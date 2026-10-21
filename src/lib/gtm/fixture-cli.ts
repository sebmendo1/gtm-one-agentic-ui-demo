import "server-only";
import { COMMANDS, type CommandDef, type CommandId } from "./commands";
import type { GtmBackend, RunResult } from "./backend";
import {
  FIXTURE_COMPANIES,
  FIXTURE_CONTACTS,
  FIXTURE_ENGAGEMENTS,
  FIXTURE_GTM_CONTEXT,
  type FixtureCompany,
  type FixtureContact,
} from "./fixtures";

// Emulates `gtm <command> -f json` for the allowlisted commands, returning the documented
// `{ data: [{ id, attributes }] }` envelope. No credits are involved.

function parse(argv: string[]): { path: string[]; flags: Record<string, string[]> } {
  const path: string[] = [];
  const flags: Record<string, string[]> = {};
  let current: string | null = null;
  for (const token of argv) {
    if (token === "-f") {
      current = "format";
      flags.format = [];
      continue;
    }
    if (token.startsWith("--")) {
      current = token.slice(2);
      flags[current] = [];
      continue;
    }
    if (current) flags[current]!.push(token);
    else path.push(token);
  }
  return { path, flags };
}

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findCompanies(flags: Record<string, string[]>): FixtureCompany[] {
  const ids = [...(flags.id ?? []), ...(flags["company-id"] ?? [])];
  if (ids.length) return FIXTURE_COMPANIES.filter((c) => ids.includes(c.zoomId));
  const domains = (flags.domain ?? []).map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, ""));
  if (domains.length) return FIXTURE_COMPANIES.filter((c) => domains.includes(c.domain));
  const names = (flags.name ?? []).map(norm);
  if (names.length) {
    return FIXTURE_COMPANIES.filter((c) => names.some((n) => n === norm(c.name) || n.includes(c.key) || norm(c.name).includes(n)));
  }
  const industry = (flags.industry ?? []).map(norm);
  if (industry.length) return FIXTURE_COMPANIES.filter((c) => industry.some((i) => norm(c.industry).includes(i)));
  return [];
}

function companyRecord(c: FixtureCompany, enrich: boolean) {
  const base = {
    name: c.name,
    website: c.domain,
    industries: [c.industry],
    employeeCount: c.employeeCount,
    revenue: c.revenue,
    city: c.city,
    state: c.state,
    country: c.country,
  };
  return {
    id: c.zoomId,
    attributes: enrich
      ? { ...base, description: c.description, techAttributes: c.tech }
      : base,
  };
}

function contactRecord(p: FixtureContact, enrich: boolean) {
  const company = FIXTURE_COMPANIES.find((c) => c.zoomId === p.companyId);
  return {
    id: p.personId,
    attributes: {
      firstName: p.firstName,
      lastName: p.lastName,
      jobTitle: p.jobTitle,
      managementLevel: p.managementLevel,
      companyId: p.companyId,
      companyName: company?.name ?? "",
      ...(enrich ? { email: p.email, phone: p.phone } : {}),
    },
  };
}

function rawArgs(flags: Record<string, string[]>): Record<string, unknown> {
  try {
    return JSON.parse(flags.args?.[0] ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function researchAccount(c: FixtureCompany, query: string) {
  const q = query.toLowerCase();
  const competitorName = query.match(/\bvs\.?\s+([A-Z][\w.&-]*(?:\s+[A-Z][\w.&-]*)*)/)?.[1] ?? "Gong";
  return {
    data: {
      answer: `${c.description} ${c.icpNote}`,
      nextActions: c.nextActions,
      ...(/(tech|stack|displac)/.test(q) ? { recommendations: c.plays } : {}),
      ...(/(compet|\bvs\b|against|compare)/.test(q)
        ? {
            comparison: {
              competitor: competitorName,
              rows: [
                { dimension: "Core wedge", us: "Intent + contacts in one graph", them: "Point-solution depth" },
                { dimension: "Time to value", us: "Agent-ready via MCP and CLI", them: "Longer rollout" },
                { dimension: `Fit at ${c.name}`, us: c.icpNote, them: `Incumbent footprint: ${c.tech.map((t) => t.product).join(", ")}` },
              ],
            },
          }
        : {}),
      crm: { connected: false, note: "No CRM is connected for this organization in fixture mode." },
    },
  };
}

function respond(json: unknown): RunResult {
  return { ok: true, exitCode: 0, stdout: JSON.stringify(json), stderr: "", json, ms: 5, timedOut: false };
}

function run(argv: string[]): RunResult {
  const { path, flags } = parse(argv);
  const cmd = path.join(" ");

  switch (cmd) {
    case "gtm-context get":
      return respond({ data: FIXTURE_GTM_CONTEXT });
    case "lookup":
    case "intent search":
    case "scoops search":
      return respond({ data: [] });
    case "companies search":
      return respond({ data: findCompanies(flags).map((c) => companyRecord(c, false)) });
    case "companies enrich":
      return respond({ data: findCompanies(flags).map((c) => companyRecord(c, true)) });
    case "companies similar": {
      const seed = findCompanies(flags)[0];
      return respond({ data: FIXTURE_COMPANIES.filter((c) => c !== seed).map((c) => companyRecord(c, false)) });
    }
    case "contacts search":
    case "contacts recommended": {
      const companyIds = flags["company-id"] ?? [];
      const levels = (flags["management-level"] ?? []).flatMap((v) => v.split(",")).map((v) => v.trim());
      const people = FIXTURE_CONTACTS.filter(
        (p) => (!companyIds.length || companyIds.includes(p.companyId)) && (!levels.length || levels.includes(p.managementLevel)),
      );
      return respond({ data: (companyIds.length ? people : []).map((p) => contactRecord(p, false)) });
    }
    case "contacts enrich": {
      const ids = flags.id ?? [];
      const emails = (flags.email ?? []).map((e) => e.toLowerCase());
      const people = FIXTURE_CONTACTS.filter((p) => ids.includes(p.personId) || emails.includes(p.email));
      return respond({ data: people.map((p) => contactRecord(p, true)) });
    }
    case "research account": {
      const company = findCompanies(flags)[0];
      if (!company) return respond({ data: null });
      return respond(researchAccount(company, (flags.query ?? []).join(" ")));
    }
    case "research contact": {
      const person = FIXTURE_CONTACTS.find((p) => (flags["contact-id"] ?? []).includes(p.personId));
      if (!person) return respond({ data: null });
      const touches = FIXTURE_ENGAGEMENTS.filter((e) => e.participants.includes(`${person.firstName} ${person.lastName}`));
      return respond({
        data: {
          answer: person.summary,
          engagementSummary: touches.length
            ? touches.map((t) => `${t.date}: ${t.type} — ${t.subject}`).join("; ")
            : "No logged meetings or emails.",
          crm: { connected: false },
        },
      });
    }
    case "raw call enrich_company_signals": {
      const args = rawArgs(flags);
      const ids = ((args.zoominfoCompanyIds as unknown[]) ?? []).map(String);
      const types = ((args.signalTypes as string[]) ?? ["INTENT", "SCOOP", "NEWS"]).map((t) => t.toUpperCase());
      const data = FIXTURE_COMPANIES.filter((c) => ids.includes(c.zoomId)).map((c) => ({
        id: c.zoomId,
        attributes: {
          name: c.name,
          ...(types.includes("INTENT") ? { intent: c.intent } : {}),
          ...(types.includes("SCOOP") ? { scoops: c.scoops } : {}),
          ...(types.includes("NEWS") ? { news: c.news } : {}),
        },
      }));
      return respond({ data });
    }
    case "raw call browse_engagements": {
      const args = rawArgs(flags);
      const companyId = String(args.companyId ?? args.zoominfoCompanyId ?? "");
      const contactName = String(args.contactName ?? "");
      const rows = FIXTURE_ENGAGEMENTS.filter(
        (e) => (!companyId || e.companyId === companyId) && (!contactName || e.participants.includes(contactName)),
      );
      return respond({ data: rows.map((e) => ({ id: e.id, attributes: e })) });
    }
    case "raw call conversation_intelligence":
      return respond({ data: { connected: false, answer: "No conversation sources are connected in fixture mode." } });
    default:
      return { ok: false, exitCode: 2, stdout: "", stderr: `Unknown command: ${cmd}`, json: null, ms: 1, timedOut: false };
  }
}

function help(command: CommandId): Promise<string | null> {
  const def: CommandDef = COMMANDS[command];
  if (def.raw) {
    return Promise.resolve(`${def.mcpTool}: ${def.summary} Pass JSON with --args.`);
  }
  const flags = [...def.documentedFlags, ...(command === "companies_search" ? ["domain"] : [])];
  return Promise.resolve(
    [`Usage: gtm ${def.path.join(" ")} [flags]`, def.summary, "", "Flags:", ...flags.map((f) => `  --${f}`), "  -f, --format"].join("\n"),
  );
}

export const fixtureBackend: GtmBackend = {
  kind: "fixtures",
  help,
  run: (argv) => Promise.resolve(run(argv)),
};
