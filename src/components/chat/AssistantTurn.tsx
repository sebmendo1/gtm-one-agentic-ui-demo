"use client";

import { Alert, Button } from "@mui/material";
import { Activity } from "./Activity";
import { Markdown } from "./Markdown";
import { MessageBody, MessageFooter } from "./MessageView";
import { ApprovalPrompt, ChoicePrompt } from "./Prompts";
import type { Turn } from "./useChat";

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-3xl bg-gtm-subtle px-4 py-3 text-body leading-relaxed whitespace-pre-wrap">{text}</div>
    </div>
  );
}

/** One assistant reply: activity, any clarification or approval asked along the way, then the message. */
export function AssistantTurn({
  turn,
  busy,
  onAnswer,
  onDecide,
  onRetry,
}: {
  turn: Turn;
  busy: boolean;
  onAnswer: (questionId: string, optionId: string) => void;
  onDecide: (decision: "approved" | "declined") => void;
  onRetry: () => void;
}) {
  const live = turn.status === "streaming";
  const current = <Activity activity={turn.activity} trace={turn.trace} live={live && !turn.draft} />;
  const promptPending = (turn.question && !turn.question.prelude) || (turn.approval && !turn.approval.prelude);
  return (
    <div className="flex flex-col">
      {turn.question && (
        <div className="gtm-enter">
          {turn.question.prelude ? <Activity {...turn.question.prelude} live={false} /> : current}
          <Markdown markdown={turn.question.lead} />
          <ChoicePrompt
            questions={turn.question.questions}
            picked={turn.clarifications}
            disabled={busy || turn.status !== "needs_input"}
            onPick={onAnswer}
          />
        </div>
      )}

      {turn.approval && (
        <div className="gtm-enter">
          {turn.approval.prelude ? <Activity {...turn.approval.prelude} live={false} /> : current}
          <Markdown markdown={turn.approval.lead} />
          <ApprovalPrompt
            request={turn.approval.request}
            decision={turn.decision}
            disabled={busy || turn.status !== "needs_approval"}
            onDecide={onDecide}
          />
        </div>
      )}

      {!promptPending && current}

      {live && turn.frame && <MessageBody markdown={turn.draft} frame={turn.frame} streaming />}

      {turn.status === "ready" && turn.message && (
        <>
          <MessageBody markdown={turn.message.markdown} frame={turn.message} streaming={false} />
          <MessageFooter message={turn.message} onRetry={onRetry} />
        </>
      )}

      {turn.status === "error" && (
        <Alert
          severity="error"
          variant="outlined"
          action={
            <Button color="inherit" size="small" onClick={onRetry} disabled={busy}>
              Retry
            </Button>
          }
        >
          {turn.error}
        </Alert>
      )}
    </div>
  );
}
