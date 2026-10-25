"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { messagePlainText, type AssistantMessage, type MessageFrame } from "@/lib/message";
import { nextFrame } from "@/lib/stream/frame";
import { HUB_CONVERSATION_ID, type AgentId, type AgentRun } from "@/lib/agents/types";
import { agentDisplayName } from "@/lib/agents/catalog";
import type {
  ApprovalDecision,
  ApprovalRequest,
  ClarifyingQuestion,
  EntityRef,
  SignedEvidence,
  StreamEvent,
  Trace,
  TurnContext,
} from "@/lib/spec";
import type { ActivityState } from "./Activity";

export type Phase = { activity: ActivityState; trace: Trace | null };

export type Turn = {
  id: string;
  prompt: string;
  origin?: "agent";
  agentMeta?: { runId: string; agentId: AgentId };
  createdAt?: number;
  /** Answered in the browser (hub intents, agent log lines); never sent to the model as history. */
  local?: { markdown: string };
  status: "streaming" | "ready" | "error" | "needs_input" | "needs_approval";
  activity: ActivityState;
  frame: MessageFrame | null;
  draft: string;
  message: AssistantMessage | null;
  trace: Trace | null;
  /** `prelude` keeps the activity that led to the prompt once the turn resumes past it. */
  question: { lead: string; questions: ClarifyingQuestion[]; prelude?: Phase } | null;
  approval: { lead: string; request: ApprovalRequest; prelude?: Phase } | null;
  decision: ApprovalDecision["decision"] | null;
  clarifications: Record<string, string>;
  error: string | null;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  turns: Turn[];
  /** Spoke threads always belong under Go-to-agent. */
  parentId?: typeof HUB_CONVERSATION_ID;
  origin?: { runId: string; agentId: AgentId };
  agentTouched?: boolean;
};

export function isSubChat(c: Conversation): boolean {
  return c.id !== HUB_CONVERSATION_ID;
}

const HISTORY_KEY = "gtm-chat-history-v2";

function now(): number {
  return Date.now();
}

function title(prompt: string) {
  const clean = prompt.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

function freshActivity(): ActivityState {
  return { labels: [], steps: [], startedAt: now(), ms: null };
}

function blankTurn(id: string, prompt: string): Turn {
  return {
    id,
    prompt,
    createdAt: now(),
    status: "streaming",
    activity: freshActivity(),
    frame: null,
    draft: "",
    message: null,
    trace: null,
    question: null,
    approval: null,
    decision: null,
    clarifications: {},
    error: null,
  };
}

function readHistory(): { conversations: Conversation[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { conversations: [], activeId: null };
    const parsed = JSON.parse(raw) as { conversations?: Conversation[]; activeId?: string | null };
    const conversations = (parsed.conversations ?? []).map((c) => ({
      ...c,
      turns: c.turns.map((t) =>
        t.status === "streaming" ? { ...t, status: "error" as const, error: "This reply was interrupted. Ask again to regenerate." } : t,
      ),
    }));
    const activeId = parsed.activeId && conversations.some((c) => c.id === parsed.activeId) ? parsed.activeId : null;
    return { conversations, activeId };
  } catch {
    return { conversations: [], activeId: null };
  }
}

/** Earlier turns as plain text, plus the last researched entity and its signed evidence, for follow-ups. */
function contextFor(conversation: Conversation | undefined, beforeTurnId: string): TurnContext {
  const history: TurnContext["history"] = [];
  let entity: EntityRef | null = null;
  let carry: SignedEvidence | null = null;
  for (const turn of conversation?.turns ?? []) {
    if (turn.id === beforeTurnId) break;
    if (turn.status !== "ready" || !turn.message) continue;
    history.push({ role: "user", text: turn.prompt });
    history.push({ role: "assistant", text: messagePlainText(turn.message.markdown) });
    const e = turn.trace?.harness?.entity;
    if (e && (e.company || e.contact || e.domain)) {
      entity = e;
      carry = turn.message.carry ?? null;
    }
  }
  return { history: history.slice(-8), entity, carry };
}

/** Only the newest signed ledger is ever sent back, so older ones aren't worth the storage. */
function latestCarryOnly(conversation: Conversation): Conversation {
  const keep = conversation.turns.findLast((t) => t.message?.carry)?.id;
  return {
    ...conversation,
    turns: conversation.turns.map((t) => (t.message?.carry && t.id !== keep ? { ...t, message: { ...t.message, carry: undefined } } : t)),
  };
}

async function readStream(res: Response, onEvent: (event: StreamEvent) => void) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StreamEvent);
}

export function useChat() {
  const [ready, setReady] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const conversationsRef = useRef(conversations);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    // localStorage only exists in the browser, so history is restored after mount.
    const history = readHistory();
    queueMicrotask(() => {
      setConversations(history.conversations);
      setActiveId(history.activeId);
      setReady(true);
    });
  }, []);

  const busy = conversations.some((c) => c.turns.some((t) => t.status === "streaming"));

  useEffect(() => {
    if (!ready || busy) return;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ conversations: conversations.map(latestCarryOnly), activeId }));
    } catch {
      // Over quota: keep the session working; history just isn't saved this time.
    }
  }, [ready, busy, conversations, activeId]);

  const patch = useCallback((conversationId: string, turnId: string, update: (turn: Turn) => Turn) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, updatedAt: now(), turns: c.turns.map((t) => (t.id === turnId ? update(t) : t)) } : c,
      ),
    );
  }, []);

  const run = useCallback(
    async (
      conversationId: string,
      turnId: string,
      prompt: string,
      opts: { clarifications?: Record<string, string>; approval?: ApprovalDecision } = {},
    ) => {
      const conversation = conversationsRef.current.find((c) => c.id === conversationId);
      const context = contextFor(conversation, turnId);
      const set = (update: (turn: Turn) => Turn) => patch(conversationId, turnId, update);
      // Writer deltas can arrive many per frame; they are coalesced into one state update per frame.
      let pendingText = "";
      let cancelFlush: (() => void) | null = null;
      const stopFlush = () => {
        cancelFlush?.();
        cancelFlush = null;
      };
      const flushDraft = () => {
        stopFlush();
        if (!pendingText) return;
        const text = pendingText;
        pendingText = "";
        set((t) => ({ ...t, draft: t.draft + text }));
      };
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: prompt, clarifications: opts.clarifications ?? {}, approval: opts.approval, context }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        await readStream(res, (event) => {
          if (event.type === "delta") {
            pendingText += event.text;
            cancelFlush ??= nextFrame(flushDraft);
            return;
          }
          if (event.type === "reset") pendingText = "";
          flushDraft();
          switch (event.type) {
            case "activity":
              return set((t) => ({ ...t, activity: { ...t.activity, labels: [...t.activity.labels, event.label], current: event.label } }));
            case "progress":
              return set((t) => ({ ...t, activity: { ...t.activity, current: event.label } }));
            case "step":
              return set((t) => ({ ...t, activity: { ...t.activity, steps: [...t.activity.steps, event.step] } }));
            case "frame":
              return set((t) => ({ ...t, frame: event.frame, draft: "" }));
            case "reset":
              return set((t) => ({ ...t, draft: "" }));
            case "error":
              throw new Error(event.message);
            case "done": {
              const r = event.response;
              return set((t) => {
                const finished = { ...t, trace: r.trace, activity: { ...t.activity, ms: now() - t.activity.startedAt } };
                if (r.status === "needs_questions") return { ...finished, status: "needs_input", question: { lead: r.lead, questions: r.questions } };
                if (r.status === "needs_approval") return { ...finished, status: "needs_approval", approval: { lead: r.lead, request: r.approval } };
                return { ...finished, status: "ready", message: r.message, frame: null, draft: "" };
              });
            }
          }
        });
        flushDraft();
      } catch (e) {
        stopFlush();
        const error = e instanceof Error ? e.message : "Request failed";
        set((t) => ({ ...t, status: "error", error }));
      }
    },
    [patch],
  );

  const ensureHub = useCallback((list: Conversation[]) => {
    if (list.some((c) => c.id === HUB_CONVERSATION_ID)) return list;
    const hub: Conversation = { id: HUB_CONVERSATION_ID, title: "Go-to-agent", updatedAt: now(), turns: [] };
    return [hub, ...list];
  }, []);

  const send = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt || busy) return;
      const turnId = crypto.randomUUID();
      const turn = blankTurn(turnId, prompt);
      let conversationId = activeId;
      if (conversationId === HUB_CONVERSATION_ID) {
        conversationsRef.current = ensureHub(conversationsRef.current);
        setConversations((prev) => ensureHub(prev));
      }
      if (!conversationId || conversationId === HUB_CONVERSATION_ID) {
        if (conversationId === HUB_CONVERSATION_ID) {
          const id = HUB_CONVERSATION_ID;
          conversationsRef.current = ensureHub(conversationsRef.current).map((c) =>
            c.id === id ? { ...c, updatedAt: now(), turns: [...c.turns, turn] } : c,
          );
          setConversations((prev) =>
            ensureHub(prev).map((c) => (c.id === id ? { ...c, updatedAt: now(), turns: [...c.turns, turn] } : c)),
          );
          void run(id, turnId, prompt);
          return;
        }
      }
      if (!conversationId || !conversationsRef.current.some((c) => c.id === conversationId)) {
        conversationId = crypto.randomUUID();
        const created: Conversation = {
          id: conversationId,
          title: title(prompt),
          updatedAt: now(),
          turns: [turn],
          parentId: HUB_CONVERSATION_ID,
        };
        conversationsRef.current = ensureHub([created, ...conversationsRef.current]);
        setConversations((prev) => ensureHub([created, ...prev]));
        setActiveId(conversationId);
      } else {
        const id = conversationId;
        conversationsRef.current = conversationsRef.current.map((c) => (c.id === id ? { ...c, turns: [...c.turns, turn] } : c));
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, updatedAt: now(), turns: [...c.turns, turn] } : c)));
      }
      void run(conversationId, turnId, prompt);
    },
    [activeId, busy, run, ensureHub],
  );

  const openHub = useCallback(() => {
    setConversations((prev) => ensureHub(prev));
    setActiveId(HUB_CONVERSATION_ID);
  }, [ensureHub]);

  const answerQuestion = useCallback(
    (conversationId: string, turn: Turn, questionId: string, optionId: string) => {
      const clarifications = { ...turn.clarifications, [questionId]: optionId };
      patch(conversationId, turn.id, (t) => ({
        ...t,
        status: "streaming",
        clarifications,
        question: t.question && { ...t.question, prelude: t.question.prelude ?? { activity: t.activity, trace: t.trace } },
        activity: freshActivity(),
        trace: null,
        error: null,
      }));
      void run(conversationId, turn.id, turn.prompt, { clarifications });
    },
    [patch, run],
  );

  const decide = useCallback(
    (conversationId: string, turn: Turn, decision: ApprovalDecision["decision"]) => {
      const request = turn.approval?.request;
      if (!request) return;
      patch(conversationId, turn.id, (t) => ({
        ...t,
        status: "streaming",
        decision,
        approval: t.approval && { ...t.approval, prelude: t.approval.prelude ?? { activity: t.activity, trace: t.trace } },
        activity: freshActivity(),
        trace: null,
        error: null,
      }));
      void run(conversationId, turn.id, turn.prompt, {
        clarifications: turn.clarifications,
        approval: {
          decision,
          job: request.job,
          jobConfidence: request.jobConfidence,
          jobProbabilities: request.jobProbabilities,
          entity: request.entity,
          steps: request.steps,
          planner: request.planner,
          evidence: request.evidence,
        },
      });
    },
    [patch, run],
  );

  const remove = useCallback(
    (id: string) => {
      if (id === HUB_CONVERSATION_ID) return;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveId((current) => (current === id ? HUB_CONVERSATION_ID : current));
    },
    [],
  );

  const createSubChat = useCallback(
    (initialTitle = "New thread") => {
      const conversationId = crypto.randomUUID();
      const created: Conversation = {
        id: conversationId,
        title: initialTitle,
        updatedAt: now(),
        turns: [],
        parentId: HUB_CONVERSATION_ID,
      };
      setConversations((prev) => ensureHub([created, ...prev]));
      conversationsRef.current = ensureHub([created, ...conversationsRef.current]);
      setActiveId(conversationId);
      return conversationId;
    },
    [ensureHub],
  );

  const appendLocalTurn = useCallback(
    (conversationId: string, entry: { prompt?: string; markdown: string }) => {
      const turn: Turn = { ...blankTurn(crypto.randomUUID(), entry.prompt ?? ""), status: "ready", local: { markdown: entry.markdown } };
      const add = (list: Conversation[]) =>
        ensureHub(list).map((c) => (c.id === conversationId ? { ...c, updatedAt: now(), turns: [...c.turns, turn] } : c));
      conversationsRef.current = add(conversationsRef.current);
      setConversations(add);
    },
    [ensureHub],
  );

  const resetAll = useCallback(() => {
    const hub: Conversation = { id: HUB_CONVERSATION_ID, title: "Go-to-agent", updatedAt: now(), turns: [] };
    conversationsRef.current = [hub];
    setConversations([hub]);
    setActiveId(HUB_CONVERSATION_ID);
  }, []);

  const seedFromRun = useCallback((run: AgentRun) => {
    if (!run.message && run.status !== "needs_approval") return null;
    const conversationId = crypto.randomUUID();
    const turnId = crypto.randomUUID();
    const account = run.entity.company ?? run.entity.contact ?? "Account";
    const title = `${account} · ${agentDisplayName(run.agentId)}`;
    const turn: Turn = {
      id: turnId,
      prompt: run.status === "needs_approval" ? `Finish the ${agentDisplayName(run.agentId).toLowerCase()} for ${account}` : "",
      createdAt: now(),
      origin: "agent",
      agentMeta: { runId: run.id, agentId: run.agentId },
      status: run.status === "needs_approval" ? "needs_approval" : "ready",
      activity: freshActivity(),
      frame: null,
      draft: "",
      message: run.message,
      trace: null,
      question: null,
      approval: run.approval ? { lead: "", request: run.approval } : null,
      decision: null,
      clarifications: {},
      error: null,
    };
    if (run.status === "needs_approval" && run.approval) {
      turn.approval = {
        lead: run.approvalLead ?? `**${agentDisplayName(run.agentId)}** needs approval to finish this for **${account}**.`,
        request: run.approval,
      };
    }
    const created: Conversation = {
      id: conversationId,
      title,
      updatedAt: now(),
      turns: [turn],
      parentId: HUB_CONVERSATION_ID,
      origin: { runId: run.id, agentId: run.agentId },
      agentTouched: true,
    };
    conversationsRef.current = ensureHub([created, ...conversationsRef.current]);
    setConversations((prev) => ensureHub([created, ...prev]));
    setActiveId(conversationId);
    return conversationId;
  }, [ensureHub]);

  const markAgentTouched = useCallback((conversationId: string) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, agentTouched: true } : c)));
  }, []);

  return {
    ready,
    busy,
    conversations,
    active: conversations.find((c) => c.id === activeId) ?? null,
    activeId,
    setActiveId,
    send,
    answerQuestion,
    decide,
    remove,
    seedFromRun,
    markAgentTouched,
    openHub,
    createSubChat,
    appendLocalTurn,
    resetAll,
  };
}
