"use client";

import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Tooltip } from "@mui/material";
import { useState } from "react";
import { ArrowPathIcon, ClockIcon, LockClosedIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/16/solid";
import { HUB_CONVERSATION_ID } from "@/lib/agents/types";
import { isSubChat, type Conversation } from "./useChat";
import { AgentAvatar } from "@/components/agent/AgentAvatar";
import { CreditMeter } from "@/components/agent/CreditMeter";
import { initials } from "./widgets/WidgetCard";
import type { Workspace } from "@/lib/agents/types";

export function BrandMark({ variant = "gtm-ai" }: { variant?: "gtm-ai" | "gtm-one" }) {
  if (variant === "gtm-one") {
    return <span className="text-body font-semibold tracking-tight text-gtm-text">GTM One</span>;
  }
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <span className="flex size-6 items-center justify-center rounded-md bg-gtm-cta font-gtm-mono text-caption font-medium text-white">G</span>
      <span className="text-body font-semibold tracking-tight">GTM AI</span>
    </span>
  );
}

/** Heroicons has no sidebar glyph; this one is drawn on its 24/outline grid (1.5 stroke) so it sits with the set. */
export function SidebarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden data-slot="icon">
      <rect x="3.75" y="4.5" width="16.5" height="15" rx="2.25" />
      <path d="M9.75 4.5v15" />
    </svg>
  );
}

const ROW = "flex h-9 w-full items-center gap-2.5 rounded-gtm px-2.5 text-left text-sm transition-colors pointer-coarse:h-10";
const rowState = (current: boolean) => (current ? "bg-gtm-selected" : "hover:bg-gtm-hover");

export function Sidebar({
  conversations,
  activeId,
  workspace,
  hubUnseen,
  onOpenHub,
  onOpen,
  onNewSubChat,
  onRemove,
  onInviteAdmin,
  onRestartDemo,
  onClose,
  collapsed = false,
  onExpand,
}: {
  conversations: Conversation[];
  activeId: string | null;
  workspace: Workspace | null;
  hubUnseen: number;
  onOpenHub: () => void;
  onOpen: (id: string) => void;
  onNewSubChat: () => void;
  onRemove: (id: string) => void;
  onInviteAdmin?: () => void;
  onRestartDemo?: () => void;
  /** Collapses to the rail on desktop; closes the overlay on mobile. */
  onClose?: () => void;
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const subChats = [...conversations].filter(isSubChat).sort((a, b) => b.updatedAt - a.updatedAt);
  const hubActive = activeId === HUB_CONVERSATION_ID;
  const profile = workspace?.profile;

  return (
    <aside
      className={`h-full max-w-[85vw] shrink-0 overflow-hidden border-r border-gtm-border/60 bg-gtm-bg-secondary transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${collapsed ? "w-[60px]" : "w-[264px]"}`}
    >
      {collapsed ? (
        <SidebarRail
          subChats={subChats}
          activeId={activeId}
          hubActive={hubActive}
          hubUnseen={hubUnseen}
          workspace={workspace}
          onExpand={onExpand}
          onOpenHub={onOpenHub}
          onOpen={onOpen}
          onNewSubChat={onNewSubChat}
          onRestart={onRestartDemo ? () => setConfirmRestart(true) : undefined}
        />
      ) : (
        <div className="flex h-full w-[264px] max-w-[85vw] flex-col">
          <div className="box-content flex h-14 items-center justify-between pr-2 pl-4 pt-[env(safe-area-inset-top)]">
            <BrandMark variant="gtm-one" />
            {onClose && (
              <Tooltip title={<span>Collapse sidebar <kbd className="ml-1 opacity-70">⌘B</kbd></span>}>
                <IconButton size="small" aria-label="Collapse sidebar" onClick={onClose} className="text-gtm-secondary">
                  <SidebarIcon className="size-5" />
                </IconButton>
              </Tooltip>
            )}
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3" aria-label="Go-to-agent and threads">
            <button type="button" onClick={onNewSubChat} className={`${ROW} ${rowState(false)}`}>
              <PencilSquareIcon className="size-5 shrink-0 text-gtm-secondary" />
              <span>New thread</span>
            </button>

            <div className="mt-3">
              <button type="button" onClick={onOpenHub} aria-current={hubActive ? "page" : undefined} className={`${ROW} ${rowState(hubActive)}`}>
                <AgentAvatar size={24} />
                <span className="min-w-0 flex-1 truncate font-medium">Go-to-agent</span>
                {hubUnseen > 0 && (
                  <span
                    className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gtm-cta px-1.5 text-caption font-semibold text-white tabular-nums"
                    aria-label={`${hubUnseen} need you`}
                  >
                    {hubUnseen}
                  </span>
                )}
              </button>

              {subChats.length > 0 && (
                // The rail starts under the agent mark's center (row padding 10px + half the 24px mark).
                <div className="mt-0.5 ml-[22px] border-l border-gtm-border pl-1.5">
                  <ul className="flex flex-col gap-px" aria-label="Threads">
                    {subChats.map((c) => {
                      const selected = c.id === activeId;
                      return (
                        <li key={c.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => onOpen(c.id)}
                            aria-current={selected ? "page" : undefined}
                            className={`${ROW} gap-2 pr-8 ${selected ? "pointer-coarse:pr-11" : "pointer-coarse:pr-2.5"} ${rowState(selected)}`}
                          >
                            <span className="min-w-0 flex-1 truncate">{c.title}</span>
                            {c.agentTouched && <span className="size-1.5 shrink-0 rounded-full bg-gtm-emphasis" aria-label="Updated by your agent" />}
                          </button>
                          <IconButton
                            size="small"
                            aria-label={`Delete ${c.title}`}
                            onClick={() => onRemove(c.id)}
                            className={`absolute top-1/2 right-1 -translate-y-1/2 p-1 text-gtm-muted pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 ${selected ? "" : "pointer-coarse:hidden"}`}
                          >
                            <XMarkIcon className="size-3.5" />
                          </IconButton>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </nav>

          <div className="flex flex-col gap-3 border-t border-gtm-border/60 px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {workspace && (
              <div className="px-2.5">
                <CreditMeter workspace={workspace} compact />
                {workspace.connections.salesforce === "locked" && workspace.milestones.invited && (
                  <p className="gtm-enter mt-2 flex items-center gap-1.5 text-xs text-gtm-secondary">
                    <ClockIcon className="size-3.5 text-gtm-warning" />
                    Salesforce · Invite sent, waiting on admin
                  </p>
                )}
                {workspace.connections.salesforce === "locked" && !workspace.milestones.invited && (
                  <button
                    type="button"
                    onClick={onInviteAdmin}
                    className="mt-2 flex items-center gap-1.5 text-xs text-gtm-secondary transition-colors hover:text-gtm-text"
                  >
                    <LockClosedIcon className="size-3.5" />
                    Salesforce locked ·<span className="font-medium text-gtm-text underline decoration-gtm-border underline-offset-2">Invite admin</span>
                  </button>
                )}
                {onRestartDemo && (
                  <button
                    type="button"
                    onClick={() => setConfirmRestart(true)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-gtm-secondary transition-colors hover:text-gtm-text"
                  >
                    <ArrowPathIcon className="size-3.5" />
                    Restart demo
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2.5 rounded-gtm px-2.5 py-1.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gtm-text text-caption font-semibold text-gtm-bg" aria-hidden>
                {initials(profile?.name ?? "You")}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium">{profile?.name ?? "You"}</span>
                <span className="block truncate text-xs text-gtm-muted">{profile ? `${profile.roleShort} · ${profile.company}` : "Demo workspace"}</span>
              </span>
            </div>
          </div>
        </div>
      )}
      <Dialog open={confirmRestart} onClose={() => setConfirmRestart(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Restart the demo?</DialogTitle>
        <DialogContent>
          <DialogContentText>This clears every thread and the hub, then starts again at onboarding.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmRestart(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmRestart(false);
              onRestartDemo?.();
            }}
          >
            Restart
          </Button>
        </DialogActions>
      </Dialog>
    </aside>
  );
}

function RailButton({ label, current, onClick, children }: { label: string; current?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Tooltip title={label} placement="right">
      <button
        type="button"
        aria-label={label}
        aria-current={current ? "page" : undefined}
        onClick={onClick}
        className={`relative flex size-10 items-center justify-center rounded-gtm text-gtm-secondary transition-colors ${rowState(Boolean(current))}`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** The collapsed sidebar: the same destinations as icons, so nothing is more than one click away. */
function SidebarRail({
  subChats,
  activeId,
  hubActive,
  hubUnseen,
  workspace,
  onExpand,
  onOpenHub,
  onOpen,
  onNewSubChat,
  onRestart,
}: {
  subChats: Conversation[];
  activeId: string | null;
  hubActive: boolean;
  hubUnseen: number;
  workspace: Workspace | null;
  onExpand?: () => void;
  onOpenHub: () => void;
  onOpen: (id: string) => void;
  onNewSubChat: () => void;
  onRestart?: () => void;
}) {
  const credits = workspace?.credits.data ?? 0;
  return (
    <div className="gtm-enter flex h-full w-[60px] flex-col items-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="box-content flex h-14 items-center pt-[env(safe-area-inset-top)]">
        <Tooltip title={<span>Expand sidebar <kbd className="ml-1 opacity-70">⌘B</kbd></span>} placement="right">
          <IconButton size="small" aria-label="Expand sidebar" onClick={onExpand} className="text-gtm-secondary">
            <SidebarIcon className="size-5" />
          </IconButton>
        </Tooltip>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto [scrollbar-width:none]" aria-label="Go-to-agent and threads">
        <RailButton label="New thread" onClick={onNewSubChat}>
          <PencilSquareIcon className="size-5" />
        </RailButton>
        <RailButton label={hubUnseen ? `Go-to-agent · ${hubUnseen} need you` : "Go-to-agent"} current={hubActive} onClick={onOpenHub}>
          <AgentAvatar size={24} />
          {hubUnseen > 0 && (
            <span className="gtm-pop absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gtm-cta px-1 text-[10px] font-semibold text-white tabular-nums ring-2 ring-gtm-bg-secondary">
              {hubUnseen}
            </span>
          )}
        </RailButton>
        {subChats.length > 0 && <span className="my-1 h-px w-6 bg-gtm-border" aria-hidden />}
        {subChats.slice(0, 8).map((c) => (
          <RailButton key={c.id} label={c.title} current={c.id === activeId} onClick={() => onOpen(c.id)}>
            <span className="flex size-6 items-center justify-center rounded-md border border-gtm-border bg-gtm-bg text-caption font-semibold text-gtm-text">
              {c.title.trim().charAt(0).toUpperCase() || "T"}
            </span>
            {c.agentTouched && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-gtm-emphasis" aria-hidden />}
          </RailButton>
        ))}
      </nav>
      <div className="flex flex-col items-center gap-1 border-t border-gtm-border/60 pt-3">
        {workspace && (
          <Tooltip title={`Data credits · ${credits.toLocaleString("en-US")} / 1,000`} placement="right">
            <span className="relative flex size-10 items-center justify-center" role="meter" aria-label="Data credits left" aria-valuenow={Math.round(credits / 10)} aria-valuemin={0} aria-valuemax={100}>
              <CircularProgress variant="determinate" value={100} size={22} thickness={5} className="absolute text-gtm-selected" />
              <CircularProgress variant="determinate" value={credits / 10} size={22} thickness={5} className="text-gtm-text" />
            </span>
          </Tooltip>
        )}
        {onRestart && (
          <RailButton label="Restart demo" onClick={onRestart}>
            <ArrowPathIcon className="size-5" />
          </RailButton>
        )}
        <Tooltip title={workspace?.profile ? `${workspace.profile.name} · ${workspace.profile.roleShort}` : "You"} placement="right">
          <span className="mt-1 flex size-8 items-center justify-center rounded-full bg-gtm-text text-caption font-semibold text-gtm-bg">
            {initials(workspace?.profile?.name ?? "You")}
          </span>
        </Tooltip>
      </div>
    </div>
  );
}
