"use client";

import { Button } from "@mui/material";
import { BoltIcon, CalendarIcon, CheckIcon, EnvelopeIcon } from "@heroicons/react/16/solid";
import { Fragment, useEffect, useState } from "react";
import type { NudgeContent } from "@/lib/agents/nudges";
import { formatTime } from "@/lib/agents/time";
import type { AgentNudge } from "@/lib/agents/types";
import { AgentMessage } from "./AgentMessage";

const NOTICE_MS = 1400;
/** A heads-up mounted within this long of arriving plays its "noticing" beat; older ones render settled. */
const FRESH_MS = 2500;

function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) => (
        <Fragment key={i}>{i % 2 ? <strong className="font-semibold">{part}</strong> : part}</Fragment>
      ))}
    </>
  );
}

export function HeadsUpPill() {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-gtm-emphasis/10 px-2 text-caption font-medium text-gtm-emphasis">
      <BoltIcon className="size-3" aria-hidden />
      Heads-up
    </span>
  );
}

/** Something the agent raised on its own: a short "noticing" beat, then what it saw, why now, and one decision. */
export function Nudge({
  nudge,
  content,
  onPrimary,
  onSecondary,
}: {
  nudge: AgentNudge;
  content: NudgeContent;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const [noticing, setNoticing] = useState(() => Date.now() - nudge.receivedAt < FRESH_MS);

  useEffect(() => {
    if (!noticing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(() => setNoticing(false), reduce ? 0 : NOTICE_MS);
    return () => clearTimeout(id);
  }, [noticing]);

  const SourceIcon = content.source === "gmail" ? EnvelopeIcon : CalendarIcon;
  const open = nudge.status === "new";

  return (
    <AgentMessage name="Go-to-agent" time={formatTime(nudge.at)} status={<HeadsUpPill />} pulse={noticing} anchorId={`nudge-${nudge.id}`}>
      {noticing ? (
        <p className="gtm-shimmer text-body" aria-live="polite">
          {content.noticing}
        </p>
      ) : (
        <div className={`gtm-enter rounded-gtm-xl border border-gtm-emphasis/25 bg-gtm-emphasis/[0.04] p-4 ${open ? "gtm-highlight" : ""}`}>
          <p className="flex items-center gap-1.5 text-meta text-gtm-muted">
            <SourceIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="font-medium text-gtm-emphasis">Noticed on my own</span>
            <span aria-hidden>·</span>
            <span className="truncate">{content.why}</span>
          </p>
          <p className="mt-2 text-body text-pretty text-gtm-text">
            <Bold text={content.body} />
          </p>
          {open ? (
            <footer className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="contained" color="primary" size="small" onClick={onPrimary}>
                {content.primary}
              </Button>
              <Button color="inherit" size="small" className="text-gtm-secondary" onClick={onSecondary}>
                {content.secondary}
              </Button>
            </footer>
          ) : (
            <p className="gtm-enter mt-3 flex items-center gap-1.5 text-meta text-gtm-secondary">
              <CheckIcon className={`gtm-pop size-4 shrink-0 ${nudge.status === "accepted" ? "text-gtm-success" : "text-gtm-muted"}`} aria-hidden />
              {nudge.status === "accepted" ? content.accepted : content.dismissed}
            </p>
          )}
        </div>
      )}
    </AgentMessage>
  );
}
