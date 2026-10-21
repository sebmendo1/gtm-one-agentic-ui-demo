import "server-only";
import {
  COMMANDS,
  buildArgv,
  displayCommand,
  type CommandDef,
  type Cost,
  type CommandId,
  type PlaceholderContext,
  type PlanStep,
} from "../gtm/commands";
import { timeoutFor, type CliState, type GtmBackend, type RunResult, type SourceKind } from "../gtm/backend";
import type { EvidenceStatus, EvidenceSummary } from "../spec";

export interface Evidence extends EvidenceSummary {
  command: CommandId;
  records: unknown[];
}

export interface Entity {
  company: string | null;
  contact: string | null;
  domain: string | null;
  competitor: string | null;
}

export interface CompanyOption {
  id: string;
  label: string;
  name: string;
}

export interface Ledger {
  items: Evidence[];
  ctx: PlaceholderContext;
  entity: Entity;
  backend: GtmBackend;
  /** Company id the user picked from a "which company?" question. */
  pinnedCompanyId?: string;
  /** Set when a company lookup returned records but none matched the name or domain exactly. */
  ambiguous?: { query: string; options: CompanyOption[] };
  /** Called as each step lands, so the client can show research activity live. */
  onStep?: (evidence: Evidence) => void;
  /** Called just before a step runs, for live status copy. */
  onStart?: (step: PlanStep) => void;
}

function record(ledger: Ledger, ev: Evidence): Evidence {
  ledger.items.push(ev);
  ledger.onStep?.(ev);
  return ev;
}

const UNAUTHORIZED = /not logged in|session expired|unauthori[sz]ed|\b401\b|\b403\b|forbidden/i;
const DENIED = /no approval received|approval (was )?denied|permission denied/i;

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function attrs(record: unknown): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const r = record as Record<string, unknown>;
  return r.attributes && typeof r.attributes === "object" ? (r.attributes as Record<string, unknown>) : r;
}

export function recordId(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const id = (record as Record<string, unknown>).id;
  return id === undefined || id === null ? null : String(id);
}

function classify(result: RunResult): { status: EvidenceStatus; records: unknown[]; error?: string } {
  const text = `${result.stderr}\n${result.ok ? "" : result.stdout}`;
  if (!result.ok) {
    if (DENIED.test(text)) return { status: "denied", records: [], error: "No approval received." };
    if (UNAUTHORIZED.test(text)) return { status: "unauthorized", records: [], error: "Not signed in — run gtm auth login." };
    if (result.timedOut) return { status: "unavailable", records: [], error: "Timed out." };
    if (/ENOENT/.test(text)) return { status: "unavailable", records: [], error: "gtm binary not found." };
    return { status: "error", records: [], error: text.trim().slice(0, 300) || `Exit code ${result.exitCode}` };
  }
  const json = result.json as Record<string, unknown> | unknown[] | null;
  if (json === null) {
    const out = result.stdout.trim();
    return out ? { status: "ok", records: [{ text: out.slice(0, 20_000) }] } : { status: "empty", records: [] };
  }
  if (Array.isArray(json)) return { status: json.length ? "ok" : "empty", records: json };
  const data = (json as Record<string, unknown>).data;
  if (Array.isArray(data)) return { status: data.length ? "ok" : "empty", records: data };
  if (data === null) return { status: "empty", records: [] };
  if (data && typeof data === "object") {
    const connected = (data as Record<string, unknown>).connected;
    if (connected === false) return { status: "unavailable", records: [data], error: "Source not connected." };
    return { status: "ok", records: [data] };
  }
  return { status: "ok", records: [json] };
}

const LEGAL_SUFFIX = /\b(inc|incorporated|corp|corporation|co|company|llc|ltd|limited|plc|gmbh|ag|sa|holdings?|group)\b/g;

function companyKey(text: string): string {
  return norm(text).replace(LEGAL_SUFFIX, " ").replace(/\s+/g, " ").trim();
}

function hostOf(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]!;
}

function companyOption(record: unknown): CompanyOption | null {
  const id = recordId(record);
  if (!id) return null;
  const a = attrs(record);
  const name = String(a.name ?? "Unnamed company");
  const where = [a.city, a.state ?? a.country].filter(Boolean).join(", ");
  const label = [name, hostOf(a.website ?? a.domain), where].filter(Boolean).join(" · ");
  return { id, label, name };
}

/**
 * Resolves the company id only on an exact name (ignoring legal suffixes) or domain match, per the
 * Context Graph rule in docs/specs/08-zoominfo-gtm-platform.md §4. Anything looser becomes a question.
 */
function resolveCompany(ledger: Ledger, records: unknown[]) {
  const { ctx, entity } = ledger;
  if (ledger.pinnedCompanyId) {
    const pinned = records.find((r) => recordId(r) === ledger.pinnedCompanyId);
    if (pinned) {
      ctx.companyId = ledger.pinnedCompanyId;
      entity.company = String(attrs(pinned).name ?? entity.company ?? "") || entity.company;
      ledger.ambiguous = undefined;
    }
    return;
  }
  const wanted = entity.company ? companyKey(entity.company) : null;
  const wantedHost = entity.domain ? hostOf(entity.domain) : null;
  if (!wanted && !wantedHost) return;
  const exact = records.filter((r) => {
    const a = attrs(r);
    const host = hostOf(a.website ?? a.domain);
    return (wanted && companyKey(String(a.name ?? "")) === wanted) || (wantedHost && host && (host === wantedHost || host.endsWith(`.${wantedHost}`)));
  });
  if (exact.length === 1) {
    const id = recordId(exact[0]);
    if (id) {
      ctx.companyId = id;
      ledger.ambiguous = undefined;
    }
    return;
  }
  const options = (exact.length > 1 ? exact : records).map(companyOption).filter((o): o is CompanyOption => o !== null).slice(0, 4);
  if (options.length) ledger.ambiguous = { query: entity.company ?? entity.domain ?? "", options };
}

function updateContext(ledger: Ledger, command: CommandId, records: unknown[]) {
  const { ctx, entity } = ledger;
  if (!ctx.companyId && (command === "companies_search" || command === "companies_enrich")) resolveCompany(ledger, records);
  if (!ctx.contactId && ["contacts_search", "contacts_recommended", "contacts_enrich"].includes(command) && entity.contact) {
    const wanted = norm(entity.contact);
    const match = records.find((r) => {
      const a = attrs(r);
      const full = norm(String(a.fullName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`));
      return full === wanted || full.includes(wanted);
    });
    const id = recordId(match);
    if (id) ctx.contactId = id;
  }
}

function nextId(ledger: Ledger): string {
  const highest = ledger.items.reduce((max, e) => Math.max(max, Number(e.id.slice(1)) || 0), 0);
  return `e${highest + 1}`;
}

/**
 * Starts this turn's ledger from signed evidence: an earlier turn's (marked carried) or this turn's
 * own approval gate (kept as is).
 */
export function seedLedger(ledger: Ledger, items: Evidence[], ctx: PlaceholderContext, fromEarlierTurn: boolean) {
  ledger.items.push(...items.map((item) => (fromEarlierTurn ? { ...item, carried: true } : item)));
  ledger.ctx = { ...ctx, ...ledger.ctx };
}

/** Re-resolves ids from evidence already in the ledger (a reused lookup doesn't run updateContext). */
export function refreshContext(ledger: Ledger) {
  for (const e of ledger.items) if (e.status === "ok") updateContext(ledger, e.command, e.records);
}

const RESEARCH_COMMANDS: CommandId[] = ["research_account", "research_contact", "conversation_intelligence"];

/**
 * Evidence already in the ledger that answers `step`: the same command and arguments, or — for AI
 * research on the same job — the same command regardless of the query wording.
 */
export function findReusable(ledger: Ledger, step: PlanStep, sameJob: boolean): Evidence | null {
  const built = buildArgv(step, ledger.ctx, null);
  const display = "argv" in built ? displayCommand(built.argv) : null;
  return (
    ledger.items.find(
      (e) =>
        e.command === step.command &&
        (e.status === "ok" || e.status === "empty") &&
        (e.display === display || (sameJob && RESEARCH_COMMANDS.includes(step.command))),
    ) ?? null
  );
}

function summary(
  ledger: Ledger,
  step: PlanStep,
  argv: string[],
  status: EvidenceStatus,
  records: unknown[],
  ms: number,
  error?: string,
): Evidence {
  const def: CommandDef = COMMANDS[step.command];
  return {
    id: nextId(ledger),
    command: step.command,
    display: argv.length ? displayCommand(argv) : `gtm ${def.path.join(" ")}`,
    cost: def.cost as Cost,
    status,
    source: ledger.backend.kind as SourceKind,
    count: records.length,
    ms,
    reason: step.reason,
    error,
    records,
  };
}

export async function executeStep(ledger: Ledger, step: PlanStep): Promise<Evidence> {
  const help = ledger.backend.kind === "gtm-cli" ? await ledger.backend.help(step.command) : null;
  const built = buildArgv(step, ledger.ctx, help);
  if ("error" in built) return record(ledger, summary(ledger, step, [], "skipped", [], 0, built.error));
  ledger.onStart?.(step);
  const result = await ledger.backend.run(built.argv, timeoutFor(step.command));
  const { status, records, error } = classify(result);
  const ev = summary(ledger, step, built.argv, status, records, result.ms, error);
  if (status === "ok") updateContext(ledger, step.command, records);
  return record(ledger, ev);
}

export function recordDenied(ledger: Ledger, step: PlanStep): Evidence {
  const def: CommandDef = COMMANDS[step.command];
  const built = buildArgv(step, ledger.ctx, null);
  const argv = "argv" in built ? built.argv : [...def.path];
  return record(ledger, summary(ledger, step, argv, "denied", [], 0, "No approval received — not run."));
}

export function stripRecords(items: Evidence[]): EvidenceSummary[] {
  return items.map((item) => {
    const copy: Partial<Evidence> = { ...item };
    delete copy.records;
    return copy as EvidenceSummary;
  });
}

export function evidenceFor(ledger: Ledger, ...commands: CommandId[]): Evidence[] {
  return ledger.items.filter((e) => commands.includes(e.command) && e.status === "ok");
}

const CONTEXT_URL = "https://gtm.ai/guides/connect-customer-context";

/** At most three lines, per the onboarding prompt's source-coverage rule. */
export function coverageLines(ledger: Ledger, cli: CliState): string[] {
  const counts = new Map<EvidenceStatus, string[]>();
  for (const e of ledger.items) counts.set(e.status, [...(counts.get(e.status) ?? []), e.command]);
  const n = (s: EvidenceStatus) => counts.get(s)?.length ?? 0;

  const parts = [
    n("ok") && `${n("ok")} returned data`,
    n("empty") && `${n("empty")} searched successfully with no matching records`,
    n("denied") && `${n("denied")} not approved`,
    n("unauthorized") && `${n("unauthorized")} unauthorized`,
    n("unavailable") && `${n("unavailable")} source unavailable`,
    n("error") && `${n("error")} failed`,
    n("skipped") && `${n("skipped")} skipped (missing input)`,
  ].filter(Boolean);
  const source =
    ledger.backend.kind === "fixtures"
      ? `Fixture emulator (demo data, no credits)${cli === "not_installed" ? " — GTM CLI not installed" : cli === "unauthenticated" ? " — GTM CLI not signed in" : ""}`
      : "GTM CLI";
  const carried = ledger.items.filter((e) => e.carried).length;
  const calls = `${ledger.items.length} calls${carried ? ` (${carried} reused from earlier in this chat)` : ""}`;
  const lines = [`${source}: ${calls} — ${parts.join(", ") || "none"}.`];

  const crmFlags = ledger.items.flatMap((e) =>
    e.records.map((r) => (attrs(r).crm as { connected?: boolean } | undefined)?.connected).filter((v) => v !== undefined),
  );
  const engagements = ledger.items.find((e) => e.command === "browse_engagements");
  if (crmFlags.includes(false)) {
    lines.push(`CRM history: not connected, so CRM stage and status are unknown — connect at ${CONTEXT_URL}.`);
  } else if (crmFlags.includes(true)) {
    lines.push("CRM history: connected.");
  } else {
    lines.push("CRM connection status unknown — no CRM-backed tool reported it.");
  }

  const emptyCmds = counts.get("empty") ?? [];
  if (engagements?.status === "ok") {
    lines.push(`Engagements: ${engagements.count} meetings/emails returned${emptyCmds.length ? `; empty results (${emptyCmds.join(", ")}) are not evidence of no history` : ""}.`);
  } else if (emptyCmds.length) {
    lines.push(`Empty results (${emptyCmds.join(", ")}) mean no matching records, not "no customer history".`);
  } else if (engagements) {
    lines.push(`Engagement history: ${engagements.status}${engagements.error ? ` — ${engagements.error.replace(/\.$/, "")}` : ""}.`);
  }
  return lines.slice(0, 3);
}
