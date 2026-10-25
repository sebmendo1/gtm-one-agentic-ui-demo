import "server-only";
import {
  APIConnectionError,
  choice,
  InternalServerError,
  RateLimitError,
  TypeSafeClient,
  type ChoiceResponse,
  type Questions,
  type RequestOptions,
  type SystemOneRequest,
} from "@typesafe-ai/sdk";
import { MAX_SECTIONS, UI_COMPONENTS, type Placement, type UiComponentId } from "../message";
import type { ClarifyingQuestion, SectionTrace, UiPick } from "../spec";
import { computeScores, finalizeCommittee, type Adapted } from "./adapt";
import { detectJobQuestions } from "./clarify-gtm";
import type { CommitteeMember, FixtureBundle } from "./fixtures";
import { GTM_JOBS, GTM_PURPOSES, type GtmJob, type GtmPurpose } from "./jobs";

let client: TypeSafeClient | undefined;

function jev(): TypeSafeClient {
  client ??= new TypeSafeClient();
  return client;
}

/** Calls normally answer in 1–3s; a bad network falls back within seconds instead of retrying for half a minute. */
const JEV_OPTIONS: RequestOptions = { timeout: 6000, retry: { maxRetries: 0 } };
/** After a failure, skip TypeSafe for a while so the next call and turn don't wait out another timeout. */
const COOL_DOWN_MS = 60_000;
let downUntil = 0;

/** TypeSafe is down or unreachable, as opposed to rejecting the request (bad key, bad input). */
function unreachable(error: unknown): boolean {
  return error instanceof APIConnectionError || error instanceof RateLimitError || error instanceof InternalServerError;
}

function orUnreachable(error: unknown): null {
  if (!unreachable(error)) throw error;
  downUntil = Date.now() + COOL_DOWN_MS;
  console.warn(`TypeSafe unreachable, using keyword fallback: ${error instanceof Error ? error.message : String(error)}`);
  return null;
}

function askJev<Q extends Questions>(request: SystemOneRequest<Q>) {
  if (Date.now() < downUntil) return Promise.resolve(null);
  return jev().systemOne(request, JEV_OPTIONS).catch(orUnreachable);
}

export const KEYWORD_MODEL = "keyword fallback (TypeSafe unreachable)";

const KEYWORD_JOBS: [RegExp, GtmJob][] = [
  [/\b(draft|write|reply|email|agenda|talk track)\b/i, "draft"],
  [/\b(buying committee|committee|stakeholders?|decision[- ]makers?|multithread)/i, "buying_committee"],
  [/\bwhy now\b|\btiming\b|\bmove now\b/i, "why_now"],
  [/\bintent\b/i, "intent_monitor"],
  [/\b(score|tier|icp fit)\b/i, "score_accounts"],
  [/\btech(nology)? stack|technograph/i, "tech_stack"],
  [/\b(competitor|compare|versus|vs\.?)\b/i, "competitor"],
  [/\b(our (offerings|personas|icp|competitors)|gtm context)\b/i, "gtm_context"],
  [/\b(?:[Bb]rief me on|[Ww]ho is|[Rr]esearch) [A-Z][a-z]+ [A-Z][a-z'-]+/, "contact_brief"],
];
const PRODUCT_QUESTION = /\b(gtm ai|zoominfo|set (it )?up|install|sign in|cli|mcp|credits?|what can you do)\b/i;

function fallbackChoice<T extends string>(label: T, confidence = 0.6): ChoiceResponse {
  return { type: "choice", choice: label, confidence, probabilities: { [label]: confidence } };
}

function keywordClassification(description: string, previous: string | null, namesAccount: boolean, clarifications: Record<string, string>): Classification {
  const text = description.trim().split(/\s+/).length <= 4 && previous ? `${description} ${previous}` : description;
  const job = KEYWORD_JOBS.find(([pattern]) => pattern.test(text))?.[1] ?? "account_brief";
  const prose = !namesAccount && PRODUCT_QUESTION.test(description);
  return {
    surface: { choice: prose ? "prose" : "genui", confidence: 0.8 },
    job: { choice: applyJobClarification(job, clarifications), confidence: 0.6, probabilities: { [job]: 0.6 } },
    questions: [],
    model: KEYWORD_MODEL,
    usage: { input_tokens: null, output_tokens: null },
  };
}

const SURFACES = {
  genui:
    "Asks for data or research about a company, person, or account (brief, tech stack, intent, timing, score, committee, competitor, a draft email or talk track for them) or about our own GTM context",
  prose:
    "Asks about ZoomInfo or GTM AI themselves (products, Context Agents, Skills, Context Graph, data types, credits), how to install, sign in to, connect, or use the GTM CLI, MCP, or this app, or what this assistant can do, without needing data about any company or person",
} as const;

const UI_MODES = {
  visual:
    "Show the evidence as interactive components (cards, tables, scores, timelines) next to a short conversational answer — the user wants to see, compare, or explore data",
  text: "Reply in conversational text only — the user wants a draft (email, agenda, talk track), advice, a summary, a yes/no answer, or a follow-up explanation",
} as const;

/** Asked of every candidate besides Jev's main pick; "omit" is the expected answer. */
const EXTRA = {
  inline: "Also show it, beside the paragraph it supports — the user would clearly miss it, and the best single view doesn't cover it",
  omit: "Leave it out (the default) — the best single view or the text already covers it, or it adds little here",
} as const;

/** How many views the request needs; slot thresholds apply to these probabilities. */
const VIEW_COUNT = {
  one: "One view — a single view plus the text answers it. This covers most requests, including briefs, lookups, and single questions",
  two: "Two views — the request explicitly asks about two different things that each need their own view (e.g. the committee and the tech stack)",
  three: "Three views — the request explicitly asks for three or more distinct things, each needing its own view",
} as const;

const COMPOSE_OPTION =
  "Custom view: built from this data for something no listed component shows — a calculation, filter, what-if, or side-by-side";

const TOPIC_MAP = {
  ours: "This intent topic maps to one of our offerings",
  other: "This topic is a competitor or adjacent category, not our offering",
} as const;

const ROLES = {
  decision: "Decision-maker or economic buyer",
  champion: "Champion who sponsors us internally",
  influencer: "Influencer or evaluator",
  blocker: "Gatekeeper such as procurement, legal, security, or architecture review",
} as const;

/** Fallback when Jev chooses visual but omits every component. */
export const PRIMARY_COMPONENTS: Record<GtmJob, UiComponentId[]> = {
  account_brief: ["company", "signals", "next_actions"],
  buying_committee: ["committee"],
  intent_monitor: ["intent"],
  why_now: ["why_now"],
  score_accounts: ["scores"],
  tech_stack: ["tech_stack"],
  competitor: ["comparison"],
  contact_brief: ["contact"],
  draft: [],
  gtm_context: ["gtm_context"],
};

/**
 * Minimum keep score (1 − P(omit)) for the 1st, 2nd, and 3rd GenUI section of a reply. The first is
 * Jev's comparative main pick (keep 1); each extra needs a much stronger case, so most replies show
 * one (docs/specs/04-jev-decisions.md § Section budget).
 */
export const SECTION_THRESHOLDS = [0.5, 0.8, 0.9] as const;

/** Sections that repeat each other's data; a reply shows at most one from each group. */
const OVERLAPS: (UiComponentId | "compose")[][] = [
  ["company", "scores"],
  ["signals", "why_now"],
];

const TEXT_MIN_CONFIDENCE = 0.5;
const LEAD_MIN_CONFIDENCE = 0.5;

function applyJobClarification(job: GtmJob, clarifications: Record<string, string>): GtmJob {
  if (clarifications.job && clarifications.job in GTM_JOBS) return clarifications.job as GtmJob;
  if (clarifications.account_brief_vs_committee === "account_brief") return "account_brief";
  if (clarifications.account_brief_vs_committee === "buying_committee") return "buying_committee";
  if (clarifications.intent_vs_why_now === "intent_monitor") return "intent_monitor";
  if (clarifications.intent_vs_why_now === "why_now") return "why_now";
  return job;
}

export interface Classification {
  surface: { choice: "genui" | "prose"; confidence: number };
  job: { choice: GtmJob; confidence: number; probabilities: Record<string, number> };
  questions: ClarifyingQuestion[];
  model: string;
  usage: { input_tokens: number | null; output_tokens: number | null };
}

const TASK = {
  specific: "It names a task or deliverable (a brief, committee, scores, email, tech stack, comparison, why-now…)",
  vague: 'It only names an account or person with no clear task ("help me with Stripe", "Snowflake?")',
} as const;
const VAGUE_MIN_CONFIDENCE = 0.6;

/** Jev call 1 — surface and job (docs/specs/04-jev-decisions.md). */
export async function classifyTurn(
  description: string,
  candidates: string[],
  clarifications: Record<string, string>,
  namesAccount = false,
  previous: string | null = null,
): Promise<Classification> {
  const request = {
    state: { description, previous_request: previous ?? "", candidates, clarifications },
    questions: {
      surface: choice(
        "Is `description` asking for GTM research about an account, person, or our context, or a general question about the product answered in prose? `previous_request` is the earlier turn, for follow-ups.",
        SURFACES,
      ),
      job: choice("Which GTM job or skill does `description` ask for? Use `previous_request` to resolve follow-ups.", GTM_JOBS),
      task: choice("Does `description` (with `previous_request`) say what the user wants done, or does it only name an account or person?", TASK),
    },
  };
  const result = await askJev(request);
  if (!result) return keywordClassification(description, previous, namesAccount, clarifications);
  const surfaceResp = result.answers.surface as ChoiceResponse<typeof SURFACES>;
  const jobResp = result.answers.job as ChoiceResponse<typeof GTM_JOBS>;
  const taskResp = result.answers.task as ChoiceResponse<typeof TASK>;
  const vague = taskResp.choice === "vague" && taskResp.confidence >= VAGUE_MIN_CONFIDENCE;
  return {
    surface: { choice: surfaceResp.choice as "genui" | "prose", confidence: surfaceResp.confidence },
    job: {
      choice: applyJobClarification(jobResp.choice as GtmJob, clarifications),
      confidence: jobResp.confidence,
      probabilities: jobResp.probabilities,
    },
    questions: detectJobQuestions(jobResp.probabilities, clarifications, namesAccount, vague),
    model: result.model,
    usage: result.usage,
  };
}

function available(id: UiComponentId, job: GtmJob, b: FixtureBundle): boolean {
  switch (id) {
    case "company":
      return Boolean(b.company);
    case "intent":
      return Boolean(b.signals?.topics.length);
    case "signals":
      return Boolean(b.signals?.scoops.length || b.signals?.news.length);
    case "next_actions":
      return Boolean(b.company?.nextActions.length);
    case "committee":
      return Boolean(b.committee?.members.length);
    case "scores":
      return Boolean(b.company) && (job === "score_accounts" || Boolean(b.signals?.topics.length));
    case "tech_stack":
      return Boolean(b.tech?.categories.length);
    case "comparison":
      return Boolean(b.competitor?.rows.length);
    case "contact":
      return Boolean(b.contact);
    case "why_now":
      return Boolean(b.whyNow?.hooks.length);
    case "gtm_context":
      return Boolean(b.gtmContext?.offerings.length) && (job === "gtm_context" || job === "competitor");
  }
}

/** The job's first primary component with data, for when a visual reply would otherwise show nothing. */
export function primaryComponent(job: GtmJob, bundle: FixtureBundle): UiComponentId | null {
  return PRIMARY_COMPONENTS[job].find((id) => available(id, job, bundle)) ?? null;
}

export interface UiDecision {
  data: FixtureBundle;
  mode: { choice: "visual" | "text"; confidence: number };
  placements: Partial<Record<UiComponentId, Placement>>;
  /** Where a composed block may go, or null when the reply gets none. */
  compose: Placement | null;
  picks: UiPick[];
  /** Section budget before the writer runs; `shown` is filled in from the final reply. */
  sections: Omit<SectionTrace, "shown">;
  purpose: { choice: GtmPurpose; confidence: number };
  model: string | null;
  usage: { input_tokens: number | null; output_tokens: number | null };
}

function keepScore(resp: ChoiceResponse | undefined): number {
  if (!resp) return 0;
  const omit = resp.probabilities?.omit;
  if (typeof omit === "number") return Math.max(0, Math.min(1, 1 - omit));
  return resp.choice === "omit" ? 1 - resp.confidence : resp.confidence;
}

/**
 * Fills up to MAX_SECTIONS slots, strongest first. Slot n needs both the pick's keep score and
 * `need[n]` (Jev's probability that the request needs n+1 views) to reach SECTION_THRESHOLDS[n].
 * Overlapping sections are skipped, and only the first section may lead.
 */
export function selectSections(
  picks: UiPick[],
  need: number[] = [1, 1, 1],
): {
  chosen: { id: UiPick["id"]; placement: Placement }[];
  dropped: SectionTrace["dropped"];
} {
  const chosen: { id: UiPick["id"]; placement: Placement }[] = [];
  const dropped: SectionTrace["dropped"] = [];
  const ranked = [...picks].sort(
    (a, b) => Number(b.placement === "lead") - Number(a.placement === "lead") || b.keep - a.keep,
  );
  for (const p of ranked) {
    if (p.placement === "omit") {
      dropped.push({ id: p.id, reason: "omitted" });
      continue;
    }
    if (chosen.length >= MAX_SECTIONS) {
      dropped.push({ id: p.id, reason: "cap" });
      continue;
    }
    const slot = chosen.length;
    const needed = SECTION_THRESHOLDS[slot]!;
    const score = Math.min(p.keep, need[slot] ?? 0);
    if (score < needed) {
      const why = (need[slot] ?? 0) < p.keep ? `request needs ${slot + 1} views: ${(need[slot] ?? 0).toFixed(2)}` : `keep ${p.keep.toFixed(2)}`;
      dropped.push({ id: p.id, reason: "below_threshold", detail: `${why} < ${needed}` });
      continue;
    }
    const clash = chosen.find((c) => OVERLAPS.some((group) => group.includes(c.id) && group.includes(p.id)));
    if (clash) {
      dropped.push({ id: p.id, reason: "overlap", detail: `repeats ${clash.id}` });
      continue;
    }
    chosen.push({ id: p.id, placement: chosen.length === 0 ? p.placement : "inline" });
  }
  return { chosen, dropped };
}

/**
 * Jev call 2 — after evidence is in: whether the reply shows UI at all, which sections, and where
 * each goes (lead or inline). Also maps intent topics and committee roles.
 */
export async function decideUi(input: {
  description: string;
  previous: string | null;
  job: GtmJob;
  clarifications: Record<string, string>;
  adapted: Adapted;
  /** Whether the writer can compose a custom view this turn (it needs the model writer). */
  allowCompose: boolean;
}): Promise<UiDecision> {
  const { job, adapted } = input;
  const bundle: FixtureBundle = structuredClone(adapted.bundle);
  const candidates = (Object.keys(UI_COMPONENTS) as UiComponentId[]).filter((id) => available(id, job, bundle));
  const composable = input.allowCompose && job !== "draft" && candidates.length > 0;
  const topics = bundle.signals?.topics ?? [];
  const members: CommitteeMember[] = bundle.committee?.members ?? [];

  const questions: Record<string, ReturnType<typeof choice>> = {
    purpose: choice("What is the primary purpose behind `description`?", GTM_PURPOSES),
    mode: choice(
      "Should the reply to `description` show interactive components, or is a conversational text reply best? `components` lists what evidence can be shown.",
      UI_MODES,
    ),
  };
  // Comparative first (which one view answers it best), then a high bar for anything extra.
  const views: Record<string, string> = Object.fromEntries(candidates.map((id) => [id, `${UI_COMPONENTS[id].label}: ${UI_COMPONENTS[id].describe}`]));
  if (composable) views.compose = COMPOSE_OPTION;
  const viewIds = Object.keys(views) as UiPick["id"][];
  if (viewIds.length > 1) {
    questions.main_view = choice(`If the reply to \`description\` (job: ${job}) shows exactly one view, which one answers it best?`, views);
    questions.view_count = choice("How many separate views does the reply to `description` need?", VIEW_COUNT);
  }
  for (const id of viewIds) {
    const what = id === "compose" ? "a custom view built from this data" : `the "${UI_COMPONENTS[id].label}" component (${UI_COMPONENTS[id].describe})`;
    questions[`extra_${id}`] = choice(
      `Unless it is the best single view, would the user clearly miss ${what} if the reply to \`description\` left it out?`,
      EXTRA,
    );
  }
  topics.forEach((t, i) => {
    questions[`topic_${i}`] = choice(`Does intent topic \`topics[${i}]\` ("${t.topic}") map to one of \`offerings\`?`, TOPIC_MAP);
  });
  members.forEach((m, i) => {
    questions[`member_${i}`] = choice(`What buying role does \`members[${i}]\` (${m.title}) most likely play?`, ROLES);
  });

  const offerings = bundle.gtmContext?.offerings ?? [];
  const result = await askJev({
    state: {
      description: input.description,
      previous_request: input.previous ?? "",
      job,
      clarifications: input.clarifications,
      components: candidates.map((id) => `${id}: ${UI_COMPONENTS[id].describe}`),
      offerings,
      topics: topics.map((t) => t.topic),
      members: members.map((m) => ({ name: m.name, title: m.title })),
    },
    questions,
  });
  const answers = result
    ? (result.answers as unknown as Record<string, ChoiceResponse>)
    : fallbackUiAnswers(job, bundle, viewIds, topics.map((t) => t.topic), offerings);

  topics.forEach((t, i) => {
    t.mapsToUs = answers[`topic_${i}`]?.choice === "ours";
    t.reason = `${t.mapsToUs ? "Maps to our offerings" : "Competitor or adjacent category"} · signal score ${t.score ?? "—"}`;
  });
  members.forEach((m, i) => {
    const role = answers[`member_${i}`]?.choice as CommitteeMember["role"] | undefined;
    if (role) m.role = role;
  });
  if (bundle.committee) bundle.committee = finalizeCommittee(bundle.committee, adapted.entityLabel ?? "the account");
  const scores = computeScores(bundle, Date.now());
  if (scores) {
    bundle.scores = scores;
    if (bundle.company) bundle.company.icpFit = `${scores.fitLabel} (${scores.fit}/100)`;
  }

  const mainResp = answers.main_view;
  const main = (mainResp?.choice ?? viewIds[0]) as UiPick["id"] | undefined;
  const picks: UiPick[] = viewIds.map((id) => {
    if (id === main) return { id, placement: "lead", confidence: mainResp?.confidence ?? 1, keep: 1 };
    const resp = answers[`extra_${id}`];
    return { id, placement: (resp?.choice as "inline" | "omit" | undefined) ?? "omit", confidence: resp?.confidence ?? 0, keep: keepScore(resp) };
  });

  const modeResp = answers.mode as ChoiceResponse<typeof UI_MODES>;
  // An unsure "text" call yields to a confident pick to lead with a component.
  const textOverruled =
    modeResp.choice === "text" &&
    modeResp.confidence < TEXT_MIN_CONFIDENCE &&
    picks.some((p) => p.placement === "lead" && p.confidence >= LEAD_MIN_CONFIDENCE);
  const modeChoice = (textOverruled ? "visual" : modeResp.choice) as "visual" | "text";
  const mode = { choice: modeChoice, confidence: textOverruled ? (modeResp.probabilities[modeChoice] ?? 0) : modeResp.confidence };

  const count = answers.view_count?.probabilities ?? {};
  const need = [1, (count.two ?? 0) + (count.three ?? 0), count.three ?? 0];

  const placements: Partial<Record<UiComponentId, Placement>> = {};
  let compose: Placement | null = null;
  let dropped: SectionTrace["dropped"] = [];
  if (mode.choice === "visual") {
    const selection = selectSections(picks, need);
    dropped = selection.dropped;
    for (const c of selection.chosen) {
      if (c.id === "compose") compose = c.placement;
      else placements[c.id] = c.placement;
    }
    if (selection.chosen.length === 0) {
      const primary = primaryComponent(job, bundle);
      if (primary) {
        placements[primary] = "lead";
        dropped = dropped.filter((d) => d.id !== primary);
      }
    }
  } else {
    dropped = picks.map((p) => ({ id: p.id, reason: "text_mode" as const }));
  }
  const allowed = Object.keys(placements).length + (compose ? 1 : 0);

  const purposeResp = answers.purpose as ChoiceResponse<typeof GTM_PURPOSES>;
  return {
    data: bundle,
    mode,
    placements,
    compose,
    picks,
    sections: { limit: MAX_SECTIONS, allowed, dropped, need: need.map((n) => Math.round(n * 100) / 100) },
    purpose: { choice: purposeResp.choice as GtmPurpose, confidence: purposeResp.confidence },
    model: result?.model ?? KEYWORD_MODEL,
    usage: result?.usage ?? { input_tokens: null, output_tokens: null },
  };
}

/** The answers decideUi would get from Jev, from the job's defaults; members keep their fixture roles. */
function fallbackUiAnswers(
  job: GtmJob,
  bundle: FixtureBundle,
  viewIds: UiPick["id"][],
  topics: string[],
  offerings: string[],
): Record<string, ChoiceResponse> {
  const words = new Set(offerings.flatMap((o) => o.toLowerCase().split(/\W+/)).filter((w) => w.length > 3));
  const main = primaryComponent(job, bundle) ?? viewIds[0];
  return {
    purpose: fallbackChoice("pre_call"),
    mode: fallbackChoice(job === "draft" ? "text" : "visual", 1),
    ...(main ? { main_view: fallbackChoice(main, 1) } : {}),
    view_count: fallbackChoice("one", 1),
    ...Object.fromEntries(viewIds.map((id) => [`extra_${id}`, fallbackChoice("omit", 1)])),
    ...Object.fromEntries(
      topics.map((t, i) => [`topic_${i}`, fallbackChoice(t.toLowerCase().split(/\W+/).some((w) => words.has(w)) ? "ours" : "other")]),
    ),
  };
}
