import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Grounding documents for the prose path (traced into the build via next.config.ts). Paths are
// literal so the bundler traces only these files, not the whole project.
export interface KnowledgeDocs {
  setup: string;
  platform: string;
  knowledgeBase: string;
}

let cache: Promise<KnowledgeDocs> | undefined;

function stripFrontmatter(text: string): string {
  return text.startsWith("---") ? text.replace(/^---[\s\S]*?\n---\n/, "") : text;
}

async function read(file: string): Promise<string> {
  try {
    return stripFrontmatter(await readFile(file, "utf8"));
  } catch {
    return "";
  }
}

export function knowledgeDocs(): Promise<KnowledgeDocs> {
  cache ??= Promise.all([
    read(path.join(process.cwd(), "docs", "specs", "06-setup-gtm-ai.md")),
    read(path.join(process.cwd(), "docs", "specs", "08-zoominfo-gtm-platform.md")),
    read(path.join(process.cwd(), "docs", "external-sources", "zoominfo-gtm-ai-knowledge-base.md")),
  ]).then(([setup, platform, knowledgeBase]) => ({ setup, platform, knowledgeBase }));
  return cache;
}

/** Copy rules from docs/specs/08-zoominfo-gtm-platform.md §7, applied to every model-written reply. */
export const PLATFORM_RULES = [
  "Use ZoomInfo's current product names: GTM Intelligence Platform, GTM Studio, GTM Workspace, GTM AI, Copilot. Never say SalesOS or MarketingOS.",
  'Never say "GTM One" — no product by that name is confirmed.',
  "Present credit costs as estimates; don't state how data and AI credits map to tools as confirmed.",
  "If you cite GTM Bench v1, label it a vendor-run benchmark.",
  'Keep missing access distinct from missing data: a result limited by entitlements or an unconnected source is "not available to this account", not "none found".',
];
