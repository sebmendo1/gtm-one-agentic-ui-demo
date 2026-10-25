"use client";

import { Button, Fab, Snackbar, Zoom } from "@mui/material";
import { ArrowDownIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { parseHubIntent } from "@/lib/agents/intents";
import { dayLabel } from "@/lib/agents/time";
import { nudgeContent } from "@/lib/agents/nudges";
import type { AgentNudge, AgentRun, AgentRunStatus, Workspace } from "@/lib/agents/types";
import { hubSuggestions, isVisible } from "@/lib/agents/work";
import type { ApprovalDecision } from "@/lib/spec";
import { AssistantTurn, UserBubble } from "@/components/chat/AssistantTurn";
import { Composer } from "@/components/chat/Composer";
import { StreamedMarkdown } from "@/components/chat/stream/StreamedMarkdown";
import { useStickToBottom } from "@/components/chat/stream/useStickToBottom";
import type { Conversation, Turn } from "@/components/chat/useChat";
import { AgentMessage } from "./AgentMessage";
import { DayDivider } from "./DayDivider";
import { Dispatch } from "./Dispatch";
import { Nudge } from "./Nudge";
import { runPrimaryAction, type RunHandlers } from "./RunResult";
import { SubAgentSheet } from "./SubAgentSheet";
import { SweepError } from "./SweepStatus";
import type { SweepLive } from "./useWorkspace";

type Item =
  | { kind: "day"; label: string }
  | { kind: "batch"; at: number; runs: AgentRun[] }
  | { kind: "turn"; turn: Turn }
  | { kind: "nudge"; nudge: AgentNudge };

type Toast = { message: string; undo?: () => void };

/** Runs from one sweep share its demo time, so consecutive runs with the same `createdAt` form one dispatch. */
function timeline(runs: AgentRun[], turns: Turn[], nudges: AgentNudge[], now: number): Item[] {
  const entries = [
    ...runs.map((run) => ({ at: run.receivedAt ?? 0, run, turn: null, nudge: null })),
    ...turns.map((turn) => ({ at: turn.createdAt ?? 0, run: null, turn, nudge: null })),
    ...nudges.map((nudge) => ({ at: nudge.receivedAt, run: null, turn: null, nudge })),
  ].sort((a, b) => a.at - b.at);
  const out: Item[] = [];
  let lastDay = "";
  for (const { run, turn, nudge } of entries) {
    if (turn) {
      out.push({ kind: "turn", turn });
      continue;
    }
    if (nudge) {
      out.push({ kind: "nudge", nudge });
      continue;
    }
    const last = out.at(-1);
    if (last?.kind === "batch" && last.at === run!.createdAt) {
      last.runs.push(run!);
      continue;
    }
    const label = dayLabel(run!.createdAt, now);
    if (label !== lastDay) {
      out.push({ kind: "day", label });
      lastDay = label;
    }
    out.push({ kind: "batch", at: run!.createdAt, runs: [run!] });
  }
  return out;
}

function HubTurn({ turn, busy, onAnswer, onDecide, onRetry }: { turn: Turn; busy: boolean; onAnswer: (q: string, o: string) => void; onDecide: (d: ApprovalDecision["decision"]) => void; onRetry: () => void }) {
  const body = turn.local ? (
    <StreamedMarkdown id={turn.id} createdAt={turn.createdAt} markdown={turn.local.markdown} />
  ) : (
    <AssistantTurn turn={turn} busy={busy} onAnswer={onAnswer} onDecide={onDecide} onRetry={onRetry} />
  );
  if (!turn.prompt) {
    return (
      <AgentMessage name="Go-to-agent" pulse={turn.status === "streaming"}>
        {body}
      </AgentMessage>
    );
  }
  return (
    <div className="gtm-enter flex flex-col gap-6">
      <UserBubble text={turn.prompt} />
      {body}
    </div>
  );
}

export function GoToAgentView({
  workspace,
  hubConversation,
  sweeping,
  sweepLive,
  sweepError,
  busy,
  focus,
  onRetrySweep,
  onSendHarness,
  onLocalReply,
  onWatchlist,
  onOpenRun,
  onUpdateRun,
  onPrimary,
  onShare,
  onHubAnswer,
  onHubDecide,
  onNudge,
}: {
  workspace: Workspace;
  hubConversation: Conversation | null;
  sweeping: boolean;
  sweepLive: SweepLive | null;
  sweepError: string | null;
  busy: boolean;
  focus: { runId: string; nonce: number } | null;
  onRetrySweep: () => void;
  onSendHarness: (text: string) => void;
  onLocalReply: (prompt: string, markdown: string) => void;
  onWatchlist: (keys: string[]) => void;
  onOpenRun: (run: AgentRun) => void;
  onUpdateRun: (runId: string, update: (r: AgentRun) => AgentRun) => void;
  onPrimary: (run: AgentRun) => void;
  onShare: (run: AgentRun) => void;
  onHubAnswer: (turn: Turn, questionId: string, optionId: string) => void;
  onHubDecide: (turn: Turn, decision: ApprovalDecision["decision"]) => void;
  onNudge: (nudge: AgentNudge, choice: "accepted" | "dismissed") => void;
}) {
  const { scrollRef, contentRef, atBottom, unread, stick, detach } = useStickToBottom();
  const [toast, setToast] = useState<Toast | null>(null);
  // A row the user toggled keeps their choice until the work panel focuses it again (a newer nonce).
  const [toggled, setToggled] = useState<Record<string, { open: boolean; nonce: number }>>({});
  const [workRunId, setWorkRunId] = useState<string | null>(null);

  const turns = useMemo(() => hubConversation?.turns ?? [], [hubConversation]);
  const runs = useMemo(() => workspace.runs.filter(isVisible), [workspace.runs]);
  const items = useMemo(() => {
    const out = timeline(runs, turns, workspace.nudges, workspace.demoNow);
    if (!sweeping) return out;
    const current = out.findLast((item) => item.kind === "batch");
    if (current?.kind === "batch" && current.at === workspace.demoNow) return out;
    return [...out, { kind: "batch", at: workspace.demoNow, runs: [] } as Item];
  }, [runs, turns, workspace.nudges, workspace.demoNow, sweeping]);
  const workRun = workspace.runs.find((r) => r.id === workRunId) ?? null;

  const isOpen = (run: AgentRun) => {
    const focused = focus?.runId === run.id ? focus.nonce : -1;
    const choice = toggled[run.id];
    return choice && choice.nonce >= focused ? choice.open : focused >= 0;
  };

  useEffect(() => {
    if (!focus) return;
    detach();
    document.getElementById(`run-${focus.runId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, detach]);

  const markSeen = (run: AgentRun) => {
    if (!run.seenAt) onUpdateRun(run.id, (r) => ({ ...r, seenAt: Date.now() }));
  };

  const setAside = (run: AgentRun, status: Extract<AgentRunStatus, "snoozed" | "dismissed">) => {
    const previous = run.status;
    onUpdateRun(run.id, (r) => ({ ...r, status, seenAt: r.seenAt ?? Date.now() }));
    setToast({
      message: status === "snoozed" ? "Snoozed until tomorrow's check-in" : "Marked not useful. I'll show fewer like this.",
      undo: () => onUpdateRun(run.id, (r) => ({ ...r, status: previous })),
    });
  };

  const toggle = (run: AgentRun) => {
    const open = !isOpen(run);
    if (open) markSeen(run);
    setToggled((prev) => ({ ...prev, [run.id]: { open, nonce: focus?.nonce ?? 0 } }));
  };

  const handlersFor = (run: AgentRun): RunHandlers => ({
    onOpenThread: () => {
      markSeen(run);
      setWorkRunId(null);
      onOpenRun(run);
    },
    onPrimary: async () => {
      markSeen(run);
      const ok = await runPrimaryAction(run);
      if (ok) {
        onPrimary(run);
        setToast({ message: `${run.primaryAction.label.replace(/^Copy\s+/, "").replace(/^\w/, (c) => c.toUpperCase())} copied to your clipboard` });
      } else {
        setToast({ message: "Couldn't reach the clipboard. Open the thread to copy it." });
      }
    },
    onViewWork: () => {
      markSeen(run);
      setWorkRunId(run.id);
    },
    onSnooze: () => setAside(run, "snoozed"),
    onDismiss: () => setAside(run, "dismissed"),
    onShare: run.agentId === "meeting_prep" && run.message ? () => onShare(run) : undefined,
  });

  const suggestions = hubSuggestions(workspace);

  const send = (text: string) => {
    const intent = parseHubIntent(text, workspace);
    if (intent) {
      onLocalReply(text.trim(), intent.reply);
      if (intent.watchlist) onWatchlist(intent.watchlist);
    } else {
      onSendHarness(text);
    }
    stick();
  };

  const idle = !busy && !sweeping;

  return (
    <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-12 sm:gap-10 sm:px-6 sm:pt-8">
          {items.map((item, i) => {
            if (item.kind === "day") return <DayDivider key={`d-${item.label}-${i}`} label={item.label} />;
            if (item.kind === "nudge") {
              return (
                <Nudge
                  key={item.nudge.id}
                  nudge={item.nudge}
                  content={nudgeContent(item.nudge, workspace)}
                  onPrimary={() => onNudge(item.nudge, "accepted")}
                  onSecondary={() => onNudge(item.nudge, "dismissed")}
                />
              );
            }
            if (item.kind === "turn") {
              return (
                <HubTurn
                  key={item.turn.id}
                  turn={item.turn}
                  busy={busy}
                  onAnswer={(q, o) => onHubAnswer(item.turn, q, o)}
                  onDecide={(d) => onHubDecide(item.turn, d)}
                  onRetry={() => onSendHarness(item.turn.prompt)}
                />
              );
            }
            const working = sweeping && item.at === workspace.demoNow;
            return (
              <Dispatch
                key={`b-${item.at}`}
                at={item.at}
                runs={item.runs}
                now={workspace.demoNow}
                working={working}
                live={working ? sweepLive : null}
                isOpen={isOpen}
                highlightId={focus?.runId ?? null}
                onToggle={toggle}
                handlersFor={handlersFor}
              />
            );
          })}
          {sweepError && !sweeping && <SweepError message={sweepError} onRetry={onRetrySweep} />}
        </div>
      </div>

      <Zoom in={!atBottom}>
        <Fab
          size="small"
          aria-label="Scroll to bottom"
          onClick={() => stick("smooth")}
          className={`absolute left-1/2 z-10 size-8 min-h-0 -translate-x-1/2 border border-gtm-border bg-gtm-bg text-gtm-text shadow-sm hover:bg-gtm-subtle ${idle ? "bottom-40" : "bottom-30"} ${unread ? "gtm-pulse" : ""}`}
        >
          <ArrowDownIcon className="size-4" />
        </Fab>
      </Zoom>

      <div className="gtm-composer-fade mx-auto w-full max-w-3xl shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {idle && (
          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="list" aria-label="Suggestions">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                role="listitem"
                onClick={() => send(s)}
                className="h-8 shrink-0 rounded-full border border-gtm-border bg-gtm-bg px-3 text-meta font-medium whitespace-nowrap text-gtm-secondary transition-colors hover:bg-gtm-subtle hover:text-gtm-text pointer-coarse:h-9"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <Composer busy={busy || sweeping} placeholder="Ask about a deal, a meeting or a buyer…" shortPlaceholder="Ask about a deal…" onSend={send} />
        <p className="mt-2 text-center text-xs text-gtm-muted max-sm:hidden">Open a thread for sources and evidence. Paid research always asks first.</p>
      </div>

      <SubAgentSheet run={workRun} onClose={() => setWorkRunId(null)} handlers={workRun ? handlersFor(workRun) : null} />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.undo ? 6000 : 3000}
        onClose={(_, reason) => reason !== "clickaway" && setToast(null)}
        message={toast?.message}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        action={
          toast?.undo ? (
            <Button
              size="small"
              color="inherit"
              className="font-semibold"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Undo
            </Button>
          ) : undefined
        }
      />
    </>
  );
}
