import "server-only";
import { adaptEvidence } from "@/lib/gtm/adapt";
import { fixtureBackend } from "@/lib/gtm/fixture-cli";
import { COMMANDS, stepNeeds, type PlanStep } from "@/lib/gtm/commands";
import { primaryComponent } from "@/lib/gtm/decide";
import { DATA_ROOTS, type DataRoot } from "@/lib/genui/catalog";
import { UI_COMPONENTS, type MessageFrame, type Placement, type UiComponentId } from "@/lib/message";
import type { AssistantMessage } from "@/lib/message";
import type { ApprovalRequest } from "@/lib/spec";
import { approvalLead, approvalSteps, planEstimate } from "@/lib/harness/approval";
import { signEvidence } from "@/lib/harness/carry";
import { coverageLines, executeStep, type Entity, type Ledger } from "@/lib/harness/evidence";
import { finalizeMarkdown, sourceLabels, templateMarkdown } from "@/lib/harness/writer";
import type { TriggerCandidate } from "./catalog";
import { INBOX_THREADS } from "./fixtures";
import { buildTasks, runSummary } from "./tasks";
import type { AgentId, AgentRun, SweepInput } from "./types";

const CONTEXT_STEP: PlanStep = {
  command: "gtm_context_get",
  flags: [],
  rawArgs: null,
  reason: "Read saved business context (free)",
};

/** The outreach template, turned into a reply on the unanswered thread that triggered the nudge. */
function asReply(markdown: string, threadId: string | undefined): string {
  const thread = INBOX_THREADS.find((t) => t.id === threadId);
  if (!thread) return markdown;
  const ack = "Thanks for your patience. The deck and a one-pager are attached, and I'm happy to walk through both before you pick a pilot slot.";
  return markdown
    .replace(/^\*\*Subject:\*\*.*$/m, `**Subject:** ${thread.subject}`)
    .replace(/^(Hi [^\n]+,)$/m, `$1\n\n${ack}`)
    .replace(", and thought it was a good moment to reach out.", ", so the timing feels right.")
    .replace(/^I've been following .* worth reaching out\.\n\n/m, "")
    .replace(/^(?:If .* this quarter, I'd welcome 20 minutes.*|Would you be open to 20 minutes.*)$/m, "Would a 20-minute walkthrough this week help you lock in the pilot?");
}

/** "~2 data credits" for chips; the approval request keeps the full estimate sentence. */
function shortEstimate(steps: PlanStep[]): string {
  return planEstimate(steps).replace(/^Estimate:\s*/, "").replace(/\.\s*Actual charges.*$/, "");
}

function produces(step: PlanStep, key: "companyId" | "contactId"): boolean {
  return (key === "companyId" && step.command === "companies_enrich") || (key === "contactId" && step.command === "contacts_enrich");
}

function placementsFor(agentId: AgentId, frame: MessageFrame): Partial<Record<UiComponentId, Placement>> {
  const main = primaryComponent(frame.job!, frame.data);
  const out: Partial<Record<UiComponentId, Placement>> = {};
  if (agentId === "meeting_prep") {
    if (frame.data.company) out.company = "lead";
    if (frame.data.signals) out.signals = "inline";
    else if (main) out[main] = "lead";
  } else if (agentId === "deal_watch") {
    if (frame.data.whyNow) out.why_now = "lead";
    else if (frame.data.signals) out.signals = "lead";
  } else if (agentId === "follow_up_nudge") {
    // The reply is the deliverable; who it's to sits under it, not between subject and body.
    if (frame.data.contact) out.contact = "inline";
  } else if (agentId === "account_map") {
    if (frame.data.committee) out.committee = "lead";
    else if (main) out[main] = "lead";
  } else if (main) out[main] = "lead";
  return out;
}

function buildFrame(adapted: ReturnType<typeof adaptEvidence>, job: AgentRun["job"], agentId: AgentId): MessageFrame {
  const sources = adapted.sources;
  const sourcesOf = (keys: readonly string[]) => [...new Set(keys.flatMap((key) => sources[key] ?? []))];
  const componentSources: MessageFrame["componentSources"] = {};
  for (const id of Object.keys(UI_COMPONENTS) as UiComponentId[]) componentSources[id] = sourcesOf(UI_COMPONENTS[id].sources);
  const rootSources: MessageFrame["rootSources"] = {};
  for (const root of Object.keys(DATA_ROOTS) as DataRoot[]) rootSources[root] = sourcesOf(DATA_ROOTS[root]);

  const frame: MessageFrame = {
    job,
    entityLabel: adapted.entityLabel,
    source: "fixtures",
    data: adapted.bundle,
    placements: {},
    compose: null,
    componentSources,
    rootSources,
    sources: {},
    allowCrmDrafts: false,
    notFound: adapted.notFound ? { query: adapted.entityLabel } : null,
  };
  frame.placements = placementsFor(agentId, frame);
  return frame;
}

export async function runAgentCandidate(
  candidate: TriggerCandidate,
  input: SweepInput,
  runId: string,
): Promise<AgentRun> {
  const entity: Entity = {
    company: candidate.entity.company,
    contact: candidate.entity.contact,
    domain: candidate.entity.domain,
    competitor: candidate.entity.competitor,
  };

  const ledger: Ledger = {
    items: [],
    ctx: {},
    entity,
    backend: fixtureBackend,
    onStep: () => {},
    onStart: () => {},
  };

  await executeStep(ledger, CONTEXT_STEP);
  for (const step of candidate.freeSteps) {
    if (stepNeeds(step).every((key) => ledger.ctx[key] || candidate.freeSteps.some((p) => p !== step && produces(p, key)))) {
      await executeStep(ledger, step);
    }
  }

  const paidResolvable = candidate.paidSteps.filter((step) =>
    stepNeeds(step).every((key) => ledger.ctx[key] || candidate.paidSteps.some((p) => p !== step && produces(p, key))),
  );
  const hasAi = paidResolvable.some((s) => COMMANDS[s.command].cost === "ai");
  const dataPaid = paidResolvable.filter((s) => COMMANDS[s.command].cost === "data");
  const autopilotOk =
    input.budget.allowDataAutopilot && dataPaid.length > 0 && !hasAi && dataPaid.length <= input.budget.dataCreditsPerDay;

  if (paidResolvable.length > 0 && !autopilotOk) {
    const request: ApprovalRequest = {
      job: candidate.job,
      jobConfidence: 1,
      jobProbabilities: { [candidate.job]: 1 },
      entity: candidate.entity,
      source: "fixtures",
      steps: approvalSteps(ledger, candidate.freeSteps, paidResolvable),
      estimate: planEstimate(paidResolvable),
      note: "Fixture mode: approving runs demo data only. AI research always asks separately.",
      planner: { kind: "default", model: null },
      evidence: signEvidence({ job: candidate.job, ledger }),
    };
    return {
      id: runId,
      runKey: candidate.runKey,
      agentId: candidate.agentId,
      job: candidate.job,
      trigger: candidate.trigger,
      entity: candidate.entity,
      status: "needs_approval",
      message: null,
      approval: request,
      approvalLead: approvalLead(request, Boolean(ledger.ctx.companyId)),
      costLabel: shortEstimate(paidResolvable),
      primaryAction: candidate.primaryAction,
      summary: runSummary(candidate, "needs_approval", null, ledger.items),
      tasks: buildTasks(candidate, ledger.items, paidResolvable, "needs_approval", null),
      createdAt: input.now,
      seenAt: null,
    };
  }

  if (autopilotOk) {
    for (const step of paidResolvable) await executeStep(ledger, step);
  }

  const adapted = adaptEvidence(ledger, candidate.job);
  if (adapted.notFound) {
    const frame = buildFrame(adapted, candidate.job, candidate.agentId);
    const markdown = `I couldn't find enough demo data for **${adapted.entityLabel ?? "this account"}** to finish this card.`;
    const message: AssistantMessage = {
      ...frame,
      markdown,
      coverage: coverageLines(ledger, "skipped"),
      followUps: [],
      writer: { kind: "template", model: null, note: "Prepared by Go-to-agent" },
      carry: signEvidence({ job: candidate.job, ledger }),
    };
    message.sources = sourceLabels(ledger);
    return {
      id: runId,
      runKey: candidate.runKey,
      agentId: candidate.agentId,
      job: candidate.job,
      trigger: candidate.trigger,
      entity: candidate.entity,
      status: "ready",
      message,
      approval: null,
      costLabel: autopilotOk ? `Autopilot · ${shortEstimate(paidResolvable)}` : "Free",
      primaryAction: candidate.primaryAction,
      summary: runSummary(candidate, "not_found", null, ledger.items),
      tasks: buildTasks(candidate, ledger.items, [], "not_found", null, autopilotOk ? paidResolvable : []),
      createdAt: input.now,
      seenAt: null,
    };
  }

  const frame = buildFrame(adapted, candidate.job, candidate.agentId);
  frame.sources = sourceLabels(ledger);
  const coverage = coverageLines(ledger, "skipped");
  const template = templateMarkdown({ job: candidate.job, ledger, adapted, frame, coverage });
  const raw = candidate.agentId === "follow_up_nudge" ? asReply(template, candidate.trigger.meta?.threadId) : template;
  const finalized = finalizeMarkdown(raw, frame, ledger, primaryComponent(candidate.job, frame.data));
  const message: AssistantMessage = {
    ...frame,
    markdown: finalized.markdown,
    coverage,
    followUps: [],
    writer: { kind: "template", model: null, note: "Prepared by Go-to-agent from GTM evidence" },
    carry: signEvidence({ job: candidate.job, ledger }),
  };

  return {
    id: runId,
    runKey: candidate.runKey,
    agentId: candidate.agentId,
    job: candidate.job,
    trigger: candidate.trigger,
    entity: candidate.entity,
    status: "ready",
    message,
    approval: null,
    costLabel: paidResolvable.length && autopilotOk ? `Autopilot · ${shortEstimate(paidResolvable)}` : "Free",
    primaryAction: candidate.primaryAction,
    summary: runSummary(candidate, "ready", frame.data, ledger.items),
    tasks: buildTasks(candidate, ledger.items, [], "ready", frame.data, autopilotOk ? paidResolvable : []),
    createdAt: input.now,
    seenAt: null,
  };
}
