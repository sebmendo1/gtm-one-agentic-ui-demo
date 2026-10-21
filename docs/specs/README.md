# GTM GenUI specs (spec-driven development)

Read in order for implementation:

| Spec | Topic |
|------|--------|
| [00-product.md](./00-product.md) | PoC goals and boundaries |
| [01-gtm-jobs.md](./01-gtm-jobs.md) | Closed job catalog + start-building links |
| [02-design-system.md](./02-design-system.md) | GTM.ai tokens, global light/dark, MUI + Tailwind |
| [03-genui-components.md](./03-genui-components.md) | Conversational message format, component catalog, actions |
| [04-jev-decisions.md](./04-jev-decisions.md) | Two-call Jev sequence (job, then what to show) |
| [05-fixtures.md](./05-fixtures.md) | Demo data until MCP |
| **[06-setup-gtm-ai.md](./06-setup-gtm-ai.md)** | **Install CLI, set up MCP, onboarding prompt** |
| [07-agentic-harness.md](./07-agentic-harness.md) | Gemini Flash + GTM CLI + Jev turn loop, approval gate, evidence ledger |
| [08-zoominfo-gtm-platform.md](./08-zoominfo-gtm-platform.md) | Domain model: ZoomInfo, the GTM platform, GTM AI surfaces, Context Agents, credits |
| [09-guardrails.md](./09-guardrails.md) | Safety and prompt-injection guardrails: harm filters, untrusted-data fencing, link sanitization, approval, request limits |

Sources behind these specs live in [external-sources](../external-sources/), starting with the [ZoomInfo and GTM AI knowledge base](../external-sources/zoominfo-gtm-ai-knowledge-base.md).

Live setup entry point: [gtm.ai/start-building?tool=gtm-cli&useCase=account-research](https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research)
