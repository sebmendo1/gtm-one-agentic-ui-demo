/**
 * Only replies that finish while the user watches stream. Anything restored from history (created
 * before this page load) or already played once renders settled.
 */
const SESSION_START = Date.now();
const played = new Set<string>();

export function isFreshReply(id: string, createdAt: number | undefined): boolean {
  return (createdAt ?? 0) >= SESSION_START && !played.has(id);
}

export function markPlayed(id: string) {
  played.add(id);
}
