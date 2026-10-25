# Product spec — GTM chat GenUI demo

## Purpose

Prove that GTM AI can be experienced as a **chat product** where answers are **decision surfaces** (GenUI), not only prose. The seller describes a GTM job; Jev picks which surface to show; fixture data (later MCP) fills the UI.

**PoC extension (spec 11):** a mid-market **Account Executive** gets a pinned **Go-to-agent** hub that proactively prepares meeting briefs and follow-ups from simulated Google Calendar/Gmail plus ZoomInfo fixtures, with spoke chats for deep work.

## Boundaries

| Layer | Technology | Role |
|-------|------------|------|
| Chat shell | MUI + Tailwind in `src/app/page.tsx`, `src/components/chat` | Conversations, composer, sidebar, activity panel |
| GenUI | MUI + Tailwind on the `--gtm-*` tokens ([02](./02-design-system.md)) | Inline catalog components and composed views ([03](./03-genui-components.md)) |
| Intelligence | TypeSafe Jev (`systemOne`) | Surface, job, purpose, which views and how many (at most 3) — no invented copy |
| Agent | Gemini Flash via AI SDK (`src/lib/harness`) | Tool plan, cited briefing, prose answers ([07](./07-agentic-harness.md)) |
| Data | GTM CLI (`gtm`), fixture emulator fallback | Same `{ data: [{ id, attributes }] }` envelope either way |

## Success criteria

- “Brief me before a call with **Snowflake**” → `account_brief`: a cited conversational answer with one inline view.
- “Map the buying committee at **Databricks**” → `buying_committee` with people and gaps.
- Unknown company name → **not found** state; no fabricated firmographics.
- Ambiguous job → one authored clarification, retry same turn, then render.
- Paid research → one approval card with a labeled credit estimate before any data/AI credits are spent.
- Every material fact in the briefing cites an evidence id and date when the source returned one.

## Non-goals (this pass)

- ZoomInfo MCP inside the app runtime (the app shells out to the GTM CLI; MCP stays for AI clients like Cursor)
- CRM writes — recommendations are drafts only
- Persisting specs server-side beyond client localStorage for conversations
- Real Google OAuth, real Salesforce connection, server-side agent scheduling, or outbound email (always-on PoC uses simulated sources and client-triggered sweeps; see [11-always-on-agent.md](./11-always-on-agent.md))

## GTM AI setup (operators)

Install ZoomInfo GTM CLI or MCP before connecting this demo to live data. Full steps, onboarding prompt, and start-building links: **[06-setup-gtm-ai.md](./06-setup-gtm-ai.md)** · [Start Building — account research](https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research).
