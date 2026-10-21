# GTM.ai design system

**Light by default**, with a global Light / Dark / System switch in the header. The whole app (chat chrome and generated components) is MUI + Tailwind on the same tokens. Dark values match the [gtm.ai](https://gtm.ai/) homepage (2026-10-20).

**Product setup** (CLI/MCP, credits, onboarding) is documented in [06-setup-gtm-ai.md](./06-setup-gtm-ai.md); styling is independent of which connect path you use.

## Core tokens

Defined once in `src/app/globals.css` as `--gtm-*` variables on `:root` (light) and `.dark`, and mirrored for MUI in `src/components/theme/tokens.ts`.

| Token | Light | Dark |
|---|---|---|
| `--gtm-bg` page | `#FFFFFF` | `#000000` |
| `--gtm-bg-secondary` sidebar | `#F8F9FF` | `#0D0D12` |
| `--gtm-surface-secondary` raised | `#F3F4F6` | `#0D0D12` |
| `--gtm-subtle` hover, selected, chip fill | `#F3F4F6` | `#1C1C25` |
| `--gtm-border` 1px hairlines | `#E5E7EB` | `#3C3C4A` |
| `--gtm-text` / `-secondary` / `-muted` | `#111827` / `#4B5563` / `#6B7280` | `#FFFFFF` / `#D0D0DE` / `#A0A0B0` |
| `--gtm-emphasis` | `#C9211B` | `#FF786C` (coral) |

Shared: CTA `#DF201A` (hover `#EA1B15`), accent and errors `#FF3333`, success `#10B981`, warning `#F59E0B`.

## Color roles

Red is the brand's loudest signal, so it is rationed:

- **CTA red** (`--gtm-cta`, MUI `primary`): contained buttons for the one primary action in a view ("Approve and run", "Draft email"), the send button, and the brand mark. The theme makes `text` and `outlined` buttons neutral, so secondary actions ("Brief me", "Use hook", "Talk track") never turn red.
- **Selection and emphasis**: inverse neutral (`bg-gtm-text text-gtm-bg`): selected filter chips, a picked clarification, the decision-maker role, avatars, composed-view `emphasis` badges. Quote and play rules use a `gtm-text` border.
- **Status**: success green for progress and good scores, warning amber for gatekeepers and mid scores, neutral grey for low scores. A low score is not an error.
- **Errors** (`--gtm-accent`, MUI `error`): failed steps and real errors only. MUI `info` is mapped to `--gtm-text-secondary`, so info alerts stay on-brand.

## Light / dark switch

- MUI owns the mode: `createTheme({ cssVariables: { colorSchemeSelector: "class" }, colorSchemes: { light, dark } })` in `AppThemeProvider`, `defaultMode="light"`, stored in `localStorage["gtm-mode"]`.
- `InitColorSchemeScript` (class attribute, light default) runs before paint, so there is no flash; `<html suppressHydrationWarning>`.
- MUI toggles `.dark` on `<html>`. The same class swaps the `--gtm-*` tokens and drives Tailwind's `dark:` variant (`@custom-variant dark (&:is(.dark *))`). One switch changes everything.
- `ThemeToggle` (`useColorScheme`) offers Light, Dark, and System.

## Typography

- Sans: Figtree (app layout) — loaded with `next/font`, exposed as `--font-figtree`; the MUI theme uses that variable. Do **not** install Roboto (MUI's default); GTM branding overrides it.
- Mono eyebrows: JetBrains Mono 11px uppercase, tracking 0.18em (`--font-jetbrains-mono`, `.gtm-eyebrow`)

Type scale (tokens in `@theme`, no arbitrary `text-[Npx]`):

| Utility | Size | Use |
|---|---|---|
| `text-caption` | 11px / 16px | chips, eyebrows, mono metadata, source labels |
| `text-xs` | 12px | secondary notes, error lines |
| `text-meta` | 13px / 20px | labels, activity panel, table sublines |
| `text-sm` | 14px | widget body, table cells, buttons |
| `text-body` | 15px / 1.7 | chat prose, user bubbles, composer |
| `text-3xl` / `sm:text-4xl` | 30 / 36px | the empty-state headline only |

## Spacing

Tailwind's 4px scale (`1` = 4px). Use whole steps: `1 2 3 4 5 6 8`. Half steps (`1.5`, `2.5`, `3.5`) are off-grid and not used for spacing; `0.5` (2px) is only for optical icon alignment. Composed views accept only `0 1 2 3 4 5 6 8` for `gap` and `padding`.

Rhythm:

- A message body is a flex column with `gap-4` (16px) between every block: paragraph groups, widgets, composed views, CRM drafts. Blocks carry no outer margins.
- Inside a widget card: `p-4` (`sm:p-5`), header to content `mb-3`, sections `gap-3`, rows `gap-2`, chip groups `gap-2`.
- Prose paragraphs: 0.75em between blocks (`.gtm-prose`).

## MUI + Tailwind wiring

- MUI per [installation](https://mui.com/material-ui/getting-started/installation/): `@mui/material @emotion/react @emotion/styled`, icons from `@mui/icons-material` (SVG imports, no icon font).
- Tailwind v4 through Next's PostCSS integration: `tailwindcss` + `@tailwindcss/postcss` in `postcss.config.mjs`, `@import "tailwindcss"` in `globals.css`.
- Layer order per [MUI Tailwind v4 guide](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/): `@layer theme, base, mui, components, utilities;` and `AppRouterCacheProvider options={{ enableCssLayer: true }}` so Tailwind utilities override MUI.
- Token utilities: `bg-gtm-bg`, `bg-gtm-bg-secondary`, `bg-gtm-surface`, `bg-gtm-subtle`, `border-gtm-border`, `text-gtm-text`, `text-gtm-secondary`, `text-gtm-muted`, `text-gtm-emphasis`, `bg-gtm-cta`, `font-gtm-mono`, `rounded-gtm`, `rounded-gtm-xl`, and the type scale above.
- Use MUI for interactive controls (Button, ToggleButtonGroup, Switch, Slider, Table, Chip, Tooltip, Collapse, Menu) and Tailwind for layout and spacing.

## Mobile

- Viewport: `viewport-fit=cover` with `env(safe-area-inset-*)` padding on the header, sidebar, main column, and bottom composer slot; `interactive-widget=resizes-content` so the keyboard resizes the layout instead of covering the composer.
- Inputs are 16px below `sm` (iOS zooms into anything smaller on focus); the composer sends `enterKeyHint="send"` and uses a short placeholder under 480px.
- Touch targets: on `(pointer: coarse)`, small IconButtons grow to 40px, small Buttons and ToggleButtons to 36px tall, clickable small Chips to 32px; text toggles get extra vertical padding via `pointer-coarse:`.
- Hover-only reveals (copy, delete, send, "Help me") use `pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100`, so they're always visible on touch. Sidebar delete shows on touch only for the open chat.
- Below `sm`, wide tables become stacks: the buying committee is a list with a "Brief me" button per person, and the comparison is one block per dimension. Composed grids reflow with a 7.5rem minimum column.
- Below `md`, the sidebar is an overlay drawer that starts closed (CSS decides before hydration, so it never flashes open); the header hides the brand mark during a chat so the title can take the space.

## Shape

- Buttons/cards: 8px (`rounded-gtm`), feature cards and widgets 12px (`rounded-gtm-xl`); chips and the composer are pills.
- Flat surfaces: outlined cards, no box-shadow except the composer's soft light-mode lift.
