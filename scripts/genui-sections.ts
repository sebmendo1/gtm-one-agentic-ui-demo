/**
 * GenUI section counter across common searches: how many views each reply shows (limit 3), and why
 * candidates were left out. Jev is real; Gemini is stubbed to fail, so plans and replies use the
 * deterministic fallbacks while Jev still decides every section, including the custom view.
 *
 *   npm run eval:genui
 */
process.env.GOOGLE_GENERATIVE_AI_API_KEY = "mock-key";
process.env.GTM_DATA_SOURCE = "fixtures";

import type { GenerateResponse, TurnContext } from "../src/lib/spec";

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("generativelanguage.googleapis.com")) return realFetch(input, init);
  return new Response(JSON.stringify({ error: { code: 400, message: "eval stub", status: "INVALID_ARGUMENT" } }), { status: 400 });
};

const COMMON = [
  "Account brief on Snowflake",
  "Give me a brief on Stripe before my call",
  "Who is on the buying committee at Snowflake?",
  "What is Snowflake researching right now?",
  "Why should I reach out to Stripe now?",
  "Score Snowflake against our ICP",
  "What tech stack does Stripe use?",
  "How do we stack up against competitors at Snowflake?",
  "Tell me about Jordan Lee at Snowflake",
  "Show my GTM context",
  "Draft an intro email to Alex Chen at Stripe",
  "What changed at Stripe recently?",
];

const EMPTY: TurnContext = { history: [], entity: null };
const VERBOSE = process.argv.includes("--verbose");

async function settle(description: string): Promise<GenerateResponse> {
  const { runTurn } = await import("../src/lib/harness/run");
  const clarifications: Record<string, string> = {};
  let result = await runTurn({ description, clarifications, approval: null, context: EMPTY });
  for (let i = 0; i < 3; i++) {
    if (result.status === "needs_questions") {
      for (const q of result.questions) clarifications[q.id] = q.options[0]!.id;
      result = await runTurn({ description, clarifications, approval: null, context: EMPTY });
    } else if (result.status === "needs_approval") {
      const { estimate: _e, note: _n, source: _s, ...rest } = result.approval;
      void _e;
      void _n;
      void _s;
      result = await runTurn({ description, clarifications, approval: { ...rest, decision: "approved" }, context: EMPTY });
    } else break;
  }
  return result;
}

async function main() {
  const console_info = console.info;
  console.info = () => {};
  const { MAX_SECTIONS } = await import("../src/lib/message");
  const histogram = new Map<number, number>();
  const rows: string[] = [];
  for (const description of COMMON) {
    const result = await settle(description);
    if (result.status !== "ready") {
      rows.push(`  ?  ${description} — stopped at ${result.status}`);
      continue;
    }
    const s = result.trace.ui?.sections;
    const shown = s?.shown ?? 0;
    histogram.set(shown, (histogram.get(shown) ?? 0) + 1);
    const views = [...Object.keys(result.message.placements), ...(result.message.compose ? ["compose"] : [])];
    const keeps = (result.trace.ui?.picks ?? [])
      .filter((p) => p.placement !== "omit")
      .sort((a, b) => b.keep - a.keep)
      .map((p) => `${p.id} ${p.placement} ${p.keep.toFixed(2)}`);
    const mode = result.trace.ui?.mode.choice ?? (result.message.notFound ? "not found" : "no UI decision");
    rows.push(`  ${shown}  ${description} — ${result.trace.job.choice}, ${mode}${views.length ? ` [${views.join(", ")}]` : ""}`);
    if (VERBOSE) rows.push(`       needs ≥2/3 views: ${s?.need?.slice(1).join(" / ") ?? "—"} · wanted: ${keeps.join(" · ") || "—"}`);
  }
  console.info = console_info;

  const total = [...histogram.values()].reduce((a, b) => a + b, 0);
  console.log("Sections per reply (limit 3):\n");
  console.log(rows.join("\n"));
  console.log("\nHistogram:");
  for (let n = 0; n <= MAX_SECTIONS; n++) {
    const count = histogram.get(n) ?? 0;
    console.log(`  ${n} section${n === 1 ? " " : "s"}  ${"█".repeat(count)} ${count}`);
  }
  const atMostOne = (histogram.get(0) ?? 0) + (histogram.get(1) ?? 0);
  const over = [...histogram.entries()].filter(([n]) => n > MAX_SECTIONS).reduce((a, [, c]) => a + c, 0);
  const average = total ? [...histogram.entries()].reduce((a, [n, c]) => a + n * c, 0) / total : 0;
  console.log(`\n${atMostOne}/${total} replies show at most one section · average ${average.toFixed(2)} · ${over} over the limit`);
  if (over > 0 || atMostOne * 2 <= total) {
    console.log("FAIL  most common searches should show one section, and none more than 3");
    process.exitCode = 1;
  } else {
    console.log("PASS  most common searches show one section, and none more than 3");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
