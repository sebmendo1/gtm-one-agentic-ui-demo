"use client";

import { Button, IconButton, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ViewSidebarOutlinedIcon from "@mui/icons-material/ViewSidebarOutlined";
import type { Conversation } from "./useChat";

export function BrandMark() {
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <span className="flex size-6 items-center justify-center rounded-md bg-gtm-cta font-gtm-mono text-caption font-medium text-white">G</span>
      <span className="text-body font-semibold tracking-tight">GTM AI</span>
    </span>
  );
}

export function Sidebar({
  conversations,
  activeId,
  onOpen,
  onNew,
  onRemove,
  onClose,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const ordered = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <aside className="flex h-full w-[264px] max-w-[85vw] shrink-0 flex-col border-r border-gtm-border/50 bg-gtm-bg-secondary">
      <div className="box-content flex h-14 items-center justify-between px-3 pt-[env(safe-area-inset-top)]">
        <BrandMark />
        <Tooltip title="Close sidebar">
          <IconButton size="small" aria-label="Close sidebar" onClick={onClose}>
            <ViewSidebarOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
      <div className="px-2 pb-2">
        <Button fullWidth color="inherit" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={onNew} className="justify-start rounded-gtm px-3 font-medium hover:bg-gtm-subtle">
          New chat
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3" aria-label="Chats">
        {ordered.length > 0 && <p className="px-3 pt-2 pb-1 text-xs font-medium text-gtm-muted">Recents</p>}
        <ul className="flex flex-col gap-0.5">
          {ordered.map((c) => {
            const selected = c.id === activeId;
            return (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  aria-current={selected ? "page" : undefined}
                  className={`w-full truncate rounded-gtm px-3 py-2 pr-8 text-left text-sm transition-colors pointer-coarse:py-3 ${selected ? "pointer-coarse:pr-11" : "pointer-coarse:pr-3"} ${selected ? "bg-white font-medium dark:bg-gtm-subtle" : "hover:bg-white dark:hover:bg-gtm-subtle"}`}
                >
                  {c.title}
                </button>
                {/* Revealed on hover with a mouse. Touch has no hover, so it shows on the open chat only: deleting has no undo. */}
                <IconButton
                  size="small"
                  aria-label={`Delete ${c.title}`}
                  onClick={() => onRemove(c.id)}
                  className={`absolute top-1/2 right-1 -translate-y-1/2 text-gtm-muted pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 ${selected ? "" : "pointer-coarse:hidden"}`}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-gtm-border/50 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs leading-snug text-gtm-muted">
        GTM CLI included — sign in for live ZoomInfo data.{" "}
        <a href="https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research" target="_blank" rel="noreferrer" className="text-gtm-emphasis underline underline-offset-2">
          Set up GTM AI
        </a>
      </div>
    </aside>
  );
}
