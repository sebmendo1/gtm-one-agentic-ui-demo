"use client";

import { ThemeProvider, createTheme, type Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { GTM_DARK, GTM_FONTS, GTM_LIGHT, GTM_SHAPE } from "./tokens";

export const MODE_STORAGE_KEY = "gtm-mode";

function palette(t: typeof GTM_LIGHT | typeof GTM_DARK) {
  return {
    primary: { main: t.cta, dark: t.ctaHover, contrastText: "#FFFFFF" },
    secondary: { main: t.emphasis },
    background: { default: t.bg, paper: t === GTM_LIGHT ? t.surface : t.surfaceSecondary },
    text: { primary: t.text, secondary: t.textSecondary, disabled: t.textMuted },
    divider: t.border,
    success: { main: t.success },
    warning: { main: t.warning },
    info: { main: t.textSecondary },
    error: { main: t.accent },
  };
}

const vars = (theme: Theme) => theme.vars ?? theme;

// One theme for the whole app. `colorSchemeSelector: "class"` puts `.light` / `.dark` on <html>,
// which also drives Tailwind's `dark:` variant and the `--gtm-*` tokens in globals.css.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: { palette: palette(GTM_LIGHT) },
    dark: { palette: palette(GTM_DARK) },
  },
  shape: { borderRadius: GTM_SHAPE.radiusLg },
  typography: {
    fontFamily: GTM_FONTS.sans,
    h5: { fontWeight: 600, letterSpacing: "-0.02em" },
    h6: { fontWeight: 600, fontSize: "1rem", letterSpacing: "-0.01em" },
    subtitle2: { fontWeight: 600 },
    body2: { lineHeight: 1.6 },
    overline: { fontFamily: GTM_FONTS.mono, fontSize: 11, letterSpacing: "0.18em", lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: GTM_SHAPE.radiusXl } },
    },
    // CTA red is for contained (primary) buttons only; text and outlined buttons are neutral.
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          variants: [
            {
              props: { variant: "text", color: "primary" },
              style: { color: vars(theme).palette.text.primary, "&:hover": { backgroundColor: "var(--gtm-subtle)" } },
            },
            {
              props: { variant: "outlined", color: "primary" },
              style: {
                color: vars(theme).palette.text.primary,
                borderColor: vars(theme).palette.divider,
                "&:hover": { backgroundColor: "var(--gtm-subtle)", borderColor: vars(theme).palette.text.disabled },
              },
            },
          ],
        }),
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderColor: vars(theme).palette.divider }),
        head: ({ theme }) => ({
          color: vars(theme).palette.text.disabled,
          fontFamily: GTM_FONTS.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }),
      },
    },
    MuiTooltip: { styleOverrides: { tooltip: { fontFamily: GTM_FONTS.sans, fontSize: 12 } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 500 } } },
  },
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme} defaultMode="light" modeStorageKey={MODE_STORAGE_KEY} disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
