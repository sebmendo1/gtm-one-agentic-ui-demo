import "server-only";
import { humanDate } from "@/lib/dates";
import { attrs, evidenceFor, recordId, type Ledger } from "../harness/evidence";
import type {
  CommitteeMember,
  CommitteeRecord,
  ContactRecord,
  FixtureBundle,
  GtmContextRecord,
  ScoresRecord,
  SignalsRecord,
  TechCategory,
} from "./fixtures";
import type { GtmJob } from "./jobs";

export interface Adapted {
  bundle: FixtureBundle;
  entityLabel: string | null;
  notFound: boolean;
  /** section id → evidence ids */
  sources: Record<string, string[]>;
  research: { answer: string | null; nextActions: string[]; evidenceId: string | null };
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (Array.isArray(value)) return value.map(str).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return str(o.name ?? o.title ?? o.value ?? o.description ?? "");
  }
  return String(value);
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function money(value: unknown): string {
  if (typeof value === "number") {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toLocaleString("en-US")}`;
  }
  return str(value) || "—";
}

function sentences(text: string, max: number): string {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(\s|$)/g);
  return (parts ? parts.slice(0, max).join("") : text).trim();
}

function strength(score: number): string {
  return score >= 80 ? "High" : score >= 60 ? "Medium" : "Low";
}

function byCompany(records: unknown[], companyId: string | undefined): unknown[] {
  if (!companyId) return records;
  const matched = records.filter((r) => recordId(r) === companyId || str(attrs(r).companyId) === companyId);
  return matched.length ? matched : records;
}

function readGtmContext(ledger: Ledger): { record: GtmContextRecord | undefined; id: string | null } {
  const ev = evidenceFor(ledger, "gtm_context_get")[0];
  if (!ev) return { record: undefined, id: null };
  const a = attrs(ev.records[0]);
  const pick = (...keys: string[]) => keys.map((k) => list(a[k])).find((l) => l.length) ?? [];
  return {
    id: ev.id,
    record: {
      role: str(a.role ?? a.userRole) || undefined,
      offerings: pick("offerings", "products"),
      personas: pick("personas", "buyerPersonas"),
      icp: pick("icp", "icps", "idealCustomerProfiles"),
      competitors: pick("competitors"),
    },
  };
}

function managementRole(level: string, title: string): CommitteeMember["role"] {
  const text = `${level} ${title}`.toLowerCase();
  if (/c level|chief|vp|vice president|head of/.test(text)) return "decision";
  if (/procurement|legal|security|architect/.test(text)) return "blocker";
  return "influencer";
}

export function adaptEvidence(ledger: Ledger, job: GtmJob): Adapted {
  const sources: Record<string, string[]> = {};
  const cite = (section: string, ...ids: (string | null | undefined)[]) => {
    const clean = ids.filter((id): id is string => Boolean(id));
    if (clean.length) sources[section] = [...new Set([...(sources[section] ?? []), ...clean])];
  };
  const bundle: FixtureBundle = {};
  const companyId = ledger.ctx.companyId;

  const gtm = readGtmContext(ledger);
  if (gtm.record) bundle.gtmContext = gtm.record;
  for (const s of ["offerings", "personas", "icp", "competitors"]) cite(s, gtm.id);

  const research = evidenceFor(ledger, "research_account", "research_contact")[0];
  const researchData = research ? attrs(research.records[0]) : {};
  const researchAnswer = str(researchData.answer ?? researchData.brief ?? researchData.summary ?? researchData.text) || null;
  const nextActions = list(researchData.nextActions ?? researchData.recommendedActions);

  const companyEv = [...evidenceFor(ledger, "companies_enrich"), ...evidenceFor(ledger, "companies_search")];
  const companyRecordEv = companyEv.find((e) => e.records.some((r) => recordId(r) === companyId));
  const companyRaw = companyRecordEv?.records.find((r) => recordId(r) === companyId);
  const enrichEv = evidenceFor(ledger, "companies_enrich")[0];
  const enrichAttrs = enrichEv ? attrs(byCompany(enrichEv.records, companyId)[0]) : {};

  if (companyRaw) {
    const a = { ...attrs(companyRaw), ...enrichAttrs };
    bundle.company = {
      id: companyId ?? "",
      name: str(a.name) || ledger.entity.company || "Unknown",
      industry: list(a.industries)[0] ?? (str(a.industry) || "—"),
      employees: str(a.employeeCount ?? a.employees) || "—",
      revenue: money(a.revenue),
      hq: [a.city, a.state, a.country].map(str).filter(Boolean).join(", ") || "—",
      website: str(a.website ?? a.domain) || "—",
      tldr: researchAnswer ? sentences(researchAnswer, 2) : str(a.description),
      icpFit: "",
      nextActions,
    };
    cite("firmographics", companyRecordEv?.id, enrichEv?.id);
    cite("tldr", research?.id ?? enrichEv?.id ?? companyRecordEv?.id);
    cite("next_actions", research?.id);
  }

  const signalsEv = evidenceFor(ledger, "company_signals")[0];
  if (signalsEv) {
    const a = attrs(byCompany(signalsEv.records, companyId)[0]);
    const intent = Array.isArray(a.intent) ? a.intent : [];
    const scoops = Array.isArray(a.scoops) ? a.scoops : [];
    const news = Array.isArray(a.news) ? a.news : [];
    const signals: SignalsRecord = {
      topics: intent.slice(0, 6).map((t) => {
        const r = t as Record<string, unknown>;
        const score = Number(r.signalScore ?? r.score ?? 0);
        return { topic: str(r.topic ?? r.name), strength: strength(score), score, mapsToUs: false, reason: `Signal score ${score}` };
      }),
      scoops: scoops.map((s) => {
        const r = s as Record<string, unknown>;
        return { date: str(r.publishedDate ?? r.date).slice(0, 10), text: str(r.description ?? r.title ?? r.text) };
      }),
      news: news.map((n) => {
        const r = n as Record<string, unknown>;
        return { date: str(r.publishedDate ?? r.date).slice(0, 10), headline: str(r.title ?? r.headline) };
      }),
    };
    bundle.signals = signals;
    for (const s of ["intent", "scoops", "topics_for_us", "topics_competitor", "thesis", "hooks"]) cite(s, signalsEv.id);
  }

  const engagementsEv = evidenceFor(ledger, "browse_engagements")[0];
  const engagements = (engagementsEv?.records ?? []).map((r) => attrs(r));
  const engagedNames = new Set(engagements.flatMap((e) => list(e.participants)).map((n) => n.toLowerCase()));

  const contactsEv = evidenceFor(ledger, "contacts_search", "contacts_recommended");
  const people = contactsEv.flatMap((e) => e.records);
  if (people.length && job !== "contact_brief") {
    const seen = new Set<string>();
    const members: CommitteeMember[] = [];
    for (const p of people) {
      const a = attrs(p);
      const name = str(a.fullName) || `${str(a.firstName)} ${str(a.lastName)}`.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      members.push({
        name,
        title: str(a.jobTitle ?? a.title),
        role: managementRole(str(a.managementLevel), str(a.jobTitle)),
        engaged: engagedNames.has(name.toLowerCase()),
      });
    }
    bundle.committee = { members: members.slice(0, 8), gaps: [], multithreadRisk: "", tldr: "" };
    cite("members", ...contactsEv.map((e) => e.id), engagementsEv?.id);
    cite("gaps", ...contactsEv.map((e) => e.id), engagementsEv?.id);
    cite("risk", engagementsEv?.id, ...contactsEv.map((e) => e.id));
    cite("tldr", ...contactsEv.map((e) => e.id));
  }

  if ((job === "contact_brief" || job === "draft") && ledger.ctx.contactId) {
    const enriched = evidenceFor(ledger, "contacts_enrich")[0];
    const raw =
      enriched?.records.find((r) => recordId(r) === ledger.ctx.contactId) ??
      people.find((r) => recordId(r) === ledger.ctx.contactId);
    if (raw) {
      const a = attrs(raw);
      const name = str(a.fullName) || `${str(a.firstName)} ${str(a.lastName)}`.trim();
      const touches = engagements.filter((e) => list(e.participants).some((n) => n.toLowerCase() === name.toLowerCase()));
      const contact: ContactRecord = {
        id: ledger.ctx.contactId,
        name,
        title: str(a.jobTitle ?? a.title),
        company: str(a.companyName) || ledger.entity.company || "",
        email: str(a.email) || "Not returned (enrich to reveal)",
        phone: str(a.phone ?? a.directPhone) || "Not returned (enrich to reveal)",
        tldr: researchAnswer ?? "",
        engagement:
          str(researchData.engagementSummary) ||
          (touches.length ? touches.map((t) => `${humanDate(str(t.date))}: ${str(t.type)} — ${str(t.subject)}`).join("; ") : ""),
      };
      bundle.contact = contact;
      cite("profile", enriched?.id ?? contactsEv[0]?.id);
      cite("tldr", research?.id);
      cite("engagement", research?.id, engagementsEv?.id);
    }
  }

  const tech = Array.isArray(enrichAttrs.techAttributes) ? enrichAttrs.techAttributes : Array.isArray(enrichAttrs.technologies) ? enrichAttrs.technologies : [];
  if (tech.length) {
    const groups = new Map<string, TechCategory>();
    const plays = Array.isArray(researchData.recommendations) ? researchData.recommendations : [];
    for (const t of tech) {
      const r = t as Record<string, unknown>;
      const category = str(r.category ?? r.parentCategory) || "Other";
      const group = groups.get(category) ?? { category, tools: [], play: "" };
      group.tools.push(str(r.product ?? r.name));
      groups.set(category, group);
    }
    for (const p of plays) {
      const r = p as Record<string, unknown>;
      const g = groups.get(str(r.category));
      if (g) g.play = str(r.play);
    }
    bundle.tech = { categories: [...groups.values()], tldr: `${groups.size} technology categories on file at ${bundle.company?.name ?? "this account"}.` };
    cite("stack", enrichEv?.id);
    cite("plays", plays.length ? research?.id : null);
    cite("tldr", enrichEv?.id);
  }

  const comparison = researchData.comparison as { competitor?: unknown; rows?: unknown[] } | undefined;
  if (comparison?.rows?.length) {
    const competitor = str(comparison.competitor) || ledger.entity.competitor || "Competitor";
    bundle.competitor = {
      competitor,
      rows: comparison.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return { dimension: str(r.dimension), us: str(r.us), them: str(r.them) };
      }),
      tldr: `Comparison vs ${competitor}${bundle.company ? ` for ${bundle.company.name}` : ""}.`,
    };
    cite("comparison", research?.id);
  }

  if (bundle.signals && bundle.company) {
    const triggers = [
      ...bundle.signals.scoops.map((s) => ({ date: s.date, text: s.text })),
      ...bundle.signals.news.map((n) => ({ date: n.date, text: n.headline })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const hooks = triggers.map((t) => `${humanDate(t.date)}: ${t.text}`);
    const ours = [...bundle.signals.topics].sort((a, b) => Number(b.mapsToUs) - Number(a.mapsToUs) || (b.score ?? 0) - (a.score ?? 0))[0];
    const latest = triggers[0];
    const thesis =
      ours && latest
        ? `${ours.strength} intent on ${ours.topic}, plus a fresh trigger on ${humanDate(latest.date)}: ${latest.text}.`
        : latest
          ? `Fresh trigger on ${humanDate(latest.date)}: ${latest.text}.`
          : bundle.company.tldr;
    bundle.whyNow = {
      thesis,
      hooks: hooks.slice(0, 4),
      tldr: hooks[0] ? `Most recent trigger — ${hooks[0]}` : "",
    };
    cite("tldr", signalsEv?.id);
  }

  const needsContact = job === "contact_brief";
  const needsCompany = job !== "gtm_context" && !needsContact;
  const notFound = needsContact ? !bundle.contact : needsCompany ? !bundle.company : !bundle.gtmContext;
  const entityLabel =
    job === "gtm_context"
      ? "Your organization"
      : needsContact
        ? (bundle.contact?.name ?? ledger.entity.contact)
        : (bundle.company?.name ?? ledger.entity.company ?? ledger.entity.domain);

  return {
    bundle,
    entityLabel,
    notFound,
    sources,
    research: { answer: researchAnswer, nextActions, evidenceId: research?.id ?? null },
  };
}

function firstNumber(text: string): number | null {
  const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([kKmM])?/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2]?.toLowerCase() === "k" ? n * 1000 : m[2]?.toLowerCase() === "m" ? n * 1_000_000 : n;
}

/** Explainable scores from evidence only — every row names the criterion and the value it used. */
export function computeScores(bundle: FixtureBundle, now: number): ScoresRecord | undefined {
  const c = bundle.company;
  if (!c) return undefined;
  const icp = bundle.gtmContext?.icp ?? [];
  const band = icp.join(" ").match(/(\d[\d,]*)\s*[–-]\s*(\d[\d,]*)\s*employees/i);
  const employees = firstNumber(c.employees);
  let fit = 0;
  const breakdown: { label: string; value: string }[] = [];

  if (band && employees !== null) {
    const lo = Number(band[1]!.replace(/,/g, ""));
    const hi = Number(band[2]!.replace(/,/g, ""));
    const inBand = employees >= lo && employees <= hi;
    fit += inBand ? 30 : 10;
    breakdown.push({ label: `Employee band (ICP ${band[1]}–${band[2]})`, value: `${c.employees} — ${inBand ? "in band" : employees > hi ? "above band" : "below band"}` });
  } else {
    fit += 15;
    breakdown.push({ label: "Employee band", value: `${c.employees} — no ICP band in GTM context` });
  }

  const regionText = icp.join(" ");
  const usIcp = /\bUS\b|United States|North America/i.test(regionText);
  const euIcp = /\bEU\b|Europe/i.test(regionText);
  const inUs = /United States|\bUSA?\b/i.test(c.hq);
  const regionHit = (usIcp && inUs) || (euIcp && /Germany|France|United Kingdom|Netherlands|Spain|Italy|Ireland|Sweden/i.test(c.hq));
  fit += regionHit ? 25 : 5;
  breakdown.push({ label: "HQ region vs ICP", value: `${c.hq} — ${regionHit ? "in ICP regions" : "outside listed ICP regions"}` });

  const ours = bundle.signals?.topics.filter((t) => t.mapsToUs) ?? [];
  fit += ours.length ? 30 : 0;
  breakdown.push({
    label: "Intent on our offerings",
    value: ours.length ? ours.map((t) => `${t.topic} (${t.score ?? t.strength})`).join(", ") : bundle.signals ? "None of the returned topics map to our offerings" : "No intent evidence returned",
  });

  const scoop = [...(bundle.signals?.scoops ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  const ageDays = scoop ? (now - Date.parse(scoop.date)) / 86_400_000 : Infinity;
  const recent = ageDays <= 120;
  fit += recent ? 15 : 0;
  breakdown.push({ label: "Scoop in last 120 days", value: scoop ? `${humanDate(scoop.date)}: ${scoop.text}` : "No scoop evidence returned" });

  const scores = bundle.signals?.topics.map((t) => t.score ?? 0) ?? [];
  const inMarket = scores.length ? Math.max(...scores) : 0;
  const fitLabel = fit >= 75 ? "Great fit" : fit >= 55 ? "Moderate fit" : "Low fit";
  const inMarketLabel = !scores.length ? "No intent data" : inMarket >= 80 ? "In market" : inMarket >= 60 ? "Evaluating" : "Early";

  return {
    fit,
    inMarket,
    fitLabel,
    inMarketLabel,
    breakdown,
    whyNow: `${c.name}: ${fitLabel.toLowerCase()} (${fit}/100) and ${inMarketLabel.toLowerCase()} (${inMarket}/100) from the evidence returned.`,
  };
}

export function finalizeCommittee(committee: CommitteeRecord, companyName: string): CommitteeRecord {
  const engaged = committee.members.filter((m) => m.engaged);
  const gaps: string[] = [];
  for (const role of ["decision", "champion"] as const) {
    if (!committee.members.some((m) => m.role === role)) gaps.push(`No ${role === "decision" ? "decision-maker" : "champion"} identified`);
    else if (!engaged.some((m) => m.role === role)) gaps.push(`${role === "decision" ? "Decision-maker" : "Champion"} not yet engaged`);
  }
  if (!committee.members.some((m) => /security|ciso|infosec/i.test(m.title))) gaps.push("No security stakeholder in returned contacts");
  const risk =
    engaged.length <= 1
      ? `High — ${engaged.length === 0 ? "no engaged threads" : "only one engaged thread"}`
      : engaged.length === 2
        ? "Medium — two engaged threads"
        : `Low — ${engaged.length} engaged threads`;
  return {
    ...committee,
    gaps,
    multithreadRisk: risk,
    tldr: `${committee.members.length} stakeholders returned at ${companyName}; ${engaged.length} engaged in logged meetings or emails.`,
  };
}
