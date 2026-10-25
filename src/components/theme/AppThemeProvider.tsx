"use client";

import { ThemeProvider, createTheme, type Theme } from "@mui/material/styles";
import { CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
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
    button: { textTransform: "none", fontWeight: 500 },
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
          borderRadius: GTM_SHAPE.radiusLg,
          variants: [
            { props: { size: "small" }, style: { minHeight: 32, fontSize: 14, paddingLeft: 12, paddingRight: 12 } },
            { props: { variant: "text" }, style: { "&:hover": { backgroundColor: "var(--gtm-hover)" } } },
            { props: { variant: "text", color: "primary" }, style: { color: vars(theme).palette.text.primary } },
            {
              props: { variant: "outlined", color: "primary" },
              style: {
                color: vars(theme).palette.text.primary,
                borderColor: vars(theme).palette.divider,
                "&:hover": { backgroundColor: "var(--gtm-hover)", borderColor: vars(theme).palette.text.disabled },
              },
            },
            { props: { variant: "outlined", color: "inherit" }, style: { "&:hover": { backgroundColor: "var(--gtm-hover)" } } },
          ],
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: GTM_SHAPE.radiusLg,
          "&:hover": { backgroundColor: "var(--gtm-hover)" },
          variants: [{ props: { size: "small" }, style: { padding: 6 } }],
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: GTM_SHAPE.radiusXl,
          border: `1px solid ${vars(theme).palette.divider}`,
          boxShadow: "0 8px 24px rgba(17, 24, 39, 0.08)",
          ...theme.applyStyles("dark", { boxShadow: "none" }),
        }),
        list: { padding: 4 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 36,
          borderRadius: GTM_SHAPE.radiusLg,
          fontSize: 14,
          "&:hover": { backgroundColor: "var(--gtm-hover)" },
          "&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible": { backgroundColor: "var(--gtm-selected)" },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 32, color: "inherit" } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: GTM_SHAPE.radiusXl } } },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          borderRadius: GTM_SHAPE.radiusXl,
          fontSize: 14,
          backgroundColor: "var(--gtm-text)",
          color: "var(--gtm-bg)",
          boxShadow: "0 8px 24px rgba(17, 24, 39, 0.16)",
        },
      },
    },
    MuiAlert: {
      defaultProps: {
        iconMapping: {
          success: <CheckCircleIcon className="size-5" />,
          info: <InformationCircleIcon className="size-5" />,
          warning: <ExclamationTriangleIcon className="size-5" />,
          error: <ExclamationCircleIcon className="size-5" />,
        },
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
    MuiTooltip: {
      defaultProps: { enterDelay: 300, enterNextDelay: 100 },
      styleOverrides: {
        tooltip: {
          fontFamily: GTM_FONTS.sans,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.5,
          padding: "4px 8px",
          borderRadius: GTM_SHAPE.radiusLg,
          backgroundColor: "var(--gtm-text)",
          color: "var(--gtm-bg)",
        },
        arrow: { color: "var(--gtm-text)" },
      },
    },
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
