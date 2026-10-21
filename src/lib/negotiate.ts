// Accept-header negotiation between HTML and Markdown (acceptmarkdown.com, RFC 9110 §12.5.1).

export const PRODUCES = ["text/html", "text/markdown"] as const;
export type Produced = (typeof PRODUCES)[number];

interface AcceptEntry {
  type: string;
  q: number;
  specificity: number;
}

function parseAccept(header: string): AcceptEntry[] {
  return header
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const [type = "", ...params] = raw.split(";").map((s) => s.trim());
      let q = 1;
      for (const param of params) {
        const [name, value] = param.split("=").map((s) => s.trim());
        if (name?.toLowerCase() === "q") {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
        }
      }
      const lower = type.toLowerCase();
      return { type: lower, q, specificity: lower === "*/*" ? 0 : lower.endsWith("/*") ? 1 : 2 };
    });
}

function matches(entry: AcceptEntry, candidate: string): boolean {
  if (entry.type === "*/*") return true;
  if (entry.type.endsWith("/*")) return candidate.startsWith(entry.type.slice(0, -1));
  return entry.type === candidate;
}

/**
 * The representation to send, or null when the client rejects both (→ 406). Each type uses its most
 * specific matching range, so `text/html;q=0, *\/*` rejects HTML; across types the highest q wins and
 * ties go to the client's order. A missing or empty header means HTML.
 */
export function preferredType(header: string | null): Produced | null {
  const entries = header ? parseAccept(header) : [];
  if (entries.length === 0) return "text/html";

  let best: Produced | null = null;
  let bestQ = -1;
  let bestPosition = Infinity;
  for (const candidate of PRODUCES) {
    let matched: AcceptEntry | null = null;
    let position = Infinity;
    entries.forEach((entry, index) => {
      if (!matches(entry, candidate)) return;
      if (!matched || entry.specificity > matched.specificity) {
        matched = entry;
        position = index;
      }
    });
    const q = (matched as AcceptEntry | null)?.q ?? 0;
    if (q <= 0) continue;
    if (q > bestQ || (q === bestQ && position < bestPosition)) {
      best = candidate;
      bestQ = q;
      bestPosition = position;
    }
  }
  return best;
}

export function appendVaryAccept(headers: Headers): void {
  const existing = headers.get("Vary");
  if (!existing) {
    headers.set("Vary", "Accept");
    return;
  }
  if (!existing.split(",").some((token) => token.trim().toLowerCase() === "accept")) headers.set("Vary", `${existing}, Accept`);
}
