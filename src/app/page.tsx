"use client";

import { Badge, Button, Drawer, Fab, IconButton, Snackbar, Tooltip, Zoom } from "@mui/material";
import { ArrowDownIcon, Bars3Icon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { BoltIcon, ChevronRightIcon } from "@heroicons/react/16/solid";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStickToBottom } from "@/components/chat/stream/useStickToBottom";
import { AssistantTurn, UserBubble } from "@/components/chat/AssistantTurn";
import { Composer } from "@/components/chat/Composer";
import { ChatActionsContext } from "@/components/chat/context";
import { BrandMark, Sidebar } from "@/components/chat/Sidebar";
import { useChat, type Turn } from "@/components/chat/useChat";
import type { ApprovalDecision } from "@/lib/spec";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AgentAvatar } from "@/components/agent/AgentAvatar";
import { GoToAgentView } from "@/components/agent/GoToAgentView";
import { Onboarding } from "@/components/agent/Onboarding";
import { DemoControls, DemoControlsTrigger } from "@/components/agent/DemoControls";
import { ShareSheet } from "@/components/agent/ShareSheet";
import { useWorkspace } from "@/components/agent/useWorkspace";
import { WatchSuggestion } from "@/components/agent/WatchSuggestion";
import { WorkPanel } from "@/components/agent/WorkPanel";
import { agentDisplayName } from "@/lib/agents/catalog";
import { CALENDAR_EVENTS, DEFAULT_WATCHLIST, type PersonaDeal } from "@/lib/agents/fixtures";
import { nextIdleNudge, nudgeContent } from "@/lib/agents/nudges";
import { completeTasks } from "@/lib/agents/tasks";
import { formatTime } from "@/lib/agents/time";
import { HUB_CONVERSATION_ID } from "@/lib/agents/types";
import type { AgentNudge, AgentRun, NudgeKey, WorkspaceMilestone } from "@/lib/agents/types";
import { approvalCredits, needsYouCount, threadStarters } from "@/lib/agents/work";

const FOCUS_MS = 1700;
/** Quiet time after a check-in before the agent raises what it noticed on its own. */
const NUDGE_IDLE_MS = 4000;
const LAYOUT_KEY = "gtm-layout-v1";

type Layout = { left: boolean; right: boolean };

function attendeeEmail(name: string | undefined): string | undefined {
  return name ? CALENDAR_EVENTS.flatMap((e) => e.attendees).find((a) => a.name === name)?.email : undefined;
}

function AgentStatus({ working, lastSweepAt }: { working: boolean; lastSweepAt?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-meta font-normal text-gtm-muted" aria-live="polite">
      <span className={`size-2 shrink-0 rounded-full ${working ? "gtm-pulse bg-gtm-warning text-gtm-warning" : "bg-gtm-success"}`} aria-hidden />
      <span className="truncate max-sm:hidden">{working ? "Working…" : lastSweepAt ? `Active · checked ${formatTime(lastSweepAt)}` : "Active"}</span>
    </span>
  );
}

export default function Home() {
  const chat = useChat();
  const ws = useWorkspace();
  /** Mobile overlay only; on desktop the sidebar is always there, expanded or as a rail. */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Layout>({ left: false, right: false });
  const [panelDrawer, setPanelDrawer] = useState(false);
  const [focus, setFocus] = useState<{ runId: string; nonce: number } | null>(null);
  const [shareRun, setShareRun] = useState<AgentRun | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [watchDismissed, setWatchDismissed] = useState<string | null>(null);
  const [nudgeToast, setNudgeToast] = useState<string | null>(null);
  const [shareNudgeId, setShareNudgeId] = useState<string | null>(null);
  const { scrollRef, contentRef, atBottom, unread, stick } = useStickToBottom();
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sweptRef = useRef(false);
  const hubBootRef = useRef(false);

  const { openHub } = chat;
  const { updateRun, raiseNudge, markNudgesSeen } = ws;
  const isHub = chat.activeId === HUB_CONVERSATION_ID;
  const isHubRef = useRef(isHub);
  const workspaceRef = useRef(ws.workspace);
  useEffect(() => {
    isHubRef.current = isHub;
    workspaceRef.current = ws.workspace;
  }, [isHub, ws.workspace]);

  /** Raises a heads-up; away from the hub it also surfaces as a toast, so the agent reaches the AE wherever she is. */
  const raise = useCallback(
    (key: NudgeKey) => {
      const nudge = raiseNudge(key);
      if (nudge && !isHubRef.current) setNudgeToast(nudgeContent(nudge, workspaceRef.current).headline);
      return nudge;
    },
    [raiseNudge],
  );

  const idleNudge = ws.ready && ws.workspace.onboardingComplete && !ws.sweeping && !chat.busy ? nextIdleNudge(ws.workspace) : null;
  useEffect(() => {
    if (!idleNudge) return;
    const id = setTimeout(() => raise(idleNudge), NUDGE_IDLE_MS);
    return () => clearTimeout(id);
  }, [idleNudge, raise]);

  useEffect(() => {
    if (isHub) markNudgesSeen();
  }, [isHub, ws.workspace.nudges, markNudgesSeen]);

  const layoutLoaded = useRef(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "null") as Partial<Layout> | null;
        if (saved) setCollapsed({ left: Boolean(saved.left), right: Boolean(saved.right) });
      } catch {
        // ignore
      }
      layoutLoaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (!layoutLoaded.current) return;
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(collapsed));
    } catch {
      // quota
    }
  }, [collapsed]);

  const toggleLeft = useCallback(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setCollapsed((c) => ({ ...c, left: !c.left }));
    else setSidebarOpen((o) => !o);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleLeft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleLeft]);
  const turns = chat.active?.turns ?? [];
  const lastTurn = turns.at(-1);
  useEffect(() => {
    stick();
  }, [chat.activeId, turns.length, stick]);

  useEffect(() => {
    if (!ws.ready || !chat.ready || !ws.workspace.onboardingComplete || hubBootRef.current) return;
    if (!chat.activeId) {
      openHub();
      hubBootRef.current = true;
    }
  }, [ws.ready, chat.ready, ws.workspace.onboardingComplete, chat.activeId, openHub]);

  useEffect(() => {
    if (!ws.ready || !ws.workspace.onboardingComplete || sweptRef.current) return;
    if (ws.workspace.connections.google !== "connected") return;
    sweptRef.current = true;
    void ws.sweep();
  }, [ws.ready, ws.workspace.onboardingComplete, ws.workspace.connections.google, ws]);

  // An approval finished in a thread completes the hub card it came from.
  useEffect(() => {
    for (const c of chat.conversations) {
      if (!c.origin) continue;
      const run = ws.workspace.runs.find((r) => r.id === c.origin!.runId);
      if (run?.status !== "needs_approval") continue;
      const seeded = c.turns.find((t) => t.agentMeta?.runId === run.id);
      if (seeded?.status === "ready" && seeded.message) {
        const message = seeded.message;
        updateRun(run.id, (r) => ({ ...r, ...completeTasks(r, message.data), status: "ready", message, approval: null, seenAt: r.seenAt ?? Date.now() }));
      }
    }
  }, [chat.conversations, ws.workspace.runs, updateRun]);

  useEffect(() => () => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
  }, []);

  const closeOnMobile = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const hubConversation = chat.conversations.find((c) => c.id === HUB_CONVERSATION_ID) ?? null;
  const waitingCount = needsYouCount(ws.workspace);
  const panelInline = isHub && !collapsed.right;
  const hubResearching = hubConversation?.turns.findLast((t) => t.status === "streaming" && !t.local)?.prompt ?? null;

  const togglePanel = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((c) => ({ ...c, right: !c.right }));
    else setPanelDrawer(true);
  };

  const hubReply = useCallback((markdown: string, prompt?: string) => chat.appendLocalTurn(HUB_CONVERSATION_ID, { prompt, markdown }), [chat]);

  const focusRun = (runId: string) => {
    setPanelDrawer(false);
    setFocus({ runId, nonce: Date.now() });
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocus(null), FOCUS_MS);
  };

  const openRun = (run: AgentRun) => {
    if (run.threadId && chat.conversations.some((c) => c.id === run.threadId)) {
      chat.setActiveId(run.threadId);
      return;
    }
    const threadId = chat.seedFromRun(run);
    if (threadId) ws.updateRun(run.id, (r) => ({ ...r, threadId }));
  };

  const inviteAdmin = () => {
    if (ws.workspace.milestones.invited) return;
    ws.markMilestone("invited");
    hubReply("I sent your Salesforce admin an invite. Once they connect, Deal Watch will use pipeline stage and close dates, not just signals.");
  };

  /** Each Setup item takes the AE straight to the action that completes it. */
  const setupAction = (key: WorkspaceMilestone) => {
    const runs = ws.workspace.runs;
    const brief = runs.find((r) => r.agentId === "meeting_prep" && r.message);
    if (key === "invited") inviteAdmin();
    else if (key === "firstSweep" || key === "connected") void ws.sweep();
    else if (key === "shared" && brief) setShareRun(brief);
    else if (key === "activated") {
      const target = runs.find((r) => r.status === "ready" && r.primaryAction.kind === "send_reply") ?? runs.find((r) => r.status === "ready");
      if (target) focusRun(target.id);
    }
  };

  /** Approving paid research spends the estimated data credits. */
  const decide = (conversationId: string, turn: Turn, decision: ApprovalDecision["decision"]) => {
    if (decision === "approved") ws.spendCredits(approvalCredits(turn.approval?.request));
    chat.decide(conversationId, turn, decision);
  };

  const restartDemo = () => {
    ws.resetDemo();
    chat.resetAll();
    setNudgeToast(null);
    sweptRef.current = false;
    hubBootRef.current = false;
  };

  const handleOnboardingComplete = useCallback(
    (input: { watchlist: string[]; budget: { dataCreditsPerDay: number; allowDataAutopilot: boolean }; deals: PersonaDeal[] }) => {
      ws.completeOnboarding(input.watchlist);
      ws.patch((w) => ({ ...w, budget: input.budget, deals: input.deals }));
      chat.openHub();
      sweptRef.current = false;
    },
    [ws, chat],
  );

  const handlePrimary = useCallback(
    (run: AgentRun) => {
      ws.markMilestone("activated");
      const sentAt = run.primaryAction.kind === "send_reply" ? ws.workspace.demoNow : undefined;
      ws.updateRun(run.id, (r) => ({ ...r, status: "done", seenAt: r.seenAt ?? Date.now(), sentAt }));
      if (run.agentId === "meeting_prep" && run.trigger.meta?.shareWith && !ws.workspace.milestones.shared) setShareRun(run);
    },
    [ws],
  );

  const handleNudge = (nudge: AgentNudge, choice: "accepted" | "dismissed") => {
    const runId = nudgeContent(nudge, ws.workspace).runId;
    const run = ws.workspace.runs.find((r) => r.id === runId);
    if (choice === "accepted" && nudge.key === "loop_in_se" && run) {
      setShareNudgeId(nudge.id);
      setShareRun(run);
      return;
    }
    ws.resolveNudge(nudge.id, choice);
    if (choice === "accepted" && nudge.key === "morning_lead" && run) focusRun(run.id);
  };

  const lastEntity = lastTurn?.trace?.harness?.entity?.company ?? lastTurn?.message?.entityLabel ?? null;
  const showWatch =
    !isHub &&
    lastEntity &&
    lastTurn?.status === "ready" &&
    !ws.workspace.watchlist.some((k) => lastEntity.toLowerCase().includes(k)) &&
    watchDismissed !== lastEntity;

  if (!ws.ready || !chat.ready) {
    return <main className="flex h-dvh items-center justify-center bg-gtm-bg text-gtm-muted">Loading…</main>;
  }

  if (!ws.workspace.onboardingComplete) {
    return (
      <main className="flex h-dvh overflow-hidden bg-gtm-bg">
        <Onboarding onComplete={handleOnboardingComplete} />
      </main>
    );
  }

  const panel = (onClose: () => void, inline?: { collapsed: boolean }) => (
    <WorkPanel
      inline={inline}
      workspace={ws.workspace}
      sweeping={ws.sweeping}
      sweepLabel={ws.sweepLabel}
      researching={hubResearching}
      onFocusRun={focusRun}
      onFocusNudge={(id) => {
        setPanelDrawer(false);
        document.getElementById(`nudge-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      onSetupAction={setupAction}
      onClose={onClose}
    />
  );

  return (
    <ChatActionsContext.Provider value={{ send: chat.send, busy: chat.busy }}>
      <main className="flex h-dvh overflow-hidden bg-gtm-bg pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        {sidebarOpen && (
          <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <div
          className={`z-30 h-full max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:pl-[env(safe-area-inset-left)] max-md:shadow-xl ${sidebarOpen ? "" : "max-md:hidden"}`}
        >
          <Sidebar
            conversations={chat.conversations}
            activeId={chat.activeId}
            workspace={ws.workspace}
            hubUnseen={waitingCount}
            onOpenHub={() => {
              chat.openHub();
              closeOnMobile();
            }}
            onOpen={(id) => {
              chat.setActiveId(id);
              closeOnMobile();
            }}
            onNewSubChat={() => {
              chat.createSubChat();
              closeOnMobile();
            }}
            onRemove={chat.remove}
            onInviteAdmin={inviteAdmin}
            onRestartDemo={restartDemo}
            onClose={toggleLeft}
            collapsed={collapsed.left && !sidebarOpen}
            onExpand={() => setCollapsed((c) => ({ ...c, left: false }))}
          />
        </div>

        <section className="relative flex min-w-0 flex-1 flex-col">
          <header className="box-content flex h-14 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] sm:px-3">
            <div className={`flex shrink-0 items-center gap-2 ${collapsed.left ? "" : "md:hidden"}`}>
              <Tooltip title="Open sidebar">
                <IconButton size="small" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)} className="text-gtm-secondary md:hidden">
                  <Bars3Icon className="size-5" />
                </IconButton>
              </Tooltip>
              <span className={chat.active && !isHub ? "max-sm:hidden" : ""}>
                <BrandMark variant={isHub ? "gtm-one" : "gtm-ai"} />
              </span>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1 truncate px-2 text-sm font-medium">
              {isHub ? (
                <span className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 text-gtm-text">Go-to-agent</span>
                  <AgentStatus working={ws.sweeping || Boolean(hubResearching)} lastSweepAt={ws.workspace.lastSweepAt} />
                </span>
              ) : (
                <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
                  <button type="button" className="shrink-0 rounded-gtm px-1 py-0.5 text-gtm-muted transition-colors hover:text-gtm-text" onClick={() => chat.openHub()}>
                    Go-to-agent
                  </button>
                  <ChevronRightIcon className="size-3.5 shrink-0 text-gtm-muted" aria-hidden />
                  <span className="truncate px-1 text-gtm-text">{chat.active?.title ?? "Thread"}</span>
                </nav>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {isHub && (
                <Tooltip title={panelInline ? "Collapse agent work" : "Expand agent work"}>
                  <IconButton size="small" aria-label="Agent work" aria-pressed={panelInline} onClick={togglePanel}>
                    <Badge badgeContent={waitingCount} color="error" invisible={waitingCount === 0} sx={{ "& .MuiBadge-badge": { fontSize: 10, height: 16, minWidth: 16 } }}>
                      <ClipboardDocumentListIcon className="size-5" />
                    </Badge>
                  </IconButton>
                </Tooltip>
              )}
              <ThemeToggle />
            </div>
          </header>

          {isHub ? (
            <GoToAgentView
              workspace={ws.workspace}
              hubConversation={hubConversation}
              sweeping={ws.sweeping}
              sweepLive={ws.sweepLive}
              sweepError={ws.sweepError}
              busy={chat.busy}
              focus={focus}
              onRetrySweep={() => void ws.sweep()}
              onSendHarness={chat.send}
              onLocalReply={(prompt, markdown) => hubReply(markdown, prompt)}
              onWatchlist={(keys) => ws.patch((w) => ({ ...w, watchlist: keys }))}
              onOpenRun={openRun}
              onUpdateRun={ws.updateRun}
              onHubAnswer={(turn, q, o) => chat.answerQuestion(HUB_CONVERSATION_ID, turn, q, o)}
              onHubDecide={(turn, d) => decide(HUB_CONVERSATION_ID, turn, d)}
              onNudge={handleNudge}
              onSkipToMorning={() => {
                ws.simulateOvernight();
                void ws.sweep();
              }}
              onPrimary={handlePrimary}
              onShare={setShareRun}
            />
          ) : turns.length === 0 ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                <div className="m-auto flex w-full max-w-3xl flex-col items-center px-4 py-6 sm:py-10">
                  <p className="mb-1 text-meta font-medium text-gtm-muted">Thread under Go-to-agent</p>
                  <h1 className="mb-3 text-center text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Work one deal</h1>
                  <p className="mb-8 max-w-lg text-center text-body text-pretty text-gtm-secondary">
                    Prep a meeting, map the buyers or draft the next email. Your agent keeps watching your deals in{" "}
                    <button type="button" className="font-medium text-gtm-text underline decoration-gtm-border underline-offset-2 hover:decoration-current" onClick={() => chat.openHub()}>
                      Go-to-agent
                    </button>
                    .
                  </p>
                  <div className="hidden w-full sm:block">
                    <Composer busy={chat.busy} onSend={chat.send} autoFocus />
                  </div>
                  <ul className="mt-4 flex w-full flex-wrap justify-center gap-2" aria-label="Starters">
                    {threadStarters(ws.workspace).map((s) => (
                      <li key={s.label}>
                        <button
                          type="button"
                          disabled={chat.busy}
                          onClick={() => chat.send(s.prompt)}
                          className="h-8 rounded-full border border-gtm-border bg-gtm-bg px-3 text-meta font-medium text-gtm-secondary transition-colors hover:bg-gtm-subtle hover:text-gtm-text disabled:opacity-50 pointer-coarse:h-9"
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
                <Composer busy={chat.busy} onSend={chat.send} />
              </div>
            </>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-4 pb-12 sm:gap-10 sm:px-6 sm:pt-6">
                  {turns.map((turn) => (
                    <div key={turn.id} className="flex flex-col gap-6">
                      {turn.origin === "agent" && turn.agentMeta ? (
                        <button
                          type="button"
                          onClick={() => chat.openHub()}
                          className="flex w-fit items-center gap-2 rounded-full border border-gtm-border py-1 pr-3 pl-1 text-meta text-gtm-secondary transition-colors hover:bg-gtm-subtle"
                        >
                          <AgentAvatar agent={turn.agentMeta.agentId} size={24} />
                          <span>
                            <span className="font-medium text-gtm-text">{agentDisplayName(turn.agentMeta.agentId)}</span> · from Go-to-agent
                          </span>
                        </button>
                      ) : turn.prompt ? (
                        <UserBubble text={turn.prompt} />
                      ) : null}
                      <AssistantTurn
                        turn={turn}
                        busy={chat.busy}
                        onAnswer={(q, o) => chat.active && chat.answerQuestion(chat.active.id, turn, q, o)}
                        onDecide={(d) => chat.active && decide(chat.active.id, turn, d)}
                        onRetry={() => chat.send(turn.prompt || "Try again")}
                      />
                    </div>
                  ))}
                  {showWatch && (
                    <WatchSuggestion
                      company={lastEntity!}
                      onWatch={() => {
                        const key = lastEntity!.toLowerCase().includes("snow")
                          ? "snowflake"
                          : lastEntity!.toLowerCase().includes("stripe")
                            ? "stripe"
                            : "datadog";
                        ws.patch((w) => ({ ...w, watchlist: [...new Set([...w.watchlist, key])] }));
                        hubReply(`Now watching **${lastEntity}**. I'll post here when there's an overnight signal or an email waiting on you.`);
                        chat.markAgentTouched(chat.active!.id);
                      }}
                      onDismiss={() => setWatchDismissed(lastEntity!)}
                    />
                  )}
                </div>
              </div>
              <Zoom in={!atBottom}>
                <Fab
                  size="small"
                  aria-label="Scroll to bottom"
                  onClick={() => stick("smooth")}
                  className={`absolute bottom-30 left-1/2 z-10 size-8 min-h-0 -translate-x-1/2 border border-gtm-border bg-gtm-bg text-gtm-text shadow-sm hover:bg-gtm-subtle ${unread ? "gtm-pulse" : ""}`}
                >
                  <ArrowDownIcon className="size-4" />
                </Fab>
              </Zoom>
              <div className="gtm-composer-fade mx-auto w-full max-w-3xl shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                <Composer busy={chat.busy} onSend={chat.send} />
                <p className="mt-2 text-center text-xs text-gtm-muted max-sm:hidden">Every answer cites GTM CLI evidence. Paid research always asks first.</p>
              </div>
            </>
          )}
        </section>

        {isHub && (
          <div className="h-full max-lg:hidden">
            {panel(togglePanel, { collapsed: collapsed.right })}
          </div>
        )}
      </main>

      <Drawer anchor="right" open={isHub && panelDrawer} onClose={() => setPanelDrawer(false)} className="lg:hidden">
        {panel(() => setPanelDrawer(false))}
      </Drawer>

      <ShareSheet
        open={Boolean(shareRun)}
        run={shareRun}
        suggestedName={shareRun?.trigger.meta?.shareWith?.name}
        suggestedRole={shareRun?.trigger.meta?.shareWith?.role}
        suggestedEmail={attendeeEmail(shareRun?.trigger.meta?.shareWith?.name)}
        onClose={() => {
          setShareRun(null);
          setShareNudgeId(null);
        }}
        onShared={(channel) => {
          ws.markMilestone("shared");
          const pending = shareNudgeId ?? ws.workspace.nudges.find((n) => n.key === "loop_in_se" && n.status === "new")?.id;
          if (pending) ws.resolveNudge(pending, "accepted");
          const who = shareRun?.trigger.meta?.shareWith?.name ?? "your teammate";
          const how = channel === "email" ? "by email" : channel === "slack" ? "in Slack" : "as a read-only link";
          hubReply(`Sent the **${shareRun?.entity.company ?? ""} brief** to ${who} ${how}. They can read it without signing in, and start their own Go-to-agent from it.`);
        }}
      />

      <Snackbar
        open={Boolean(nudgeToast)}
        autoHideDuration={8000}
        onClose={(_, reason) => reason !== "clickaway" && setNudgeToast(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        message={
          <span className="flex items-center gap-2">
            <BoltIcon className="size-4 shrink-0 text-gtm-emphasis" aria-hidden />
            <span>
              <span className="font-semibold">Heads-up from Go-to-agent.</span> {nudgeToast}
            </span>
          </span>
        }
        action={
          <Button
            size="small"
            color="inherit"
            className="font-semibold"
            onClick={() => {
              setNudgeToast(null);
              chat.openHub();
            }}
          >
            View
          </Button>
        }
      />

      <DemoControlsTrigger onOpen={() => setDemoOpen(true)} />
      <DemoControls
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        onSimulateOvernight={() => {
          ws.simulateOvernight();
          chat.openHub();
          void ws.sweep();
        }}
        onReset={() => {
          ws.resetDemo();
          chat.resetAll();
          ws.completeOnboarding(DEFAULT_WATCHLIST);
          sweptRef.current = false;
        }}
        onReplay={restartDemo}
        onHeadsUp={() => {
          const key = nextIdleNudge(ws.workspace);
          if (key) raise(key);
        }}
      />
    </ChatActionsContext.Provider>
  );
}
