import { accountLabel, CALENDAR_EVENTS } from "./fixtures";
import { formatLongDate, formatTime, sameDay } from "./time";
import type { Workspace } from "./types";
import { dealsReply } from "./work";

const MS_DAY = 86_400_000;

const ACCOUNT_HINTS: Record<string, string[]> = {
  snowflake: ["snowflake", "snow"],
  stripe: ["stripe"],
  datadog: ["datadog", "ddog"],
};

function accountKeyFor(name: string): string {
  const n = name.toLowerCase();
  for (const [key, hints] of Object.entries(ACCOUNT_HINTS)) if (hints.some((h) => n.includes(h))) return key;
  return n.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function label(key: string, typed: string): string {
  return key in ACCOUNT_HINTS ? accountLabel(key) : typed.replace(/\b\w/g, (c) => c.toUpperCase());
}

function agenda(ws: Workspace, day: number, from: number): string[] {
  return CALENDAR_EVENTS.filter((e) => sameDay(e.startMs, day) && e.startMs >= from)
    .sort((a, b) => a.startMs - b.startMs)
    .map((e) => {
      const run = ws.runs.find((r) => r.trigger.meta?.eventId === e.id);
      if (!e.external) return `- **${formatTime(e.startMs)}** · ${e.title}`;
      const prep = run?.status === "needs_approval" ? "waiting on your approval" : run ? "brief ready" : "I'll prep this 24h before";
      return `- **${formatTime(e.startMs)}** · ${e.title} — ${prep}`;
    });
}

/** Commands the hub answers in the browser. Anything else goes to the research harness. */
export function parseHubIntent(text: string, ws: Workspace): { reply: string; watchlist?: string[] } | null {
  const t = text.trim().replace(/[.!?]+$/, "");

  const watch = t.match(/^(?:please\s+)?(?:watch|track|monitor)\s+(.+)$/i);
  if (watch) {
    const key = accountKeyFor(watch[1]!);
    const name = label(key, watch[1]!.trim());
    if (ws.watchlist.includes(key)) return { reply: `I'm already watching **${name}**.` };
    return {
      reply: `Now watching **${name}**. I'll post here when there's an overnight signal or an email waiting on you.`,
      watchlist: [...ws.watchlist, key],
    };
  }

  const stop = t.match(/^(?:stop watching|unwatch|stop tracking)\s+(.+)$/i);
  if (stop) {
    const key = accountKeyFor(stop[1]!);
    const name = label(key, stop[1]!.trim());
    if (!ws.watchlist.includes(key)) return { reply: `I wasn't watching **${name}**.` };
    return { reply: `Stopped watching **${name}**.`, watchlist: ws.watchlist.filter((k) => k !== key) };
  }

  if (/\b(my deals|deals need|which deals|pipeline|forecast|book of business)\b/i.test(t)) {
    return { reply: dealsReply(ws) };
  }

  if (/\b(today|my day|on my calendar|what's on|whats on|schedule)\b/i.test(t)) {
    const now = ws.demoNow;
    const today = agenda(ws, now, now);
    if (today.length) return { reply: `Here's the rest of today, ${formatLongDate(now)}:\n\n${today.join("\n")}` };
    const tomorrow = agenda(ws, now + MS_DAY, now);
    return {
      reply: tomorrow.length
        ? `Nothing else on your calendar today. Tomorrow, ${formatLongDate(now + MS_DAY)}:\n\n${tomorrow.join("\n")}`
        : "Your calendar is clear for today and tomorrow.",
    };
  }

  return null;
}
