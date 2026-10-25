/**
 * Streaming-safe Markdown (docs/specs/02-design-system.md § Streaming). Makes a half-written
 * prefix parse into the same structure the finished text will, so nothing flashes as literal
 * syntax and blocks don't change shape when their closing marker arrives.
 */

const FENCE = /^ {0,3}(```|~~~)/;
const TABLE_ROW = /^\s*\|/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Hides a table until its delimiter row arrives, and a row until it is finished. */
function holdTable(lines: string[], endsWithNewline: boolean): string[] {
  let start = lines.length;
  while (start > 0 && TABLE_ROW.test(lines[start - 1]!)) start--;
  if (start === lines.length) return lines;
  const rows = lines.slice(start);
  if (rows.length < 2 || !TABLE_DELIMITER.test(rows[1]!)) return lines.slice(0, start);
  if (!endsWithNewline && !rows.at(-1)!.trimEnd().endsWith("|")) return lines.slice(0, -1);
  return lines;
}

/** Closes `**`, `*` and `` ` `` left open in the last paragraph, innermost first; drops a dangling marker. */
function closeInline(paragraph: string): string {
  let text = paragraph;
  const tickCount = (text.match(/`/g) ?? []).length;
  if (tickCount % 2 === 1) return /`\s*$/.test(text) ? text.replace(/`\s*$/, "") : `${text}\``;

  const scan = text.replace(/`[^`]*`/g, (m) => " ".repeat(m.length)).replace(/^(\s*)[*+-](\s)/gm, "$1 $2");
  const open: { marker: string; at: number }[] = [];
  for (const m of scan.matchAll(/\*\*|\*/g)) {
    const before = scan[m.index - 1] ?? " ";
    const after = scan[m.index + m[0].length] ?? " ";
    const top = open.at(-1);
    if (top?.marker === m[0] && /\S/.test(before)) open.pop();
    else if (/\S/.test(after)) open.push({ marker: m[0], at: m.index });
  }
  for (const { marker, at } of open.reverse()) {
    if (text.slice(at + marker.length).trim() === "") text = text.slice(0, at).trimEnd();
    else text = `${text.trimEnd()}${marker}`;
  }
  return text;
}

/** Holds back a link or citation whose `[` has no matching `]`, or whose `](` has no `)`. */
function holdLink(paragraph: string): string {
  const open = paragraph.lastIndexOf("[");
  if (open < 0) return paragraph;
  const tail = paragraph.slice(open);
  const close = tail.indexOf("]");
  if (close < 0) return paragraph.slice(0, open).trimEnd();
  if (tail[close + 1] === "(" && !tail.includes(")", close)) return paragraph.slice(0, open).trimEnd();
  return paragraph;
}

export function repairMarkdown(source: string): string {
  const lines = source.split("\n");
  let inFence = false;
  for (const line of lines) if (FENCE.test(line)) inFence = !inFence;
  if (inFence) return `${source}\n\`\`\``;

  const kept = holdTable(lines, source.endsWith("\n"));
  const text = kept.join("\n");
  const cut = text.lastIndexOf("\n\n") + 1;
  const head = text.slice(0, cut);
  const last = text.slice(cut);
  return head + closeInline(holdLink(last));
}
