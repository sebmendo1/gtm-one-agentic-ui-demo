// Read-only GTM CLI allowlist (docs/specs/07-agentic-harness.md, https://gtm.ai/docs/cli/commands).
// Write tools (gtm-context update, feedback submit, audience writes, arbitrary raw calls) are excluded.

export type Cost = "free" | "data" | "ai";

export interface CommandDef {
  path: readonly string[];
  cost: Cost;
  mcpTool: string;
  summary: string;
  /** Flags shown in the public command reference; the real CLI's `--help` is authoritative. */
  documentedFlags: readonly string[];
  /** `raw call <tool>` commands take one JSON `--args` object instead of flags. */
  raw?: boolean;
  timeoutMs?: number;
}

export const COMMANDS = {
  gtm_context_get: {
    path: ["gtm-context", "get"],
    cost: "free",
    mcpTool: "get_gtm_context",
    summary: "Read our offerings, ICP, personas, competitors, and the user's role.",
    documentedFlags: ["detailed"],
  },
  lookup: {
    path: ["lookup"],
    cost: "free",
    mcpTool: "lookup",
    summary: "Canonical filter values (industries, intent-topics, tech-vendors, tech-products).",
    documentedFlags: ["field", "fuzzy", "vendor"],
  },
  companies_search: {
    path: ["companies", "search"],
    cost: "free",
    mcpTool: "search_companies",
    summary: "Find companies by firmographic criteria. Needs at least one filter. Returns ids.",
    documentedFlags: ["name", "industry", "metro", "employees", "type", "country", "revenue-min", "sort", "page-size", "select"],
  },
  companies_similar: {
    path: ["companies", "similar"],
    cost: "free",
    mcpTool: "find_similar_companies",
    summary: "Machine-ranked look-alike companies.",
    documentedFlags: ["name", "id"],
  },
  contacts_search: {
    path: ["contacts", "search"],
    cost: "free",
    mcpTool: "search_contacts",
    summary: "Find contacts by role, seniority, department, or company id.",
    documentedFlags: ["company-id", "management-level", "department", "required", "page-size", "select"],
  },
  contacts_recommended: {
    path: ["contacts", "recommended"],
    cost: "free",
    mcpTool: "get_recommended_contacts",
    summary: "Outreach-ready contacts for an account.",
    documentedFlags: ["company-id", "use-case"],
  },
  intent_search: {
    path: ["intent", "search"],
    cost: "free",
    mcpTool: "search_intent",
    summary: "Companies showing intent on exact topic names (look topics up first).",
    documentedFlags: ["topics", "signal-score-min", "country", "sort"],
  },
  scoops_search: {
    path: ["scoops", "search"],
    cost: "free",
    mcpTool: "search_scoops",
    summary: "Business events (funding, hiring, leadership moves) across the market.",
    documentedFlags: ["scoop-types", "department", "published-start"],
  },
  browse_engagements: {
    path: ["raw", "call", "browse_engagements"],
    cost: "free",
    mcpTool: "browse_engagements",
    summary: "Timeline of our meetings and emails with an account or contact (needs connected customer context).",
    documentedFlags: [],
    raw: true,
  },
  companies_enrich: {
    path: ["companies", "enrich"],
    cost: "data",
    mcpTool: "enrich_companies",
    summary: "Full firmographics for a company by id, domain, name, ticker, or website.",
    documentedFlags: ["id", "domain", "name", "fields", "file"],
  },
  contacts_enrich: {
    path: ["contacts", "enrich"],
    cost: "data",
    mcpTool: "enrich_contacts",
    summary: "Full contact detail by person id, email, phone, or name plus company.",
    documentedFlags: ["id", "email", "fields"],
  },
  company_signals: {
    path: ["raw", "call", "enrich_company_signals"],
    cost: "data",
    mcpTool: "enrich_company_signals",
    summary: 'Intent, scoops, and news for up to 10 known companies. Args: {"zoominfoCompanyIds":[id],"signalTypes":["INTENT","SCOOP","NEWS"]}.',
    documentedFlags: [],
    raw: true,
  },
  research_account: {
    path: ["research", "account"],
    cost: "ai",
    mcpTool: "account_research",
    summary: "Account Research agent: blends ZoomInfo data with CRM and conversation history into a brief.",
    documentedFlags: ["company-id", "query"],
    timeoutMs: 180_000,
  },
  research_contact: {
    path: ["research", "contact"],
    cost: "ai",
    mcpTool: "contact_research",
    summary: "Contact Research agent: who this person is and our history with them.",
    documentedFlags: ["contact-id", "query"],
    timeoutMs: 180_000,
  },
  conversation_intelligence: {
    path: ["raw", "call", "conversation_intelligence"],
    cost: "ai",
    mcpTool: "conversation_intelligence",
    summary: "What was said, agreed, or pushed back on across calls, meetings, and emails.",
    documentedFlags: [],
    raw: true,
    timeoutMs: 180_000,
  },
} as const satisfies Record<string, CommandDef>;

export type CommandId = keyof typeof COMMANDS;

export const COMMAND_IDS = Object.keys(COMMANDS) as CommandId[];
export const FREE_COMMAND_IDS = COMMAND_IDS.filter((id) => COMMANDS[id].cost === "free");
export const PAID_COMMAND_IDS = COMMAND_IDS.filter((id) => COMMANDS[id].cost !== "free");

export function isCommandId(value: unknown): value is CommandId {
  return typeof value === "string" && value in COMMANDS;
}

export interface FlagInput {
  name: string;
  values: string[];
}

/** A step the harness may run. Values may hold `{{companyId}}` / `{{contactId}}` placeholders. */
export interface PlanStep {
  command: CommandId;
  flags: FlagInput[];
  rawArgs: Record<string, unknown> | null;
  reason: string;
}

export interface PlaceholderContext {
  companyId?: string;
  contactId?: string;
}

const FLAG_NAME = /^[a-z][a-z0-9-]{0,40}$/;
const MAX_VALUE = 300;
const MAX_VALUES = 10;
const PLACEHOLDER = /\{\{(companyId|contactId)\}\}/g;

export function stepNeeds(step: PlanStep): ("companyId" | "contactId")[] {
  const text = JSON.stringify([step.flags, step.rawArgs]);
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1] as "companyId" | "contactId"))];
}

function fill(text: string, ctx: PlaceholderContext): string {
  return text.replace(PLACEHOLDER, (_, key: "companyId" | "contactId") => ctx[key] ?? "");
}

function fillRaw(value: unknown, ctx: PlaceholderContext): unknown {
  if (typeof value === "string") {
    const whole = value.match(/^\{\{(companyId|contactId)\}\}$/);
    if (whole) {
      const id = ctx[whole[1] as "companyId" | "contactId"] ?? "";
      return /^\d+$/.test(id) ? Number(id) : id;
    }
    return fill(value, ctx);
  }
  if (Array.isArray(value)) return value.map((v) => fillRaw(v, ctx));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillRaw(v, ctx)]));
  }
  return value;
}

/** Normalizes untrusted step input (from Gemini or the client). Returns null when it is not allowlisted. */
export function sanitizeStep(input: unknown): PlanStep | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!isCommandId(raw.command)) return null;
  const def: CommandDef = COMMANDS[raw.command];
  const flags: FlagInput[] = [];
  if (Array.isArray(raw.flags)) {
    for (const f of raw.flags.slice(0, 12)) {
      if (!f || typeof f !== "object") continue;
      const name = String((f as FlagInput).name ?? "").replace(/^-+/, "");
      const values = Array.isArray((f as FlagInput).values) ? (f as FlagInput).values.map(String) : [];
      if (!FLAG_NAME.test(name) || name === "format" || name === "f" || name === "debug") continue;
      if (values.some((v) => v.trim().startsWith("-") || v.length > MAX_VALUE)) return null;
      flags.push({ name, values: values.slice(0, MAX_VALUES) });
    }
  }
  let rawArgs: Record<string, unknown> | null = null;
  if (def.raw && raw.rawArgs && typeof raw.rawArgs === "object" && !Array.isArray(raw.rawArgs)) {
    const encoded = JSON.stringify(raw.rawArgs);
    if (encoded.length <= 2000) rawArgs = raw.rawArgs as Record<string, unknown>;
  }
  return {
    command: raw.command,
    flags: def.raw ? [] : flags,
    rawArgs: def.raw ? (rawArgs ?? {}) : null,
    reason: typeof raw.reason === "string" ? raw.reason.slice(0, 200) : "",
  };
}

/**
 * Turns a step into argv for `gtm` (never a shell string). `helpText`, when present, is the
 * real CLI's `--help` output and every flag must appear in it.
 */
export function buildArgv(
  step: PlanStep,
  ctx: PlaceholderContext,
  helpText: string | null,
): { argv: string[] } | { error: string } {
  const def: CommandDef = COMMANDS[step.command];
  const missing = stepNeeds(step).filter((key) => !ctx[key]);
  if (missing.length > 0) return { error: `Missing ${missing.join(", ")} — no earlier result resolved it.` };

  const argv = [...def.path];
  if (def.raw) {
    argv.push("--args", JSON.stringify(fillRaw(step.rawArgs ?? {}, ctx)));
  } else {
    for (const flag of step.flags) {
      if (helpText && !helpText.includes(`--${flag.name}`)) {
        return { error: `Flag --${flag.name} is not listed in \`gtm ${def.path.join(" ")} --help\`.` };
      }
      const values = flag.values.map((v) => fill(v, ctx).trim()).filter(Boolean);
      for (const value of values) {
        if (value.startsWith("-")) return { error: `Value for --${flag.name} cannot start with "-".` };
        if (value.length > MAX_VALUE) return { error: `Value for --${flag.name} is too long.` };
      }
      argv.push(`--${flag.name}`, ...values);
    }
  }
  argv.push("-f", "json");
  return { argv };
}

export function costLabel(cost: Cost): string {
  return cost === "free" ? "Free" : cost === "data" ? "Data credits" : "AI credits";
}

/** Per-step estimate text. Labeled as an estimate: actual charges depend on records and work done. */
export function stepEstimate(step: PlanStep): string {
  const def: CommandDef = COMMANDS[step.command];
  if (def.cost === "free") return "Free";
  if (def.cost === "ai") return "AI credits · scales with the research work";
  if (step.command === "company_signals") {
    const ids = (step.rawArgs?.zoominfoCompanyIds as unknown[] | undefined)?.length ?? 1;
    return `Data credits · est. ${ids} (one per company)`;
  }
  const count = step.flags.reduce((n, f) => (["id", "email", "domain", "name"].includes(f.name) ? n + f.values.length : n), 0);
  return `Data credits · est. ${Math.max(1, count)} (one per record; 0 if already under management)`;
}

export function planEstimate(steps: PlanStep[]): string {
  let data = 0;
  let ai = 0;
  for (const step of steps) {
    const def: CommandDef = COMMANDS[step.command];
    if (def.cost === "data") data += Number(stepEstimate(step).match(/est\. (\d+)/)?.[1] ?? 1);
    if (def.cost === "ai") ai += 1;
  }
  const parts: string[] = [];
  if (data > 0) parts.push(`~${data} data credit${data === 1 ? "" : "s"}`);
  if (ai > 0) parts.push(`${ai} AI research run${ai === 1 ? "" : "s"} (AI credits scale with work)`);
  return parts.length ? `Estimate: ${parts.join(" + ")}. Actual charges depend on records and work done.` : "Free";
}

export function displayCommand(argv: string[]): string {
  return ["gtm", ...argv.map((a) => (/[\s"'{}$`\\]/.test(a) ? `'${a.replace(/'/g, `'\\''`)}'` : a))].join(" ");
}
