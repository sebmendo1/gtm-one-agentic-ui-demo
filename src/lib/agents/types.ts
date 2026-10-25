import type { AssistantMessage } from "@/lib/message";
import type { ApprovalRequest, EntityRef } from "@/lib/spec";
import type { GtmJob } from "@/lib/gtm/jobs";

export const HUB_CONVERSATION_ID = "__go-to-agent__";

export type AgentId = "meeting_prep" | "deal_watch" | "follow_up_nudge" | "account_map";

export type AgentRunStatus = "running" | "ready" | "needs_approval" | "done" | "snoozed" | "dismissed";

export type SourceKind = "calendar" | "gmail" | "zoominfo";

export interface AgentTrigger {
  line: string;
  sources: SourceKind[];
  at: number;
  meta?: {
    eventId?: string;
    threadId?: string;
    signalId?: string;
    shareWith?: { name: string; role: string };
  };
}

export type AgentTaskStatus = "done" | "empty" | "waiting" | "skipped";

/** One small job a specialist ran: what it did, where it looked, and what came back. */
export interface AgentTask {
  id: string;
  label: string;
  detail: string;
  source: SourceKind | "writer";
  status: AgentTaskStatus;
  cost: "free" | "data" | "ai";
  /** Ledger ids the task produced, matching the citations in the thread. */
  evidenceIds: string[];
  /** CLI command lines the task ran. */
  commands: string[];
}

export interface AgentRun {
  id: string;
  runKey: string;
  agentId: AgentId;
  job: GtmJob;
  trigger: AgentTrigger;
  entity: EntityRef;
  status: AgentRunStatus;
  message: AssistantMessage | null;
  approval: ApprovalRequest | null;
  /** Server-written sentence explaining what the paid steps would add. */
  approvalLead?: string;
  costLabel: string;
  primaryAction: { label: string; kind: "copy_talk_track" | "copy_draft" | "copy_note" | "approve" };
  /** What the specialist did, in one line ("Drafted a reply to Alex Chen"). */
  summary?: string;
  tasks?: AgentTask[];
  createdAt: number;
  seenAt: number | null;
  /** Wall-clock arrival, for ordering against hub turns. */
  receivedAt?: number;
  /** The thread this card was opened in, reused on the next Open thread. */
  threadId?: string;
}

export type ConnectionState = "disconnected" | "connected" | "locked";

export interface WorkspaceConnections {
  google: ConnectionState;
  salesforce: ConnectionState;
}

export interface WorkspaceProfile {
  name: string;
  role: string;
  roleShort: string;
  company: string;
  territory: string;
  goal: string;
}

export interface WorkspaceBudget {
  dataCreditsPerDay: number;
  allowDataAutopilot: boolean;
}

export type WorkspaceMilestone = "connected" | "firstSweep" | "activated" | "shared" | "invited";

/** Heads-ups the agent raises on its own, between check-ins (spec 11 § Heads-ups). */
export type NudgeKey = "loop_in_se" | "reply_watch" | "morning_lead";

export interface AgentNudge {
  id: string;
  key: NudgeKey;
  /** Demo time it was raised. */
  at: number;
  /** Wall-clock arrival, for ordering against hub turns. */
  receivedAt: number;
  status: "new" | "accepted" | "dismissed";
  seenAt: number | null;
}

export interface Workspace {
  version: 1;
  profile: WorkspaceProfile | null;
  connections: WorkspaceConnections;
  watchlist: string[];
  budget: WorkspaceBudget;
  credits: { data: number; ai: number };
  demoNow: number;
  runs: AgentRun[];
  nudges: AgentNudge[];
  milestones: Partial<Record<WorkspaceMilestone, number>>;
  mappedAccounts: string[];
  onboardingComplete: boolean;
  lastSweepAt?: number;
}

export type AgentStreamEvent =
  | { type: "agent_run"; run: AgentRun }
  | { type: "activity"; label: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface SweepInput {
  now: number;
  watchlist: string[];
  connections: WorkspaceConnections;
  budget: WorkspaceBudget;
  seenRunKeys: string[];
  mappedAccounts: string[];
}
