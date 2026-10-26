# Fixture data

Fixtures stand in until ZoomInfo is installed and authenticated ([06-setup-gtm-ai.md](./06-setup-gtm-ai.md)). They are served through `src/lib/gtm/fixture-cli.ts`, which answers the same allowlisted commands as the real `gtm` binary in the same `{ data: [{ id, attributes }] }` envelope, so the harness ([07](./07-agentic-harness.md)) and adapter run identically in both modes. `GTM_DATA_SOURCE=auto` picks the real CLI when `gtm auth whoami` succeeds.

## Accounts

| Key | Display name | Vertical |
|-----|--------------|----------|
| `snowflake` | Snowflake | Data warehouse |
| `stripe` | Stripe | Fintech |
| `datadog` | Datadog | Observability (sales engagement deal; Salesforce is only the CRM integration) |

## Contacts

| Key | Name | Company |
|-----|------|---------|
| `jordan-lee` | Jordan Lee | Snowflake |
| `alex-chen` | Alex Chen | Stripe |

## Org

Single `gtm_context` record: offerings, personas, ICP segments, competitors (ZoomInfo-shaped).

## Unknown entity

If no fixture match → `GtmSpec.notFound: true` with message citing the span from the prompt.

## Record shapes

- `CompanyRecord`: name, industry, employees, revenue, hq, website
- `SignalsRecord`: intent topics with `mapsToUs` boolean, scoops[], news[]
- `CommitteeRecord`: members[], gaps[], multithreadRisk
- `ScoresRecord`: fit 0–100, inMarket 0–100, whyNow string
- `TechStackRecord`: categories with tools and displacement hint
- `ContactRecord`: title, email, phone, recent engagement summary

All visible strings in GenUI must come from these records or the user prompt spans.

## Always-on persona fixtures (spec 11)

Elena Vasquez (mid-market AE) demo sources live in `src/lib/agents/fixtures.ts`:

- **Profile:** `PERSONA_PROFILE` (name, role, short role, company, territory, quarter goal). The app always reads it from the fixture, so a saved workspace picks up a rename.
- **Deals:** `PERSONA_DEALS`, the three deals Elena works this quarter, each with stage, amount, close date and next step: Snowflake expansion (Commit, $84k, Nov 20), Stripe new logo (Best case, $48k, Dec 12), Datadog sales engagement (Pipeline, $120k, Dec 19). They are self-reported at onboarding (editable there, then stored as `workspace.deals`), because Salesforce stays locked, and are labeled that way wherever they show.
- **Calendar:** Snowflake expansion review (Tue 10:00, external attendees Riley Kim, Morgan Patel, Jordan Lee; internal Sam Ortiz, Sales Engineer), Stripe follow-up (Fri 2:00 PM), internal forecast, Datadog discovery call (Wed 11:00 AM, Jamie Fox).
- **Reply attachments:** `REPLY_ATTACHMENTS`, the two files the Alex Chen reply carries: Northwind demo deck.pdf, Pilot one-pager.pdf.
- **People:** Sam Ortiz is always Northwind's internal Sales Engineer. Snowflake's procurement contact is Priya Shah.
- **Inbox:** Alex Chen demo-deck request (2026-10-03, unanswered) for Follow-up Nudge.
- **Overnight signals:** timestamped scoops/intent bumps for Deal Watch on watched accounts.

Domains align with fixture companies (`snowflake.com`, `stripe.com`, `datadoghq.com`). Simulated connect only — no real OAuth.
