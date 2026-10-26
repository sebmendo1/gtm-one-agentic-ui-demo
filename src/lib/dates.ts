const DEMO_YEAR = 2026;

/** "2026-10-03" → "Oct 3" ("Oct 3, 2025" outside the demo year). Anything unparseable passes through. */
export function humanDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(Number(match[1]) === DEMO_YEAR ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
