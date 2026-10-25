"use client";

import { useEffect, useState } from "react";
import { nextFrame } from "@/lib/stream/frame";
import { simulateStream } from "@/lib/stream/simulate";

/**
 * Plays finished `text` back as a simulated stream. Chunks collect in a buffer that is flushed to
 * React once per animation frame, so a fast chunk rate never costs more than one render a frame.
 */
export function useSimulatedStream(text: string, enabled: boolean): { text: string; done: boolean } {
  const [state, setState] = useState({ text: "", done: false });

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let cancelFlush: (() => void) | null = null;
    const flush = () => {
      cancelFlush = null;
      setState({ text: buffer, done: false });
    };
    const stream = simulateStream(text, {
      onChunk: (chunk) => {
        buffer += chunk;
        cancelFlush ??= nextFrame(flush);
      },
      onDone: () => {
        cancelFlush?.();
        setState({ text: buffer, done: true });
      },
    });
    return () => {
      stream.cancel();
      cancelFlush?.();
    };
  }, [text, enabled]);

  return enabled ? state : { text, done: true };
}
