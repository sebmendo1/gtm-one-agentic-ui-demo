import { agentDisplayName } from "./catalog";
import { CALENDAR_EVENTS, INBOX_THREADS, PERSONA_DEALS, PERSONA_GOAL, accountLabel, type PersonaDeal } from "./fixtures";
import { PERSONA_TIME_ZONE, formatDayTime, relativeMeeting } from "./time";
import type { AgentId, AgentRun, Workspace, WorkspaceMilestone } from "./types";

const MS_DAY = 86_400_000;

export function isVisible(run: AgentRun): boolean {
  return run.status !== "dismissed" && run.status !== "snoozed";
}

export function isOpen(run: AgentRun): boolean {
  return run.status === "ready" || run.status === "needs_approval";
}

function account(run: AgentRun): string {
  return run.entity.company ?? run.entity.contact ?? "this account";
}

/** Short noun for the panel: what the work is, not which agent did it. */
export function runTitle(run: AgentRun): string {
  switch (run.agentId) {
    case "meeting_prep":
      return `${account(run)} meeting brief`;
    case "deal_watch":
      return `${account(run)} buying signal`;
    case "follow_up_nudge":
      return `Reply to ${run.entity.contact ?? account(run)}`;
    case "account_map":
      return `${account(run)} buying committee`;
  }
}

/** The one thing the AE should do next with this card. */
export function nextStepFor(run: AgentRun, now: number): string {
  if (run.status === "needs_approval") return `Approve ${run.costLabel} to finish`;
  if (run.status === "done") return run.primaryAction.label.replace(/^Copy/, "Copied");
  switch (run.agentId) {
    case "meeting_prep": {
      const event = CALENDAR_EVENTS.find((e) => e.id === run.trigger.meta?.eventId);
      return event ? `Review before ${relativeMeeting(event.startMs, now)}` : "Review the brief";
    }
    case "deal_watch":
      return "Send a timely note";
    case "follow_up_nudge": {
      const thread = INBOX_THREADS.find((t) => t.id === run.trigger.meta?.threadId);
      const days = thread ? Math.floor((now - thread.receivedMs) / MS_DAY) : null;
      return days ? `Draft ready · waiting ${days} days` : "Draft ready";
    }
    case "account_map":
      return "Review stakeholders";
  }
}

export type MeetingPrep = "ready" | "approval" | "pending" | "scheduled";

export interface UpcomingMeeting {
  id: string;
  account: string;
  title: string;
  when: string;
  prep: MeetingPrep;
  prepLabel: string;
  runId?: string;
}

export function upcomingMeetings(ws: Workspace, limit = 3): UpcomingMeeting[] {
  const now = ws.demoNow;
  return CALENDAR_EVENTS.filter((e) => e.external && e.accountKey && e.startMs >= now)
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, limit)
    .map((e) => {
      const run = ws.runs.find((r) => r.trigger.meta?.eventId === e.id && isVisible(r));
      let prep: MeetingPrep = "scheduled";
      let prepLabel = `Preps ${formatDayTime(e.startMs - MS_DAY)}`;
      if (run?.status === "needs_approval") {
        prep = "approval";
        prepLabel = "Waiting on approval";
      } else if (run) {
        prep = "ready";
        prepLabel = run.agentId === "account_map" ? "Mapped" : "Brief ready";
      } else if (e.startMs - now <= MS_DAY) {
        prep = "pending";
        prepLabel = "Prepping on next check";
      }
      return {
        id: e.id,
        account: accountLabel(e.accountKey!),
        title: e.title.split(" — ")[1] ?? e.title,
        when: relativeMeeting(e.startMs, now),
        prep,
        prepLabel,
        runId: run?.id,
      };
    });
}

export function formatAmount(amount: number): string {
  return amount >= 1000 ? `$${Math.round(amount / 1000)}k` : `$${amount}`;
}

export function formatCloseDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PERSONA_TIME_ZONE });
}

/** The persona's deal for an account name or key, if she has one. */
export function dealFor(account: string | null | undefined): PersonaDeal | null {
  if (!account) return null;
  const a = account.toLowerCase();
  return PERSONA_DEALS.find((d) => d.accountKey === a || accountLabel(d.accountKey).toLowerCase() === a) ?? null;
}

function dealStatus(ws: Workspace, deal: PersonaDeal): string | null {
  const company = accountLabel(deal.accountKey);
  const runs = ws.runs.filter((r) => r.entity.company === company && isOpen(r));
  const approval = runs.find((r) => r.status === "needs_approval");
  const what = (run: AgentRun) => runTitle(run).replace(company, "").trim();
  if (approval) return `${what(approval)} waiting on your approval`;
  return runs[0] ? `${what(runs[0])} ready` : null;
}

/** "Which deals need me?": every deal with its stage, close date, next step and what the agent has for it. */
export function dealsReply(ws: Workspace): string {
  const lines = PERSONA_DEALS.map((deal) => {
    const status = dealStatus(ws, deal);
    return `- **${deal.name}** · ${deal.stage} · ${formatAmount(deal.amount)} · closes ${formatCloseDate(deal.closeMs)}. Next: ${deal.nextStep}${status ? ` (${status})` : ""}.`;
  });
  const open = PERSONA_DEALS.filter((d) => d.stage !== "Commit").map((d) => accountLabel(d.accountKey));
  const gap = PERSONA_GOAL.target - PERSONA_GOAL.committed;
  return [
    `Here are your ${PERSONA_GOAL.quarterLabel} deals, as you reported them (Salesforce isn't connected yet):`,
    "",
    ...lines,
    "",
    `${PERSONA_GOAL.committed} of ${PERSONA_GOAL.target} deals in commit. To hit your goal, ${gap === open.length ? open.join(" and ") : `${gap} of ${open.join(", ")}`} need to move to commit.`,
  ].join("\n");
}

function nextExternalMeeting(ws: Workspace) {
  return CALENDAR_EVENTS.filter((e) => e.external && e.accountKey && e.startMs >= ws.demoNow).sort((a, b) => a.startMs - b.startMs)[0];
}

function oldestUnanswered() {
  return INBOX_THREADS.filter((t) => t.unanswered).sort((a, b) => a.receivedMs - b.receivedMs)[0];
}

/** Hub chips drawn from the AE's own week: next meeting, overdue reply, deals, then an unwatched deal account. */
export function hubSuggestions(ws: Workspace): string[] {
  const meeting = nextExternalMeeting(ws);
  const thread = oldestUnanswered();
  const unwatched = PERSONA_DEALS.find((d) => !ws.watchlist.includes(d.accountKey));
  return [
    meeting ? `Prep me for ${accountLabel(meeting.accountKey!)} ${relativeMeeting(meeting.startMs, ws.demoNow).replace(/^today /, "")}` : null,
    thread ? `Draft my reply to ${thread.fromName} at ${accountLabel(thread.accountKey)}` : null,
    "Which deals need me?",
    unwatched ? `Watch ${accountLabel(unwatched.accountKey)}` : null,
  ].filter((s): s is string => Boolean(s));
}

/** Starters for an empty thread: one per deal motion. */
export function threadStarters(ws: Workspace): { label: string; prompt: string }[] {
  const meeting = nextExternalMeeting(ws);
  const thread = oldestUnanswered();
  const bestCase = PERSONA_DEALS.find((d) => d.stage === "Best case");
  const pipeline = PERSONA_DEALS.find((d) => d.stage === "Pipeline");
  return [
    meeting && { label: `Prep my ${accountLabel(meeting.accountKey!)} meeting`, prompt: `Brief me before my call with ${accountLabel(meeting.accountKey!)}` },
    bestCase && { label: `Map the ${accountLabel(bestCase.accountKey)} buying committee`, prompt: `Map the buying committee at ${accountLabel(bestCase.accountKey)}` },
    thread && { label: `Reply to ${thread.fromName}`, prompt: `Draft my reply to ${thread.fromName} at ${accountLabel(thread.accountKey)}` },
    pipeline && { label: `Why ${accountLabel(pipeline.accountKey)} should move now`, prompt: `Why now case for ${accountLabel(pipeline.accountKey)}` },
  ].filter((s): s is { label: string; prompt: string } => Boolean(s));
}

export const SETUP_STEPS: { key: WorkspaceMilestone; label: string }[] = [
  { key: "connected", label: "Connect Google" },
  { key: "firstSweep", label: "First check-in" },
  { key: "activated", label: "Act on a brief" },
  { key: "shared", label: "Share with a teammate" },
  { key: "invited", label: "Invite your Salesforce admin" },
];

export interface DoneItem {
  id: string;
  title: string;
  detail: string;
  runId?: string;
  agentId?: AgentId;
}

export function doneItems(ws: Workspace): DoneItem[] {
  const runs: DoneItem[] = ws.runs
    .filter((r) => r.status === "done")
    .map((r) => ({ id: r.id, runId: r.id, agentId: r.agentId, title: runTitle(r), detail: nextStepFor(r, ws.demoNow) }));
  const growth: DoneItem[] = [];
  if (ws.milestones.shared) growth.push({ id: "m-shared", title: "Brief shared", detail: "Read-only link copied" });
  if (ws.milestones.invited) growth.push({ id: "m-invited", title: "Salesforce admin invited", detail: "Pipeline-aware Deal Watch unlocks on connect" });
  return [...runs, ...growth];
}

export function needsYou(ws: Workspace): AgentRun[] {
  return ws.runs
    .filter(isOpen)
    .sort((a, b) => Number(b.status === "needs_approval") - Number(a.status === "needs_approval") || (a.receivedAt ?? a.createdAt) - (b.receivedAt ?? b.createdAt));
}

export { agentDisplayName };
