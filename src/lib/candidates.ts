// Jev selects rather than generates, so code first finds every phrase in the
// description that could become visible UI text. Jev then judges each one.

const QUOTED = /"([^"]+)"|“([^”]+)”|'([^']{2,})'/g;

// Words and phrases that join separate pieces of content.
const SEPARATORS =
  /,(?!\d{3}\b)|[;:\n]|[.!?]\s+|\s+(?:and|with|for|featuring|including|plus|then|showing|shows|containing|called|named|labeled|labelled|says|saying|titled|that says|that has|which has)\s+/i;

const LEADING_FILLER =
  /^(?:(?:a|an|the|some|my|our|its|their|also|fields?|inputs?|for|of|to|items?|options?|entries)\s+)+/i;

const MAX_WORDS = 10;
const MAX_CANDIDATES = 30;

export function extractCandidates(description: string): string[] {
  const found: string[] = [];

  // Quoted text is taken verbatim and blanked out so splitting can't break it.
  const unquoted = description.replace(QUOTED, (_, a, b, c) => {
    found.push((a ?? b ?? c).trim());
    return " , ";
  });

  for (const piece of unquoted.split(SEPARATORS)) {
    const cleaned = piece
      .trim()
      .replace(LEADING_FILLER, "")
      .replace(/[.!?]+$/, "")
      .trim();
    if (!cleaned || /^(?:a|an|the)$/i.test(cleaned) || cleaned.split(/\s+/).length > MAX_WORDS) continue;
    found.push(cleaned);
  }

  const seen = new Set<string>();
  return found
    .filter((text) => {
      const key = text.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CANDIDATES);
}

/** Capitalizes the first letter only, so copied text otherwise stays verbatim. */
export function asLabel(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const NUMBER = /[$€£¥]?\s?\d[\d,.]*\s?(?:[kKmMbB]\b|%|\/mo\b|\/month\b|\/yr\b)?/;

/** Splits "revenue $12k" into a label and the number found in the text. */
export function splitNumber(text: string): { label: string; value: string | null } {
  const match = text.match(NUMBER);
  if (!match) return { label: text, value: null };
  const label = text
    .replace(match[0], " ")
    .replace(/\s+(?:of|at|is|=)\s*$/i, "")
    .replace(/^\s*(?:of|at|is|=)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return { label: label || text, value: match[0].trim() };
}
