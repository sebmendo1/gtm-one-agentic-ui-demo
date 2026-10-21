// Link allowlist for rendered replies (docs/specs/09-guardrails.md G4). Shared by server and client.

const TRUSTED_HOSTS = ["gtm.ai", "zoominfo.com", "ai.google.dev", "aistudio.google.com"];

export function isTrustedHref(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return TRUSTED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
