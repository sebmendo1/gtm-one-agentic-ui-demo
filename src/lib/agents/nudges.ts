import { CALENDAR_EVENTS, DEMO_MORNING_MS, accountLabel } from "./fixtures";
import { relativeMeeting } from "./time";
import type { AgentNudge, AgentRun, NudgeKey, SourceKind, Workspace } from "./types";
import { isVisible } from "./work";

const MS_HOUR = 3_600_000;

export interface NudgeContent {
  /** One line for the toast when the AE is in a thread. */
  headline: string;
  /** What it noticed, shown while it "looks" before the message lands. */
  noticing: string;
  /** Where it noticed it and why now, in a few words. */
  why: string;
  source: SourceKind;
  /** Markdown body. */
  body: string;
  primary: string;
  secondary: string;
  accepted: string;
  dismissed: string;
  /** The run the primary action works on. */
  runId?: string;
}

function meetingPrepRun(ws: Workspace): AgentRun | undefined {
  return ws.runs.find((r) => r.agentId === "meeting_prep" && r.trigger.meta?.eventId === "cal-snowflake-expansion" && isVisible(r));
}

const SNOWFLAKE_EVENT = CALENDAR_EVENTS.find((e) => e.id === "cal-snowflake-expansion")!;

function hoursUntil(ms: number, now: number): string {
  const h = Math.max(1, Math.round((ms - now) / MS_HOUR));
  return h === 1 ? "about an hour" : `about ${h} hours`;
}

export function nudgeContent(nudge: AgentNudge, ws: Workspace): NudgeContent {
  const now = nudge.at;
  switch (nudge.key) {
    case "loop_in_se": {
      const run = meetingPrepRun(ws);
      const se = run?.trigger.meta?.shareWith ?? { name: "Sam Ortiz", role: "Sales Engineer" };
      const first = se.name.split(" ")[0];
      return {
        headline: `${first} hasn't seen tomorrow's Snowflake brief`,
        noticing: "Looking at who's on tomorrow's Snowflake invite…",
        why: `Calendar · Snowflake review ${relativeMeeting(SNOWFLAKE_EVENT.startMs, now)}`,
        source: "calendar",
        body: `**${se.name}** (${se.role}) is on tomorrow's Snowflake review but hasn't seen the brief. Riley's team will ask technical questions, so ${first} should walk in with the same context you have.`,
        primary: `Share brief with ${first}`,
        secondary: "Not now",
        accepted: `Shared with ${first}. I'll flag it if he adds questions before 10:00 AM.`,
        dismissed: "Okay. The brief stays private to you.",
        runId: run?.id,
      };
    }
    case "morning_lead": {
      const run = meetingPrepRun(ws);
      const intent = ws.runs.some((r) => r.agentId === "deal_watch" && r.entity.company === accountLabel("snowflake") && isVisible(r));
      return {
        headline: `Snowflake review in ${hoursUntil(SNOWFLAKE_EVENT.startMs, now)}: ${intent ? "your brief changed overnight" : "one last read"}`,
        noticing: "Rechecking your Snowflake brief against overnight signals…",
        why: `Calendar · Snowflake review in ${hoursUntil(SNOWFLAKE_EVENT.startMs, now)}`,
        source: "calendar",
        body: intent
          ? "Your **Snowflake** review starts in a couple of hours. Overnight their intent on Revenue Intelligence rose to 91, so I moved it to the top of your brief. Open with it: it's the reason they're taking the meeting."
          : "Your **Snowflake** review starts in a couple of hours. Nothing changed overnight, so the brief from last night still holds. Give it one read before you join.",
        primary: "Open the brief",
        secondary: "Got it",
        accepted: "Brief open. Good luck at 10:00 AM.",
        dismissed: "Okay. It's in Needs you when you want it.",
        runId: run?.id,
      };
    }
  }
}

function has(ws: Workspace, key: NudgeKey): boolean {
  return ws.nudges.some((n) => n.key === key);
}

/** The heads-up the agent would raise next on its own, if any. */
export function nextIdleNudge(ws: Workspace): NudgeKey | null {
  if (!ws.lastSweepAt || ws.nudges.some((n) => n.status === "new" && n.at === ws.demoNow)) return null;
  const prep = meetingPrepRun(ws);
  if (ws.demoNow >= DEMO_MORNING_MS) {
    return ws.lastSweepAt >= DEMO_MORNING_MS && prep && !has(ws, "morning_lead") ? "morning_lead" : null;
  }
  if (prep?.message && prep.trigger.meta?.shareWith && !ws.milestones.shared && !has(ws, "loop_in_se")) return "loop_in_se";
  return null;
}

