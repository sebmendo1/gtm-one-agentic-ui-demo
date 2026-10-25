// The assistant's message format (docs/specs/03-genui-components.md): Markdown with `[e3]` citations
// and component tags alone on a line (`<ui:company/>`). Shared by the server (validation) and the
// client (rendering, including half-streamed text).
import type { DataRoot } from "./genui/catalog";
import type { FixtureBundle } from "./gtm/fixtures";
import type { GtmJob } from "./gtm/jobs";
import type { SignedEvidence } from "./spec";

export const UI_COMPONENTS = {
  company: {
    label: "Company card",
    describe: "firmographics (industry, employees, revenue, HQ, website) and ICP fit",
    sources: ["firmographics", "tldr"],
  },
  intent: {
    label: "Intent topics",
    describe: "intent topics with signal scores, split into ours vs competitor categories",
    sources: ["intent"],
  },
  signals: {
    label: "Signal timeline",
    describe: "dated scoops and news",
    sources: ["scoops"],
  },
  next_actions: {
    label: "Next actions",
    describe: "a checklist of recommended next actions the user can act on",
    sources: ["next_actions"],
  },
  committee: {
    label: "Buying committee",
    describe: "stakeholders with buying role and engagement, gaps, and multithread risk",
    sources: ["members", "gaps", "risk"],
  },
  scores: {
    label: "Account score",
    describe: "ICP fit and in-market scores with an explainable breakdown",
    sources: ["firmographics", "intent"],
  },
  tech_stack: {
    label: "Tech stack",
    describe: "technologies by category with displacement or integration plays",
    sources: ["stack", "plays"],
  },
  comparison: {
    label: "Competitive comparison",
    describe: "us vs the named competitor, dimension by dimension",
    sources: ["comparison"],
  },
  contact: {
    label: "Contact card",
    describe: "one person's title, company, contact details, and our engagement with them",
    sources: ["profile", "engagement"],
  },
  why_now: {
    label: "Why-now hooks",
    describe: "a timing thesis and dated outreach hooks",
    sources: ["thesis", "hooks"],
  },
  gtm_context: {
    label: "GTM context",
    describe: "our offerings, personas, ICP, and competitors",
    sources: ["offerings", "personas", "icp", "competitors"],
  },
} as const;

export type UiComponentId = keyof typeof UI_COMPONENTS;
export type Placement = "lead" | "inline";

export function isUiComponent(id: string): id is UiComponentId {
  return id in UI_COMPONENTS;
}

export type Block =
  | { kind: "text"; markdown: string }
  | { kind: "ui"; component: UiComponentId }
  | { kind: "compose"; title: string | null; source: string }
  | { kind: "crm_draft"; field: string; value: string; reason: string };

/**
 * GenUI sections per reply: catalog components, the composed block, and CRM drafts all count. Most
 * replies should show one (docs/specs/04-jev-decisions.md § Section budget).
 */
export const MAX_SECTIONS = 3;
export const MAX_CRM_DRAFTS = 1;

export interface SectionCount {
  total: number;
  components: number;
  composed: number;
  crmDrafts: number;
}

export function countSections(blocks: Block[]): SectionCount {
  const components = blocks.filter((b) => b.kind === "ui").length;
  const composed = blocks.filter((b) => b.kind === "compose").length;
  const crmDrafts = blocks.filter((b) => b.kind === "crm_draft").length;
  return { total: components + composed + crmDrafts, components, composed, crmDrafts };
}

export interface FollowUp {
  label: string;
  prompt: string;
}

/** Everything the client needs to render components; the writer only places tags. */
export interface MessageFrame {
  job: GtmJob | null;
  entityLabel: string | null;
  source: "gtm-cli" | "fixtures" | null;
  data: FixtureBundle;
  placements: Partial<Record<UiComponentId, Placement>>;
  /** Where a composed block may go, when Jev allowed one this turn. */
  compose: Placement | null;
  componentSources: Partial<Record<UiComponentId, string[]>>;
  /** Evidence ids behind each data root (`company`, `signals`, …), for composed blocks' source chips. */
  rootSources: Partial<Record<DataRoot, string[]>>;
  /** Evidence id → short label such as "research account · fixtures". */
  sources: Record<string, string>;
  allowCrmDrafts: boolean;
  notFound: { query: string | null } | null;
}

export interface AssistantMessage extends MessageFrame {
  markdown: string;
  coverage: string[];
  followUps: FollowUp[];
  writer: { kind: "gemini" | "template"; model: string | null; note?: string };
  /** Signed evidence ledger for follow-ups about the same account. */
  carry?: SignedEvidence;
}

const TAG_LINE = /^\s*<ui:([a-z_]+)((?:\s+[a-z_]+="[^"]*")*)\s*\/?>\s*$/;
const ATTR = /([a-z_]+)="([^"]*)"/g;

function attributes(text: string): Record<string, string> {
  return Object.fromEntries([...text.matchAll(ATTR)].map((m) => [m[1]!, m[2]!]));
}

export const COMPOSE_OPEN = /^\s*<ui:compose(?:\s+title="([^"]*)")?\s*>\s*$/;
export const COMPOSE_CLOSE = /^\s*<\/ui:compose>\s*$/;

/**
 * Splits the source into text and GenUI blocks, keeping at most MAX_SECTIONS sections. While
 * streaming, a half-written tag line or an unclosed `<ui:compose>` block is held back, so each
 * section appears only once complete.
 */
export function parseMessage(
  source: string,
  frame: Pick<MessageFrame, "placements" | "allowCrmDrafts" | "compose">,
  streaming = false,
): Block[] {
  const lines = source.split("\n");
  if (streaming) {
    const last = lines.at(-1) ?? "";
    if (/^\s*</.test(last) && !TAG_LINE.test(last) && !COMPOSE_OPEN.test(last) && !COMPOSE_CLOSE.test(last)) lines.pop();
  }
  const blocks: Block[] = [];
  const placed = new Set<string>();
  let sections = 0;
  let crmDrafts = 0;
  let text: string[] = [];
  const flush = () => {
    const markdown = text.join("\n").trim();
    if (markdown) blocks.push({ kind: "text", markdown });
    text = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const open = line.match(COMPOSE_OPEN);
    if (open) {
      let close = lines.findIndex((l, j) => j > i && COMPOSE_CLOSE.test(l));
      if (close < 0) {
        if (streaming) break;
        close = lines.length;
      }
      if (frame.compose && !placed.has("compose") && sections < MAX_SECTIONS) {
        placed.add("compose");
        sections++;
        flush();
        blocks.push({ kind: "compose", title: open[1] || null, source: lines.slice(i + 1, close).join("\n") });
      }
      i = close;
      continue;
    }
    const tag = line.match(TAG_LINE);
    if (!tag) {
      if (!/^\s*<\/?ui:/.test(line)) text.push(line);
      continue;
    }
    const name = tag[1]!;
    const attrs = attributes(tag[2] ?? "");
    if (name === "crm_draft") {
      if (frame.allowCrmDrafts && attrs.field && attrs.value && crmDrafts < MAX_CRM_DRAFTS && sections < MAX_SECTIONS) {
        crmDrafts++;
        sections++;
        flush();
        blocks.push({ kind: "crm_draft", field: attrs.field, value: attrs.value, reason: attrs.reason ?? "" });
      }
      continue;
    }
    if (!isUiComponent(name) || !frame.placements[name] || placed.has(name) || sections >= MAX_SECTIONS) continue;
    placed.add(name);
    sections++;
    flush();
    blocks.push({ kind: "ui", component: name });
  }
  flush();
  return blocks;
}

/** True while a streaming source ends inside a section `parseMessage` is still holding back. */
export function pendingSection(source: string, frame: Pick<MessageFrame, "compose">): boolean {
  const lines = source.split("\n");
  const last = lines.at(-1) ?? "";
  if (/^\s*<(?:u|ui|ui:)?$|^\s*<ui:/.test(last) && !TAG_LINE.test(last) && !COMPOSE_CLOSE.test(last)) return true;
  if (!frame.compose) return false;
  let open = false;
  for (const line of lines) {
    if (COMPOSE_OPEN.test(line)) open = true;
    else if (COMPOSE_CLOSE.test(line)) open = false;
  }
  return open;
}

export function placedComponents(source: string): Set<string> {
  return new Set(
    source
      .split("\n")
      .map((line) => line.match(TAG_LINE)?.[1])
      .filter((name): name is string => Boolean(name)),
  );
}

/** Each `<ui:compose>` block in the source; `end` is the index of its closing line (or the line count). */
export function composeBlocks(source: string): { title: string | null; body: string; start: number; end: number }[] {
  const lines = source.split("\n");
  const out: { title: string | null; body: string; start: number; end: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i]!.match(COMPOSE_OPEN);
    if (!open) continue;
    const close = lines.findIndex((l, j) => j > i && COMPOSE_CLOSE.test(l));
    const end = close < 0 ? lines.length : close;
    out.push({ title: open[1] || null, body: lines.slice(i + 1, end).join("\n"), start: i, end });
    i = end;
  }
  return out;
}

export const CITATION = /\[(e\d+(?:\s*,\s*e\d+)*)\]/g;

export function citedIds(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(CITATION)].flatMap((m) => m[1]!.split(/\s*,\s*/)))];
}

/** Drops citations to evidence the harness never produced. */
export function keepKnownCitations(markdown: string, known: Set<string>): string {
  return markdown.replace(CITATION, (_, ids: string) => {
    const kept = ids.split(/\s*,\s*/).filter((id) => known.has(id));
    return kept.length ? `[${kept.join(", ")}]` : "";
  });
}

/** Turns `[e3, e4]` into links the renderer draws as citation chips. */
export function linkCitations(markdown: string): string {
  return markdown.replace(CITATION, (_, ids: string) => `[${ids}](cite:${ids.replace(/\s+/g, "")})`);
}

/** Plain text for conversation history sent back to the model (the Markdown fallback). */
export function messagePlainText(markdown: string): string {
  const lines = markdown.split("\n");
  for (const block of composeBlocks(markdown).reverse()) {
    lines.splice(block.start, block.end - block.start + 1, block.title ? `[${block.title}]` : "");
  }
  return lines
    .filter((line) => !TAG_LINE.test(line))
    .join("\n")
    .replace(/\s+\n/g, "\n")
    .trim();
}
