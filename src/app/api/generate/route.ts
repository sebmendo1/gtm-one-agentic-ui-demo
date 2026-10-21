import { AuthenticationError, TypeSafeError } from "@typesafe-ai/sdk";
import { isGtmJob, runTurn } from "@/lib/harness/run";
import { crossSiteReason, rateLimitRetryAfter } from "@/lib/request-guard";
import type { ApprovalDecision, EntityRef, HistoryEntry, SignedEvidence, StreamEvent, TurnContext } from "@/lib/spec";

const MAX_LENGTH = 2000;
const MAX_HISTORY = 8;
const MAX_HISTORY_TEXT = 1500;

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
}

function parseEntity(value: unknown): EntityRef {
  const entity = (value ?? {}) as Record<string, unknown>;
  return {
    company: nullableString(entity.company),
    contact: nullableString(entity.contact),
    domain: nullableString(entity.domain),
    competitor: nullableString(entity.competitor),
  };
}

const MAX_EVIDENCE_CHARS = 400_000;

/** Shape check only; the harness verifies the signature before trusting any of it. */
function parseSigned(value: unknown): SignedEvidence | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.payload !== "string" || typeof v.sig !== "string") return null;
  if (v.payload.length > MAX_EVIDENCE_CHARS || v.sig.length > 100) return null;
  return { payload: v.payload, sig: v.sig };
}

/** Steps are re-sanitized against the allowlist inside the harness; this only checks the envelope. */
function parseApproval(value: unknown): ApprovalDecision | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  if (a.decision !== "approved" && a.decision !== "declined") return null;
  if (!isGtmJob(a.job) || !Array.isArray(a.steps)) return null;
  const planner = (a.planner ?? {}) as Record<string, unknown>;
  const probabilities = Object.fromEntries(
    Object.entries((a.jobProbabilities ?? {}) as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
  return {
    decision: a.decision,
    job: a.job,
    jobConfidence: typeof a.jobConfidence === "number" ? a.jobConfidence : 0,
    jobProbabilities: probabilities,
    entity: parseEntity(a.entity),
    steps: a.steps.slice(0, 12) as ApprovalDecision["steps"],
    planner: {
      kind: planner.kind === "gemini" ? "gemini" : "default",
      model: nullableString(planner.model),
    },
    evidence: parseSigned(a.evidence) ?? undefined,
  };
}

function parseContext(value: unknown): TurnContext {
  const c = (value ?? {}) as Record<string, unknown>;
  const history: HistoryEntry[] = (Array.isArray(c.history) ? c.history : [])
    .filter((h): h is { role: "user" | "assistant"; text: string } => {
      const e = h as Record<string, unknown>;
      return (e?.role === "user" || e?.role === "assistant") && typeof e.text === "string" && e.text.trim() !== "";
    })
    .slice(-MAX_HISTORY)
    .map((h) => ({ role: h.role, text: h.text.slice(0, MAX_HISTORY_TEXT) }));
  const entity = c.entity ? parseEntity(c.entity) : null;
  return {
    history,
    entity: entity && (entity.company || entity.contact || entity.domain) ? entity : null,
    carry: parseSigned(c.carry),
  };
}

function failure(error: unknown): string {
  if (error instanceof AuthenticationError) return "TypeSafe rejected the API key.";
  return error instanceof TypeSafeError ? error.message : "Something went wrong.";
}

export async function POST(request: Request): Promise<Response> {
  const crossSite = crossSiteReason(request);
  if (crossSite) return Response.json({ error: crossSite }, { status: 403 });
  const retryAfter = rateLimitRetryAfter(request);
  if (retryAfter > 0) {
    return Response.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfter / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    description?: unknown;
    clarifications?: unknown;
    approval?: unknown;
    context?: unknown;
  } | null;
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!description) return Response.json({ error: "Describe the GTM job you need." }, { status: 400 });
  if (description.length > MAX_LENGTH) {
    return Response.json({ error: `Keep it under ${MAX_LENGTH} characters.` }, { status: 400 });
  }
  if (!process.env.TYPESAFE_API_KEY) {
    return Response.json(
      {
        error: process.env.VERCEL
          ? "TYPESAFE_API_KEY is not set for this Vercel environment. Add it in Project Settings → Environment Variables and redeploy."
          : "TYPESAFE_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  const input = {
    description,
    clarifications: stringRecord(body?.clarifications),
    approval: parseApproval(body?.approval),
    context: parseContext(body?.context),
  };
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: "done", response: await runTurn(input, send) });
      } catch (error) {
        console.error(error);
        send({ type: "error", message: failure(error) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
