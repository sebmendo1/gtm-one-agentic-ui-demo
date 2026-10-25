"use client";

import { ArrowTrendingUpIcon, CalendarIcon, EnvelopeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { ArrowUpRightIcon } from "@heroicons/react/24/solid";
import type { AgentId } from "@/lib/agents/types";

const ICONS = {
  meeting_prep: CalendarIcon,
  deal_watch: ArrowTrendingUpIcon,
  follow_up_nudge: EnvelopeIcon,
  account_map: UserGroupIcon,
} as const;

export function AgentAvatar({ agent = "hub", size = 32, pulse = false }: { agent?: AgentId | "hub"; size?: 24 | 32; pulse?: boolean }) {
  const glyph = size === 24 ? "size-3.5" : "size-[18px]";
  const box = size === 24 ? "size-6 rounded-md" : "size-8 rounded-gtm";
  if (agent === "hub") {
    return (
      <span className={`flex shrink-0 items-center justify-center bg-gtm-cta text-gtm-cta ${box} ${pulse ? "gtm-pulse" : ""}`} aria-hidden>
        <ArrowUpRightIcon className={`${glyph} text-white`} />
      </span>
    );
  }
  const Icon = ICONS[agent];
  return (
    <span className={`flex shrink-0 items-center justify-center border border-gtm-border bg-gtm-surface text-gtm-secondary ${box}`} aria-hidden>
      <Icon className={glyph} />
    </span>
  );
}
