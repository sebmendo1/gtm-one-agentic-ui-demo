# Agentic harness — GTM CLI + Gemini Flash + Jev

One chat turn produces a **conversational, cited GTM reply** that may include interactive components ([03](./03-genui-components.md)). Facts come only from the GTM CLI (or the fixture emulator that mimics it). Gemini Flash plans tool calls and writes the reply. Jev decides the job, whether to ask first, and whether and where UI appears. MUI + Tailwind paint it with the tokens in [02-design-system.md](./02-design-system.md).

Setup for the CLI itself (install, `gtm auth login`, onboarding prompt): [06-setup-gtm-ai.md](./06-setup-gtm-ai.md) · [Start Building](https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research). Command surface: [GTM CLI command reference](https://gtm.ai/docs/cli/commands).

## Ownership

| Layer | Owns | Must not |
|-------|------|----------|
| Gemini Flash (`src/lib/harness/planner.ts`, `writer.ts`, `answer.ts`) | Tool plan, CLI flag values (after reading `--help`), the streamed Markdown reply with citations and component tags, prose answers | Invent firmographics, CRM status, dates, or flags; call write tools; retype component data |
| GTM CLI (`src/lib/gtm/cli.ts`) / fixture emulator (`fixture-cli.ts`) | Records in the `{ data: [{ id, attributes }] }` envelope | Choose layout or write recommendations |
| Code (`src/lib/gtm/commands.ts`, `src/lib/harness/run.ts`) | Allowlist, argv-only spawn, flag validation, credit estimate, approval gate, evidence ledger, source coverage, citation and tag validation, follow-up suggestions | Retry a denied call; treat empty results as "no history" |
| Jev (`src/lib/gtm/decide.ts`) | `surface`, `job`, vague-request check, `purpose`, reply `mode`, the main view, how many views (section budget, spec 04), whether a composed view is allowed, intent-topic mapping, committee roles | Author visible copy |
| Renderer (`src/components/chat/*`) | Parse the message, bind tags and composed views to the frame's data, local interactions, actions that start a new turn | Fetch data |

## Turn loop

The client posts `{ description, clarifications, approval, context: { history, entity, carry } }` to `/api/generate`. `history` holds up to 8 earlier messages as plain text. `entity` is the last researched account, so follow-ups keep their subject. `carry` is the signed evidence from the last researched reply (§ Evidence carry). The route streams NDJSON events: `activity` (a status label), `step` (one evidence summary as each GTM call finishes), `frame`, `delta` (writer text), `reset` (discard the draft after a writer failure), then `done` with the response or `error`.

1. **Classify**: Jev call 1 (spec 04). A clarification returns `needs_questions` with a one-line lead and the choices.
2. **Prose path**: when `surface = prose`, `answer.ts` streams Markdown from [06-setup-gtm-ai.md](./06-setup-gtm-ai.md) and the command reference. No CLI calls, no components.
3. **Reuse**: if the approval or `carry` verifies and is about the same subject, its evidence seeds the ledger. Steps it already answered are not run again, and their ids stay citable.
4. **Plan**: the Gemini planner gets the conversation so far and the tools `cli_help` and `run_free_command`. Free commands execute immediately and land in the ledger. Its final structured output is the entity plus paid steps. Without a Gemini key, or if the planner fails, `defaultPlan(job, entity)` is used and skips free commands that already ran. The `draft` job never plans paid steps; it writes from evidence already gathered.
5. **Match**: if the company search found records but none matches the name or domain exactly, return `needs_questions` with "Which company do you mean?" (spec 04) before anything is charged.
6. **Gate**: if the plan has paid steps and the request carries no approval, return `needs_approval` with a conversational lead, each step's credit class, a labeled estimate, and the signed evidence gathered so far. The server **re-validates** every step against the allowlist; it never trusts client steps.
7. **Execute**: approved paid steps run sequentially. Placeholders `{{companyId}}` / `{{contactId}}` resolve from earlier evidence. Declined steps are recorded as `denied` and never retried.
8. **Adapt**: `adapt.ts` maps evidence records into `FixtureBundle` fields (spec 05). If there is no company record, the reply is a not-found message that stops before any paid step.
9. **Decide UI**: Jev call 2 (`decideUi`) chooses purpose, mode, the main view, and how many views to show (spec 04 § Section budget), and maps topics and roles. The server emits a `frame`: bound data, placements, the composed-view slot, sources per component and per data root, and whether CRM drafts are allowed.
10. **Write**: the Gemini writer streams Markdown from the evidence ledger, the frame, the job, purpose, history, and the spec 08 copy rules. Code strips unknown citations, validates any composed view (spec 03), and places any tag it skipped. If a composed view fails, its slot goes to the job's main component. Without Gemini, or on failure, a template reply in the same format is built from evidence and labeled as such.
11. **Respond**: `ready` with the `message` (frame, Markdown, coverage, follow-ups, writer, signed `carry`) and the `trace` (Jev picks, the section counter, harness steps, coverage, token usage).

## Evidence carry

The server is stateless, so the client holds the evidence between turns. `src/lib/harness/carry.ts` signs the ledger with HMAC-SHA256 (`HARNESS_SECRET`, or a key derived from `TYPESAFE_API_KEY`). The ledger is trimmed to 12,000 characters per record and 150,000 in total.

- Each `ready` reply carries `carry`; the client keeps only the newest one in storage and sends it with the next turn.
- `needs_approval` carries the evidence gathered before the gate, so approving resumes without re-running free calls.
- The server ignores a carry that fails the signature check, is older than 12 hours, came from a different data source, or is about a different subject (domain, then company, then contact). A new person at the same company keeps only the company id.
- Reused steps are marked `carried` and shown as "Reused from earlier"; the activity summary counts them.

## Measuring GenUI

Each reply's `trace.ui.sections` records the limit (3), how many views Jev allowed, how many the reply actually showed, the need probabilities, and why every other view was left out (spec 04). The server logs one line per reply:

```
[genui] {"job":"account_brief","mode":"visual","allowed":1,"shown":1,"dropped":["scores:overlap","signals:below_threshold",…]}
```

`npm run eval:genui` runs 12 common searches through the real Jev with Gemini stubbed out, then prints sections per reply and a histogram. It exits non-zero if any reply shows more than 3 sections or if half or more show more than one. `--verbose` prints the need probabilities and keep scores.

## Evidence ledger

```ts
Evidence {
  id: "e1" …;            // cited by the writer
  command: CommandId;     // allowlisted id
  reason: string;         // human step name, shown in activity and given to the writer
  argv: string[];         // exactly what ran (display only)
  cost: "free" | "data" | "ai";
  status: "ok" | "empty" | "unauthorized" | "unavailable" | "denied" | "error" | "skipped";
  source: "gtm-cli" | "fixtures";
  records: unknown[];     // envelope `data`, normalized to an array
  ms: number;
  error?: string;
}
```

Status rules (from the onboarding prompt):

- `empty` = a successful call with zero records. **Never** rendered as "no customer history".
- `unauthorized` = "Not logged in", "Session expired", 401/403.
- `unavailable` = CLI missing, timeout, or source not connected (CRM / conversations).
- `denied` = user declined, or tool returned "No approval received".

## Source coverage

Computed in code, max 3 lines: ZoomInfo calls by status; CRM/conversation history status (`unknown` unless a research payload reports it); data source (`GTM CLI` vs `fixtures`). Shown under the reply in "Sources & coverage". Link: [Connect customer context](https://gtm.ai/guides/connect-customer-context).

## Allowlist (read-only)

| Id | argv | Credits |
|----|------|---------|
| `gtm_context_get` | `gtm-context get` | Free |
| `lookup` | `lookup` | Free |
| `companies_search` | `companies search` | Free |
| `companies_similar` | `companies similar` | Free |
| `contacts_search` | `contacts search` | Free |
| `contacts_recommended` | `contacts recommended` | Free |
| `intent_search` | `intent search` | Free |
| `scoops_search` | `scoops search` | Free |
| `browse_engagements` | `raw call browse_engagements` | Free |
| `companies_enrich` | `companies enrich` | Data |
| `contacts_enrich` | `contacts enrich` | Data |
| `company_signals` | `raw call enrich_company_signals` | Data |
| `research_account` | `research account` | AI |
| `research_contact` | `research contact` | AI |
| `conversation_intelligence` | `raw call conversation_intelligence` | AI |

Excluded: `gtm-context update`, `feedback submit`, audience writes, arbitrary `raw call`.

Flag rules: names `^[a-z][a-z0-9-]*$`; values ≤ 300 chars, never starting with `-`; ≤ 10 values per flag. With a real CLI, a flag must appear in that command's `--help` output. Every call appends `-f json`.

## Configuration

`.env.local` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `TYPESAFE_API_KEY` | Jev (required) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini Flash planner/writer (optional — template fallback without it) |
| `GEMINI_MODEL` | Default `gemini-3.8-flash` |
| `GTM_DATA_SOURCE` | `auto` (CLI when installed + authenticated, else fixtures) · `cli` · `fixtures` |
| `GTM_CLI_BIN` | Path to `gtm` if not on `PATH` |
| `HARNESS_SECRET` | Signs carried evidence (optional; defaults to a key derived from `TYPESAFE_API_KEY`) |

Gemini free-tier keys allow about 20 requests per model per day, and a briefing uses 4–5 (planner steps + streamed writer). A 429 or 503 falls back like an outage. The activity panel then says "rate limit or quota reached" and suggests waiting, switching `GEMINI_MODEL`, or enabling billing.

The client keeps conversations in `localStorage["gtm-chat-history-v2"]`. A reply that was still streaming on reload is marked interrupted.

## Acceptance

- Account brief for Snowflake: a conversational approval prompt (fixtures say "nothing is charged"), then approve, then a streamed reply with cited facts and the components Jev chose.
- Decline: free evidence only. The reply says which steps were not run and invents no research.
- Unknown company ("Zyphrex Industries"): stops before paid steps with a not-found reply. Never says "no history".
- "How do I install the GTM CLI?": a streamed text answer with no CLI calls and no components.
- "Help me with Stripe": one job question first (spec 04), then the chosen job.
- Follow-up "What about their tech stack?" after a Snowflake brief: Snowflake is reused and the tech stack job runs.
- Follow-up "Draft an email to Riley" after a Snowflake brief: no approval, no new paid calls; the reply cites the earlier evidence.
- "Brief me on Stripe Payments" when the search only finds near matches: "Which company do you mean?" before any credits.
- Common searches show one GenUI section; none shows more than 3 (`npm run eval:genui`).
- Real `gtm` 2.2.0 installed but signed out:
  - `GTM_DATA_SOURCE=auto` → fixtures, with coverage "GTM CLI not signed in".
  - `GTM_DATA_SOURCE=cli` → steps marked `unauthorized` with the `gtm auth login` hint, and dependent steps `skipped`.
  - Every flag in `defaultPlan` appears in the real `--help`.
- `npm run smoke:gemini` passes. It answers Gemini's REST and streaming endpoints with scripted responses and checks:
  - Planner tool calls run free commands and resolve ids; paid steps reach the approval prompt; injected flag values are dropped.
  - Steps stream as they run, and the frame arrives before the first text delta.
  - Unknown citations are stripped; every placed component appears exactly once; CRM drafts appear only when allowed; an unfinished tag or composed view is hidden while streaming.
  - No reply exceeds 3 sections and the trace counter matches what renders; the composed-view compiler binds frame data and drops typed-in numbers, unknown primitives, and off-scale spacing; an invalid composed view falls back to the main component.
  - A draft follow-up reuses the carry without approval; a tampered carry is ignored; an ambiguous company asks first.
  - Follow-ups inherit the entity; unknown accounts stop early; vague requests ask first; prose streams with no components.
  - A Gemini outage falls back to the default plan with an error label.
- Live (`GEMINI_MODEL=gemini-3.5-flash`, 2026-10-20): the setup question and the declined tech-stack follow-up were streamed by Gemini; the planner built the Stripe tech-stack plan. Busy or rate-limited calls fell back to the template with the reason shown.
