"use client";

import { Button, Card, CardContent, Chip, Collapse } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
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
          <CheckCircleOutlineIcon className="text-gtm-success" sx={{ fontSize: 16 }} />
        ) : (
          <BlockIcon className="text-gtm-warning" sx={{ fontSize: 16 }} />
        )}
        {decision === "approved"
          ? `Approved ${paid.length} paid step${paid.length === 1 ? "" : "s"}`
          : "Skipped paid steps — free evidence only"}
      </div>
    );
  }
  return (
    <Card className="gtm-enter my-3 border-gtm-emphasis/50">
      <CardContent className="p-4 last:pb-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldOutlinedIcon fontSize="small" className="text-gtm-emphasis" />
          <span className="font-semibold">Approve paid research?</span>
          <span className="ml-auto text-xs text-gtm-muted">
            Planned by {request.planner.kind === "gemini" ? `Gemini` : "the default plan"}
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {paid.map((step) => (
            <li key={step.display} className="flex items-center justify-between gap-3 rounded-gtm bg-gtm-subtle px-3 py-2">
              <span className="text-sm">{step.reason || step.command}</span>
              <Chip size="small" variant="outlined" color={COST[step.cost].color} label={step.estimate || COST[step.cost].label} className="shrink-0" />
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setShowCommands((s) => !s)} className="mt-2 text-xs text-gtm-muted underline-offset-2 hover:underline">
          {showCommands ? "Hide" : "Show"} exact commands
        </button>
        <Collapse in={showCommands}>
          <div className="mt-1 flex flex-col gap-1">
            {request.steps.map((step) => (
              <code key={step.display} className="block truncate font-gtm-mono text-caption text-gtm-muted" title={step.display}>
                {step.executed ? "✓ " : "• "}
                {step.display}
              </code>
            ))}
          </div>
        </Collapse>
        <p className="mt-3 text-sm">{request.estimate}</p>
        <p className="mt-1 text-xs text-gtm-muted">{request.note}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="contained" disabled={disabled} onClick={() => onDecide("approved")} className="rounded-full">
            Approve and run
          </Button>
          <Button variant="outlined" color="inherit" disabled={disabled} onClick={() => onDecide("declined")} className="rounded-full border-gtm-border">
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
        <div key={q.id} className="gtm-enter">
          <p className="mb-2 text-body font-medium">{q.prompt}</p>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => {
              const selected = picked[q.id] === opt.id;
              return (
                <Button
                  key={opt.id}
                  variant={selected ? "contained" : "outlined"}
                  color="inherit"
                  disabled={disabled || (Boolean(picked[q.id]) && !selected)}
                  onClick={() => onPick(q.id, opt.id)}
                  className={`rounded-full ${selected ? "bg-gtm-text text-gtm-bg" : "border-gtm-border"}`}
                  startIcon={selected ? <CheckCircleOutlineIcon /> : undefined}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
