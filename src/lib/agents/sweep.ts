import "server-only";
import { agentDisplayName, detectTriggers } from "./catalog";
import { runAgentCandidate } from "./runner";
import type { AgentStreamEvent, SweepInput } from "./types";

export async function runSweep(input: SweepInput, emit: (event: AgentStreamEvent) => void): Promise<void> {
  const candidates = detectTriggers(input);
  emit({ type: "activity", label: "Checking Calendar, Gmail and ZoomInfo signals" });

  let autopilotLeft = input.autopilotLeft ?? input.budget.dataCreditsPerDay;
  for (const candidate of candidates) {
    const target = candidate.entity.company ?? candidate.entity.contact ?? "your accounts";
    emit({ type: "activity", label: `${agentDisplayName(candidate.agentId)} · ${target}` });
    const run = await runAgentCandidate(candidate, { ...input, autopilotLeft }, crypto.randomUUID());
    autopilotLeft -= run.creditsUsed ?? 0;
    emit({ type: "agent_run", run });
  }
  emit({ type: "done" });
}

export function sweepInputFromBody(body: unknown): SweepInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const now = typeof b.now === "number" ? b.now : Date.now();
  const watchlist = Array.isArray(b.watchlist) ? b.watchlist.filter((x): x is string => typeof x === "string").slice(0, 20) : [];
  const seenRunKeys = Array.isArray(b.seenRunKeys) ? b.seenRunKeys.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  const mappedAccounts = Array.isArray(b.mappedAccounts) ? b.mappedAccounts.filter((x): x is string => typeof x === "string").slice(0, 20) : [];
  const connections = (b.connections ?? {}) as SweepInput["connections"];
  const budget = (b.budget ?? {}) as SweepInput["budget"];
  return {
    now,
    autopilotLeft: typeof b.autopilotLeft === "number" ? Math.max(0, Math.min(50, b.autopilotLeft)) : undefined,
    watchlist,
    seenRunKeys,
    mappedAccounts,
    connections: {
      google: connections.google === "connected" ? "connected" : connections.google === "locked" ? "locked" : "disconnected",
      salesforce: connections.salesforce === "connected" ? "connected" : connections.salesforce === "locked" ? "locked" : "disconnected",
    },
    budget: {
      dataCreditsPerDay: typeof budget.dataCreditsPerDay === "number" ? Math.min(50, Math.max(0, budget.dataCreditsPerDay)) : 10,
      allowDataAutopilot: Boolean(budget.allowDataAutopilot),
    },
  };
}
