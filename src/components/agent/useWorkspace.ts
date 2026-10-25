"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeRuns } from "@/lib/agents/merge-runs";
import { DEFAULT_WATCHLIST, DEMO_MORNING_MS, DEMO_START_MS, PERSONA_PROFILE } from "@/lib/agents/fixtures";
import type { AgentNudge, AgentRun, AgentStreamEvent, NudgeKey, Workspace, WorkspaceMilestone } from "@/lib/agents/types";

const STORAGE_KEY = "gtm-workspace-v1";
const REVEAL_MS = 420;
const TASK_MS = 300;

/** The specialist currently working in a sweep, and which of its tasks is in flight. */
export interface SweepLive {
  run: AgentRun;
  step: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function defaultWorkspace(): Workspace {
  return {
    version: 1,
    profile: null,
    connections: { google: "disconnected", salesforce: "locked" },
    watchlist: [],
    budget: { dataCreditsPerDay: 10, allowDataAutopilot: true },
    credits: { data: 940, ai: 1000 },
    demoNow: DEMO_START_MS,
    runs: [],
    nudges: [],
    milestones: {},
    mappedAccounts: ["snowflake", "stripe"],
    onboardingComplete: false,
  };
}

function readWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWorkspace();
    const parsed = JSON.parse(raw) as Workspace;
    if (parsed.version !== 1) return defaultWorkspace();
    // The profile is fixture-owned, so a saved workspace follows persona changes.
    return { ...defaultWorkspace(), ...parsed, profile: parsed.profile ? PERSONA_PROFILE : null, version: 1 };
  } catch {
    return defaultWorkspace();
  }
}

async function readAgentStream(res: Response, onEvent: (event: AgentStreamEvent) => void) {
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
      if (line) onEvent(JSON.parse(line) as AgentStreamEvent);
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as AgentStreamEvent);
}

export function useWorkspace() {
  const [ready, setReady] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>(defaultWorkspace);
  const [sweeping, setSweeping] = useState(false);
  const [sweepLabel, setSweepLabel] = useState<string | null>(null);
  const [sweepLive, setSweepLive] = useState<SweepLive | null>(null);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const sweepingRef = useRef(false);
  const wsRef = useRef(workspace);

  useEffect(() => {
    wsRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    queueMicrotask(() => {
      wsRef.current = readWorkspace();
      setWorkspace(wsRef.current);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // quota
    }
  }, [ready, workspace]);

  /** Keeps the ref in step so a sweep fired in the same tick sees the new clock and connections. */
  const patch = useCallback((update: (w: Workspace) => Workspace) => {
    wsRef.current = update(wsRef.current);
    setWorkspace(wsRef.current);
  }, []);

  const markMilestone = useCallback((key: WorkspaceMilestone) => {
    patch((w) => ({ ...w, milestones: { ...w.milestones, [key]: w.demoNow } }));
  }, [patch]);

  const completeOnboarding = useCallback(
    (watchlist: string[]) => {
      patch((w) => ({
        ...w,
        onboardingComplete: true,
        profile: PERSONA_PROFILE,
        watchlist: watchlist.length ? watchlist : DEFAULT_WATCHLIST,
        connections: { ...w.connections, google: "connected" },
        milestones: { ...w.milestones, connected: w.milestones.connected ?? w.demoNow },
      }));
    },
    [patch],
  );

  const resetDemo = useCallback(() => {
    setSweepError(null);
    wsRef.current = defaultWorkspace();
    setWorkspace(wsRef.current);
  }, []);

  const simulateOvernight = useCallback(() => {
    patch((w) => ({ ...w, demoNow: DEMO_MORNING_MS }));
  }, [patch]);

  const updateRun = useCallback((runId: string, update: (run: AgentRun) => AgentRun) => {
    patch((w) => ({ ...w, runs: w.runs.map((r) => (r.id === runId ? update(r) : r)) }));
  }, [patch]);

  const raiseNudge = useCallback(
    (key: NudgeKey): AgentNudge | null => {
      if (wsRef.current.nudges.some((n) => n.key === key)) return null;
      const nudge: AgentNudge = { id: crypto.randomUUID(), key, at: wsRef.current.demoNow, receivedAt: Date.now(), status: "new", seenAt: null };
      patch((w) => ({ ...w, nudges: [...w.nudges, nudge] }));
      return nudge;
    },
    [patch],
  );

  const resolveNudge = useCallback(
    (id: string, status: "accepted" | "dismissed") => {
      patch((w) => ({ ...w, nudges: w.nudges.map((n) => (n.id === id ? { ...n, status, seenAt: n.seenAt ?? Date.now() } : n)) }));
    },
    [patch],
  );

  const markNudgesSeen = useCallback(() => {
    if (!wsRef.current.nudges.some((n) => !n.seenAt)) return;
    patch((w) => ({ ...w, nudges: w.nudges.map((n) => (n.seenAt ? n : { ...n, seenAt: Date.now() })) }));
  }, [patch]);

  const sweep = useCallback(async () => {
    const w = wsRef.current;
    if (w.connections.google !== "connected" || sweepingRef.current) return;
    sweepingRef.current = true;
    setSweeping(true);
    setSweepError(null);
    setSweepLabel("Checking Calendar, Gmail and ZoomInfo signals");
    try {
      const res = await fetch("/api/agents/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          now: w.demoNow,
          watchlist: w.watchlist,
          connections: w.connections,
          budget: w.budget,
          seenRunKeys: w.runs.map((r) => r.runKey),
          mappedAccounts: w.mappedAccounts,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Sweep failed (${res.status})`);
      }
      const incoming: { label: string | null; run: AgentRun }[] = [];
      let label: string | null = null;
      await readAgentStream(res, (event) => {
        if (event.type === "activity") label = event.label;
        if (event.type === "agent_run") incoming.push({ label, run: event.run });
        if (event.type === "error") throw new Error(event.message);
      });
      // Fixture sweeps finish in milliseconds; pacing the reveal lets each card land as its own event.
      await sleep(REVEAL_MS);
      for (const item of incoming) {
        if (item.label) setSweepLabel(item.label);
        const steps = item.run.tasks?.length ?? 0;
        if (steps) {
          for (let step = 0; step < steps; step++) {
            setSweepLive({ run: item.run, step });
            await sleep(TASK_MS);
          }
        } else {
          await sleep(REVEAL_MS);
        }
        const run = { ...item.run, receivedAt: Date.now() };
        patch((prev) => ({ ...prev, runs: mergeRuns(prev.runs, [run]) }));
        setSweepLive(null);
      }
      patch((prev) => ({
        ...prev,
        lastSweepAt: prev.demoNow,
        milestones: incoming.length ? { ...prev.milestones, firstSweep: prev.milestones.firstSweep ?? prev.demoNow } : prev.milestones,
      }));
    } catch (e) {
      setSweepError(e instanceof Error ? e.message : "Sweep failed");
    } finally {
      sweepingRef.current = false;
      setSweeping(false);
      setSweepLabel(null);
      setSweepLive(null);
    }
  }, [patch]);

  const unseenCount =
    workspace.runs.filter((r) => r.status !== "dismissed" && r.status !== "snoozed" && !r.seenAt).length + workspace.nudges.filter((n) => !n.seenAt).length;

  return {
    ready,
    workspace,
    sweeping,
    sweepLabel,
    sweepLive,
    sweepError,
    unseenCount,
    patch,
    markMilestone,
    completeOnboarding,
    resetDemo,
    simulateOvernight,
    updateRun,
    raiseNudge,
    resolveNudge,
    markNudgesSeen,
    sweep,
  };
}
