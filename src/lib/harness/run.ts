import "server-only";
import { extractCandidates } from "../candidates";
import { adaptEvidence } from "../gtm/adapt";
import { chooseBackend } from "../gtm/backend";
import {
  COMMANDS,
  buildArgv,
  displayCommand,
  planEstimate,
  sanitizeStep,
  stepEstimate,
  stepNeeds,
  type CommandDef,
  type PlanStep,
} from "../gtm/commands";
import { DATA_ROOTS, type DataRoot } from "../genui/catalog";
import { classifyTurn, decideUi, primaryComponent, type Classification, type UiDecision } from "../gtm/decide";
import { GTM_JOBS, type GtmJob } from "../gtm/jobs";
import {
  MAX_SECTIONS,
  UI_COMPONENTS,
  countSections,
  parseMessage,
  type AssistantMessage,
  type MessageFrame,
  type UiComponentId,
} from "../message";
import type {
  ApprovalDecision,
  ApprovalRequest,
  GenerateResponse,
  HarnessTrace,
  SectionTrace,
  StreamEvent,
  Trace,
  TurnContext,
} from "../spec";
import { answerProse } from "./answer";
import { sameSubject, signEvidence, verifyEvidence } from "./carry";
import {
  coverageLines,
  executeStep,
  findReusable,
  recordDenied,
  refreshContext,
  seedLedger,
  stripRecords,
  type Entity,
  type Ledger,
} from "./evidence";
import { DEMO_ACCOUNTS, PROSE_FOLLOW_UPS, followUpsFor } from "./followups";
import { geminiConfigured, geminiErrorText, geminiModelId, type TokenTally } from "./gemini";
import { asPersonFor, defaultPlan, extractEntity, planWithGemini } from "./planner";
import { progress, stepProgress } from "./progress";
import { finalizeMarkdown, sourceLabels, streamWithGemini, templateMarkdown, type Finalized } from "./writer";

export interface TurnInput {
  description: string;
  clarifications: Record<string, string>;
  approval: ApprovalDecision | null;
  context: TurnContext;
}

export type Emit = (event: StreamEvent) => void;

const PROSE_MIN_CONFIDENCE = 0.75;
const HISTORY_TURNS = 8;

const CONTEXT_STEP: PlanStep = {
  command: "gtm_context_get",
  flags: [],
  rawArgs: null,
  reason: "Read saved business context (free)",
};

function fromApproval(approval: ApprovalDecision): Classification {
  return {
    surface: { choice: "genui", confidence: 1 },
    job: { choice: approval.job, confidence: approval.jobConfidence, probabilities: approval.jobProbabilities },
    questions: [],
    model: "resumed",
    usage: { input_tokens: null, output_tokens: null },
  };
}

function produces(step: PlanStep, key: "companyId" | "contactId"): boolean {
  return (key === "companyId" && step.command === "companies_enrich") || (key === "contactId" && step.command === "contacts_enrich");
}

function jobLabel(job: GtmJob): string {
  return GTM_JOBS[job].split(":")[0]!.trim();
}

function approvalSteps(ledger: Ledger, free: PlanStep[], paid: PlanStep[]): ApprovalRequest["steps"] {
  return [...free, ...paid].map((step) => {
    const def: CommandDef = COMMANDS[step.command];
    const built = buildArgv(step, ledger.ctx, null);
    const display =
      "argv" in built
        ? displayCommand(built.argv)
        : `gtm ${def.path.join(" ")} ${step.flags.map((f) => `--${f.name} ${f.values.join(" ")}`).join(" ")}`.trim();
    return {
      command: step.command,
      flags: step.flags,
      rawArgs: step.rawArgs,
      reason: step.reason,
      display,
      cost: def.cost,
      estimate: stepEstimate(step),
      executed: def.cost === "free",
    };
  });
}

function approvalLead(request: ApprovalRequest, resolved: boolean): string {
  const name = request.entity.company ?? request.entity.contact ?? request.entity.domain ?? "this account";
  const paid = request.steps.filter((s) => !s.executed);
  const opener = resolved ? `I found **${name}** with a free search.` : `I can research **${name}**.`;
  const what = paid.map((s) => s.reason.charAt(0).toLowerCase() + s.reason.slice(1)).join(", and ");
  const cost = request.source === "fixtures" ? "This is demo data, so nothing is charged." : "These spend your ZoomInfo credits.";
  return `${opener} To finish the ${jobLabel(request.job).toLowerCase()}, I'd run ${paid.length} more GTM call${paid.length === 1 ? "" : "s"}: ${what}. ${cost} Want me to go ahead?`;
}

function notFoundMarkdown(query: string | null, source: "gtm-cli" | "fixtures"): string {
  if (!query) return "Which company or contact should I look at? Name one and I'll start with a free search.";
  const where = source === "fixtures" ? "in the demo data" : "in ZoomInfo";
  const hint =
    source === "fixtures"
      ? `The demo covers ${DEMO_ACCOUNTS.join(", ")}, Jordan Lee, and Alex Chen — or sign in to the GTM CLI for live data.`
      : "An empty search isn't proof the company doesn't exist, or that we have no history with it. Try the website domain or the exact legal name.";
  return `I couldn't find a match for **${query}** ${where}, so I stopped before spending any credits. ${hint}`;
}

/** Sections Jev allowed vs. what the final reply shows, with the reason for every candidate left out. */
function sectionTrace(
  base: UiDecision["sections"],
  markdown: string,
  frame: MessageFrame,
  compose: Finalized["compose"],
): SectionTrace {
  const dropped = [...base.dropped];
  if (compose && compose.status !== "shown") {
    const codes = [...new Set(compose.report?.diagnostics.map((d) => d.code) ?? [])];
    dropped.push({ id: "compose", reason: compose.status, ...(codes.length ? { detail: codes.join(", ") } : {}) });
  }
  return {
    ...base,
    shown: countSections(parseMessage(markdown, frame)).total,
    dropped,
    ...(compose?.report ? { compose: compose.report } : {}),
  };
}

function emptyFrame(): MessageFrame {
  return {
    job: null,
    entityLabel: null,
    source: null,
    data: {},
    placements: {},
    compose: null,
    rootSources: {},
    componentSources: {},
    sources: {},
    allowCrmDrafts: false,
    notFound: null,
  };
}

export async function runTurn(input: TurnInput, emit: Emit = () => {}): Promise<GenerateResponse> {
  const started = Date.now();
  const { description, clarifications, approval } = input;
  const history = input.context.history.slice(-HISTORY_TURNS);
  const previous = [...history].reverse().find((h) => h.role === "user")?.text ?? null;
  const conversation = history.map((h) => `${h.role}: ${h.text.slice(0, 400)}`).join("\n");
  const candidates = extractCandidates(description);
  const gemini: TokenTally = { input_tokens: 0, output_tokens: 0 };
  const modelId = geminiModelId();
  const useGemini = geminiConfigured();

  const explicit = approval?.entity ?? extractEntity(description);
  const namesEntity = Boolean(explicit.company || explicit.contact || explicit.domain);
  if (!approval) emit({ type: "activity", label: progress.reading(namesEntity ? explicit : (input.context.entity ?? explicit)) });
  const cls = approval
    ? fromApproval(approval)
    : await classifyTurn(description, candidates, clarifications, namesEntity || Boolean(input.context.entity), previous);
  const job = cls.job.choice;

  const baseTrace = (extra: Partial<Trace> = {}): Trace => ({
    model: cls.model,
    ms: Date.now() - started,
    surface: cls.surface,
    job: cls.job,
    purpose: null,
    ui: null,
    clarifications,
    usage: cls.usage,
    ...extra,
  });

  // The prose path only answers product questions; anything naming an account needs evidence.
  if (cls.surface.choice === "prose" && (namesEntity || cls.surface.confidence < PROSE_MIN_CONFIDENCE)) {
    cls.surface = { choice: "genui", confidence: 1 - cls.surface.confidence };
  }
  // Follow-ups ("what about their tech stack?") inherit the last researched entity; naming only a
  // person ("email Jordan Lee") keeps the account they were researched under.
  const prior = input.context.entity;
  const spoken = approval ? explicit : asPersonFor(job, explicit);
  const named: Entity = !prior
    ? spoken
    : !namesEntity
      ? { ...prior, competitor: spoken.competitor ?? prior.competitor }
      : spoken.contact && !spoken.company && !spoken.domain
        ? { ...spoken, company: prior.company, domain: prior.domain }
        : spoken;

  if (cls.surface.choice === "genui" && cls.questions.length > 0) {
    const name = named.company ?? named.contact;
    return {
      status: "needs_questions",
      lead: `Happy to help${name ? ` with **${name}**` : ""}. One quick question so I pull the right research:`,
      questions: cls.questions,
      trace: baseTrace(),
    };
  }

  if (cls.surface.choice === "prose") {
    emit({ type: "activity", label: progress.prose(useGemini) });
    const frame = emptyFrame();
    emit({ type: "frame", frame });
    const answer = await answerProse({ description, history, usage: gemini, modelId, useGemini, onDelta: (text) => emit({ type: "delta", text }) });
    if (answer.error) emit({ type: "reset" });
    const message: AssistantMessage = { ...frame, markdown: answer.markdown, coverage: [], followUps: PROSE_FOLLOW_UPS, writer: answer.writer };
    return {
      status: "ready",
      message,
      trace: baseTrace({
        model: `${cls.model}${answer.writer.model ? ` + ${answer.writer.model}` : ""}`,
        harness: {
          source: "fixtures",
          cli: "skipped",
          cliDetail: "Product question — no GTM CLI calls.",
          planner: { kind: "default", model: null },
          writer: { kind: answer.writer.kind, model: answer.writer.model, error: answer.error },
          approval: "not_needed",
          entity: { company: null, contact: null, domain: null, competitor: null },
          steps: [],
          coverage: [],
          geminiUsage: gemini,
        },
      }),
    };
  }

  const choice = await chooseBackend();
  const ledger: Ledger = {
    items: [],
    ctx: {},
    entity: named,
    backend: choice.backend,
    onStep: (ev) => emit({ type: "step", step: stripRecords([ev])[0]! }),
    onStart: (step) => emit({ type: "progress", label: stepProgress(step, ledger.entity) }),
  };
  let planner: HarnessTrace["planner"] = approval?.planner ?? { kind: "default", model: null };
  let freeSteps: PlanStep[] = [];
  let paidSteps: PlanStep[] = [];

  const harness = (extra: Partial<HarnessTrace>): HarnessTrace => ({
    source: choice.backend.kind,
    cli: choice.cli,
    cliDetail: choice.detail,
    planner,
    writer: { kind: "none", model: null },
    approval: !approval ? "not_needed" : approval.decision,
    entity: ledger.entity,
    steps: stripRecords(ledger.items),
    coverage: coverageLines(ledger, choice.cli),
    geminiUsage: gemini,
    ...extra,
  });

  const notFound = (query: string | null): GenerateResponse => {
    const coverage = coverageLines(ledger, choice.cli);
    const frame: MessageFrame = { ...emptyFrame(), job, entityLabel: query, source: choice.backend.kind, sources: sourceLabels(ledger), notFound: { query } };
    const message: AssistantMessage = {
      ...frame,
      markdown: notFoundMarkdown(query, choice.backend.kind),
      coverage,
      followUps: followUpsFor(job, ledger.entity, {}, true),
      writer: { kind: "template", model: null },
    };
    return { status: "ready", message, trace: baseTrace({ harness: harness({ coverage }) }) };
  };

  if (clarifications.company === "none") return notFound(named.company ?? named.domain ?? named.contact);
  if (clarifications.company) ledger.pinnedCompanyId = clarifications.company;

  // Evidence from the approval gate (this turn) or from the last turn about the same subject.
  const resumed = approval ? verifyEvidence(approval.evidence) : null;
  const earlier = resumed ? null : verifyEvidence(input.context.carry);
  const carried = [resumed, earlier].find((c) => c && c.source === choice.backend.kind && (c === resumed || sameSubject(named, c.entity))) ?? null;
  if (carried) {
    const otherPerson = Boolean(named.contact && named.contact !== carried.entity.contact);
    seedLedger(ledger, carried.items, otherPerson ? { companyId: carried.ctx.companyId } : carried.ctx, carried === earlier);
    ledger.entity = {
      company: carried.entity.company ?? named.company,
      domain: carried.entity.domain ?? named.domain,
      contact: named.contact ?? carried.entity.contact,
      competitor: named.competitor ?? carried.entity.competitor,
    };
    if (otherPerson) refreshContext(ledger);
    if (earlier) emit({ type: "activity", label: progress.reusing(carried.items.filter((e) => e.status === "ok").length, ledger.entity) });
  }
  const sameJob = carried?.job === job;
  const reusable = (step: PlanStep) => findReusable(ledger, step, sameJob);
  if (!reusable(CONTEXT_STEP)) await executeStep(ledger, CONTEXT_STEP);

  if (approval) {
    const approvedPaid = approval.steps.filter((s) => s.cost !== "free").length;
    emit({ type: "activity", label: approval.decision === "approved" ? progress.approved(approvedPaid) : progress.declined() });
    const steps = approval.steps.map(sanitizeStep).filter((s): s is PlanStep => s !== null);
    freeSteps = steps.filter((s) => COMMANDS[s.command].cost === "free" && s.command !== "gtm_context_get");
    paidSteps = steps.filter((s) => COMMANDS[s.command].cost !== "free").slice(0, 4);
    for (const step of freeSteps) if (!reusable(step)) await executeStep(ledger, step);
  } else {
    const searchHelp = choice.backend.kind === "gtm-cli" ? await choice.backend.help("companies_search") : "--name";
    const hint = defaultPlan(job, ledger.entity, Boolean(searchHelp?.includes("--name")));
    let planned = false;
    if (useGemini) {
      emit({ type: "activity", label: progress.planning(job, ledger.entity) });
      try {
        const result = await planWithGemini({ description, job, ledger, hint, usage: gemini, modelId, conversation });
        ledger.entity = result.entity;
        freeSteps = result.freeSteps;
        paidSteps = result.paidSteps;
        planner = { kind: "gemini", model: modelId };
        planned = true;
      } catch (error) {
        planner = { kind: "default", model: null, error: `Gemini planner failed: ${geminiErrorText(error)}` };
        emit({ type: "activity", label: progress.plannerFallback() });
      }
    }
    if (!planned) {
      if (!useGemini) emit({ type: "activity", label: progress.planning(job, ledger.entity) });
      // A planner that failed midway may already have run some of these free lookups.
      const alreadyRan = new Set(ledger.items.filter((e) => e.status === "ok" && !e.carried).map((e) => e.command));
      freeSteps = hint.filter((s) => COMMANDS[s.command].cost === "free");
      paidSteps = hint.filter((s) => COMMANDS[s.command].cost !== "free");
      for (const step of freeSteps) if (!alreadyRan.has(step.command) && !reusable(step)) await executeStep(ledger, step);
    }
    // Drafts write from what is already known; paid research is its own request.
    if (job === "draft") paidSteps = [];
    paidSteps = paidSteps.filter((step) => !reusable(step));
  }

  // Context Graph rule (spec 08 §4): never research a company that only loosely matched the name.
  if (!ledger.ctx.companyId && ledger.ambiguous && job !== "gtm_context") {
    const { query, options } = ledger.ambiguous;
    const where = choice.backend.kind === "fixtures" ? "the demo data" : "ZoomInfo";
    return {
      status: "needs_questions",
      lead: `I didn't find an exact match for **${query}** in ${where}, so I haven't run any paid research yet. Which company do you mean?`,
      questions: [
        {
          id: "company",
          prompt: "Which company?",
          options: [...options.map((o) => ({ id: o.id, label: o.label })), { id: "none", label: "None of these" }],
        },
      ],
      trace: baseTrace({ harness: harness({}) }),
    };
  }

  const resolvable = paidSteps.filter((step) =>
    stepNeeds(step).every((key) => ledger.ctx[key] || paidSteps.some((p) => p !== step && produces(p, key))),
  );

  if (!approval && resolvable.length > 0) {
    const request: ApprovalRequest = {
      job,
      jobConfidence: cls.job.confidence,
      jobProbabilities: cls.job.probabilities,
      entity: ledger.entity,
      source: choice.backend.kind,
      steps: approvalSteps(ledger, freeSteps, resolvable),
      estimate: planEstimate(resolvable),
      note:
        choice.backend.kind === "fixtures"
          ? "Fixture mode: these steps run against demo data and no credits are charged. With a signed-in GTM CLI the same steps spend real credits."
          : "These steps spend your ZoomInfo credits. The estimate is approximate: actual charges depend on records and work done.",
      planner,
      evidence: signEvidence({ job, ledger }),
    };
    return {
      status: "needs_approval",
      lead: approvalLead(request, Boolean(ledger.ctx.companyId || ledger.ctx.contactId)),
      approval: request,
      trace: baseTrace({ harness: harness({ approval: "pending" }) }),
    };
  }

  if (approval?.decision === "approved") {
    for (const step of resolvable) await executeStep(ledger, step);
  } else if (approval?.decision === "declined") {
    for (const step of resolvable) recordDenied(ledger, step);
  }

  const adapted = adaptEvidence(ledger, job);
  if (adapted.notFound) return notFound(adapted.entityLabel);
  const coverage = coverageLines(ledger, choice.cli);
  const sources = sourceLabels(ledger);

  emit({ type: "activity", label: progress.deciding(ledger.items.filter((e) => e.status === "ok").length) });
  const ui = await decideUi({ description, previous, job, clarifications, adapted, allowCompose: useGemini });
  const sourcesOf = (keys: readonly string[]) => [...new Set(keys.flatMap((key) => adapted.sources[key] ?? []))];
  const componentSources: MessageFrame["componentSources"] = {};
  for (const id of Object.keys(UI_COMPONENTS) as UiComponentId[]) componentSources[id] = sourcesOf(UI_COMPONENTS[id].sources);
  const rootSources: MessageFrame["rootSources"] = {};
  for (const root of Object.keys(DATA_ROOTS) as DataRoot[]) rootSources[root] = sourcesOf(DATA_ROOTS[root]);
  const frame: MessageFrame = {
    job,
    entityLabel: adapted.entityLabel,
    source: choice.backend.kind,
    data: ui.data,
    placements: ui.placements,
    compose: ui.compose,
    componentSources,
    rootSources,
    sources,
    allowCrmDrafts:
      ui.mode.choice === "visual" &&
      ui.sections.allowed < MAX_SECTIONS &&
      job !== "gtm_context" &&
      !coverage.some((line) => line.startsWith("CRM history: not connected")) &&
      Boolean(ui.data.company || ui.data.contact),
    notFound: null,
  };
  emit({ type: "frame", frame });

  const fallback = primaryComponent(job, frame.data);
  let finalized: Finalized | null = null;
  let writer: HarnessTrace["writer"] = { kind: "template", model: null };
  if (useGemini) {
    emit({ type: "activity", label: progress.writing(job, ledger.entity) });
    let streamed = false;
    try {
      const raw = await streamWithGemini({
        description,
        history,
        job,
        purpose: ui.purpose.choice,
        ledger,
        frame,
        coverage,
        usage: gemini,
        onDelta: (text) => {
          streamed = true;
          emit({ type: "delta", text });
        },
      });
      finalized = finalizeMarkdown(raw, frame, ledger, fallback);
      writer = { kind: "gemini", model: modelId };
    } catch (error) {
      if (streamed) emit({ type: "reset" });
      writer = { kind: "template", model: null, error: `Gemini writer failed: ${geminiErrorText(error)}` };
      emit({ type: "activity", label: progress.writerFallback() });
    }
  }
  finalized ??= finalizeMarkdown(templateMarkdown({ job, ledger, adapted, frame, coverage }), frame, ledger, fallback);
  const markdown = finalized.markdown;

  const sections = sectionTrace(ui.sections, markdown, frame, finalized.compose);
  console.info("[genui]", JSON.stringify({ job, mode: ui.mode.choice, allowed: sections.allowed, shown: sections.shown, dropped: sections.dropped.map((d) => `${d.id}:${d.reason}`) }));

  const message: AssistantMessage = {
    ...frame,
    markdown,
    coverage,
    followUps: followUpsFor(job, ledger.entity, ui.data, false),
    writer:
      writer.kind === "gemini"
        ? { kind: "gemini", model: writer.model }
        : { kind: "template", model: null, note: useGemini ? "Gemini was unavailable — evidence-only reply." : "Evidence-only reply — set GOOGLE_GENERATIVE_AI_API_KEY for Gemini-written replies." },
    carry: signEvidence({ job, ledger }),
  };
  const models = [cls.model, ui.model, planner.model, writer.model].filter(
    (m, i, all): m is string => Boolean(m) && all.indexOf(m) === i,
  );
  return {
    status: "ready",
    message,
    trace: baseTrace({
      model: models.join(" + "),
      purpose: ui.purpose,
      ui: { mode: ui.mode, picks: ui.picks, sections },
      usage: {
        input_tokens: (cls.usage.input_tokens ?? 0) + (ui.usage.input_tokens ?? 0),
        output_tokens: (cls.usage.output_tokens ?? 0) + (ui.usage.output_tokens ?? 0),
      },
      harness: harness({ writer, coverage }),
    }),
  };
}

export function isGtmJob(value: unknown): value is GtmJob {
  return typeof value === "string" && value in GTM_JOBS;
}
