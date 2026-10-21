import "server-only";
import { streamText } from "ai";
import { DATA_ROOTS, catalogPrompt, type DataRoot } from "../genui/catalog";
import { compileComposed, countElements } from "../genui/compile";
import type { Adapted } from "../gtm/adapt";
import type { FixtureBundle } from "../gtm/fixtures";
import { GTM_JOBS, GTM_PURPOSES, type GtmJob, type GtmPurpose } from "../gtm/jobs";
import {
  UI_COMPONENTS,
  composeBlocks,
  keepKnownCitations,
  placedComponents,
  type MessageFrame,
  type UiComponentId,
} from "../message";
import type { HistoryEntry, SectionTrace } from "../spec";
import { GEMINI_PROVIDER_OPTIONS, SAFETY_BLOCKED, WRITER_TIMEOUT, addUsage, geminiModel, type TokenTally } from "./gemini";
import type { Evidence, Ledger } from "./evidence";
import { SCOPE_RULES, UNTRUSTED_REMINDER, UNTRUSTED_RULES, countRedactions, fenceUntrusted, screenUntrusted } from "./guardrails";
import { PLATFORM_RULES } from "./knowledge";

const MAX_RECORD_CHARS = 6000;

// Behavior rules from the GTM AI onboarding prompt (docs/specs/06-setup-gtm-ai.md §3).
const ONBOARDING_RULES = [
  "Cite the evidence id in square brackets right after each material fact, e.g. \"Intent on revenue intelligence is high [e4].\" Include the date when the evidence has one.",
  'If a step is "denied" (No approval received), say so plainly and name the tool. Do not invent what it would have returned.',
  'Separate an unavailable or unauthorized source from a successful search with no matching records. Never infer "no customer history" from an empty result.',
  "Recommend CRM changes as drafts only. Never claim a CRM update was made.",
  "Only use facts present in the evidence. No outside knowledge about the company.",
  "Ledger items marked carried were gathered earlier in this chat; use them like any other evidence.",
];

/** What the reply is shaped like depends on the job; the account-briefing shape is only for briefs. */
function shapeRules(job: GtmJob): string[] {
  if (job === "draft") {
    return [
      "Write the requested draft first: an email starts with a **Subject:** line; an agenda is a numbered list; a talk track is short bullets. Keep it ready to send.",
      "Use only specifics the evidence supports. Keep citations out of the draft text; after it, add one line starting `Grounded in:` followed by the citations you used.",
      "Then, only if the evidence is thin, one sentence on what to verify before sending. No briefing sections and no **Next step:** label.",
    ];
  }
  const briefing = job === "account_brief" || job === "contact_brief";
  return [
    briefing
      ? "Cover where things stand, what changed, what remains unresolved, and one recommended next action — in conversational prose, not a form."
      : "Answer the question this job asks in the first sentence or two, then add only the detail that helps, and end with one recommended next action.",
    "Weave those points into natural sentences; do not label paragraphs (no \"What changed:\" or \"What remains unresolved:\").",
    "Bold the recommended next step as **Next step:**.",
  ];
}

export function sourceLabels(ledger: Ledger): Record<string, string> {
  return Object.fromEntries(
    ledger.items.map((e) => [e.id, `${e.command.replaceAll("_", " ")} · ${e.source === "fixtures" ? "fixtures" : "GTM CLI"}`]),
  );
}

function evidencePayload(items: Evidence[]) {
  return items.map((e) => ({
    id: e.id,
    command: e.command,
    step: e.reason,
    status: e.status,
    ...(e.carried ? { carried: true } : {}),
    error: e.error && screenUntrusted(e.error).value,
    records: JSON.stringify(screenUntrusted(e.records).value).slice(0, MAX_RECORD_CHARS),
  }));
}

function componentRules(frame: MessageFrame): string[] {
  const entries = Object.entries(frame.placements) as [UiComponentId, "lead" | "inline"][];
  if (!entries.length && !frame.compose) {
    return ["This reply is text only: do not write any <ui:…/> tags. Write the full answer (draft, advice, summary) in Markdown."];
  }
  const budget = entries.length + (frame.compose ? 1 : 0);
  return [
    `The app renders interactive views from the evidence. This reply gets exactly ${budget} view${budget === 1 ? "" : "s"} — do not add others.`,
    ...(entries.length
      ? [
          "Place each component below exactly once, with its tag alone on its own line, e.g. `<ui:company/>`.",
          ...entries.map(([id, placement]) => `- <ui:${id}/> (${placement}): ${UI_COMPONENTS[id].label} — ${UI_COMPONENTS[id].describe}`),
          "Put a lead component right after your opening sentence or two. Put inline components right after the paragraph they support.",
        ]
      : []),
    "A view already shows its values, so do not repeat its numbers, rows, or lists in text — interpret them and refer to them (\"the committee below shows…\").",
    ...(frame.allowCrmDrafts
      ? ['Only if a CRM field is clearly out of date, write one `<ui:crm_draft field="Field_Name" value="new value" reason="why"/>` on its own line. It is a draft the user applies.']
      : []),
  ];
}

const COMPOSE_EXAMPLE = [
  '<ui:compose title="Intent on our offerings">',
  '<state name="floor" value={60}/>',
  '<slider state="floor" min={0} max={100} step={5} label="Minimum signal score"/>',
  '<box gap={2}>',
  '<each of={signals.topics} as="t" where={t.mapsToUs && t.score >= floor} limit={6}>',
  '<box direction="row" align="between"><text>{t.topic}</text><badge label={t.score} tone="emphasis"/></box>',
  "</each>",
  "</box>",
  "<text tone=\"muted\" size=\"sm\">{len(signals.topics)} topics in total</text>",
  "</ui:compose>",
].join("\n");

/** Shape of the frame data, so the writer knows which paths it can bind to. */
function dataPreview(data: FixtureBundle): Record<string, unknown> {
  const trim = (value: unknown, depth: number): unknown => {
    if (Array.isArray(value)) return value.slice(0, 2).map((v) => trim(v, depth + 1));
    if (value && typeof value === "object") {
      if (depth > 3) return "{…}";
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trim(v, depth + 1)]));
    }
    return typeof value === "string" && value.length > 80 ? `${value.slice(0, 77)}…` : value;
  };
  return Object.fromEntries(
    (Object.keys(DATA_ROOTS) as DataRoot[]).filter((root) => data[root] !== undefined).map((root) => [root, trim(data[root], 0)]),
  );
}

function composeRules(frame: MessageFrame): string[] {
  if (!frame.compose) return [];
  return [
    `One of the views is a custom view you compose, placed ${frame.compose === "lead" ? "right after your opening sentence or two" : "right after the paragraph it supports"}. Use it for what no component shows: a what-if, a filtered list, a calculation, or a side-by-side. Do not rebuild a listed component.`,
    "Write it between a line `<ui:compose title=\"Short title\">` and a line `</ui:compose>`, using only these JSX-like elements (* = required prop):",
    catalogPrompt(),
    "Bind every value to the frame data below with {expressions}: paths (company.employees, signals.topics[0].score), + - * / %, comparisons, && || !, a ? b : c, and round floor ceil abs min max len join fmt pct lower upper. Quoted strings are only for labels and options.",
    "Never type a number, name, or date from the evidence into the view; bind it, so the view always matches the data. Props of type data must be {expressions}.",
    'For interaction, declare <state name="x" value={…}/> and bind <slider state="x"/> or <segmented state="x"/>; the view recomputes locally without a new message. Buttons with action="ask" send their message as the user\'s next turn.',
    "Keep it to one card's worth (under 25 elements). Spacing is on the 4px scale: gap={2} is 8px, gap={4} is 16px. No citations inside the view; its sources are shown automatically.",
    "Example:",
    COMPOSE_EXAMPLE,
    "Frame data (arrays cut to 2 items; use len() for counts):",
    fenceUntrusted("frame_data", screenUntrusted(dataPreview(frame.data)).value),
  ];
}

export async function streamWithGemini(input: {
  description: string;
  history: HistoryEntry[];
  job: GtmJob;
  purpose: GtmPurpose;
  ledger: Ledger;
  frame: MessageFrame;
  coverage: string[];
  usage: TokenTally;
  onDelta: (text: string) => void;
}): Promise<string> {
  const { ledger, frame, usage } = input;
  const result = streamText({
    model: geminiModel(),
    temperature: 0.3,
    maxRetries: 1,
    timeout: WRITER_TIMEOUT,
    providerOptions: GEMINI_PROVIDER_OPTIONS,
    instructions: [
      "You are GTM AI, a conversational assistant for B2B sellers, working from ZoomInfo evidence. You never invent facts.",
      ...SCOPE_RULES,
      "Reply like a sharp colleague in chat. GitHub-flavored Markdown; short paragraphs; bullets when listing; ### headings only for long replies.",
      ...shapeRules(input.job),
      ...ONBOARDING_RULES,
      ...PLATFORM_RULES,
      "Refer to GTM calls by what they do, using the evidence `step` (\"the technographics lookup\"), never by command ids like companies_enrich.",
      ...componentRules(frame),
      ...composeRules(frame),
      `Job: ${input.job} — ${GTM_JOBS[input.job]}.`,
      `Purpose: ${input.purpose} — ${GTM_PURPOSES[input.purpose]}.`,
      `Entity: ${frame.entityLabel ?? "unknown"}.`,
      `Source coverage (computed by code; the app shows it under the reply, mention it only where it changes the answer): ${input.coverage.join(" | ")}`,
      ...UNTRUSTED_RULES,
      "Evidence ledger:",
      fenceUntrusted("evidence", evidencePayload(ledger.items)),
      UNTRUSTED_REMINDER,
    ].join("\n"),
    messages: [
      ...input.history.map((h) => ({ role: h.role, content: h.text })),
      { role: "user" as const, content: input.description },
    ],
  });
  let text = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      text += part.text;
      input.onDelta(part.text);
    } else if (part.type === "error") {
      throw part.error instanceof Error ? part.error : new Error(String(part.error));
    }
  }
  addUsage(usage, await result.totalUsage);
  if ((await result.finishReason) === "content-filter") throw new Error(SAFETY_BLOCKED);
  return text;
}

/** The G6 notice (docs/specs/09-guardrails.md) when instruction-like text was removed from evidence. */
function securityNotice(ledger: Ledger): string | null {
  const { sources } = countRedactions(ledger.items);
  if (!sources) return null;
  const which = sources === 1 ? "One GTM source" : `${sources} GTM sources`;
  return `> **Security notice:** ${which} contained text that looked like instructions to an AI. It was treated as data and not followed.`;
}

export interface Finalized {
  markdown: string;
  /** What happened to the composed view Jev allowed: shown, never written, or removed by the compiler. */
  compose: { status: "shown" | "not_placed" | "invalid"; report: NonNullable<SectionTrace["compose"]> | null } | null;
}

/**
 * Keeps the first composed block when Jev allowed one and it compiles to something visible; removes
 * any other. Closes a block the writer left open.
 */
function finalizeCompose(markdown: string, frame: MessageFrame): Finalized {
  const lines = markdown.split("\n");
  const blocks = composeBlocks(markdown);
  let compose: Finalized["compose"] = frame.compose ? { status: "not_placed", report: null } : null;
  for (const [i, block] of [...blocks.entries()].reverse()) {
    const remove = () => lines.splice(block.start, block.end - block.start + 1);
    if (i > 0 || !frame.compose) {
      remove();
      continue;
    }
    const compiled = compileComposed(block.body, block.title);
    const report = { nodes: countElements(compiled.nodes), roots: compiled.roots, diagnostics: compiled.diagnostics };
    if (!compiled.nodes.length) {
      remove();
      compose = { status: "invalid", report };
      continue;
    }
    const body = block.body.split("\n").filter((line) => line.trim());
    lines.splice(block.start, block.end - block.start + 1, block.title ? `<ui:compose title="${block.title}">` : "<ui:compose>", ...body, "</ui:compose>");
    compose = { status: "shown", report };
  }
  return { markdown: lines.join("\n"), compose };
}

/**
 * Drops unknown citations, validates the composed view, and places any component Jev chose that the
 * writer skipped. When the allowed composed view didn't arrive, its slot is released in `frame`, and a
 * reply left with no view gets `fallback` as its lead component.
 */
export function finalizeMarkdown(raw: string, frame: MessageFrame, ledger: Ledger, fallback: UiComponentId | null = null): Finalized {
  const composed = finalizeCompose(keepKnownCitations(raw.trim(), new Set(ledger.items.map((e) => e.id))), frame);
  if (frame.compose && composed.compose?.status !== "shown") {
    frame.compose = null;
    if (fallback && !Object.keys(frame.placements).length) frame.placements = { [fallback]: "lead" };
  }
  let markdown = composed.markdown;
  const placed = placedComponents(markdown);
  const missing = (Object.entries(frame.placements) as [UiComponentId, string][]).filter(([id]) => !placed.has(id));
  const lead = missing.filter(([, p]) => p === "lead").map(([id]) => `<ui:${id}/>`);
  const inline = missing.filter(([, p]) => p === "inline").map(([id]) => `<ui:${id}/>`);
  if (lead.length) {
    const paragraphs = markdown.split(/\n{2,}/);
    paragraphs.splice(Math.min(1, paragraphs.length), 0, lead.join("\n\n"));
    markdown = paragraphs.join("\n\n");
  }
  if (inline.length) markdown = `${markdown}\n\n${inline.join("\n\n")}`;
  const notice = securityNotice(ledger);
  if (notice) markdown = `${markdown}\n\n${notice}`;
  return { markdown, compose: composed.compose };
}

function tag(id: UiComponentId) {
  return `<ui:${id}/>`;
}

const OPENERS: Record<GtmJob, (name: string) => string> = {
  account_brief: (n) => `Here's where things stand with ${n}.`,
  buying_committee: (n) => `Here's the buying committee at ${n}.`,
  contact_brief: (n) => `Here's what we know about ${n}.`,
  draft: (n) => `Here's a draft for ${n}.`,
  intent_monitor: (n) => `Here's what ${n} is researching.`,
  why_now: (n) => `Here's the case for reaching out to ${n} now.`,
  score_accounts: (n) => `Here's how ${n} scores.`,
  tech_stack: (n) => `Here's the tech stack at ${n}.`,
  competitor: (n) => `Here's how we compare at ${n}.`,
  gtm_context: () => "Here's your saved GTM context.",
};

/** An outreach email built only from evidence: the latest dated trigger and the top intent topic on our offerings. */
function templateDraft(adapted: Adapted, frame: MessageFrame): string {
  const data = frame.data;
  const company = data.company?.name ?? frame.entityLabel ?? "your team";
  const first = data.contact?.name.split(" ")[0];
  const trigger = data.whyNow?.hooks[0]?.split(": ").slice(1).join(": ");
  const topic = data.signals?.topics.find((t) => t.mapsToUs)?.topic;
  const ids = [...new Set([...(adapted.sources.hooks ?? []), ...(adapted.sources.intent ?? []), ...(adapted.sources.profile ?? [])])];
  const opener = trigger
    ? `I saw that ${company} recently ${trigger.charAt(0).toLowerCase()}${trigger.slice(1).replace(/\.$/, "")}, and thought it was a good moment to reach out.`
    : `I've been following ${company} and thought it was worth reaching out.`;
  const ask = topic
    ? `If ${topic.toLowerCase()} is on your list this quarter, I'd welcome 20 minutes to compare notes on what we're seeing with similar teams.`
    : "Would you be open to 20 minutes to compare notes on your priorities this quarter?";
  return [
    `**Subject:** ${trigger ? `Following ${company}'s latest news` : `An idea for ${company}`}`,
    `Hi ${first ?? "there"},`,
    opener,
    ask,
    "Best,\n[Your name]",
    ...(ids.length ? [`Grounded in: [${ids.join(", ")}]`] : []),
  ].join("\n\n");
}

/** Evidence-only reply in the same format, used when Gemini is not configured or fails. */
export function templateMarkdown(input: { job: GtmJob; ledger: Ledger; adapted: Adapted; frame: MessageFrame; coverage: string[] }): string {
  const { adapted, ledger, frame, job } = input;
  if (job === "draft") return templateDraft(adapted, frame);
  const { sources, research } = adapted;
  const data = frame.data;
  const cite = (...ids: (string | null | undefined)[]) => {
    const clean = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    return clean.length ? ` [${clean.join(", ")}]` : "";
  };
  const placements = Object.entries(frame.placements) as [UiComponentId, string][];
  const lead = placements.filter(([, p]) => p === "lead").map(([id]) => id);
  const inline = placements.filter(([, p]) => p === "inline").map(([id]) => id);
  const shown = new Set([...lead, ...inline]);

  const where =
    research.answer ??
    data.company?.tldr ??
    data.committee?.tldr ??
    data.contact?.tldr ??
    (data.gtmContext ? `Your GTM context lists ${data.gtmContext.offerings.length} offerings and ${data.gtmContext.competitors.length} competitors.` : "");
  const whereIds = research.evidenceId ? [research.evidenceId] : (sources.tldr ?? []);
  const name = `**${frame.entityLabel ?? "this account"}**`;
  const parts: string[] = [`${OPENERS[job](name)} ${where}${cite(...whereIds)}`.trim()];
  parts.push(...lead.map(tag));

  const signalsId = sources.scoops?.[0] ?? sources.intent?.[0] ?? null;
  if (!shown.has("signals") && signalsId) {
    const changed = [
      ...(data.signals?.scoops ?? []).map((s) => `- ${s.date ? `${s.date}: ` : ""}${s.text}${cite(signalsId)}`),
      ...(data.signals?.news ?? []).map((n) => `- ${n.date ? `${n.date}: ` : ""}${n.headline}${cite(signalsId)}`),
    ].slice(0, 4);
    if (changed.length) parts.push(`**What changed**\n${changed.join("\n")}`);
  }

  const open = [
    ...ledger.items
      .filter((e) => e.status === "denied")
      .map((e) => `- ${e.command.replaceAll("_", " ")} was not run — no approval received.${cite(e.id)}`),
    ...(shown.has("committee") ? [] : (data.committee?.gaps ?? []).map((g) => `- ${g}${cite(sources.gaps?.[0])}`)),
    ...(input.coverage.some((l) => l.startsWith("CRM history: not connected")) ? ["- CRM stage and status are unknown — CRM is not connected."] : []),
  ];
  if (open.length) parts.push(`**Still open**\n${open.slice(0, 5).join("\n")}`);
  parts.push(...inline.map(tag));

  const gap = data.committee?.gaps[0];
  const action = research.nextActions[0] ?? (gap ? `close the first gap — ${gap.charAt(0).toLowerCase()}${gap.slice(1)}.` : null);
  if (action && !shown.has("next_actions")) parts.push(`**Next step:** ${action}${cite(research.evidenceId ?? sources.gaps?.[0])}`);
  return parts.join("\n\n");
}
