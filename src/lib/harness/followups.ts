import type { GtmJob } from "../gtm/jobs";
import type { FixtureBundle } from "../gtm/fixtures";
import type { FollowUp } from "../message";
import type { EntityRef } from "../spec";

export const DEMO_ACCOUNTS = ["Snowflake", "Stripe", "Salesforce"];

/** Suggested next turns, built from the job and evidence (no model call). */
export function followUpsFor(job: GtmJob | null, entity: EntityRef, data: FixtureBundle, notFound: boolean): FollowUp[] {
  if (notFound) {
    return DEMO_ACCOUNTS.map((name) => ({ label: `Research ${name}`, prompt: `Account research brief for ${name} before a call` }));
  }
  const company = data.company?.name ?? entity.company ?? "this account";
  const unengaged = data.committee?.members.find((m) => !m.engaged && m.role === "decision");
  const competitor = entity.competitor ?? data.gtmContext?.competitors[0] ?? "our top competitor";
  const contact = data.contact?.name ?? entity.contact;
  const options: Partial<Record<GtmJob | "prose", FollowUp[]>> = {
    account_brief: [
      { label: "Map the buying committee", prompt: `Map the buying committee at ${company}` },
      { label: "Why reach out now?", prompt: `Why should I reach out to ${company} this week?` },
      { label: "Draft a call agenda", prompt: `Draft a 30-minute call agenda for ${company} based on what we found` },
    ],
    buying_committee: [
      ...(unengaged ? [{ label: `Brief me on ${unengaged.name}`, prompt: `Contact research brief on ${unengaged.name} at ${company}` }] : []),
      { label: "Draft a multithreading email", prompt: `Draft a short email to bring another stakeholder at ${company} into the deal` },
      { label: "Why now?", prompt: `Why now case for ${company}` },
    ],
    intent_monitor: [
      { label: "Build the why-now case", prompt: `Why now case for reaching out to ${company} with timing hooks` },
      { label: "Score this account", prompt: `Score ${company} by ICP fit and in-market signals` },
    ],
    why_now: [
      { label: "Draft outreach from the top hook", prompt: `Draft a first outreach email to ${company} using the strongest timing hook` },
      { label: "Map the buying committee", prompt: `Map the buying committee at ${company}` },
    ],
    score_accounts: [
      { label: "Full account brief", prompt: `Account research brief for ${company}` },
      { label: "Why now?", prompt: `Why now case for ${company}` },
    ],
    tech_stack: [
      { label: `Compare us vs ${competitor}`, prompt: `Compare us vs ${competitor} at ${company}` },
      { label: "Full account brief", prompt: `Account research brief for ${company}` },
    ],
    competitor: [
      { label: "Draft a talk track", prompt: `Draft a competitive talk track for ${company} against ${competitor}` },
      { label: "Map the buying committee", prompt: `Map the buying committee at ${company}` },
    ],
    contact_brief: [
      ...(contact ? [{ label: `Draft an email to ${contact}`, prompt: `Draft a short first email to ${contact} at ${company}` }] : []),
      { label: "Map the buying committee", prompt: `Map the buying committee at ${company}` },
    ],
    draft: [
      { label: "Make it shorter", prompt: `Rewrite that draft for ${contact ?? company} in half the length` },
      { label: "Draft a follow-up", prompt: `Draft a follow-up to send ${contact ?? company} if there's no reply in a week` },
      { label: "Map the buying committee", prompt: `Map the buying committee at ${company}` },
    ],
    gtm_context: DEMO_ACCOUNTS.slice(0, 2).map((name) => ({ label: `Research ${name}`, prompt: `Account research brief for ${name}` })),
  };
  return (job ? options[job] : null) ?? [];
}

export const PROSE_FOLLOW_UPS: FollowUp[] = [
  { label: "Prep my Snowflake meeting", prompt: "Brief me before my call with Snowflake" },
  { label: "Map the Stripe buying committee", prompt: "Map the buying committee at Stripe" },
];
