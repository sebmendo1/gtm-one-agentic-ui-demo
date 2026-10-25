/** The persona works in Pacific time; every demo-clock label renders there, whatever the viewer's zone. */
export const PERSONA_TIME_ZONE = "America/Los_Angeles";

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: PERSONA_TIME_ZONE });
}

export function formatDayTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: PERSONA_TIME_ZONE });
}

export function formatLongDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: PERSONA_TIME_ZONE });
}

function dayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { timeZone: PERSONA_TIME_ZONE });
}

export function sameDay(a: number, b: number): boolean {
  return dayKey(a) === dayKey(b);
}

export function dayLabel(ms: number, now: number): string {
  if (sameDay(ms, now)) return "Today";
  if (sameDay(ms, now - 86_400_000)) return "Yesterday";
  if (sameDay(ms, now + 86_400_000)) return "Tomorrow";
  return formatLongDate(ms);
}

export function hourOf(ms: number): number {
  return Number(new Date(ms).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: PERSONA_TIME_ZONE }));
}

/** "tomorrow at 10:00 AM", "today at 3:00 PM", or "Thu 2:00 PM". */
export function relativeMeeting(startMs: number, now: number): string {
  const time = formatTime(startMs);
  if (sameDay(startMs, now)) return `today at ${time}`;
  if (sameDay(startMs, now + 86_400_000)) return `tomorrow at ${time}`;
  return formatDayTime(startMs);
}
