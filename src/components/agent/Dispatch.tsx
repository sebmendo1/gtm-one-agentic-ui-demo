"use client";

import { CircularProgress } from "@mui/material";
import { CheckIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { agentDisplayName } from "@/lib/agents/catalog";
import { formatTime } from "@/lib/agents/time";
import type { AgentRun, SourceKind } from "@/lib/agents/types";
import { runTitle } from "@/lib/agents/work";
import { AgentAvatar } from "./AgentAvatar";
import { AgentMessage } from "./AgentMessage";
import { RunResult, type RunHandlers } from "./RunResult";
import type { SweepLive } from "./useWorkspace";

const SOURCE_ORDER: SourceKind[] = ["calendar", "gmail", "zoominfo"];
const SOURCE_WORDS: Record<SourceKind, string> = { calendar: "calendar", gmail: "inbox", zoominfo: "ZoomInfo signals" };
const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six"];

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

function intro(runs: AgentRun[], working: boolean): string {
  if (working && !runs.length) return "Checking your calendar, inbox and accounts, and handing the work to specialists.";
  const sources = SOURCE_ORDER.filter((s) => runs.some((r) => r.trigger.sources.includes(s))).map((s) => SOURCE_WORDS[s]);
  const n = runs.length;
  const who = `${COUNT_WORDS[n] ?? n} ${n === 1 ? "specialist" : "specialists"} picked up work`;
  const waiting = runs.filter((r) => r.status === "needs_approval").length;
  const ask = waiting ? `; ${waiting === 1 ? "one needs" : `${COUNT_WORDS[waiting]?.toLowerCase() ?? waiting} need`} you` : "";
  return `Checked your ${listWords(sources)}. ${who}${ask}.`;
}

function StatusMark({ run }: { run: AgentRun }) {
  if (run.status === "needs_approval") return <span className="size-2 rounded-full bg-gtm-warning" role="img" aria-label="Needs you" />;
  if (run.status === "done") return <CheckIcon className="size-4 text-gtm-success" role="img" aria-label="Done" />;
  if (!run.seenAt) return <span className="size-2 rounded-full bg-gtm-emphasis" role="img" aria-label="New" />;
  return <span className="size-2 rounded-full border border-gtm-muted/60" role="img" aria-label="Ready" />;
}

function RowText({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-2">
      <span className="block shrink-0 text-sm font-medium text-gtm-text">{name}</span>
      {children}
    </span>
  );
}

function SubAgentRow({
  run,
  now,
  open,
  highlight,
  onToggle,
  handlers,
}: {
  run: AgentRun;
  now: number;
  open: boolean;
  highlight: boolean;
  onToggle: () => void;
  handlers: RunHandlers;
}) {
  const approval = run.status === "needs_approval";
  const tasks = run.tasks?.length ?? 0;
  return (
    <li id={`run-${run.id}`} className={`gtm-enter scroll-mt-4 rounded-gtm-xl ${highlight ? "gtm-highlight" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-gtm-lg px-2 py-2 text-left transition-colors hover:bg-gtm-subtle"
      >
        <span className="flex w-4 shrink-0 justify-center">
          <StatusMark run={run} />
        </span>
        <AgentAvatar agent={run.agentId} size={24} />
        <RowText name={agentDisplayName(run.agentId)}>
          <span className="block truncate text-sm text-gtm-secondary">{run.summary ?? runTitle(run)}</span>
        </RowText>
        <span className={`shrink-0 text-meta tabular-nums ${approval ? "font-medium text-amber-700 dark:text-amber-300" : "text-gtm-muted"}`}>
          {approval ? "Needs you" : tasks ? `${tasks} tasks` : formatTime(run.createdAt)}
        </span>
        <ChevronRightIcon className={`size-4 shrink-0 text-gtm-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="gtm-enter ml-4 border-l border-gtm-border pt-1 pb-3 pl-5">
          <p className="mb-3 text-meta text-gtm-muted">{run.trigger.line.replace(/\*\*/g, "")}</p>
          <RunResult run={run} now={now} handlers={handlers} />
        </div>
      )}
    </li>
  );
}

function LiveRow({ live }: { live: SweepLive | null }) {
  const task = live?.run.tasks?.[live.step];
  const total = live?.run.tasks?.length ?? 0;
  return (
    <li className="flex items-center gap-3 px-2 py-2" aria-live="polite">
      <span className="flex w-4 shrink-0 justify-center text-gtm-muted">
        <CircularProgress size={12} thickness={6} color="inherit" aria-label="Working" />
      </span>
      <AgentAvatar agent={live?.run.agentId ?? "hub"} size={24} />
      <RowText name={live ? agentDisplayName(live.run.agentId) : "Go-to-agent"}>
        <span key={task?.id ?? "start"} className="gtm-shimmer block truncate text-sm">
          {task ? `${task.label}…` : "Reading your sources…"}
        </span>
      </RowText>
      {live && total > 0 && (
        <span className="shrink-0 text-meta text-gtm-muted tabular-nums">
          {live.step + 1} of {total}
        </span>
      )}
    </li>
  );
}

/** One Go-to-agent message per sweep: what it checked, then a row per specialist it handed work to. */
export function Dispatch({
  at,
  runs,
  now,
  working,
  live,
  isOpen,
  highlightId,
  onToggle,
  handlersFor,
}: {
  at: number;
  runs: AgentRun[];
  now: number;
  working: boolean;
  live: SweepLive | null;
  isOpen: (run: AgentRun) => boolean;
  highlightId: string | null;
  onToggle: (run: AgentRun) => void;
  handlersFor: (run: AgentRun) => RunHandlers;
}) {
  return (
    <AgentMessage name="Go-to-agent" time={formatTime(at)} pulse={working}>
      <p className="text-body text-pretty text-gtm-text">{intro(runs, working)}</p>
      <ul className="-mx-2 mt-3 flex flex-col gap-0.5" aria-label="Specialists">
        {runs.map((run) => (
          <SubAgentRow
            key={run.id}
            run={run}
            now={now}
            open={isOpen(run)}
            highlight={highlightId === run.id}
            onToggle={() => onToggle(run)}
            handlers={handlersFor(run)}
          />
        ))}
        {working && (live || !runs.length) && <LiveRow live={live} />}
      </ul>
    </AgentMessage>
  );
}
