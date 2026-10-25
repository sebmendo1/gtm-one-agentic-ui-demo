"use client";

import { useEffect, useState } from "react";
import { repairMarkdown } from "@/lib/stream/repair";
import { Markdown } from "../Markdown";
import { isFreshReply, markPlayed } from "./fresh";
import type { CaretState } from "./rehypeStream";
import type { StreamPhase } from "./useSmoothStream";
import { useSimulatedStream } from "./useSimulatedStream";
import { useSmoothStream } from "./useSmoothStream";

export function caretFor(phase: StreamPhase): CaretState | null {
  if (phase === "settled") return null;
  return phase === "streaming" ? "solid" : "blink";
}

/** The caret on its own line, for a reply that has started but has no words yet. */
export function StandaloneCaret() {
  return (
    <div className="gtm-prose" aria-hidden>
      <p>
        <i className="gtm-caret gtm-caret-blink" />
      </p>
    </div>
  );
}

/** Markdown that arrives whole (hub intents, agent log lines) but streams in when it is new. */
export function StreamedMarkdown({ id, createdAt, markdown }: { id: string; createdAt?: number; markdown: string }) {
  const [fresh] = useState(() => isFreshReply(id, createdAt));
  const source = useSimulatedStream(markdown, fresh);
  const { text, phase } = useSmoothStream(source.text, { enabled: fresh, done: source.done });

  useEffect(() => {
    if (fresh && phase === "settled") markPlayed(id);
  }, [fresh, phase, id]);

  if (phase === "settled") return <Markdown markdown={text} />;
  if (!text) return <StandaloneCaret />;
  return <Markdown markdown={repairMarkdown(text)} animate caret={caretFor(phase)} />;
}
