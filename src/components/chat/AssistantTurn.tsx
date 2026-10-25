"use client";

import { Alert, Button } from "@mui/material";
import { useCallback, useState } from "react";
import { Activity } from "./Activity";
import { Markdown } from "./Markdown";
import { MessageBody, MessageFooter } from "./MessageView";
import { ApprovalPrompt, ChoicePrompt } from "./Prompts";
import { isFreshReply, markPlayed } from "./stream/fresh";
import { useSimulatedStream } from "./stream/useSimulatedStream";
import type { Turn } from "./useChat";

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-3xl bg-gtm-subtle px-4 py-2.5 text-body break-words whitespace-pre-wrap sm:max-w-[70%]">{text}</div>
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
  const ready = turn.status === "ready" ? turn.message : null;
  const [fresh] = useState(() => turn.origin !== "agent" && isFreshReply(turn.id, turn.createdAt));
  const [settled, setSettled] = useState(!fresh);
  const onSettled = useCallback(() => {
    markPlayed(turn.id);
    setSettled(true);
  }, [turn.id]);
  // A template reply arrives whole in `done`; it plays back through the simulated stream.
  const replay = useSimulatedStream(ready?.markdown ?? "", fresh && ready?.writer.kind === "template");
  const bodyFrame = live ? turn.frame : ready;
  const source = live ? turn.draft : ready?.writer.kind === "template" ? replay.text : (ready?.markdown ?? "");
  const sourceDone = !live && (ready?.writer.kind !== "template" || replay.done);

  const seededIdle = turn.origin === "agent" && !live && turn.activity.steps.length === 0;
  const current = seededIdle ? null : <Activity activity={turn.activity} trace={turn.trace} live={live && !turn.draft} />;
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

      {bodyFrame && <MessageBody markdown={source} frame={bodyFrame} live={fresh} done={sourceDone} onSettled={onSettled} />}

      {ready && settled && (
        <div className={fresh ? "gtm-enter" : undefined}>
          <MessageFooter message={ready} onRetry={onRetry} />
        </div>
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
