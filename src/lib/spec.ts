import type { GtmJob, GtmPurpose } from "./gtm/jobs";
import type { AssistantMessage, MessageFrame, UiComponentId } from "./message";

export type EvidenceStatus = "ok" | "empty" | "unauthorized" | "unavailable" | "denied" | "error" | "skipped";

export interface EvidenceSummary {
  id: string;
  command: string;
  display: string;
  cost: "free" | "data" | "ai";
  status: EvidenceStatus;
  source: "gtm-cli" | "fixtures";
  count: number;
  ms: number;
  reason: string;
  error?: string;
  /** Came from an earlier turn's ledger rather than a call made this turn. */
  carried?: boolean;
}

/** An evidence ledger the server signed, held by the client and returned on the next turn. */
export interface SignedEvidence {
  payload: string;
  sig: string;
}

export interface HarnessTrace {
  source: "gtm-cli" | "fixtures";
  cli: "ready" | "not_installed" | "unauthenticated" | "skipped";
  cliDetail: string;
  planner: { kind: "gemini" | "default"; model: string | null; error?: string };
  writer: { kind: "gemini" | "template" | "none"; model: string | null; error?: string };
  approval: "not_needed" | "pending" | "approved" | "declined";
  entity: EntityRef;
  steps: EvidenceSummary[];
  coverage: string[];
  geminiUsage: { input_tokens: number; output_tokens: number };
}

export interface UiPick {
  id: UiComponentId | "compose";
  placement: "lead" | "inline" | "omit";
  confidence: number;
  /** 1 − P(omit): how strongly Jev wants this section at all. */
  keep: number;
}

export type SectionDropReason = "omitted" | "below_threshold" | "overlap" | "cap" | "text_mode" | "not_placed" | "invalid";

/** GenUI sections for one reply: what Jev allowed, what the reply actually showed, and why others were cut. */
export interface SectionTrace {
  limit: number;
  allowed: number;
  shown: number;
  /** Jev's probability that the request needs at least 1, 2, and 3 views. */
  need?: number[];
  dropped: { id: string; reason: SectionDropReason; detail?: string }[];
  /** Composed-block diagnostics from the compiler, when one was written. */
  compose?: { nodes: number; roots: string[]; diagnostics: { code: string; detail: string }[] };
}

/** What Jev decided this turn — shown in the message's activity panel. */
export interface Trace {
  model: string;
  ms: number;
  surface: { choice: "genui" | "prose"; confidence: number };
  job: { choice: GtmJob; confidence: number; probabilities: Record<string, number> };
  purpose: { choice: GtmPurpose; confidence: number } | null;
  ui: { mode: { choice: "visual" | "text"; confidence: number }; picks: UiPick[]; sections?: SectionTrace } | null;
  clarifications: Record<string, string>;
  usage: { input_tokens: number | null; output_tokens: number | null };
  harness?: HarnessTrace;
}

export interface EntityRef {
  company: string | null;
  contact: string | null;
  domain: string | null;
  competitor: string | null;
}

export interface ClarifyingQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
}

export interface FlagValue {
  name: string;
  values: string[];
}

export interface ApprovalStep {
  command: string;
  flags: FlagValue[];
  rawArgs: Record<string, unknown> | null;
  reason: string;
  display: string;
  cost: "free" | "data" | "ai";
  estimate: string;
  /** Free steps already ran while planning; they re-run (free) when the turn resumes. */
  executed: boolean;
}

export interface ApprovalRequest {
  job: GtmJob;
  jobConfidence: number;
  jobProbabilities: Record<string, number>;
  entity: EntityRef;
  source: "gtm-cli" | "fixtures";
  steps: ApprovalStep[];
  estimate: string;
  note: string;
  planner: HarnessTrace["planner"];
  /** The ledger at the gate (free calls already made), so resuming doesn't repeat them. */
  evidence?: SignedEvidence;
}

/** What the client sends back after the approval prompt. */
export interface ApprovalDecision extends Omit<ApprovalRequest, "estimate" | "note" | "source"> {
  decision: "approved" | "declined";
}

/** Prior turns, as plain text, so follow-ups ("what about their tech stack?") keep context. */
export interface HistoryEntry {
  role: "user" | "assistant";
  text: string;
}

export interface TurnContext {
  history: HistoryEntry[];
  /** Entity of the most recent research turn, used when the new prompt names none. */
  entity: EntityRef | null;
  /** That turn's signed evidence; reused when this turn is about the same account. */
  carry?: SignedEvidence | null;
}

export type GenerateReady = {
  status: "ready";
  message: AssistantMessage;
  trace: Trace;
};

export type GenerateNeedsQuestions = {
  status: "needs_questions";
  lead: string;
  questions: ClarifyingQuestion[];
  trace: Trace;
};

export type GenerateNeedsApproval = {
  status: "needs_approval";
  lead: string;
  approval: ApprovalRequest;
  trace: Trace;
};

export type GenerateResponse = GenerateReady | GenerateNeedsQuestions | GenerateNeedsApproval;

/** NDJSON events from POST /api/generate, in order. */
export type StreamEvent =
  | { type: "activity"; label: string }
  /** Transient status for the step that is running; replaces the live line without being logged. */
  | { type: "progress"; label: string }
  | { type: "step"; step: EvidenceSummary }
  | { type: "frame"; frame: MessageFrame }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "done"; response: GenerateResponse }
  | { type: "error"; message: string };
