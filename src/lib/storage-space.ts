// Browser storage keys, scoped to a "space". The presenter's tab uses the default space. A shared
// brief's "Start free" opens `/?new=1`, which gets a brand-new space on every load, so the recipient
// always onboards from scratch and never reads or overwrites the sender's workspace.

const GUEST_PREFIX = ":guest-";
let guest: string | null = null;

function resolveSpace(): string | null {
  try {
    if (new URLSearchParams(window.location.search).get("new") !== "1") return null;
    if (!guest) {
      guest = `guest-${Date.now().toString(36)}`;
      for (const key of Object.keys(localStorage)) if (key.includes(GUEST_PREFIX)) localStorage.removeItem(key);
    }
    return guest;
  } catch {
    return null;
  }
}

export function spacedKey(key: string): string {
  const space = resolveSpace();
  return space ? `${key}:${space}` : key;
}
