"use client";

import { Button, Card, CardContent, Chip, Collapse } from "@mui/material";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { ArrowRightIcon, CheckCircleIcon, CheckIcon, NoSymbolIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import type { ApprovalDecision, ApprovalRequest, ClarifyingQuestion } from "@/lib/spec";

const COST: Record<ApprovalRequest["steps"][number]["cost"], { label: string; color: "success" | "warning" | "secondary" }> = {
  free: { label: "Free", color: "success" },
  data: { label: "Data credits", color: "warning" },
  ai: { label: "AI credits", color: "secondary" },
};

/** Inline consent for paid GTM CLI steps; collapses to a one-line receipt once decided. */
export function ApprovalPrompt({
  request,
  decision,
  disabled,
  onDecide,
}: {
  request: ApprovalRequest;
  decision: ApprovalDecision["decision"] | null;
  disabled: boolean;
  onDecide: (decision: ApprovalDecision["decision"]) => void;
}) {
  const [showCommands, setShowCommands] = useState(false);
  const paid = request.steps.filter((s) => !s.executed);
  if (decision) {
    return (
      <div className="my-2 flex items-center gap-2 text-meta text-gtm-secondary">
        {decision === "approved" ? (
          <CheckCircleIcon className="size-4 text-gtm-success" />
        ) : (
          <NoSymbolIcon className="size-4 text-gtm-warning" />
        )}
        {decision === "approved"
          ? `Approved ${paid.length} paid step${paid.length === 1 ? "" : "s"}`
          : "Skipped paid steps — free evidence only"}
      </div>
    );
  }
  return (
    <Card className="gtm-enter my-3 border-gtm-emphasis/40">
      <CardContent className="p-4 last:pb-4 sm:p-5 sm:last:pb-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <ShieldCheckIcon className="size-5 text-gtm-emphasis" />
          <span className="font-semibold">Approve paid research?</span>
          <span className="text-xs text-gtm-muted max-sm:w-full max-sm:pl-7 sm:ml-auto">
            Planned by {request.planner.kind === "gemini" ? `Gemini` : "the default plan"}
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {paid.map((step) => (
            <li key={step.display} className="flex items-center justify-between gap-3 rounded-gtm bg-gtm-subtle px-3 py-2">
              <span className="min-w-0 text-sm">{step.reason || step.command}</span>
              <Chip size="small" variant="outlined" color={COST[step.cost].color} label={step.estimate || COST[step.cost].label} className="shrink-0" />
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setShowCommands((s) => !s)} className="mt-1 py-1 text-xs text-gtm-muted underline-offset-2 hover:underline pointer-coarse:py-2">
          {showCommands ? "Hide" : "Show"} exact commands
        </button>
        <Collapse in={showCommands}>
          <div className="mt-1 flex flex-col gap-1">
            {request.steps.map((step) => (
              <code key={step.display} className="block font-gtm-mono text-caption break-all text-gtm-muted sm:truncate" title={step.display}>
                {step.executed ? "✓ " : "• "}
                {step.display}
              </code>
            ))}
          </div>
        </Collapse>
        <p className="mt-3 text-sm">{request.estimate}</p>
        <p className="mt-1 text-xs text-gtm-muted">{request.note}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="contained" disabled={disabled} onClick={() => onDecide("approved")} className="whitespace-nowrap max-sm:flex-1">
            Approve and run
          </Button>
          <Button variant="outlined" color="inherit" disabled={disabled} onClick={() => onDecide("declined")} className="border-gtm-border whitespace-nowrap max-sm:flex-1">
            Skip paid steps
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** One clarifying question as tappable options; the picked option stays highlighted. */
export function ChoicePrompt({
  questions,
  picked,
  disabled,
  onPick,
}: {
  questions: ClarifyingQuestion[];
  picked: Record<string, string>;
  disabled: boolean;
  onPick: (questionId: string, optionId: string) => void;
}) {
  return (
    <div className="my-3 flex flex-col gap-3">
      {questions.map((q) => (
        <fieldset key={q.id} className="gtm-enter rounded-gtm-xl border border-gtm-border p-1.5">
          <legend className="sr-only">{q.prompt}</legend>
          <p className="px-2.5 pt-2 pb-2 text-body font-medium" aria-hidden>
            {q.prompt}
          </p>
          <ul className="flex flex-col gap-px">
            {q.options.map((opt, i) => {
              const selected = picked[q.id] === opt.id;
              const off = disabled || (Boolean(picked[q.id]) && !selected);
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    disabled={off}
                    aria-pressed={selected}
                    onClick={() => onPick(q.id, opt.id)}
                    className={`group/opt flex min-h-10 w-full items-center gap-3 rounded-gtm px-2.5 py-2 text-left text-sm transition-colors ${selected ? "bg-gtm-selected font-medium" : "enabled:hover:bg-gtm-hover"} ${off && !selected ? "text-gtm-muted" : "text-gtm-text"}`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md text-caption font-medium tabular-nums ${selected ? "bg-gtm-text text-gtm-bg" : "bg-gtm-selected text-gtm-secondary"}`}
                      aria-hidden
                    >
                      {selected ? <CheckIcon className="size-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{opt.label}</span>
                    {!off && !selected && (
                      <ArrowRightIcon className="size-4 shrink-0 text-gtm-muted opacity-0 transition-opacity group-hover/opt:opacity-100 pointer-coarse:opacity-100" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
