import "server-only";

// Endpoint misuse limits (docs/specs/09-guardrails.md G7). The rate limit lives in memory per
// server instance; a shared deployment needs per-user ids and a shared store.

const WINDOW_MS = 5 * 60_000;
const MAX_TURNS = 30;
const MAX_CLIENTS = 1000;
const hits = new Map<string, number[]>();

/** Rejects cross-site and non-JSON requests, so another website can't drive the app (and its credits). */
export function crossSiteReason(request: Request): string | null {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return "Send the request as JSON.";
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return "Cross-site requests are not allowed.";
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!host || originHost !== host) return "Cross-site requests are not allowed.";
  }
  return null;
}

/** Seconds until the client may retry, or 0 when the request is within the limit. */
export function rateLimitRetryAfter(request: Request, now = Date.now()): number {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const recent = (hits.get(client) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_TURNS) {
    hits.set(client, recent);
    return Math.ceil((WINDOW_MS - (now - recent[0]!)) / 1000);
  }
  recent.push(now);
  hits.set(client, recent);
  if (hits.size > MAX_CLIENTS) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  return 0;
}
