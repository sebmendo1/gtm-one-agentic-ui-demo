/** Demo clock anchors (spec 11). Local-time strings interpreted as UTC-7 for stable ISO. */
export const DEMO_START_MS = Date.parse("2026-10-26T16:30:00-07:00");
export const DEMO_MORNING_MS = Date.parse("2026-10-27T07:45:00-07:00");

export interface CalendarAttendee {
  email: string;
  name: string;
  internal?: boolean;
  role?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  accountKey: string | null;
  domain: string | null;
  external: boolean;
  attendees: CalendarAttendee[];
  location?: string;
}

export interface InboxThread {
  id: string;
  accountKey: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  receivedMs: number;
  snippet: string;
  unanswered: boolean;
}

export interface OvernightSignal {
  id: string;
  accountKey: string;
  company: string;
  headline: string;
  atMs: number;
}

export const PERSONA_PROFILE = {
  name: "Elena Vasquez",
  role: "Mid-market Account Executive",
  roleShort: "Mid-market AE",
  company: "Northwind",
  territory: "West · B2B SaaS, 200–2,000 employees",
  goal: "Close 3 deals in commit this quarter",
};

export const PERSONA_EMAIL = "elena.vasquez@northwind.com";

export const PERSONA_GOAL = { committed: 1, target: 3, quarterLabel: "Q4" };

export type DealStage = "Commit" | "Best case" | "Pipeline";

export interface PersonaDeal {
  accountKey: string;
  name: string;
  stage: DealStage;
  amount: number;
  closeMs: number;
  nextStep: string;
}

/** Self-reported at onboarding: Salesforce is locked, so these are not CRM records (spec 11). */
export const PERSONA_DEALS: PersonaDeal[] = [
  {
    accountKey: "snowflake",
    name: "Snowflake expansion",
    stage: "Commit",
    amount: 84_000,
    closeMs: Date.parse("2026-11-20T17:00:00-08:00"),
    nextStep: "Expansion review Tue 10:00 AM",
  },
  {
    accountKey: "stripe",
    name: "Stripe new logo",
    stage: "Best case",
    amount: 48_000,
    closeMs: Date.parse("2026-12-12T17:00:00-08:00"),
    nextStep: "Send Alex Chen the deck and one-pager",
  },
  {
    accountKey: "datadog",
    name: "Datadog sales engagement",
    stage: "Pipeline",
    amount: 120_000,
    closeMs: Date.parse("2026-12-19T17:00:00-08:00"),
    nextStep: "Discovery call Wed 11:00 AM",
  },
];

export const DEFAULT_WATCHLIST = ["snowflake", "stripe"];

export const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "cal-snowflake-expansion",
    title: "Snowflake — expansion review",
    startMs: Date.parse("2026-10-27T10:00:00-07:00"),
    endMs: Date.parse("2026-10-27T10:45:00-07:00"),
    accountKey: "snowflake",
    domain: "snowflake.com",
    external: true,
    attendees: [
      { email: PERSONA_EMAIL, name: PERSONA_PROFILE.name, internal: true },
      { email: "sam.ortiz@northwind.com", name: "Sam Ortiz", internal: true, role: "Sales Engineer" },
      { email: "riley.kim@snowflake.com", name: "Riley Kim" },
      { email: "morgan.patel@snowflake.com", name: "Morgan Patel" },
      { email: "jordan.lee@snowflake.com", name: "Jordan Lee" },
    ],
    location: "Zoom",
  },
  {
    id: "cal-stripe-followup",
    title: "Stripe — follow-up",
    startMs: Date.parse("2026-10-30T14:00:00-07:00"),
    endMs: Date.parse("2026-10-30T14:30:00-07:00"),
    accountKey: "stripe",
    domain: "stripe.com",
    external: true,
    attendees: [
      { email: PERSONA_EMAIL, name: PERSONA_PROFILE.name, internal: true },
      { email: "alex.chen@stripe.com", name: "Alex Chen" },
    ],
  },
  {
    id: "cal-internal-forecast",
    title: "Q4 forecast (internal)",
    startMs: Date.parse("2026-10-27T15:00:00-07:00"),
    endMs: Date.parse("2026-10-27T15:30:00-07:00"),
    accountKey: null,
    domain: null,
    external: false,
    attendees: [{ email: PERSONA_EMAIL, name: PERSONA_PROFILE.name, internal: true }],
  },
  {
    id: "cal-datadog-discovery",
    title: "Datadog — discovery call",
    startMs: Date.parse("2026-10-28T11:00:00-07:00"),
    endMs: Date.parse("2026-10-28T11:45:00-07:00"),
    accountKey: "datadog",
    domain: "datadoghq.com",
    external: true,
    attendees: [
      { email: PERSONA_EMAIL, name: PERSONA_PROFILE.name, internal: true },
      { email: "jamie.fox@datadoghq.com", name: "Jamie Fox" },
    ],
  },
];

export const INBOX_THREADS: InboxThread[] = [
  {
    id: "mail-stripe-demo",
    accountKey: "stripe",
    fromName: "Alex Chen",
    fromEmail: "alex.chen@stripe.com",
    subject: "Re: demo deck request",
    receivedMs: Date.parse("2026-10-03T09:12:00-07:00"),
    snippet: "Can you send the deck and a one-pager before we pick a pilot slot?",
    unanswered: true,
  },
];

/** What Alex asked for; the drafted reply carries both. */
export const REPLY_ATTACHMENTS = [
  { name: "Northwind demo deck.pdf", size: "4.2 MB" },
  { name: "Pilot one-pager.pdf", size: "310 KB" },
];

/** Fires on morning sweep when `now >= DEMO_MORNING_MS`. */
export const OVERNIGHT_SIGNALS: OvernightSignal[] = [
  {
    id: "sig-stripe-hiring",
    accountKey: "stripe",
    company: "Stripe",
    headline: "Hiring surge in go-to-market operations",
    atMs: Date.parse("2026-10-27T02:15:00-07:00"),
  },
  {
    id: "sig-snowflake-intent",
    accountKey: "snowflake",
    company: "Snowflake",
    headline: "Intent spike on Revenue Intelligence (88 → 91)",
    atMs: Date.parse("2026-10-27T03:40:00-07:00"),
  },
];

export function accountLabel(key: string): string {
  const map: Record<string, string> = { snowflake: "Snowflake", stripe: "Stripe", datadog: "Datadog" };
  return map[key] ?? key;
}

export function domainsFromCalendar(): string[] {
  return [...new Set(CALENDAR_EVENTS.map((e) => e.domain).filter(Boolean))] as string[];
}
