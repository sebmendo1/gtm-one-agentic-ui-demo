import type { CommandDef, PlanStep } from "@/lib/gtm/commands";
import { COMMANDS } from "@/lib/gtm/commands";
import type { GtmJob } from "@/lib/gtm/jobs";
import type { EntityRef } from "@/lib/spec";
import {
  CALENDAR_EVENTS,
  INBOX_THREADS,
  OVERNIGHT_SIGNALS,
  PERSONA_PROFILE,
  accountLabel,
  type CalendarEvent,
} from "./fixtures";
import { relativeMeeting } from "./time";
import type { AgentId, AgentTrigger, SweepInput } from "./types";

const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;

export interface TriggerCandidate {
  runKey: string;
  agentId: AgentId;
  job: GtmJob;
  entity: EntityRef;
  trigger: AgentTrigger;
  freeSteps: PlanStep[];
  paidSteps: PlanStep[];
  primaryAction: { label: string; kind: "copy_talk_track" | "copy_draft" | "copy_note" | "approve" };
}

function flag(name: string, ...values: string[]) {
  return { name, values };
}

function entityForAccount(key: string): EntityRef {
  const company = accountLabel(key);
  const domain = key === "snowflake" ? "snowflake.com" : key === "stripe" ? "stripe.com" : "salesforce.com";
  return { company, contact: null, domain, competitor: null };
}

function formatMeetingTime(startMs: number, now: number): string {
  const diff = startMs - now;
  if (diff > 0 && diff < MS_HOUR) return `in ${Math.max(1, Math.round(diff / 60_000))} min`;
  return relativeMeeting(startMs, now);
}

function meetingPrepSteps(entity: EntityRef): { free: PlanStep[]; paid: PlanStep[] } {
  const free: PlanStep[] = [];
  const add = (command: PlanStep["command"], flags: PlanStep["flags"], reason: string, rawArgs: Record<string, unknown> | null = null) =>
    free.push({
      command,
      flags,
      rawArgs: (COMMANDS[command] as CommandDef).raw ? (rawArgs ?? {}) : null,
      reason,
    });
  if (entity.domain) add("companies_enrich", [flag("domain", entity.domain)], "Resolve the company by domain");
  else if (entity.company) add("companies_search", [flag("name", entity.company)], "Resolve the company id (free search)");
  add("contacts_recommended", [flag("company-id", "{{companyId}}"), flag("use-case", "account-research")], "Outreach-ready contacts");
  add("browse_engagements", [], "Our meetings and emails with the account", { companyId: "{{companyId}}" });
  add("scoops_search", [flag("published-start", "2026-08-01")], "Recent business events (free market scoops)");
  return { free, paid: [] };
}

function dealWatchSteps(entity: EntityRef): { free: PlanStep[]; paid: PlanStep[] } {
  const free: PlanStep[] = [];
  const add = (command: PlanStep["command"], flags: PlanStep["flags"], reason: string, rawArgs: Record<string, unknown> | null = null) =>
    free.push({ command, flags, rawArgs: (COMMANDS[command] as CommandDef).raw ? (rawArgs ?? {}) : null, reason });
  if (entity.domain) add("companies_enrich", [flag("domain", entity.domain)], "Resolve the company by domain");
  else add("companies_search", [flag("name", entity.company ?? "")], "Resolve the company id");
  add("company_signals", [], "Timing triggers", { zoominfoCompanyIds: ["{{companyId}}"], signalTypes: ["INTENT", "SCOOP", "NEWS"] });
  return { free, paid: [] };
}

function followUpSteps(entity: EntityRef): { free: PlanStep[]; paid: PlanStep[] } {
  const free: PlanStep[] = [];
  const add = (command: PlanStep["command"], flags: PlanStep["flags"], reason: string, rawArgs: Record<string, unknown> | null = null) =>
    free.push({ command, flags, rawArgs: (COMMANDS[command] as CommandDef).raw ? (rawArgs ?? {}) : null, reason });
  if (entity.domain) add("companies_enrich", [flag("domain", entity.domain)], "Resolve the company by domain");
  add("contacts_search", [flag("company-id", "{{companyId}}"), flag("management-level", "Director")], "Find the contact");
  add("browse_engagements", [], "Our history for the draft", {
    companyId: "{{companyId}}",
    contactName: entity.contact ?? "",
  });
  return { free, paid: [] };
}

function accountMapSteps(entity: EntityRef): { free: PlanStep[]; paid: PlanStep[] } {
  const free: PlanStep[] = [];
  const paid: PlanStep[] = [];
  const addFree = (command: PlanStep["command"], flags: PlanStep["flags"], reason: string, rawArgs: Record<string, unknown> | null = null) =>
    free.push({ command, flags, rawArgs: (COMMANDS[command] as CommandDef).raw ? (rawArgs ?? {}) : null, reason });
  const addPaid = (command: PlanStep["command"], flags: PlanStep["flags"], reason: string, rawArgs: Record<string, unknown> | null = null) =>
    paid.push({ command, flags, rawArgs: (COMMANDS[command] as CommandDef).raw ? (rawArgs ?? {}) : null, reason });

  if (entity.domain) addFree("companies_enrich", [flag("domain", entity.domain)], "Resolve the company by domain");
  addFree(
    "contacts_search",
    [flag("company-id", "{{companyId}}"), flag("management-level", "C Level Exec,VP Level Exec,Director")],
    "Stakeholders at the account",
  );
  addFree("browse_engagements", [], "Which stakeholders we have engaged", { companyId: "{{companyId}}" });
  addPaid(
    "company_signals",
    [],
    "Intent and news to prioritize stakeholders",
    { zoominfoCompanyIds: ["{{companyId}}"], signalTypes: ["INTENT", "NEWS"] },
  );
  return { free, paid };
}

function meetingPrepTrigger(event: CalendarEvent, now: number): AgentTrigger {
  const se = event.attendees.find((a) => a.internal && a.name !== PERSONA_PROFILE.name);
  return {
    line: `Because you meet **${accountLabel(event.accountKey!)}** ${formatMeetingTime(event.startMs, now)}`,
    sources: ["calendar", "zoominfo"],
    at: now,
    meta: {
      eventId: event.id,
      shareWith: se ? { name: se.name, role: se.role ?? "Teammate" } : undefined,
    },
  };
}

export function detectTriggers(input: SweepInput): TriggerCandidate[] {
  if (input.connections.google !== "connected") return [];
  const out: TriggerCandidate[] = [];
  const { now, watchlist, seenRunKeys, mappedAccounts } = input;

  for (const event of CALENDAR_EVENTS) {
    if (!event.external || !event.accountKey) continue;
    const delta = event.startMs - now;
    if (delta < 0 || delta > MS_DAY) continue;
    const runKey = `meeting_prep:${event.id}:${event.startMs}`;
    if (seenRunKeys.includes(runKey)) continue;
    const entity = entityForAccount(event.accountKey);
    const steps = meetingPrepSteps(entity);
    out.push({
      runKey,
      agentId: "meeting_prep",
      job: "account_brief",
      entity,
      trigger: meetingPrepTrigger(event, now),
      freeSteps: steps.free,
      paidSteps: steps.paid,
      primaryAction: { label: "Copy talk track", kind: "copy_talk_track" },
    });
  }

  if (now >= Date.parse("2026-10-27T07:00:00-07:00")) {
    for (const sig of OVERNIGHT_SIGNALS) {
      if (!watchlist.includes(sig.accountKey)) continue;
      const runKey = `deal_watch:${sig.id}`;
      if (seenRunKeys.includes(runKey)) continue;
      const entity = entityForAccount(sig.accountKey);
      const steps = dealWatchSteps(entity);
      out.push({
        runKey,
        agentId: "deal_watch",
        job: "why_now",
        entity,
        trigger: {
          line: `Overnight signal on **${sig.company}** — ${sig.headline}`,
          sources: ["zoominfo"],
          at: sig.atMs,
          meta: { signalId: sig.id },
        },
        freeSteps: steps.free,
        paidSteps: steps.paid,
        primaryAction: { label: "Copy outreach note", kind: "copy_note" },
      });
    }
  }

  for (const thread of INBOX_THREADS) {
    if (!thread.unanswered) continue;
    if (!watchlist.includes(thread.accountKey)) continue;
    if (now - thread.receivedMs < 3 * MS_DAY) continue;
    const runKey = `follow_up:${thread.id}`;
    if (seenRunKeys.includes(runKey)) continue;
    const entity: EntityRef = {
      ...entityForAccount(thread.accountKey),
      contact: thread.fromName,
    };
    const steps = followUpSteps(entity);
    out.push({
      runKey,
      agentId: "follow_up_nudge",
      job: "draft",
      entity,
      trigger: {
        line: `**${thread.fromName}** at ${accountLabel(thread.accountKey)} emailed ${Math.floor((now - thread.receivedMs) / MS_DAY)} days ago — still no reply`,
        sources: ["gmail", "zoominfo"],
        at: thread.receivedMs,
        meta: { threadId: thread.id },
      },
      freeSteps: steps.free,
      paidSteps: steps.paid,
      primaryAction: { label: "Copy draft", kind: "copy_draft" },
    });
  }

  for (const event of CALENDAR_EVENTS) {
    if (!event.external || !event.accountKey) continue;
    if (mappedAccounts.includes(event.accountKey)) continue;
    if (event.accountKey === "snowflake" || event.accountKey === "stripe") continue;
    const runKey = `account_map:${event.accountKey}`;
    if (seenRunKeys.includes(runKey)) continue;
    const entity = entityForAccount(event.accountKey);
    const steps = accountMapSteps(entity);
    out.push({
      runKey,
      agentId: "account_map",
      job: "buying_committee",
      entity,
      trigger: {
        line: `**${accountLabel(event.accountKey)}** is new on your calendar — ${event.title.split(" — ")[1] ?? event.title} ${relativeMeeting(event.startMs, now)}`,
        sources: ["calendar", "zoominfo"],
        at: event.startMs,
        meta: { eventId: event.id },
      },
      freeSteps: steps.free,
      paidSteps: steps.paid,
      primaryAction: { label: "Copy stakeholder map", kind: "copy_note" },
    });
  }

  return out.sort((a, b) => a.trigger.at - b.trigger.at);
}

export function agentDisplayName(id: AgentId): string {
  switch (id) {
    case "meeting_prep":
      return "Meeting Prep";
    case "deal_watch":
      return "Deal Watch";
    case "follow_up_nudge":
      return "Follow-up Nudge";
    case "account_map":
      return "Account Map";
  }
}
