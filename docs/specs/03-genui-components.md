# Conversational GenUI

The assistant replies like a chat model. Most of a reply is text, and it **decides if, when, and which** UI to show inline, following [How ChatGPT's intelligent UI works](https://www.openui.com/blog/how-chatgpt-intelligent-ui-works). There are no tabs; every reply is one message.

Live data path: install GTM CLI or ZoomInfo MCP per [06-setup-gtm-ai.md](./06-setup-gtm-ai.md); the harness ([07](./07-agentic-harness.md)) adapts CLI payloads into the same bundle, so the renderer is unchanged.

Two kinds of GenUI, as in the article:

- **Catalog components** (static GenUI): designed widgets the writer places by tag.
- **Composed views** (declarative GenUI): the writer composes a small view from catalog primitives, bound to the same evidence. The server compiles and validates it; the client renders only the primitives below.

## Message format

The writer (Gemini, or the template fallback) emits GitHub-flavored Markdown with these additions:

- **Citations** `[e3]` or `[e3, e4]` right after a fact. Ids must exist in the evidence ledger; unknown ids are stripped server-side. Rendered as source pills with a tooltip.
- **Component tags**, alone on a line: `<ui:company/>`. A tag carries no data; the app binds it to evidence the server already sent (the writer never retypes numbers).
- **Composed views** between a line `<ui:compose title="…">` and a line `</ui:compose>`, only when Jev allowed one (spec 04).
- **CRM drafts** `<ui:crm_draft field="…" value="…" reason="…"/>`, only when allowed. Rendered as "CRM draft · not applied".

Parser (`src/lib/message.ts`): tags not in the catalog, not placed by Jev, or repeated are dropped, and a reply never renders more than **3 GenUI sections** (spec 04 § Section budget). While streaming, an unfinished tag line or an unclosed composed view is hidden until it completes, so each section appears whole. Anything else is plain Markdown, so a reply always renders; history sent back to the model replaces a composed view with its title.

## Catalog components

| Tag | Shows | Local interaction | Actions |
|---|---|---|---|
| `company` | Firmographics, ICP fit | — | — |
| `intent` | Intent topics vs our offerings | All / Ours / Adjacent filter | "Turn this into a why-now case" |
| `signals` | Dated scoops and news | — | Ask about one signal |
| `next_actions` | Recommended actions | Check off | "Help me" with one, open in GTM AI |
| `scores` | ICP fit + in-market gauges | Weighting slider re-tiers, breakdown | — |
| `committee` | Members, roles, engagement, risk | "Engaged only" switch | "Brief me" on a person |
| `contact` | One buyer | Copy email / phone | "Draft email" |
| `comparison` | Us vs competitor | — | "Talk track" |
| `tech_stack` | Technographics + plays | Category filter | — |
| `why_now` | Timing thesis + hooks | — | "Use hook" |
| `gtm_context` | Offerings, personas, ICP, competitors | — | — |

Local interactions never call the model. **Actions** send a new user turn (the article's `issueNewTurn`) or copy text. Every widget shows its sources and a "Demo data" chip in fixture mode.

## Composed views

Catalog (`src/lib/genui/catalog.ts`):

| Primitive | Props (* required) | Children |
|---|---|---|
| `box` | `direction` col/row, `gap`, `padding`, `border`, `align` | blocks |
| `grid` | `cols` 1–4, `gap` | blocks |
| `title`, `text`, `eyebrow` | `size`, `tone` | text and `{expr}` |
| `stat` | `label`*, `value`* (data), `caption` | — |
| `badge` | `label`*, `tone` neutral/success/warning/emphasis | — |
| `progress` | `value`* (data), `label`, `max` | — |
| `bars` | `data`* (array), `label`*, `value`* (field names), `max` | — |
| `table` | `rows`* (array), `columns`* `"field:Header,…"` | — |
| `list` | `items`* (array), `field`, `ordered` | — |
| `each` | `of`* (array), `as`*, `where`, `limit` ≤ 20 | blocks |
| `if` | `test`* | blocks |
| `state` | `name`*, `value`* | — |
| `slider` | `state`*, `min`, `max`, `step`, `label` | — |
| `segmented` | `state`*, `options`* `"value:Label,…"` | — |
| `tabs` / `tab` | `tab` needs `label`* | blocks |
| `button` | `label`*, `action` ask/copy/open, `message`* | — |
| `divider` | — | — |

Binding: `{expressions}` read the frame data roots (`company`, `signals`, `committee`, `scores`, `tech`, `competitor`, `contact`, `whyNow`, `gtmContext`), loop items, and declared state. The language (`src/lib/genui/expr.ts`) has literals, paths, arithmetic, comparisons, logic, ternaries, and `round floor ceil abs min max len join fmt pct lower upper`. It never uses `eval`, and prototype keys are unreachable.

Compiler (`src/lib/genui/compile.ts`, shared by server and client). Invalid parts are removed, never fatal:

- unknown primitives and props are dropped (`unknown_component`, `unknown_prop`);
- an off-catalog literal (spacing off the 4px scale, an unknown enum) drops the prop (`invalid_literal`);
- a missing required prop drops the element (`missing_prop`);
- a typed-in value where data is required drops the element (`literal_data`), so the model can't retype numbers;
- a reference to anything but frame data, a loop item, or a declared state drops the element (`unknown_ref`);
- at most 150 nodes and 8 levels deep (`limit`).

The server keeps the first composed view only if Jev allowed one and it compiles to something visible, closes an unclosed block, and records the diagnostics in the trace. If the view never arrives or fails, its slot goes to the job's main component.

Client (`src/components/chat/ComposedBlock.tsx`): renders inside the standard widget card (eyebrow "Custom view", source chips from the data roots it read). `state`, sliders, segmented choices, and tabs live in the component, so interacting never calls the model. Buttons: `ask` sends a new turn, `copy` copies, `open` opens allowlisted https links only (guardrail G4).

## Message chrome

- **Activity**: a "thinking" disclosure above each reply. It shows the live step while working ("Planning account research with Gemini"), then a summary ("Researched with 4 GTM calls (2 reused) · 9s"). Expanded, it lists each GTM call with status and exact command (reused calls are marked "Reused from earlier"), Jev's job, purpose, reply mode and per-view picks, the **GenUI section counter** ("GenUI sections 1 of 3 max", with why other views were left out and any composed-view fixes), the planner, writer, and data source, and any fallback error. When a turn pauses for a question or approval, that phase keeps its own panel.
- **Clarifications**: inline pill choices; the picked one stays highlighted.
- **Approval**: an inline card listing the paid steps with credit chips and an "exact commands" disclosure, plus "Approve and run" and "Skip paid steps". Once decided, it collapses to a one-line receipt.
- **Footer**: Sources & coverage disclosure, copy, ask again, writer label, Demo/Live chip, then follow-up suggestions built by code from the job and evidence.

## Rules

- MUI + Tailwind only (spec 02); no shadcn.
- No invented company facts: components and composed views render evidence only; the writer cites the ledger.
- At most 3 GenUI sections per reply; most replies show one.
- CRM changes are drafts; nothing is written to a CRM.
