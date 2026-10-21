# GTM job catalog

Closed set of `GtmJob` values. Each maps to a ZoomInfo skill / Context Agent pattern; [08-zoominfo-gtm-platform.md](./08-zoominfo-gtm-platform.md) explains those and which ones the harness calls.

**Setup:** Each job assumes ZoomInfo is connected per [06-setup-gtm-ai.md](./06-setup-gtm-ai.md). Map start-building use cases to jobs below; default onboarding template is **account research** at [gtm.ai/start-building](https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research).

| Job | Decision answered | Entity | Sections (may omit if thin) |
|-----|-------------------|--------|----------------------------|
| `account_brief` | What do I need to know before this account conversation? | company | tldr, firmographics, icp_fit, intent, scoops, next_actions |
| `buying_committee` | Who matters and where are we single-threaded? | company | tldr, members, gaps, risk |
| `intent_monitor` | Is their intent about us or a competitor category? | company | tldr, topics_for_us, topics_competitor |
| `why_now` | Why reach out this week? | company | tldr, thesis, hooks |
| `score_accounts` | How do we tier this account? | company | tldr, scores, breakdown |
| `tech_stack` | What do they run and where do we displace? | company | tldr, stack, plays |
| `competitor` | How do we compare to a named competitor? | company + competitor span | tldr, comparison |
| `contact_brief` | What do I need on this buyer? | contact | tldr, profile, engagement |
| `draft` | Write the email, agenda, or talk track | company or contact | text only; reuses evidence from the previous turn and runs no paid steps |
| `gtm_context` | What does our AI know about our GTM? | none (org) | offerings, personas, icp, competitors |

## Start-building deep links

| Job | Suggested `useCase` query param |
|-----|----------------------------------|
| `account_brief` | `account-research` |
| `intent_monitor` | `intent-monitoring` (or intent monitoring flow on start-building) |
| Others | `https://gtm.ai/start-building?tool=gtm-cli&useCase=…` + MCP [tools index](https://gtm.ai/docs/mcp/tools) |

After install (`gtm auth login` or Cursor MCP OAuth), paste the onboarding prompt from **06-setup-gtm-ai.md** for account research, or ask in this demo chat for the GenUI equivalent.

## Purposes (`GtmPurpose`)

Used to frame copy emphasis, not to change fixture IDs.

- `pre_call` — discovery, QBR prep
- `inbound_triage` — route vs nurture
- `competitive` — displacement / bake-off
- `renewal` — expansion and risk
