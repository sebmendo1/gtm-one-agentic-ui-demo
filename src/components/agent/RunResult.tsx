"use client";

import { Button, IconButton, Tooltip } from "@mui/material";
import { BellSnoozeIcon, QueueListIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ArrowUpOnSquareIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AgentRun } from "@/lib/agents/types";
import { nextStepFor } from "@/lib/agents/work";
import { messagePlainText } from "@/lib/message";
import { MessageBody } from "@/components/chat/MessageView";
import { Markdown } from "@/components/chat/Markdown";
import { ChatActionsContext, QuietEvidenceContext, copyText, useChatActions } from "@/components/chat/context";

const CLAMP_PX = 260;

function Clamped({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setOverflows(el.scrollHeight > CLAMP_PX + 48));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clamped = overflows && !open;
  return (
    <div>
      <div ref={ref} style={clamped ? { maxHeight: CLAMP_PX } : undefined} className={clamped ? "gtm-fade-bottom overflow-hidden" : ""}>
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1 inline-flex items-center gap-0.5 rounded-gtm py-1 text-meta font-medium text-gtm-secondary hover:text-gtm-text"
        >
          {open ? "Show less" : "Show more"}
          <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

/** Hub results read as a summary; citations and the grounding line stay in the work view and thread. */
function quietMarkdown(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => !/^Grounded in:/i.test(line.trim()))
    .join("\n")
    .replace(/\s*\[(?:e\d+(?:,\s*)?)+\]/g, "");
}

export function ApprovalSummary({ run, onReview, onSnooze }: { run: AgentRun; onReview: () => void; onSnooze?: () => void }) {
  const paid = run.approval?.steps.filter((s) => !s.executed) ?? [];
  return (
    <div className="rounded-gtm-xl border border-gtm-warning/40 bg-gtm-warning/5 p-4">
      {run.approvalLead && <Markdown markdown={run.approvalLead.replace(/\s*Want me to go ahead\?$/, "")} />}
      {paid.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {paid.map((s) => (
            <li key={s.display} className="flex items-baseline gap-2 text-meta">
              <span className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-gtm-warning" aria-hidden />
              <span className="min-w-0 flex-1 text-gtm-secondary">{s.reason}</span>
              <span className="shrink-0 font-gtm-mono text-caption text-gtm-muted">{s.estimate}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="contained" color="primary" size="small" onClick={onReview}>
          Review and approve
        </Button>
        {onSnooze && (
          <Button color="inherit" size="small" className="text-gtm-secondary" onClick={onSnooze}>
            Not now
          </Button>
        )}
      </div>
    </div>
  );
}

/** A run's output: the message body (quiet in the hub, cited in the work view). */
export function RunBody({ run, quiet }: { run: AgentRun; quiet: boolean }) {
  const actions = useChatActions();
  if (!run.message) return null;
  const body = <MessageBody markdown={quiet ? quietMarkdown(run.message.markdown) : run.message.markdown} frame={run.message} />;
  return (
    <ChatActionsContext.Provider value={{ ...actions, hostHasPrimary: true }}>
      <QuietEvidenceContext.Provider value={quiet}>{quiet ? <Clamped>{body}</Clamped> : body}</QuietEvidenceContext.Provider>
    </ChatActionsContext.Provider>
  );
}

export interface RunHandlers {
  onOpenThread: () => void;
  onPrimary: () => void;
  onViewWork: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  onShare?: () => void;
}

/** What a sub-agent row shows when opened: its result, then one row of actions. */
export function RunResult({ run, now, handlers }: { run: AgentRun; now: number; handlers: RunHandlers }) {
  const { onOpenThread, onPrimary, onViewWork, onSnooze, onDismiss, onShare } = handlers;
  if (run.status === "needs_approval") {
    return (
      <div className="flex flex-col gap-3">
        <ApprovalSummary run={run} onReview={onOpenThread} onSnooze={onSnooze} />
        <ViewWork onClick={onViewWork} count={run.tasks?.length} />
      </div>
    );
  }
  const done = run.status === "done";
  return (
    <div>
      <RunBody run={run} quiet />
      <footer className="mt-4 flex flex-wrap items-center gap-2">
        {done ? (
          onShare && (
            <Button variant="outlined" color="inherit" size="small" startIcon={<ArrowUpOnSquareIcon className="size-4" />} className="border-gtm-border text-gtm-text" onClick={onShare}>
              Share
            </Button>
          )
        ) : (
          <Button variant="contained" color="primary" size="small" onClick={onPrimary}>
            {run.primaryAction.label}
          </Button>
        )}
        <Button variant="outlined" color="inherit" size="small" className="border-gtm-border text-gtm-text" onClick={onOpenThread}>
          Open thread
        </Button>
        <ViewWork onClick={onViewWork} count={run.tasks?.length} />
        <span className="ml-auto flex items-center gap-0.5">
          <span className="mr-2 text-meta text-gtm-muted max-sm:hidden">{nextStepFor(run, now)}</span>
          {!done && (
            <>
              <Tooltip title="Snooze until tomorrow">
                <IconButton size="small" aria-label="Snooze" onClick={onSnooze} className="text-gtm-muted">
                  <BellSnoozeIcon className="size-[18px]" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Not useful">
                <IconButton size="small" aria-label="Not useful" onClick={onDismiss} className="text-gtm-muted">
                  <XMarkIcon className="size-[18px]" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </span>
      </footer>
    </div>
  );
}

function ViewWork({ onClick, count }: { onClick: () => void; count?: number }) {
  return (
    <Button color="inherit" size="small" startIcon={<QueueListIcon className="size-4" />} className="self-start text-gtm-secondary" onClick={onClick}>
      {count ? `View ${count} tasks` : "View work"}
    </Button>
  );
}

/** What the primary action puts on the clipboard: the result text without citations, tags, or the grounding line. */
export function copyTextFor(run: AgentRun): string {
  if (!run.message) return "";
  return messagePlainText(run.message.markdown)
    .split("\n")
    .filter((line) => !/^Grounded in:/i.test(line.trim()) && !/^\[[^\]]+\]$/.test(line.trim()))
    .join("\n")
    .replace(/\s*\[(?:e\d+(?:,\s*)?)+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function runPrimaryAction(run: AgentRun): Promise<boolean> {
  const text = copyTextFor(run);
  if (!text) return false;
  return copyText(text);
}
