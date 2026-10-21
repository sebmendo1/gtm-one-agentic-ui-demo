/**
 * Times a real chat turn stage by stage (live Typesafe + Gemini, demo or CLI data).
 *   npx tsx --env-file=.env.local --conditions=react-server scripts/profile-turn.ts ["request"]
 */
import type { StreamEvent, TurnContext } from "../src/lib/spec";

const EMPTY: TurnContext = { history: [], entity: null, carry: null };

/** Logs each Gemini HTTP call: duration, status, and thinking vs. output tokens. */
function traceGemini() {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("generativelanguage.googleapis.com")) return original(input, init);
    const started = Date.now();
    const res = await original(input, init);
    const method = url.split(":").pop()?.split("?")[0];
    const head = `[gemini] ${method} ${res.status} headers ${Date.now() - started}ms`;
    if (method === "streamGenerateContent") {
      console.log(head);
      return res;
    }
    const body = await res.clone().text();
    if (!res.ok) console.log(`${head} ${body.replace(/\s+/g, " ").slice(0, 400)}`);
    const parsed = JSON.parse(body) as {
      usageMetadata?: Record<string, number>;
      candidates?: { content?: { parts?: { functionCall?: { name: string; args: unknown } }[] } }[];
    };
    const usage = parsed.usageMetadata ?? {};
    const calls = (parsed.candidates?.[0]?.content?.parts ?? []).flatMap((p) => (p.functionCall ? [`${p.functionCall.name}(${JSON.stringify(p.functionCall.args)})`] : []));
    console.log(`${head} body ${Date.now() - started}ms thoughts=${usage.thoughtsTokenCount ?? 0} out=${usage.candidatesTokenCount ?? 0} in=${usage.promptTokenCount ?? 0}${calls.length ? ` calls ${calls.join(", ")}` : ""}`);
    return res;
  };
}

async function main() {
  traceGemini();
  const { runTurn } = await import("../src/lib/harness/run");
  const description = process.argv[2] ?? "Give me an account brief on Snowflake before my call";

  const timed = async (label: string, input: Parameters<typeof runTurn>[0]) => {
    const started = Date.now();
    let firstDelta: number | null = null;
    const marks: string[] = [];
    const out = await runTurn(input, (e: StreamEvent) => {
      const at = ((Date.now() - started) / 1000).toFixed(2).padStart(6);
      if (e.type === "delta") {
        if (firstDelta === null) {
          firstDelta = Date.now() - started;
          marks.push(`${at}s  first text`);
        }
        return;
      }
      if (e.type === "activity" || e.type === "progress") marks.push(`${at}s  ${e.type}: ${e.label}`);
      else if (e.type === "step") marks.push(`${at}s  step ${e.step.command} ${e.step.status} (${e.step.ms ?? "?"}ms)`);
      else marks.push(`${at}s  ${e.type}`);
    });
    const total = Date.now() - started;
    console.log(`\n=== ${label}: ${out.status} in ${(total / 1000).toFixed(2)}s (first text ${firstDelta === null ? "—" : `${(firstDelta / 1000).toFixed(2)}s`})`);
    for (const m of marks) console.log(m);
    if ("trace" in out) console.log(`model: ${out.trace.model}`);
    if (out.status === "needs_approval") console.log(out.approval.steps.map((s) => `  plan: ${s.display}`).join("\n"));
    if (out.status === "ready" && process.env.SHOW_REPLY) console.log(`\n${out.message.markdown}`);
    return out;
  };

  const first = await timed("turn 1", { description, clarifications: {}, approval: null, context: EMPTY });
  if (first.status === "needs_approval") {
    const { estimate: _e, note: _n, source: _s, ...rest } = first.approval;
    void _e; void _n; void _s;
    await timed("turn 2 (approved)", { description, clarifications: {}, approval: { ...rest, decision: "approved" }, context: EMPTY });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
