// GTM.ai brand tokens per color scheme (docs/specs/02-design-system.md). Mirrors the `--gtm-*`
// variables in src/app/globals.css; MUI needs concrete colors to derive hover and alpha states.
export const GTM_LIGHT = {
  bg: "#FFFFFF",
  bgSecondary: "#F8F9FF",
  surface: "#FFFFFF",
  surfaceSecondary: "#F3F4F6",
  subtle: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#6B7280",
  cta: "#DF201A",
  ctaHover: "#EA1B15",
  accent: "#FF3333",
  emphasis: "#C9211B",
  success: "#10B981",
  warning: "#F59E0B",
} as const;

export const GTM_DARK = {
  bg: "#000000",
  bgSecondary: "#0D0D12",
  surface: "#000000",
  surfaceSecondary: "#0D0D12",
  subtle: "#1C1C25",
  border: "#3C3C4A",
  text: "#FFFFFF",
  textSecondary: "#D0D0DE",
  textMuted: "#A0A0B0",
  cta: "#DF201A",
  ctaHover: "#EA1B15",
  accent: "#FF3333",
  emphasis: "#FF786C",
  success: "#10B981",
  warning: "#F59E0B",
} as const;

export const GTM_SHAPE = { radiusLg: 8, radiusXl: 16 } as const;

export const GTM_FONTS = {
  sans: 'var(--font-figtree), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: "var(--font-jetbrains-mono), ui-monospace, monospace",
} as const;
