# Jev decision sequence

Aligns with GTM AI “pick your job” on [start-building](https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research). The onboarding prompt in [06-setup-gtm-ai.md](./06-setup-gtm-ai.md) describes agent behavior for **account research**. Here Jev makes the structural choices: which job, whether to ask, and whether and where UI appears. Gemini writes the words.

## Call 1 — Job classifier

State: `{ description, previous_request, candidates, clarifications }` (`previous_request` is the last user turn, for follow-ups like "what about their tech stack?").

Questions:

- `surface`: `genui` (data or research about a company, person, or account, or our own GTM context) vs `prose` (how to install, sign in, connect, or use GTM AI, the CLI, credits, this app, or what the assistant can do)
- `job`: choice over `GTM_JOBS` criteria (spec 01)
- `task`: `specific` (names a deliverable) vs `vague` (only names an account or person, e.g. "help me with Stripe")

Surface guard (code, after Jev): `prose` only when Jev's confidence ≥ **0.75** and the prompt names no company, contact, or domain. Otherwise the turn is `genui`, because the prose path only answers setup questions from spec 06.

Clarification (at most one, authored):

1. `job` when `task` is `vague` (≥ 0.6) and an account is named: Account research, Buying committee, Why now.
2. `account_brief_vs_committee` or `intent_vs_why_now` when that pair is within **0.2** and one is > 0.15.
3. Otherwise `job` when no job reaches **0.45**: the top three jobs as options. When an account is named, `gtm_context` is excluded and `account_brief` is always offered.

Clarifications override job when set (`job`, `account_brief_vs_committee`, `intent_vs_why_now`). Follow-ups with no named entity inherit the last researched entity from the conversation.

## Call 2 — What to show (`decideUi`)

Runs **after** the harness has gathered evidence ([07](./07-agentic-harness.md)), so Jev only sees components that have data.

State: `{ description, previous_request, job, clarifications, components, offerings, topics, members }`

Questions. The views are every available component plus, when the model writer is running and the job isn't `draft`, a **custom view** (a composed view, spec 03):

- `purpose`: choice over four purposes
- `mode`: `visual` (show views beside a short answer) vs `text` (a draft, advice, summary, or follow-up explanation)
- `main_view`: "If the reply shows exactly one view, which one answers it best?" — a single comparative choice over the views
- `view_count`: `one` (most requests, including briefs and lookups) | `two` (explicitly asks about two different things) | `three` (three or more distinct things)
- Per view: `extra_<id>` choice `inline` (the user would clearly miss it, and the best single view doesn't cover it) | `omit` (the default)
- Per intent topic: `topic_<i>` choice `ours` | `other` against GTM context offerings
- Per committee member: `member_<i>` choice `decision` | `champion` | `influencer` | `blocker` from title

Asking per component on its own did not discriminate: Jev rated nearly every view "lead" at 0.75–0.95. The comparative `main_view` and the request-level `view_count` are what keep most replies to one view.

### Section budget

A **GenUI section** is a catalog component, a composed view, or a CRM draft. A reply shows at most **3**.

- Section 1 is Jev's `main_view`, and it leads.
- Section 2 needs `min(keep, P(view_count ≥ two)) ≥ 0.8`; section 3 needs `min(keep, P(view_count = three)) ≥ 0.9`. Here `keep` is `1 − P(omit)` from the view's `extra_<id>`. Extras go `inline`.
- Overlapping views never both show: `company` with `scores`, `signals` with `why_now`.
- `text` mode means no views, unless Jev is unsure (< 0.5) and confidently (≥ 0.5) picked a main view; then the reply is `visual`. If a visual reply ends up with nothing, the job's primary component leads.
- CRM drafts are allowed only in visual mode, for a company or contact, when CRM history is connected and a slot is free; at most one.
- The parser enforces the cap again on the client, whatever the writer emits.

Measurement: every reply's trace carries `ui.sections` (`limit`, `allowed`, `shown`, `need`, and `dropped` with a reason per left-out view: `omitted`, `below_threshold`, `overlap`, `cap`, `text_mode`, `not_placed`, `invalid`). The server logs one `[genui]` line per reply, and the activity panel shows the counter. `npm run eval:genui` runs common searches and prints a histogram of sections per reply. It fails if any reply exceeds 3 or if half or more show more than one. Results on fixtures (12 searches, 2026-10-20): 9–10 show one section, 1–2 show two (the competitor comparison, sometimes the ICP score), the text-only draft shows none, and none show three. Jev's answers vary slightly between runs.

Availability: a view needs its data; `scores` needs intent signals unless the job is score accounts; `gtm_context` only for GTM context or competitor jobs.

Entity resolution: the planner (or the fallback span heuristic) names the entity; the CLI resolves it. Jev does not invent entity names. For person jobs (`contact_brief`, `draft`) a bare personal name ("Tell me about Jordan Lee") is read as the contact.

### Company question (code, after the free search)

When a company search returns records but none matches the name or domain exactly, the harness stops before any paid step and asks "Which company do you mean?" with up to four records plus "None of these" (question id `company`). Picking a record pins its id for the rest of the turn; "None of these" ends with the not-found reply.

## Assembly

- Adapt evidence into a bundle; apply topic and role answers; compute scores.
- Send the **frame** (bound data, placements, the composed-view slot, sources per component and per data root) to the client before the writer starts.
- The writer places the tags and writes the composed view; code validates the composed view, inserts any lead tag it skipped after the first paragraph, and appends missing inline tags.
- The trace (Jev picks plus harness steps) is shown in the reply's activity panel.
