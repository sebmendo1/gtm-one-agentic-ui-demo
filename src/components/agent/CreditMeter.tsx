"use client";

import type { Workspace } from "@/lib/agents/types";

export function CreditMeter({ workspace, compact }: { workspace: Workspace; compact?: boolean }) {
  const dataPct = Math.round((workspace.credits.data / 1000) * 100);
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center justify-between gap-2 text-xs text-gtm-muted">
        <span>Data credits</span>
        <span className="text-gtm-secondary tabular-nums">{workspace.credits.data.toLocaleString("en-US")} / 1,000</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-gtm-selected" role="meter" aria-label="Data credits left" aria-valuenow={dataPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gtm-text transition-all" style={{ width: `${dataPct}%` }} />
      </div>
      {!compact && workspace.budget.allowDataAutopilot && (
        <p className="text-caption text-gtm-muted">
          Autopilot: up to {workspace.budget.dataCreditsPerDay} data credits/day without asking.
        </p>
      )}
    </div>
  );
}
