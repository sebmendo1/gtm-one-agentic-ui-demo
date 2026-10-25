import { runSweep, sweepInputFromBody } from "@/lib/agents/sweep";
import type { AgentStreamEvent } from "@/lib/agents/types";
import { crossSiteReason, rateLimitRetryAfter } from "@/lib/request-guard";

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

  const body = await request.json().catch(() => null);
  const input = sweepInputFromBody(body);
  if (!input) return Response.json({ error: "Invalid sweep payload." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runSweep(input, send);
      } catch (error) {
        console.error(error);
        send({ type: "error", message: error instanceof Error ? error.message : "Sweep failed." });
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
