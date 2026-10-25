"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { nextFrame } from "@/lib/stream/frame";

export type StreamPhase = "waiting" | "streaming" | "settled";

/** Baseline reveal speed; a backlog raises it so a burst drains within DRAIN_S. */
const BASE_CPS = 320;
const DRAIN_S = 0.35;
/** No new word for this long and the caret starts blinking. */
const IDLE_MS = 400;

/** End of the last complete word: a live source never shows a half-received word. */
function lastWordEnd(source: string): number {
  for (let i = source.length - 1; i >= 0; i--) if (/\s/.test(source[i]!)) return i;
  return 0;
}

/**
 * Reveals a growing `source` smoothly, one animation frame at a time (docs/specs/02-design-system.md
 * § Streaming). However bursty the input, React re-renders at most once per frame, and the visible
 * text always ends on a word boundary. While `holdUntil` is in the future, nothing new is revealed.
 */
export function useSmoothStream(
  source: string,
  { enabled, done, holdUntil }: { enabled: boolean; done: boolean; holdUntil?: RefObject<number> },
): { text: string; phase: StreamPhase } {
  const [view, setView] = useState<{ length: number; phase: StreamPhase }>({ length: 0, phase: "waiting" });
  const input = useRef({ source, done });
  useLayoutEffect(() => {
    input.current = { source, done };
  });

  useEffect(() => {
    if (!enabled) return;
    let cancel = () => {};
    let shown = 0;
    let pos = 0;
    let last = performance.now();
    let lastAdvance = last;
    let phase: StreamPhase = "waiting";

    const frame = (now: number) => {
      const { source, done } = input.current;
      const dt = Math.min(1000, now - last);
      last = now;
      if (shown > source.length) shown = pos = source.length;

      const limit = done ? source.length : lastWordEnd(source);
      const held = holdUntil ? now < holdUntil.current : false;
      let changed = false;
      if (!held && shown < limit) {
        const rate = Math.max(BASE_CPS, (limit - shown) / DRAIN_S);
        // Nobody is watching a hidden tab: show everything received so far.
        pos = document.hidden ? limit : Math.min(limit, Math.max(pos, shown) + (rate * dt) / 1000);
        let next = Math.floor(pos);
        while (next < limit && !/\s/.test(source[next]!)) next++;
        if (next > shown) {
          shown = next;
          lastAdvance = now;
          changed = true;
        }
      }

      // Settling waits one quiet frame, so a card revealed by the last words can start its hold first.
      const caughtUp = done && shown >= source.length && !changed && !held;
      const nextPhase: StreamPhase = caughtUp ? "settled" : now - lastAdvance < IDLE_MS && shown > 0 ? "streaming" : "waiting";
      if (changed || nextPhase !== phase) {
        phase = nextPhase;
        setView({ length: shown, phase });
      }
      if (phase !== "settled") cancel = nextFrame(frame);
    };

    cancel = nextFrame(frame);
    return () => cancel();
  }, [enabled, holdUntil]);

  if (!enabled) return { text: source, phase: "settled" };
  return { text: source.slice(0, view.length), phase: view.phase };
}
