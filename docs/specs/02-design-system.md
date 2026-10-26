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
| `--gtm-hover` row and icon-button hover | text at 5% | text at 7% |
| `--gtm-selected` current row | text at 8% | text at 11% |

Shared: CTA `#DF201A` (hover `#EA1B15`), accent and errors `#FF3333`, success `#10B981`, warning `#F59E0B`.

Hover and selected are translucent tints of `--gtm-text` (as in ChatGPT and Claude), so one value reads correctly on the page, the sidebar, and the work panel in both modes. Utilities: `bg-gtm-hover`, `bg-gtm-selected`.

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
- Mono eyebrows: JetBrains Mono 11px uppercase, tracking 0.18em (`--font-jetbrains-mono`, `.gtm-eyebrow`). They belong to **generated components** (widget cards, the goal card). App chrome (sidebar, work panel, day dividers) uses sentence-case labels instead: `text-meta font-medium text-gtm-muted`, the way ChatGPT ("Your chats") and Claude ("Recents") label sections.

Type scale (tokens in `@theme`, no arbitrary `text-[Npx]`):

| Utility | Size | Use |
|---|---|---|
| `text-caption` | 11px / 16px | chips, eyebrows, mono metadata, source labels |
| `text-xs` | 12px | secondary notes, error lines, the composer footnote |
| `text-meta` | 13px / 20px | labels, activity line, table sublines, row details |
| `text-sm` | 14px | widget body, sidebar and panel rows, buttons |
| `text-body` | 16px / 1.75 | chat prose, user bubbles, composer, card titles |
| `text-2xl` / `sm:text-3xl` | 24 / 30px | empty-state headline only |

Chat prose is 16px on a 28px line, matching ChatGPT and Claude: long answers read as text, not UI. Headings inside prose are 20px (`h2`) and 18px (`h3`), with 1.5em above and 0.5em below.

Weights: **400** for reading text; **500** for anything you act on or scan (buttons, row titles, agent names, the header title, labels); **600** only for headings (`h1`–`h3`, widget titles) and `strong`. Buttons are 500, not 600; heavy button text is the most visible difference from ChatGPT and Claude.

## Spacing

Tailwind's 4px scale (`1` = 4px). Use whole steps: `1 2 3 4 5 6 8`. Half steps (`1.5`, `2.5`, `3.5`) are off-grid and not used for spacing; `0.5` (2px) is only for optical icon alignment. Composed views accept only `0 1 2 3 4 5 6 8` for `gap` and `padding`.

Rhythm:

- The chat column is `max-w-3xl` (768px) with `px-4 sm:px-6`, identical in the hub and in threads, so switching views never shifts the text edge.
- Between turns or timeline items: `gap-10` (40px) from `sm`, `gap-8` on phones. Inside a turn, user bubble to reply: `gap-6` (24px).
- A message body is a flex column with `gap-4` (16px) between every block: paragraph groups, widgets, composed views, CRM drafts. Blocks carry no outer margins.
- Inside a widget card: `p-4` (`sm:p-5`), header to content `mb-3`, sections `gap-3`, rows `gap-2`, chip groups `gap-2`.
- Prose paragraphs: 0.75em between blocks (`.gtm-prose`).

## MUI + Tailwind wiring

- MUI per [installation](https://mui.com/material-ui/getting-started/installation/): `@mui/material @emotion/react @emotion/styled`. Icons are [Heroicons](https://github.com/tailwindlabs/heroicons) (`@heroicons/react`), not `@mui/icons-material`; see Icons.

## Icons

[Heroicons](https://heroicons.com) v2 via `@heroicons/react`, imported per icon (tree-shaken SVG components). Size with Tailwind `size-*` and color with `text-*` (icons draw in `currentColor`). Pick the set by rendered size, as Heroicons is drawn for each:

| Where | Set | Size |
|-------|-----|------|
| Header and toolbar IconButtons, menu items, Alert icons | `24/outline` | `size-5` (20px) |
| Agent avatar glyphs | `24/outline` | `size-[18px]` in the 32px tile, `size-3.5` in the 24px tile |
| Inside buttons (`startIcon` / `endIcon`), status rows, small IconButtons | `20/solid` | `size-4` (16px), `size-4.5` for copy/retry icon buttons |
| Composer send (filled 36px tile) | `20/solid` | `size-5` |
| Dense metadata (≤14px: news kind, writer note, sidebar delete) | `16/solid` | `size-3.5` |

- Status: done `CheckCircleIcon` in success, denied `NoSymbolIcon`, error `ExclamationCircleIcon`, locked `LockClosedIcon`. Heroicons has no empty circle, so pending/unchecked is a 1.5px `border-current` ring of the same size.
- Brand mark: `ArrowUpRightIcon` (24/solid) white on the red tile.
- Sidebar toggle: the one custom glyph (`SidebarIcon` in `Sidebar.tsx`), a panel outline drawn on the 24/outline grid with a 1.5 stroke, because Heroicons has no sidebar icon. Phones keep `Bars3Icon`.
- MUI's built-in Alert icons are replaced through the theme's `MuiAlert.defaultProps.iconMapping`, so no Material glyph remains.
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

- Buttons, rows and icon buttons: 8px (`rounded-gtm`). Icon buttons are rounded squares, as in the ChatGPT and Claude action rows; only the send button and the scroll-to-latest button are circles.
- Cards, widgets, the goal card, menus: 16px (`rounded-gtm-xl`).
- User bubbles: 24px (`rounded-3xl`). Chips and suggestion pills: full pills. Composer: 28px.
- Flat surfaces: outlined cards, no box-shadow except the composer's soft lift and menus/popovers (`0 8px 24px` at 8% in light mode, none in dark).
- Tooltips are inverse (`--gtm-text` fill, `--gtm-bg` text), 12px medium, 8px radius, no arrow.

## Chat surfaces (ChatGPT / Claude conventions)

Reference: ChatGPT web and Claude web on Mobbin (conversation, research activity, sidebar). Applied as:

- **Header** (56px, no border): the title in `text-sm font-medium`; threads show a breadcrumb `Go-to-agent › {thread}` with a chevron separator. Tools sit right as 32px icon buttons.
- **Sidebar** (264px): wordmark + collapse button; a **New thread** row (pencil-square icon) like ChatGPT's "New chat"; the Go-to-agent row (24px mark, unread badge) with threads nested under a rail aligned to the mark's center; a footer with the credit meter (neutral fill, not red) and a profile row (initials, name, "Mid-market AE · Northwind") like ChatGPT's account row, with no developer setup link because the seller never configures the CLI. Rows are 36px, `text-sm`, hover `bg-gtm-hover`, current `bg-gtm-selected`.
- **User messages:** right-aligned `bg-gtm-subtle` bubbles, `rounded-3xl`, `px-4 py-2.5`, at most 80% wide (70% from `sm`).
- **Assistant replies:** no bubble and no avatar gutter; text starts at the column edge. A reply to the user's own message has no header. Proactive agent messages carry one header line (see spec 11).
- **Activity line** (Claude's thought summary): muted `text-meta` with a right chevron that turns down when open; the expanded trace hangs off a left rail.
- **Action row** under a reply: 32px icon buttons (copy, ask again) in muted grey, then a **Sources** pill that opens coverage below, then the writer label and data chip at the far right. Follow-ups list under it.
- **Composer:** a 28px-radius card with the field and a round send button; a 32px fade above it so the timeline dissolves under the suggestions instead of being cut off; a 12px centered footnote below.
- **Work panel:** like ChatGPT's research Activity panel: sentence-case section labels with a count, two-line rows, no dividers.

## Streaming

Replies "bleed" onto the page the way ChatGPT and Gemini stream, rather than typing out like a typewriter. The code has three layers, and none of them knows where the text came from:

| Layer | File | Job |
|-------|------|-----|
| Source | `src/lib/stream/simulate.ts` | Simulated stream: splits finished text into syllable-sized chunks (2–5 characters) and delivers them on a jittered `setTimeout` loop. It pauses after sentences and line breaks and treats a `<ui:…>` tag line as one chunk. Used for replies that arrive whole (template writer, hub intents, agent log lines). Live Gemini deltas skip it. |
| Buffer | `useChat` delta micro-buffer, `useSmoothStream` | Network deltas are coalesced into at most one state update per animation frame. The reveal loop (`requestAnimationFrame`) advances the visible text at a baseline of about 320 characters per second, faster when a backlog builds (a burst drains within 350 ms), and only ever stops at the end of a word. So a word never starts on one line and jumps to the next. |
| Render | `StreamingMarkdown` (`src/components/chat/stream/`) | Repairs the visible Markdown, wraps each newly revealed word in a fading span, and places the caret. |

- **Fade:** each new word mounts as `.gtm-token`: opacity 0→1 with a 2px blur clearing over 120 ms (`--gtm-token-fade`). Only opacity and filter animate, so a word takes its final place in the line before it is visible. The animation never moves text or triggers layout, and words already on screen never animate again.
- **Caret:** a 2px × 1.1em rounded bar (`.gtm-caret`) right after the last word, inside the last paragraph, list item or code block. It stays solid while text arrives, blinks softly (1 s ease-in-out) once nothing has arrived for 400 ms, and is removed from the DOM when the reply settles. A reply that has started but has no text yet shows the caret alone.
- **Markdown repair** (visible text only, while streaming): an open code fence is closed, so code renders as a block from its first line. An unpaired `**`, `*` or `` ` `` in the last paragraph is closed, innermost first (a `*` with spaces on both sides is arithmetic and left alone), so bold and italics render styled from the first word and don't flash literal asterisks. A trailing unmatched `[` (a citation or link in progress) is held back. A table is held until its delimiter row arrives, and a half-typed row until it ends.
- **Settle:** when the reveal catches up with a finished reply, the footer (copy, ask again, Sources, follow-ups) fades in and the word spans are dropped. Replies restored from history and threads opened from cards render settled immediately; only replies that finish while you watch stream.
- **GenUI cards:** a component tag (or an unclosed composed view, or a half-written tag line) shows a card container right away: the 16px outlined card with a shimmering skeleton of that widget's shape (tile grid for company, scores and intent; rows for everything else). Text pauses while a card loads. After 650 ms the real card fades in over the skeleton and text resumes, so later text doesn't jump when the card replaces its skeleton.
- **Auto-scroll** (`useStickToBottom`): a `ResizeObserver` on the timeline keeps the newest line in view while the user is at the bottom. A wheel or touch scroll upward, or PageUp/Home/ArrowUp, detaches immediately, even by a few pixels. A round 32px **Scroll to bottom** button appears while detached and pulses when new text is arriving below. Clicking it, or scrolling back to the bottom, re-attaches.
- **Frames** (`src/lib/stream/frame.ts`): every per-frame step waits for the next animation frame or 50 ms, whichever comes first, because an occluded or background view never fires `requestAnimationFrame`. The simulated source schedules each chunk at a due time, so a throttled timer delivers everything that has come due instead of falling behind. In a hidden tab the reveal jumps to everything received.
- **Reduced motion:** words appear without fade or blur, the caret doesn't blink, and skeletons don't shimmer. Pacing stays.

## Always-on agent UI (spec 11)

Components in `src/components/agent/`:

| Component | Role |
|-----------|------|
| `AgentAvatar` | 24px (messages, sidebar, panel) or 32px rounded tile: brand-red arrow for Go-to-agent, neutral tile with an outlined icon per agent |
| `AgentMessage` | Header line (24px avatar · name · time · status, quiet actions right) over full-width content; used by cards, sweep status and agent log lines |
| `Dispatch` | Go-to-agent message per sweep: one sentence, then a lifecycle row per specialist (status mark, avatar, name, summary, task count) that expands to its result; live working row during a sweep (spec 11 § Specialists and dispatch) |
| `RunResult` | A run's quiet result plus its action row (primary, Open thread, View N tasks, Snooze, Not useful); `ApprovalSummary` for runs that need approval |
| `SubAgentSheet` | Right sheet with one specialist's transcript: assignment, task timeline with sources, evidence ids and commands, cited result |
| `Onboarding` | First run: segmented progress bar, two-tone step heading, live agent preview panel from `lg` (spec 11 § First run) |
| `QuietEvidenceContext` | Set by `RunBody` in the hub; hides citation chips and widget source rows (the Demo data tag is debug-only everywhere) |
| `SweepError` | Inline sweep failure with Retry |
| `WorkPanel` | Right sidebar on Go-to-agent only: goal, needs you, up next, in progress, done, watching, setup |
| `DayDivider` | “Today” / “Yesterday” in hub timeline |
| `CreditMeter` | Sidebar footer meter + autopilot budget hint |
| `GoToAgentView` | Hub layout: timeline + composer, plus the work panel |

**Sidebar:** see Chat surfaces. Matches Figma `1313:1551` (GTM One, pinned Go-to-agent, threads under it, footer meter).

**Messages:** see Chat surfaces. Agent messages have no bubble; the header line's 24px avatar sits on the column edge and the body starts flush below it (`mt-3`), so cards, replies and the user's widgets share one left edge. Quiet actions (Snooze, Not useful) fade in on hover with a fine pointer and stay visible on touch. Status pills are 20px tall, `text-caption font-medium`, pill-shaped: `New` uses emphasis red, `Needs approval` warning amber, `Done` success green, each as a 10% tint with full-strength text.

**Work panel:** `bg-gtm-bg-secondary`, `border-l`, 320px. Section labels are sentence case (`text-meta font-medium text-gtm-muted`) with a count on the right; rows are 36px minimum, icon + two lines (title `text-sm font-medium`, detail `text-meta` muted), hover `bg-gtm-hover`.

**Day dividers:** a centered `text-meta font-medium text-gtm-muted` label between hairlines ("Yesterday", "Today").

**Card states:** running (skeleton), ready, needs_approval (amber-bordered summary; approval runs in the thread), done (single-line collapse), snoozed/dismissed hidden with an undo snackbar.
