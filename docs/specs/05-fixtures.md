# Fixture data

Fixtures stand in until ZoomInfo is installed and authenticated ([06-setup-gtm-ai.md](./06-setup-gtm-ai.md)). They are served through `src/lib/gtm/fixture-cli.ts`, which answers the same allowlisted commands as the real `gtm` binary in the same `{ data: [{ id, attributes }] }` envelope, so the harness ([07](./07-agentic-harness.md)) and adapter run identically in both modes. `GTM_DATA_SOURCE=auto` picks the real CLI when `gtm auth whoami` succeeds.

## Accounts

| Key | Display name | Vertical |
|-----|--------------|----------|
| `snowflake` | Snowflake | Data warehouse |
| `stripe` | Stripe | Fintech |
| `salesforce` | Salesforce | CRM (competitor scenario) |

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
