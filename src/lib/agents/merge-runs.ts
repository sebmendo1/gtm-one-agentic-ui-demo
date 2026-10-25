import type { AgentRun } from "./types";

export function mergeRuns(existing: AgentRun[], incoming: AgentRun[]): AgentRun[] {
  const byKey = new Map(existing.map((r) => [r.runKey, r]));
  for (const run of incoming) {
    if (!byKey.has(run.runKey)) byKey.set(run.runKey, run);
  }
  return [...byKey.values()].sort((a, b) => b.createdAt - a.createdAt);
}
