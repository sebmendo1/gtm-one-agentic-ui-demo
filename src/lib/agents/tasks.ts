import { COMMANDS, type CommandId, type PlanStep } from "@/lib/gtm/commands";
import type { FixtureBundle as BundleData } from "@/lib/gtm/fixtures";
import type { EvidenceSummary } from "@/lib/spec";
import { CALENDAR_EVENTS, INBOX_THREADS, OVERNIGHT_SIGNALS, PERSONA_PROFILE } from "./fixtures";
import type { AgentId, AgentRun, AgentTask, AgentTaskStatus } from "./types";

type Outcome = "ready" | "needs_approval" | "not_found";

/** Lookups that only resolve an id; their evidence folds into the task that uses it. */
const RESOLVERS = new Set<string>(["companies_enrich", "companies_search"]);

function company(run: Pick<AgentRun, "entity">): string {
  return run.entity.company ?? "the account";
}

function labelFor(agentId: AgentId, command: string, run: Pick<AgentRun, "entity">): string | null {
  switch (command) {
    case "gtm_context_get":
      return null;
    case "contacts_recommended":
      return "Find who to talk to";
    case "contacts_search":
      return agentId === "account_map" ? "Find stakeholders" : `Look up ${run.entity.contact ?? "the contact"}`;
    case "browse_engagements":
      return agentId === "account_map" ? "Check who we've engaged" : "Check our history";
    case "scoops_search":
      return "Scan recent news";
    case "company_signals":
      return agentId === "account_map" ? "Spot what changed" : "Check buying signals";
    case "companies_enrich":
    case "companies_search":
      return `Look up ${company(run)}`;
    default:
      return command.replace(/_/g, " ");
  }
}

function titleFor(agentId: AgentId, command: string, run: Pick<AgentRun, "entity">): string | null {
  switch (command) {
    case "contacts_recommended":
      return `Found who to talk to at ${company(run)} in ZoomInfo`;
    case "contacts_search":
      return agentId === "account_map" ? `Found stakeholders at ${company(run)} in ZoomInfo` : `Looked up ${run.entity.contact ?? "the contact"} in ZoomInfo`;
    case "browse_engagements":
      return agentId === "account_map" ? "Checked who we've already met" : "Checked our past meetings and emails";
    case "scoops_search":
      return `Scanned recent news on ${company(run)} in ZoomInfo`;
    case "company_signals":
      return `Checked ${company(run)} buying signals in ZoomInfo`;
    case "companies_enrich":
    case "companies_search":
      return `Looked up ${company(run)} in ZoomInfo`;
    default:
      return null;
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const EMPTY: Record<string, string> = {
  contacts_recommended: "No one found",
  contacts_search: "No one found",
  browse_engagements: "No meetings or emails yet",
  scoops_search: "No recent news",
  company_signals: "No new signals",
};

function detailFor(command: string, status: EvidenceSummary["status"], count: number): string {
  if (status === "empty") return EMPTY[command] ?? "Nothing found";
  if (status === "skipped") return "Skipped, missing input";
  if (status === "denied") return "Not approved";
  if (status !== "ok") return "Source unavailable";
  switch (command) {
    case "contacts_recommended":
    case "contacts_search":
      return plural(count, "person", "people");
    case "browse_engagements":
      return plural(count, "meeting or email", "meetings and emails");
    case "scoops_search":
      return plural(count, "news item", "news items");
    case "company_signals":
      return plural(count, "signal", "signals");
    case "companies_enrich":
    case "companies_search":
      return "Company profile";
    default:
      return plural(count, "record", "records");
  }
}

function taskStatus(status: EvidenceSummary["status"]): AgentTaskStatus {
  if (status === "ok") return "done";
  if (status === "empty") return "empty";
  return "skipped";
}

function readTask(run: Pick<AgentRun, "agentId" | "trigger" | "entity">): AgentTask | null {
  const meta = run.trigger.meta;
  const base = { id: "read", status: "done" as const, cost: "free" as const, evidenceIds: [], commands: [] };
  if (meta?.threadId) {
    const thread = INBOX_THREADS.find((t) => t.id === meta.threadId);
    if (thread) return { ...base, label: "Read the thread", title: `Read ${thread.fromName}'s thread in Gmail`, source: "gmail", detail: `“${thread.snippet}”` };
  }
  if (meta?.eventId) {
    const event = CALENDAR_EVENTS.find((e) => e.id === meta.eventId);
    if (event) {
      const guests = event.attendees.filter((a) => !a.internal).length;
      return { ...base, label: "Read the meeting", title: "Read the invite in Google Calendar", source: "calendar", detail: `${event.title} · ${plural(guests, "guest", "guests")} from ${company(run)}` };
    }
  }
  if (meta?.signalId) {
    const signal = OVERNIGHT_SIGNALS.find((s) => s.id === meta.signalId);
    if (signal) return { ...base, label: "Read the signal", title: "Read the overnight signal in ZoomInfo", source: "zoominfo", detail: signal.headline };
  }
  return null;
}

const WRITE_TITLE: Record<AgentId, string> = {
  meeting_prep: "Wrote the brief from what I found",
  follow_up_nudge: "Drafted the reply from the thread and history",
  account_map: "Mapped the committee from what I found",
  deal_watch: "Wrote the why-now note from the signal",
};

const WRITE_LABEL: Record<AgentId, string> = {
  meeting_prep: "Write the brief",
  follow_up_nudge: "Draft the reply",
  account_map: "Map the committee",
  deal_watch: "Write the why-now note",
};

function writeDetail(agentId: AgentId, data: BundleData | null): string {
  switch (agentId) {
    case "meeting_prep":
      return "Talk track ready";
    case "follow_up_nudge":
      return `Signed as ${PERSONA_PROFILE.name.split(" ")[0]}, ready to send`;
    case "account_map":
      return data?.committee ? `${plural(data.committee.members.length, "stakeholder", "stakeholders")} mapped` : "Committee mapped";
    case "deal_watch":
      return "Outreach note ready";
  }
}

/** Breaks one run into the small tasks its specialist ran, in order. */
export function buildTasks(
  run: Pick<AgentRun, "agentId" | "trigger" | "entity">,
  items: EvidenceSummary[],
  pending: PlanStep[],
  outcome: Outcome,
  data: BundleData | null,
  /** The run's paid steps; everything else ran as part of the free sweep. */
  paid: PlanStep[] = [],
): AgentTask[] {
  const billed = new Set<string>(paid.map((s) => s.command));
  const tasks: AgentTask[] = [];
  const read = readTask(run);
  if (read) tasks.push(read);

  let carry: EvidenceSummary[] = [];
  const meaningful = items.filter((e) => labelFor(run.agentId, e.command, run));
  meaningful.forEach((item, i) => {
    const isLast = i === meaningful.length - 1;
    if (RESOLVERS.has(item.command) && !isLast) {
      carry.push(item);
      return;
    }
    const group = [...carry, item];
    carry = [];
    tasks.push({
      id: item.id,
      label: labelFor(run.agentId, item.command, run)!,
      title: titleFor(run.agentId, item.command, run) ?? undefined,
      detail: detailFor(item.command, item.status, item.count),
      source: "zoominfo",
      status: taskStatus(item.status),
      cost: group.some((e) => billed.has(e.command) && e.cost === "ai") ? "ai" : group.some((e) => billed.has(e.command) && e.cost === "data") ? "data" : "free",
      evidenceIds: group.map((e) => e.id),
      commands: group.map((e) => e.display),
    });
  });

  for (const step of pending) {
    const def = COMMANDS[step.command as CommandId];
    tasks.push({
      id: `pending-${step.command}`,
      label: labelFor(run.agentId, step.command, run) ?? step.reason,
      detail: def.cost === "ai" ? "Uses AI credits · needs your OK" : "Uses data credits · needs your OK",
      source: "zoominfo",
      status: "waiting",
      cost: def.cost,
      evidenceIds: [],
      commands: [`gtm ${def.path.join(" ")}`],
    });
  }

  if (outcome !== "not_found") {
    tasks.push({
      id: "write",
      label: WRITE_LABEL[run.agentId],
      title: outcome === "needs_approval" ? undefined : WRITE_TITLE[run.agentId],
      detail: outcome === "needs_approval" ? "Waits for the paid step" : writeDetail(run.agentId, data),
      source: "writer",
      status: outcome === "needs_approval" ? "waiting" : "done",
      cost: "free",
      evidenceIds: [],
      commands: [],
    });
  }
  return tasks;
}

/** An approval finished in the thread: the waiting tasks ran and the result is in. */
export function completeTasks(run: AgentRun, data: BundleData): Pick<AgentRun, "tasks" | "summary"> {
  return {
    summary: runSummary(run, "ready", data, []),
    tasks: run.tasks?.map((t) =>
      t.status !== "waiting"
        ? t
        : {
            ...t,
            status: "done",
            title: t.source === "writer" ? WRITE_TITLE[run.agentId] : `${t.label} (you approved it)`,
            detail: t.source === "writer" ? writeDetail(run.agentId, data) : "Approved and run",
          },
    ),
  };
}

/** What the specialist did, as one line for its row in the hub. */
export function runSummary(run: Pick<AgentRun, "agentId" | "entity">, outcome: Outcome, data: BundleData | null, items: EvidenceSummary[]): string {
  const name = company(run);
  if (outcome === "not_found") return `Couldn't find enough on ${name}`;
  if (outcome === "needs_approval") {
    const people = items.find((e) => e.command === "contacts_search" && e.status === "ok")?.count;
    return people ? `Found ${plural(people, "stakeholder", "stakeholders")} at ${name}; needs your OK to finish` : `Needs your OK to finish ${name}`;
  }
  switch (run.agentId) {
    case "meeting_prep":
      return `Prepped your ${name} meeting`;
    case "follow_up_nudge":
      return `Drafted a reply to ${run.entity.contact ?? name}`;
    case "account_map":
      return data?.committee ? `Mapped ${plural(data.committee.members.length, "stakeholder", "stakeholders")} at ${name}` : `Mapped the buying committee at ${name}`;
    case "deal_watch":
      return `Flagged a buying signal at ${name}`;
  }
}
