"use client";

import { Button, Drawer, IconButton } from "@mui/material";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { CheckIcon, ClockIcon, MinusIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import { agentDisplayName } from "@/lib/agents/catalog";
import { formatTime } from "@/lib/agents/time";
import type { AgentRun, AgentTask } from "@/lib/agents/types";
import { AgentAvatar } from "./AgentAvatar";
import { ApprovalSummary, RunBody, type RunHandlers } from "./RunResult";

const SOURCE_LABELS: Record<AgentTask["source"], string> = {
  calendar: "Google Calendar",
  gmail: "Gmail",
  zoominfo: "ZoomInfo",
  writer: "Written from the tasks above",
};

const STATUS_TEXT: Partial<Record<AgentRun["status"], string>> = {
  ready: "Ready for you",
  needs_approval: "Needs your approval",
  done: "Done",
};

function TaskIcon({ status }: { status: AgentTask["status"] }) {
  if (status === "done") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-gtm-success/15 text-emerald-700 dark:text-emerald-300">
        <CheckIcon className="size-3.5" aria-label="Done" />
      </span>
    );
  }
  if (status === "waiting") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-gtm-warning/15 text-amber-700 dark:text-amber-300">
        <ClockIcon className="size-3.5" aria-label="Waiting on you" />
      </span>
    );
  }
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-gtm-subtle text-gtm-muted">
      <MinusIcon className="size-3.5" aria-label={status === "empty" ? "Nothing found" : "Skipped"} />
    </span>
  );
}

function TaskItem({ task, last }: { task: AgentTask; last: boolean }) {
  const meta = [
    SOURCE_LABELS[task.source],
    task.cost === "data" ? "data credits" : task.cost === "ai" ? "AI credits" : null,
    task.evidenceIds.length ? `evidence ${task.evidenceIds.join(", ")}` : null,
  ].filter(Boolean);
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute top-7 bottom-1 left-[11.5px] w-px bg-gtm-border" aria-hidden />}
      <span className="relative shrink-0">
        <TaskIcon status={task.status} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium text-gtm-text">{task.label}</p>
        <p className="text-meta text-pretty text-gtm-secondary">{task.detail}</p>
        <p className="mt-1 text-caption text-gtm-muted">{meta.join(" · ")}</p>
        {task.commands.map((command) => (
          <code key={command} title={command} className="mt-1 block truncate font-gtm-mono text-caption text-gtm-muted">
            {command}
          </code>
        ))}
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h3 className="text-caption font-medium tracking-wide text-gtm-muted uppercase">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A specialist's full transcript: who handed it the job, each task it ran with its evidence, and the cited result. */
export function SubAgentSheet({ run, onClose, handlers }: { run: AgentRun | null; onClose: () => void; handlers: RunHandlers | null }) {
  const tasks = run?.tasks ?? [];
  return (
    <Drawer anchor="right" open={Boolean(run)} onClose={onClose} slotProps={{ paper: { className: "w-full max-w-[520px] bg-gtm-bg" } }}>
      {run && handlers && (
        <div className="flex h-full flex-col" role="dialog" aria-label={`${agentDisplayName(run.agentId)} work`}>
          <header className="flex shrink-0 items-center gap-3 border-b border-gtm-border px-5 py-3">
            <AgentAvatar agent={run.agentId} size={32} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-gtm-text">{agentDisplayName(run.agentId)}</h2>
              <p className="truncate text-meta text-gtm-muted">
                {[STATUS_TEXT[run.status], tasks.length ? `${tasks.length} tasks` : null, formatTime(run.createdAt)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <IconButton aria-label="Close" onClick={onClose} className="text-gtm-muted">
              <XMarkIcon className="size-5" />
            </IconButton>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
            <Section title="Assignment">
              <div className="flex gap-3">
                <AgentAvatar size={24} />
                <p className="min-w-0 flex-1 text-sm text-gtm-text">
                  <span className="font-medium">Go-to-agent</span>
                  <span className="text-gtm-muted"> handed this off at {formatTime(run.createdAt)}</span>
                  <span className="mt-0.5 block text-gtm-secondary">{run.trigger.line.replace(/\*\*/g, "")}</span>
                </p>
              </div>
            </Section>

            {tasks.length > 0 && (
              <Section title="Tasks">
                <ol>
                  {tasks.map((task, i) => (
                    <TaskItem key={task.id} task={task} last={i === tasks.length - 1} />
                  ))}
                </ol>
              </Section>
            )}

            <Section title="Result">
              {run.status === "needs_approval" ? <ApprovalSummary run={run} onReview={handlers.onOpenThread} /> : <RunBody run={run} quiet={false} />}
            </Section>
          </div>

          <footer className="flex shrink-0 items-center gap-2 border-t border-gtm-border px-5 py-3">
            {run.status === "ready" && (
              <Button variant="contained" color="primary" size="small" onClick={handlers.onPrimary}>
                {run.primaryAction.label}
              </Button>
            )}
            <Button variant="outlined" color="inherit" size="small" className="border-gtm-border text-gtm-text" onClick={handlers.onOpenThread}>
              Open thread
            </Button>
          </footer>
        </div>
      )}
    </Drawer>
  );
}
