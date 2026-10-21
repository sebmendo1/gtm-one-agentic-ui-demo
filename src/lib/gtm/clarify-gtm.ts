import type { ClarifyingQuestion } from "../spec";
import { GTM_JOBS, type GtmJob } from "./jobs";

const CLOSE = 0.2;
const CLEAR_WINNER = 0.45;

export const GTM_CLARIFICATION_CATALOG: Record<string, Omit<ClarifyingQuestion, "id">> = {
  account_brief_vs_committee: {
    prompt: "Do you want a full account brief or a buying committee map?",
    options: [
      { id: "account_brief", label: "Account research brief" },
      { id: "buying_committee", label: "Buying committee map" },
    ],
  },
  intent_vs_why_now: {
    prompt: "Should this focus on intent topics or a why-now outreach case?",
    options: [
      { id: "intent_monitor", label: "Intent monitor" },
      { id: "why_now", label: "Why now" },
    ],
  },
};

function topTwoClose(probs: Record<string, number>, a: string, b: string): boolean {
  const pa = probs[a] ?? 0;
  const pb = probs[b] ?? 0;
  return Math.abs(pa - pb) < CLOSE && Math.max(pa, pb) > 0.15;
}

function jobLabel(job: GtmJob): string {
  return GTM_JOBS[job].split(":")[0]!.trim();
}

/** One authored clarification when the job is unclear (docs/specs/04-jev-decisions.md). */
export function detectJobQuestions(
  probabilities: Record<string, number>,
  existing: Record<string, string>,
  namesAccount = false,
  vague = false,
): ClarifyingQuestion[] {
  if (existing.job) return [];
  if (vague && namesAccount && !existing.account_brief_vs_committee && !existing.intent_vs_why_now) {
    const options: GtmJob[] = ["account_brief", "buying_committee", "why_now"];
    return [{ id: "job", prompt: "What should I put together for you?", options: options.map((job) => ({ id: job, label: jobLabel(job) })) }];
  }
  if (!existing.account_brief_vs_committee && topTwoClose(probabilities, "account_brief", "buying_committee")) {
    return [{ id: "account_brief_vs_committee", ...GTM_CLARIFICATION_CATALOG.account_brief_vs_committee! }];
  }
  if (!existing.intent_vs_why_now && topTwoClose(probabilities, "intent_monitor", "why_now")) {
    return [{ id: "intent_vs_why_now", ...GTM_CLARIFICATION_CATALOG.intent_vs_why_now! }];
  }
  const ranked = (Object.keys(GTM_JOBS) as GtmJob[])
    .filter((job) => !namesAccount || job !== "gtm_context")
    .sort((a, b) => (probabilities[b] ?? 0) - (probabilities[a] ?? 0));
  const resolved = existing.account_brief_vs_committee || existing.intent_vs_why_now;
  if (!resolved && (probabilities[ranked[0]!] ?? 0) < CLEAR_WINNER) {
    const options = ranked.slice(0, 3);
    if (namesAccount && !options.includes("account_brief")) options[2] = "account_brief";
    return [
      {
        id: "job",
        prompt: "What should I put together for you?",
        options: options.map((job) => ({ id: job, label: jobLabel(job) })),
      },
    ];
  }
  return [];
}
