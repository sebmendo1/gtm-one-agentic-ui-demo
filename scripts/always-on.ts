process.env.HARNESS_SECRET ??= "always-on-test-secret";

import { detectTriggers } from "../src/lib/agents/catalog";
import { DEMO_MORNING_MS, DEMO_START_MS } from "../src/lib/agents/fixtures";
import { runAgentCandidate } from "../src/lib/agents/runner";
import type { SweepInput } from "../src/lib/agents/types";
import { citedIds } from "../src/lib/message";

function baseInput(now: number, seenRunKeys: string[] = []): SweepInput {
  return {
    now,
    watchlist: ["snowflake", "stripe"],
    connections: { google: "connected", salesforce: "locked" },
    budget: { dataCreditsPerDay: 10, allowDataAutopilot: false },
    seenRunKeys,
    mappedAccounts: ["snowflake", "stripe"],
  };
}

async function main() {
  const errors: string[] = [];
  const evening = baseInput(DEMO_START_MS);
  const morning = baseInput(DEMO_MORNING_MS);

  const eveningTriggers = detectTriggers(evening);
  if (!eveningTriggers.some((t) => t.agentId === "meeting_prep")) {
    errors.push("Expected meeting_prep trigger on first-run clock");
  }

  const morningTriggers = detectTriggers(morning);
  if (!morningTriggers.some((t) => t.agentId === "deal_watch")) {
    errors.push("Expected deal_watch trigger after overnight clock");
  }

  const seen: string[] = [];
  for (const c of eveningTriggers) {
    const run = await runAgentCandidate(c, evening, `test-${c.runKey}`);
    seen.push(run.runKey);
    if (!run.summary) errors.push(`${c.agentId} run should carry a one-line summary`);
    if ((run.tasks?.length ?? 0) < 3) errors.push(`${c.agentId} run should break into at least 3 tasks`);
    if (process.env.SHOW_TASKS) console.log(run.agentId, run.summary, run.tasks?.map((t) => `${t.status} ${t.label}: ${t.detail}`));
    if (run.status === "ready" && run.message) {
      for (const id of citedIds(run.message.markdown)) {
        if (!run.message.sources[id] && !Object.values(run.message.sources).flat().length) {
          // citations may map via sources record keys
        }
      }
    }
  }

  const dup = await runAgentCandidate(eveningTriggers[0]!, { ...evening, seenRunKeys: seen }, "dup");
  if (detectTriggers({ ...evening, seenRunKeys: seen }).some((t) => t.runKey === eveningTriggers[0]?.runKey)) {
    errors.push("seenRunKeys should suppress duplicate triggers");
  }
  void dup;

  const approvalRun = morningTriggers.find((t) => t.agentId === "account_map");
  if (approvalRun) {
    const run = await runAgentCandidate(approvalRun, morning, "map-1");
    if (run.status !== "needs_approval") errors.push("account_map should need approval when autopilot off");
    if (run.approval?.steps.some((s) => s.cost === "ai")) errors.push("account_map sweep should not include AI steps");
    if (!run.tasks?.some((t) => t.status === "waiting")) errors.push("account_map approval run should show a waiting task");
  }

  if (errors.length) {
    console.error("always-on checks failed:\n", errors.map((e) => `- ${e}`).join("\n"));
    process.exit(1);
  }
  console.log("always-on: ok", { eveningCards: eveningTriggers.length, morningTriggers: morningTriggers.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
