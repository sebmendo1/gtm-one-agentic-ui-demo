import { agentDisplayName } from "./catalog";
import { CALENDAR_EVENTS, INBOX_THREADS, OVERNIGHT_SIGNALS, PERSONA_DEALS, PERSONA_GOAL, accountLabel, type PersonaDeal } from "./fixtures";
import type { ApprovalRequest } from "@/lib/spec";
import { PERSONA_TIME_ZONE, dayKey, formatDayTime, relativeMeeting } from "./time";
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
  if (run.status === "done" && run.sentAt) return `Sent ${formatDayTime(run.sentAt)}`;
  if (run.status === "done" && run.primaryAction.kind === "add_to_brief") return "Added to your talk track";
  if (run.status === "done") return run.primaryAction.label.replace(/^Copy/, "Copied");
  switch (run.agentId) {
    case "meeting_prep": {
      const event = CALENDAR_EVENTS.find((e) => e.id === run.trigger.meta?.eventId);
      return event ? `Review before ${relativeMeeting(event.startMs, now)}` : "Review the brief";
    }
    case "deal_watch":
      return "Add it to your talk track";
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
      let prepLabel = `Brief preps ${formatDayTime(e.startMs - MS_DAY)}, a day ahead`;
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

/** The AE's deals as she confirmed them at onboarding. */
export function dealsOf(ws: Workspace): PersonaDeal[] {
  return ws.deals ?? PERSONA_DEALS;
}

export function committedOf(ws: Workspace): number {
  return dealsOf(ws).filter((d) => d.stage === "Commit").length;
}

/** "Which deals need me?": every deal with its stage, close date, next step and what the agent has for it. */
export function dealsReply(ws: Workspace): string {
  const deals = dealsOf(ws);
  const committed = committedOf(ws);
  const lines = deals.map((deal) => {
    const status = dealStatus(ws, deal);
    return `- **${deal.name}** · ${deal.stage} · ${formatAmount(deal.amount)} · closes ${formatCloseDate(deal.closeMs)}. Next: ${deal.nextStep}${status ? ` (${status})` : ""}.`;
  });
  const open = deals.filter((d) => d.stage !== "Commit").map((d) => accountLabel(d.accountKey));
  const gap = Math.max(0, PERSONA_GOAL.target - committed);
  return [
    `Here are your ${PERSONA_GOAL.quarterLabel} deals, as you reported them (Salesforce isn't connected yet):`,
    "",
    ...lines,
    "",
    gap === 0
      ? `${committed} of ${PERSONA_GOAL.target} deals in commit. You're at your goal; keep them there.`
      : `${committed} of ${PERSONA_GOAL.target} deals in commit. To hit your goal, ${gap === open.length ? open.join(" and ") : `${gap} of ${open.join(", ")}`} need to move to commit.`,
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
  const unwatched = dealsOf(ws).find((d) => !ws.watchlist.includes(d.accountKey));
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
  const bestCase = dealsOf(ws).find((d) => d.stage === "Best case");
  const pipeline = dealsOf(ws).find((d) => d.stage === "Pipeline");
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
    .map((r) => ({
      id: r.id,
      runId: r.id,
      agentId: r.agentId,
      title: r.sentAt ? `Reply sent to ${r.entity.contact ?? account(r)}` : runTitle(r),
      detail: nextStepFor(r, ws.demoNow),
    }));
  const growth: DoneItem[] = [];
  if (ws.milestones.shared) growth.push({ id: "m-shared", title: "Brief shared", detail: "Read-only link copied" });
  if (ws.milestones.invited) growth.push({ id: "m-invited", title: "Salesforce admin invited", detail: "Pipeline-aware Deal Watch unlocks on connect" });
  return [...runs, ...growth];
}

/** An overnight signal as the morning's "While you were away" card: what came in, when, and what it means for the deal. */
export function awaySignal(run: AgentRun, now: number): { company: string; headline: string; at: number; meaning: string } | null {
  const signal = OVERNIGHT_SIGNALS.find((s) => s.id === run.trigger.meta?.signalId);
  if (!signal) return null;
  const deal = PERSONA_DEALS.find((d) => d.accountKey === signal.accountKey);
  const meeting = CALENDAR_EVENTS.filter((e) => e.accountKey === signal.accountKey && e.external && e.startMs >= now).sort((a, b) => a.startMs - b.startMs)[0];
  const fit = deal ? `That lines up with your ${deal.name.replace(signal.company, "").trim()} pitch.` : "Worth a timely note.";
  const soon = meeting && meeting.startMs - now <= MS_DAY;
  const where = !meeting ? "" : soon ? ` I added it to your brief for ${relativeMeeting(meeting.startMs, now)}.` : ` I'll work it into your brief for ${relativeMeeting(meeting.startMs, now)}.`;
  return { company: signal.company, headline: signal.headline, at: signal.atMs, meaning: `${fit}${where}` };
}

const STRIPE_CALL = CALENDAR_EVENTS.find((e) => e.id === "cal-stripe-followup")!;

/** Two days before the Stripe call, at 9:00 AM: when a bump still gives the buyer time to answer. */
export const REPLY_BUMP_MS = STRIPE_CALL.startMs - 2 * MS_DAY - 5 * 3_600_000;

/** The follow-up the agent committed to when the AE sent the reply. */
export function scheduledFollowUp(ws: Workspace): { title: string; detail: string } | null {
  const sent = ws.runs.find((r) => r.agentId === "follow_up_nudge" && r.sentAt);
  if (!sent) return null;
  return { title: sent.entity.contact ? `Watching for ${sent.entity.contact}'s reply` : "Watching for a reply", detail: `Bump drafts ${formatDayTime(REPLY_BUMP_MS)} if it's quiet` };
}

export function autopilotUsedToday(ws: Workspace): number {
  return ws.autopilot && ws.autopilot.day === dayKey(ws.demoNow) ? ws.autopilot.used : 0;
}

/** Data credits a thread approval spends: the estimate of each paid data step not yet run. */
export function approvalCredits(request: ApprovalRequest | null | undefined): number {
  if (!request) return 0;
  return request.steps
    .filter((s) => !s.executed && s.cost === "data")
    .reduce((n, s) => n + Number(s.estimate.match(/est\. (\d+)/)?.[1] ?? 1), 0);
}

/** The one count every badge shows: cards waiting on the AE plus open heads-ups. */
export function needsYouCount(ws: Workspace): number {
  return needsYou(ws).length + ws.nudges.filter((n) => n.status === "new").length;
}

export function needsYou(ws: Workspace): AgentRun[] {
  return ws.runs
    .filter(isOpen)
    .sort((a, b) => Number(b.status === "needs_approval") - Number(a.status === "needs_approval") || (a.receivedAt ?? a.createdAt) - (b.receivedAt ?? b.createdAt));
}

export { agentDisplayName };
