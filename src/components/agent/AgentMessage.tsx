"use client";

import type { ReactNode } from "react";
import type { AgentId } from "@/lib/agents/types";
import { AgentAvatar } from "./AgentAvatar";

export type StatusTone = "new" | "approval" | "done" | "working";

const TONES: Record<StatusTone, string> = {
  new: "bg-gtm-emphasis/10 text-gtm-emphasis",
  approval: "bg-gtm-warning/15 text-amber-700 dark:text-amber-300",
  done: "bg-gtm-success/15 text-emerald-700 dark:text-emerald-300",
  working: "bg-gtm-selected text-gtm-secondary",
};

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-caption font-medium ${TONES[tone]}`}>{children}</span>;
}

/** One agent message: a header line (avatar · name · time · status, quiet actions right) over full-width content. */
export function AgentMessage({
  agent = "hub",
  name,
  time,
  status,
  actions,
  anchorId,
  highlight,
  pulse,
  children,
}: {
  agent?: AgentId | "hub";
  name: string;
  time?: string;
  status?: ReactNode;
  actions?: ReactNode;
  anchorId?: string;
  highlight?: boolean;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <article id={anchorId} className={`gtm-enter group/msg -mx-3 scroll-mt-4 rounded-gtm-xl px-3 py-2 ${highlight ? "gtm-highlight" : ""}`}>
      <header className="flex h-8 items-center gap-2">
        <AgentAvatar agent={agent} size={24} pulse={pulse} />
        <span className="text-sm font-medium text-gtm-text">{name}</span>
        {time && <time className="text-meta text-gtm-muted tabular-nums">{time}</time>}
        {status}
        {actions && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/msg:opacity-100 pointer-fine:group-focus-within/msg:opacity-100">
            {actions}
          </span>
        )}
      </header>
      <div className="mt-2">{children}</div>
    </article>
  );
}
