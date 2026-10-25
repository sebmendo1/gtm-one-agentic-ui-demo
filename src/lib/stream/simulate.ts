/**
 * Simulated token stream (docs/specs/02-design-system.md § Streaming). Replies that arrive whole,
 * such as template replies, hub intents and agent log lines, are replayed through this so they
 * stream the way a model would. It knows nothing about rendering: it only calls `onChunk`.
 */

export interface SimulatedStream {
  cancel: () => void;
}

export interface SimulateOptions {
  /** Average characters per second before punctuation pauses. */
  cps?: number;
  onChunk: (chunk: string) => void;
  onDone?: () => void;
}

const DEFAULT_CPS = 340;
/** Blank lines, then a whole `<ui:…>` tag line. */
const TAG_AHEAD = /^((?:[ \t]*\n)*)[ \t]*<\/?ui:[^\n]*(?:\n|$)/;
const WORD = /^\s*\S+/;

/** Splits text into model-like chunks: 2–5 characters, leading whitespace kept, a GenUI tag line whole. */
export function syllableChunks(text: string, random: () => number = Math.random): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest) {
    const lineStart = chunks.length === 0 || chunks.at(-1)!.endsWith("\n");
    const tag = rest.match(TAG_AHEAD);
    if (tag && (lineStart || tag[1])) {
      chunks.push(tag[0]);
      rest = rest.slice(tag[0].length);
      continue;
    }
    const word = rest.match(WORD)?.[0] ?? rest;
    const lead = word.length - word.trimStart().length;
    let i = 0;
    while (i < word.length) {
      const size = 2 + Math.floor(random() * 4);
      const end = i === 0 ? Math.min(word.length, lead + size) : Math.min(word.length, i + size);
      chunks.push(word.slice(i, end));
      i = end;
    }
    rest = rest.slice(word.length);
  }
  return chunks;
}

/** How long to wait after a chunk: its typing time with jitter, plus a beat after sentences and lines. */
function delayAfter(chunk: string, cps: number, random: () => number): number {
  if (/<\/?ui:/.test(chunk)) return 40;
  const typing = (chunk.length / cps) * 1000 * (0.5 + random());
  if (/\n\s*$/.test(chunk)) return typing + 70;
  if (/[.!?]["')\]]?$/.test(chunk)) return typing + 90;
  if (/[,;:]$/.test(chunk)) return typing + 30;
  return typing;
}

/**
 * Delivers `text` chunk by chunk on a jittered `setTimeout` loop until done or cancelled. Each
 * chunk has a due time on a schedule; a late tick (a throttled timer) delivers everything that has
 * come due, so the overall pace holds.
 */
export function simulateStream(text: string, { cps = DEFAULT_CPS, onChunk, onDone }: SimulateOptions): SimulatedStream {
  const chunks = syllableChunks(text);
  let index = 0;
  let due = performance.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tick = () => {
    const now = performance.now();
    while (index < chunks.length && due <= now) {
      const chunk = chunks[index++]!;
      onChunk(chunk);
      due += delayAfter(chunk, cps, Math.random);
    }
    if (index >= chunks.length) {
      timer = null;
      onDone?.();
      return;
    }
    timer = setTimeout(tick, Math.max(0, due - performance.now()));
  };
  timer = setTimeout(tick, 0);
  return {
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
