"use client";

import { Button, Drawer, IconButton } from "@mui/material";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { CheckIcon, ChevronRightIcon, ClockIcon, MinusIcon, PaperAirplaneIcon } from "@heroicons/react/20/solid";
import { useState, type ReactNode } from "react";
import { agentDisplayName } from "@/lib/agents/catalog";
import { formatTime } from "@/lib/agents/time";
import type { AgentRun, AgentTask } from "@/lib/agents/types";
import { AgentAvatar } from "./AgentAvatar";
import { ApprovalSummary, Attachments, RunBody, type RunHandlers } from "./RunResult";

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

/**
 * How much to trust a result, stated only from what the record shows: a read of the AE's own
 * mail or calendar is direct; a ZoomInfo result backed by two or more records is high confidence.
 */
function confidence(task: AgentTask, findings: number): { text: string; tone: "high" | "ok" | "none" } {
  if (task.status === "waiting") return { text: "Waiting on your approval", tone: "none" };
  if (task.status === "empty") return { text: "Nothing on record", tone: "none" };
  if (task.status !== "done") return { text: "Skipped", tone: "none" };
  if (task.source === "gmail") return { text: "Direct from your Gmail", tone: "high" };
  if (task.source === "calendar") return { text: "Direct from your calendar", tone: "high" };
  if (task.source === "writer") return { text: `Based on ${findings} finding${findings === 1 ? "" : "s"} above`, tone: "ok" };
  const n = task.evidenceIds.length;
  return n >= 2 ? { text: `High confidence · ${n} sources`, tone: "high" } : { text: "Confirmed · 1 source", tone: "ok" };
}

const TONE_DOT = { high: "bg-gtm-success", ok: "bg-gtm-warning", none: "bg-gtm-border" } as const;

function TaskItem({ task, last, findings }: { task: AgentTask; last: boolean; findings: number }) {
  const c = confidence(task, findings);
  const cost = task.cost === "data" ? "1 data credit" : task.cost === "ai" ? "AI credits" : "Free";
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute top-7 bottom-1 left-[11.5px] w-px bg-gtm-border" aria-hidden />}
      <span className="relative shrink-0">
        <TaskIcon status={task.status} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium text-gtm-text">{task.status === "done" ? (task.title ?? task.label) : task.label}</p>
        <p className="text-meta text-pretty text-gtm-secondary">{task.detail}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-caption text-gtm-muted">
          <span className={`size-1.5 rounded-full ${TONE_DOT[c.tone]}`} aria-hidden />
          <span>{c.text}</span>
          <span aria-hidden>·</span>
          <span>{cost}</span>
        </p>
      </div>
    </li>
  );
}

function TechnicalDetails({ tasks }: { tasks: AgentTask[] }) {
  const [open, setOpen] = useState(false);
  const rows = tasks.filter((t) => t.commands.length || t.evidenceIds.length);
  if (!rows.length) return null;
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-meta font-medium text-gtm-secondary hover:text-gtm-text"
      >
        <ChevronRightIcon className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
        {open ? "Hide technical details" : "Show technical details"}
      </button>
      {open && (
        <ul className="gtm-enter mt-2 flex flex-col gap-2 rounded-gtm-lg bg-gtm-subtle p-3">
          {rows.map((t) => (
            <li key={t.id} className="min-w-0">
              <p className="text-caption font-medium text-gtm-secondary">
                {t.label}
                {t.evidenceIds.length > 0 && <span className="font-normal text-gtm-muted"> · evidence {t.evidenceIds.join(", ")}</span>}
              </p>
              {t.commands.map((command) => (
                <code key={command} title={command} className="block truncate font-gtm-mono text-caption text-gtm-muted">
                  {command}
                </code>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const sends = run?.primaryAction.kind === "send_reply";
  const findings = tasks.filter((t) => t.source !== "writer" && t.status === "done").length;
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
                    <TaskItem key={task.id} task={task} last={i === tasks.length - 1} findings={findings} />
                  ))}
                </ol>
                <TechnicalDetails tasks={tasks} />
              </Section>
            )}

            <Section title="Result">
              {run.status === "needs_approval" ? <ApprovalSummary run={run} onReview={handlers.onOpenThread} /> : <RunBody run={run} quiet={false} />}
              {sends && run.status !== "needs_approval" && <Attachments />}
            </Section>
          </div>

          <footer className="flex shrink-0 items-center gap-2 border-t border-gtm-border px-5 py-3">
            {run.status === "ready" && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={sends ? <PaperAirplaneIcon className="size-4" /> : undefined}
                onClick={handlers.onPrimary}
              >
                {run.primaryAction.label}
              </Button>
            )}
            {run.status === "ready" && sends && handlers.onCopy && (
              <Button variant="outlined" color="inherit" size="small" className="border-gtm-border text-gtm-text" onClick={handlers.onCopy}>
                Copy draft
              </Button>
            )}
            {run.sentAt && <span className="text-meta font-medium text-emerald-700 dark:text-emerald-300">Sent {formatTime(run.sentAt)}</span>}
            <Button variant="outlined" color="inherit" size="small" className="border-gtm-border text-gtm-text" onClick={handlers.onOpenThread}>
              Open thread
            </Button>
          </footer>
        </div>
      )}
    </Drawer>
  );
}
