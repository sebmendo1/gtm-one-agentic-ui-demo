"use client";

import { CircularProgress, IconButton, LinearProgress, Tooltip } from "@mui/material";
import { BellAlertIcon, CalendarDaysIcon, CheckBadgeIcon, EyeIcon as EyeOutlineIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { SidebarIcon } from "@/components/chat/Sidebar";
import { BoltIcon, CheckCircleIcon, ChevronRightIcon, EyeIcon } from "@heroicons/react/20/solid";
import { nudgeContent } from "@/lib/agents/nudges";
import type { ReactNode } from "react";
import { accountLabel, PERSONA_GOAL } from "@/lib/agents/fixtures";
import { formatTime, hourOf } from "@/lib/agents/time";
import type { Workspace, WorkspaceMilestone } from "@/lib/agents/types";
import { committedOf, dealsOf, doneItems, formatAmount, formatCloseDate, needsYou, nextStepFor, runTitle, scheduledFollowUp, SETUP_STEPS, upcomingMeetings, type MeetingPrep } from "@/lib/agents/work";
import { AgentAvatar } from "./AgentAvatar";
import { StatusPill } from "./AgentMessage";
import { DealStagePill } from "./DealStage";

const SETUP_ACTION: Record<WorkspaceMilestone, string> = {
  connected: "Connect",
  firstSweep: "Run now",
  activated: "Open",
  shared: "Share",
  invited: "Invite",
};

const PREP_DOT: Record<MeetingPrep, string> = {
  ready: "bg-gtm-success",
  approval: "bg-gtm-warning",
  pending: "bg-gtm-emphasis",
  scheduled: "bg-gtm-border",
};

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 flex items-center justify-between px-2 text-meta font-medium text-gtm-muted">
        {title}
        {count !== undefined && count > 0 && <span className="font-normal tabular-nums">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Row({ icon, title, detail, trailing, onClick }: { icon: ReactNode; title: ReactNode; detail?: ReactNode; trailing?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex w-6 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gtm-text">{title}</span>
        {detail && <span className="block truncate text-meta text-gtm-muted">{detail}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
    </>
  );
  const cls = "flex w-full min-h-9 items-center gap-3 rounded-gtm px-2 py-1.5 text-left";
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={`${cls} group transition-colors hover:bg-gtm-hover`}>
      {body}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1.5 text-meta text-gtm-muted">{children}</p>;
}

/** Fixture sweeps run on a 7:00 AM schedule in the persona's zone. */
function nextCheck(now: number): number {
  const hoursUntil = (7 - hourOf(now) + 24) % 24 || 24;
  const at = now + hoursUntil * 3_600_000;
  return at - (new Date(at).getUTCMinutes() * 60_000);
}

export function WorkPanel({
  workspace,
  sweeping,
  sweepLabel,
  researching,
  onFocusRun,
  onFocusNudge,
  onSetupAction,
  onClose,
  inline,
}: {
  /** Set when the panel sits beside the hub (desktop): it can collapse to a rail instead of closing. */
  inline?: { collapsed: boolean };
  workspace: Workspace;
  sweeping: boolean;
  sweepLabel: string | null;
  researching: string | null;
  onFocusRun: (runId: string) => void;
  onFocusNudge: (nudgeId: string) => void;
  onSetupAction: (key: WorkspaceMilestone) => void;
  onClose: () => void;
}) {
  const now = workspace.demoNow;
  const waiting = needsYou(workspace);
  const meetings = upcomingMeetings(workspace);
  const done = doneItems(workspace);
  const headsUps = workspace.nudges.filter((n) => n.status === "new");
  const followUp = scheduledFollowUp(workspace);
  const setupDone = SETUP_STEPS.filter((s) => workspace.milestones[s.key]).length;
  const committed = committedOf(workspace);
  const goalPct = Math.round((Math.min(committed, PERSONA_GOAL.target) / PERSONA_GOAL.target) * 100);

  const railed = Boolean(inline?.collapsed);
  const active = sweeping || Boolean(researching);

  return (
    <aside
      aria-label="Agent work"
      className={`flex h-full max-w-[90vw] shrink-0 justify-end overflow-hidden border-l border-gtm-border/50 bg-gtm-bg-secondary ${inline ? "transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" : ""} ${railed ? "w-14" : "w-[320px]"}`}
    >
      {railed ? (
        <div className="gtm-enter flex h-full w-14 shrink-0 flex-col items-center gap-1 pb-4">
          <div className="box-content flex h-14 items-center pt-[env(safe-area-inset-top)]">
            <Tooltip title="Expand agent work" placement="left">
              <IconButton size="small" aria-label="Expand agent work" onClick={onClose} className="text-gtm-secondary">
                <SidebarIcon className="size-5 -scale-x-100" />
              </IconButton>
            </Tooltip>
          </div>
          <Tooltip title={`${PERSONA_GOAL.quarterLabel} goal · ${committed} of ${PERSONA_GOAL.target} in commit`} placement="left">
            <span className="relative mb-2 flex size-10 items-center justify-center">
              <CircularProgress variant="determinate" value={100} size={28} thickness={4} className="absolute text-gtm-selected" />
              <CircularProgress variant="determinate" value={goalPct} size={28} thickness={4} className="text-gtm-text" />
              <span className="absolute text-[10px] font-semibold tabular-nums">
                {committed}/{PERSONA_GOAL.target}
              </span>
            </span>
          </Tooltip>
          <RailItem label="Needs you" count={waiting.length + headsUps.length} alert onClick={onClose}>
            <BellAlertIcon className="size-5" />
          </RailItem>
          <RailItem label="Up next" count={meetings.length} onClick={onClose}>
            <CalendarDaysIcon className="size-5" />
          </RailItem>
          <RailItem label={active ? "In progress · working" : followUp ? `In progress · ${followUp.title}` : "In progress · idle"} onClick={onClose}>
            <span className={`size-2.5 rounded-full ${active ? "gtm-pulse bg-gtm-emphasis text-gtm-emphasis" : followUp ? "bg-gtm-emphasis" : "bg-gtm-success"}`} />
          </RailItem>
          <RailItem label="Done" count={done.length} onClick={onClose}>
            <CheckBadgeIcon className="size-5" />
          </RailItem>
          <RailItem label="Watching" count={workspace.watchlist.length} onClick={onClose}>
            <EyeOutlineIcon className="size-5" />
          </RailItem>
        </div>
      ) : (
        <div className="flex h-full w-[320px] max-w-[90vw] shrink-0 flex-col">
          <header className="box-content flex h-14 shrink-0 items-center justify-between pr-2 pl-4 pt-[env(safe-area-inset-top)]">
            <h2 className="text-sm font-semibold">Agent work</h2>
            {inline ? (
              <Tooltip title="Collapse agent work">
                <IconButton size="small" aria-label="Collapse agent work" onClick={onClose} className="text-gtm-secondary">
                  <SidebarIcon className="size-5 -scale-x-100" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Close panel">
                <IconButton size="small" aria-label="Close work panel" onClick={onClose}>
                  <XMarkIcon className="size-5" />
                </IconButton>
              </Tooltip>
            )}
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-2 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mx-2 rounded-gtm-xl border border-gtm-border/70 bg-gtm-bg p-4">
              <p className="gtm-eyebrow">{PERSONA_GOAL.quarterLabel} goal</p>
              <p className="mt-1 text-sm font-medium">{workspace.profile?.goal ?? "Close 3 deals in commit this quarter"}</p>
              <LinearProgress
                variant="determinate"
                value={goalPct}
                aria-label="Goal progress"
                className="mt-3 h-1 rounded-full bg-gtm-selected"
                sx={{ "& .MuiLinearProgress-bar": { borderRadius: 999, backgroundColor: "var(--gtm-text)" } }}
              />
              <p className="mt-2 flex justify-between text-meta text-gtm-muted">
                <span>
                  {committed} of {PERSONA_GOAL.target} in commit
                </span>
                <span className="tabular-nums">{goalPct}%</span>
              </p>
              <ul className="mt-4 flex flex-col gap-2.5 border-t border-gtm-border/60 pt-3" aria-label="Your deals">
                {dealsOf(workspace).map((deal) => (
                  <li key={deal.accountKey} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium">{deal.name}</span>
                      <span className="block truncate text-meta text-gtm-muted">
                        <span className="tabular-nums">{formatAmount(deal.amount)}</span> · closes {formatCloseDate(deal.closeMs)}
                      </span>
                    </span>
                    <DealStagePill stage={deal.stage} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-caption text-gtm-muted">
                {workspace.milestones.invited ? "Self-reported · invite sent, waiting on your Salesforce admin" : "Self-reported until Salesforce connects"}
              </p>
            </div>

            <Section title="Needs you" count={waiting.length + headsUps.length}>
              {headsUps.map((nudge) => (
                <Row
                  key={nudge.id}
                  icon={
                    <span className="flex size-6 items-center justify-center rounded-full bg-gtm-emphasis/10 text-gtm-emphasis">
                      <BoltIcon className="size-3.5" />
                    </span>
                  }
                  title={nudgeContent(nudge, workspace).headline}
                  detail="Heads-up · noticed on my own"
                  trailing={<ChevronRightIcon className="size-4 text-gtm-muted opacity-0 transition-opacity group-hover:opacity-100" />}
                  onClick={() => onFocusNudge(nudge.id)}
                />
              ))}
              {waiting.length === 0 && headsUps.length === 0 ? (
                <Empty>Nothing waiting on you.</Empty>
              ) : (
                waiting.map((run) => (
                  <Row
                    key={run.id}
                    icon={<AgentAvatar agent={run.agentId} size={24} />}
                    title={runTitle(run)}
                    detail={nextStepFor(run, now)}
                    trailing={
                      run.status === "needs_approval" ? (
                        <StatusPill tone="approval">Approve</StatusPill>
                      ) : (
                        <ChevronRightIcon className="size-4 text-gtm-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      )
                    }
                    onClick={() => onFocusRun(run.id)}
                  />
                ))
              )}
            </Section>

            <Section title="Up next" count={meetings.length}>
              {meetings.length === 0 ? (
                <Empty>No external meetings coming up.</Empty>
              ) : (
                meetings.map((m) => (
                  <Row
                    key={m.id}
                    icon={<span className={`size-2 rounded-full ${PREP_DOT[m.prep]}`} />}
                    title={
                      <>
                        {m.account} <span className="font-normal text-gtm-muted">· {m.title}</span>
                      </>
                    }
                    detail={`${m.when.charAt(0).toUpperCase()}${m.when.slice(1)} · ${m.prepLabel}`}
                    onClick={m.runId ? () => onFocusRun(m.runId!) : undefined}
                  />
                ))
              )}
            </Section>

            <Section title="In progress">
              {sweeping ? (
                <Row
                  icon={<span className="gtm-pulse size-2 rounded-full bg-gtm-emphasis text-gtm-emphasis" />}
                  title="Checking your sources"
                  detail={sweepLabel ?? "Calendar, Gmail and ZoomInfo"}
                />
              ) : researching ? (
                <Row icon={<span className="gtm-pulse size-2 rounded-full bg-gtm-emphasis text-gtm-emphasis" />} title="Researching" detail={researching} />
              ) : (
                <Row
                  icon={<span className="size-2 rounded-full bg-gtm-success" />}
                  title="Idle"
                  detail={`${workspace.lastSweepAt ? `Checked ${formatTime(workspace.lastSweepAt)} · ` : ""}next ${formatTime(nextCheck(now))}`}
                />
              )}
              {followUp && (
                <Row icon={<EyeIcon className="size-4 text-gtm-emphasis" />} title={followUp.title} detail={followUp.detail} />
              )}
            </Section>

            <Section title="Done" count={done.length}>
              {done.length === 0 ? (
                <Empty>Finished work shows up here.</Empty>
              ) : (
                done.map((item) => (
                  <Row
                    key={item.id}
                    icon={<CheckCircleIcon className="size-4.5 text-gtm-success" />}
                    title={item.title}
                    detail={item.detail}
                    onClick={item.runId ? () => onFocusRun(item.runId!) : undefined}
                  />
                ))
              )}
            </Section>

            <Section title="Watching" count={workspace.watchlist.length}>
              {workspace.watchlist.length === 0 ? (
                <Empty>Say “watch Stripe” to track an account overnight.</Empty>
              ) : (
                <div className="flex flex-wrap gap-1.5 px-2 pt-1">
                  {workspace.watchlist.map((key) => (
                    <span key={key} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-gtm-border bg-gtm-bg px-2.5 text-meta font-medium">
                      <span className="size-1.5 rounded-full bg-gtm-success" aria-hidden />
                      {accountLabel(key)}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            {setupDone < SETUP_STEPS.length && (
              <Section title={`Setup · ${setupDone} of ${SETUP_STEPS.length}`}>
                {SETUP_STEPS.map((step) => {
                  const complete = Boolean(workspace.milestones[step.key]);
                  return (
                    <Row
                      key={step.key}
                      icon={
                        complete ? (
                          <CheckCircleIcon className="size-4.5 text-gtm-success" />
                        ) : (
                          <span className="size-3.5 rounded-full border-[1.5px] border-current text-gtm-muted" />
                        )
                      }
                      title={<span className={complete ? "font-normal text-gtm-muted line-through decoration-gtm-border" : ""}>{step.label}</span>}
                      trailing={complete ? undefined : <span className="text-meta font-medium text-gtm-emphasis">{SETUP_ACTION[step.key]}</span>}
                      onClick={complete ? undefined : () => onSetupAction(step.key)}
                    />
                  );
                })}
              </Section>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function RailItem({ label, count, alert, onClick, children }: { label: string; count?: number; alert?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip title={count ? `${label} · ${count}` : label} placement="left">
      <button
        type="button"
        aria-label={count ? `${label}, ${count}` : label}
        onClick={onClick}
        className="relative flex size-10 items-center justify-center rounded-gtm text-gtm-secondary transition-colors hover:bg-gtm-hover hover:text-gtm-text"
      >
        {children}
        {count !== undefined && count > 0 && (
          <span
            key={count}
            className={`gtm-pop absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ring-2 ring-gtm-bg-secondary ${alert ? "bg-gtm-cta text-white" : "bg-gtm-selected text-gtm-text"}`}
          >
            {count}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
