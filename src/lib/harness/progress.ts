import type { CommandId, PlanStep } from "../gtm/commands";
import type { GtmJob } from "../gtm/jobs";
import type { Entity } from "./evidence";

/** Live status copy: present tense, names the account or person, no tool ids. */

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}’` : `${name}’s`;
}

function companyName(entity: Entity): string | null {
  return entity.company ?? entity.domain;
}

const STEP_COPY: Record<CommandId, (company: string | null, contact: string | null, step: PlanStep) => string> = {
  gtm_context_get: () => "Reading your saved GTM context",
  lookup: () => "Checking ZoomInfo reference values",
  companies_search: (c) => (c ? `Finding ${c} in ZoomInfo` : "Searching ZoomInfo for the company"),
  companies_similar: (c) => (c ? `Finding companies like ${c}` : "Finding similar companies"),
  contacts_search: (c, p) => (p ? `Finding ${p} in ZoomInfo` : c ? `Finding the people at ${c}` : "Searching ZoomInfo contacts"),
  contacts_recommended: (c) => (c ? `Picking who to talk to at ${c}` : "Picking recommended contacts"),
  intent_search: (c) => (c ? `Checking what ${c} is researching` : "Checking intent signals"),
  scoops_search: (c) => (c ? `Scanning recent scoops on ${c}` : "Scanning recent scoops"),
  browse_engagements: (c) => (c ? `Checking our meetings and emails with ${c}` : "Checking our meetings and emails"),
  companies_enrich: (c, _p, step) =>
    /tech/i.test(JSON.stringify(step.flags))
      ? c ? `Pulling ${possessive(c)} tech stack` : "Pulling the tech stack"
      : c ? `Pulling ${possessive(c)} company profile` : "Pulling the company profile",
  contacts_enrich: (_c, p) => (p ? `Pulling ${possessive(p)} contact details` : "Pulling contact details"),
  company_signals: (c) => (c ? `Pulling intent, scoops, and news for ${c}` : "Pulling intent, scoops, and news"),
  research_account: (c) => (c ? `Researching ${c} with ZoomInfo AI — this one takes a moment` : "Running ZoomInfo AI research"),
  research_contact: (_c, p) => (p ? `Researching ${p} with ZoomInfo AI — this one takes a moment` : "Running ZoomInfo AI research"),
  conversation_intelligence: (c) => (c ? `Reviewing recent calls with ${c}` : "Reviewing recent calls"),
};

export function stepProgress(step: PlanStep, entity: Entity): string {
  return STEP_COPY[step.command](companyName(entity), entity.contact, step);
}

const JOB_NOUN: Record<GtmJob, string> = {
  account_brief: "account brief",
  buying_committee: "buying committee",
  intent_monitor: "intent read",
  why_now: "why-now case",
  score_accounts: "account score",
  tech_stack: "tech stack snapshot",
  competitor: "competitive comparison",
  contact_brief: "contact brief",
  draft: "draft",
  gtm_context: "GTM context summary",
};

function subject(entity: Entity): string | null {
  return entity.contact ?? companyName(entity);
}

export const progress = {
  reading: (entity: Entity) => {
    const s = subject(entity);
    return s ? `Reading your request about ${s}` : "Reading your request";
  },
  prose: (gemini: boolean) => (gemini ? "Writing an answer" : "Looking it up in the setup guide"),
  planning: (job: GtmJob, entity: Entity) => {
    const s = subject(entity);
    return s ? `Planning the ${JOB_NOUN[job]} for ${s}` : `Planning the ${JOB_NOUN[job]}`;
  },
  plannerFallback: () => "Gemini is unavailable — switching to the standard research plan",
  approved: (paid: number) => (paid === 1 ? "Running the step you approved" : `Running the ${paid} steps you approved`),
  declined: () => "Skipping paid steps — working with free data only",
  deciding: (sources: number) => `Choosing what to show from ${sources} source${sources === 1 ? "" : "s"}`,
  reusing: (calls: number, entity: Entity) => {
    const s = subject(entity);
    return `Reusing ${calls} result${calls === 1 ? "" : "s"} from earlier${s ? ` about ${s}` : ""}`;
  },
  writing: (job: GtmJob, entity: Entity) => {
    const s = subject(entity);
    return s ? `Writing up the ${JOB_NOUN[job]} for ${s}` : `Writing up the ${JOB_NOUN[job]}`;
  },
  writerFallback: () => "Gemini is busy — writing the reply straight from the evidence",
};
