# GTM AI — Install & connect (canonical)

Source: [Start Building — GTM CLI + Account research](https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research) and [GTM AI docs](https://gtm.ai/docs).

## What you get (free signup)

- **1,000 Data Credits** (one-time) — enrichment, audience rows
- **1,000 AI Credits** (one-time) — Account Research, Contact Research, Conversation Intelligence, Audience Analysis
- **Unlimited API** (free tier) — search and lookup tools per [tool catalog](https://gtm.ai/docs/mcp/tools)

Tagline on the start flow: *Pick your tool. Pick your job. Ship.* — connect ZoomInfo intelligence with CRM and customer conversations; start with one account briefing.

## Paths to connect

| Path | When to use | Docs |
|------|-------------|------|
| **GTM CLI** | Terminal, scripts, CI | [GTM CLI](https://gtm.ai/docs/cli) |
| **ZoomInfo MCP** | Claude, ChatGPT, **Cursor**, Codex, Copilot, etc. | [MCP overview](https://gtm.ai/docs/mcp) · [Cursor client](https://gtm.ai/docs/mcp/clients/cursor) |
| **REST API** | Your own app | [API catalog](https://gtm.ai/.well-known/api-catalog.json) |

This app uses demo **fixtures** until the GTM CLI is signed in, then calls the same tool shapes documented on gtm.ai.

---

## 1. Install & authenticate (GTM CLI)

**This app ships with the GTM CLI.** `@zoominfo/gtm-ai-cli` (pinned at 2.2.0) is a regular dependency, so `npm install` provides it. The harness runs it with the server's Node, and `next.config.ts` traces its single-file `dist/index.js` into the production build. Nothing has to be installed globally. Sign in once from the project folder:

```bash
npm run gtm -- auth login     # browser OAuth; saves ~/.config/gtm-ai/credentials
npm run gtm -- auth whoami    # check
```

The CLI keeps credentials in `~/.config/gtm-ai/` under the home directory of the user running the server; it has no API-key environment variable. A deployed server therefore needs that credentials directory to exist for its user. Without it, `GTM_DATA_SOURCE=auto` uses demo fixtures, and `cli` reports every call as `unauthorized`. `GTM_CLI_BIN` overrides the bundled copy, for example with a Homebrew install.

To use the CLI outside this app, from [Start Building — CLI](https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research):

```bash
# macOS / Linux — Homebrew
brew install zoominfo/gtm-ai/gtm-ai-cli

# Windows / Node — npm
npm install -g @zoominfo/gtm-ai-cli
```

Then:

1. Run `gtm auth login` — browser opens for ZoomInfo OAuth (no API keys to manage).
2. Run research commands and pipe to `jq`, CSV, or your pipeline.

New to ZoomInfo? Create a free account from the start-building page.

Full reference: [GTM CLI guide](https://gtm.ai/docs/cli) · [command reference](https://gtm.ai/docs/cli/commands).

**Other “How are you building?” options** on start-building (same data, different client): Claude Code, Codex, **Cursor** (MCP), Gemini CLI, Python, JavaScript, cURL — see [Integrations](https://gtm.ai/integrations).

---

## 2. Set up ZoomInfo MCP (Cursor and other agents)

- **Cursor:** follow [Connect ZoomInfo MCP to Cursor](https://gtm.ai/docs/mcp/clients/cursor) (OAuth via MCP bridge).
- **Other clients:** [Clients index](https://gtm.ai/docs/mcp/clients) (Claude Code, Codex, ChatGPT, Gemini, Copilot, …).

Hosted MCP server: `https://mcp.zoominfo.com/mcp` (Streamable HTTP + OAuth). See [MCP tools](https://gtm.ai/docs/mcp/tools).

---

## 3. Onboarding prompt (paste into your AI client)

Use after connecting MCP or CLI. This is the **account research** job template from start-building:

```
(Use the ZoomInfo MCP tools if available; otherwise use the GTM CLI. Use the tool schema or CLI help for supported commands.)

I just connected ZoomInfo. Help me complete the job below.

1. Read my saved business context with get_gtm_context, or the CLI equivalent. This read is free. Use the returned offerings, ICP, and role to frame the work. If context is missing, continue with the information we have. Save changes only if I explicitly ask; a first briefing does not require updating shared business context.

2. I selected this job: research a target account. Ask for the company name or domain only if needed. Expected result: a connected briefing with CRM stage and status, customer commitments and unresolved requirements, recent buying signals, and one next action backed by dated evidence. Connect the account's available CRM history, including stage and status, with recent customer conversations and external buying signals. Use Account Research, and add Browse Engagements, Conversation Intelligence, or company signals when the briefing needs more evidence.
   Return a short briefing: where things stand, what changed, what remains unresolved, and one recommended next action. Cite the source and date for each material fact when returned. Distinguish the recommendation from the evidence.

3. Before calling a tool, check its schema or documented inputs rather than guessing at parameters. Ask only for missing inputs, in a single message, then name the tools and give a credit estimate if supported by their documentation. Label it as an estimate: actual charges depend on records and work done. Ask for approval once before paid research, then complete the selected job.

If a tool call comes back "No approval received" or a similar permission response, say so plainly, name the tool, and continue with the remaining steps. Don't retry the same call hoping for a different result, and don't invent an approval that didn't happen.

Include a source-coverage note of no more than 3 lines. Separate an unavailable or unauthorized source from a successful search with no matching records. If connection status is unknown, say so. Never infer "no customer history" from an empty result. Continue with available evidence and identify what is missing; use https://gtm.ai/guides/connect-customer-context for source setup.

Recommend CRM changes as drafts. Applying them requires an available, separately connected CRM workflow and my authorization. Do not claim a CRM update was made by ZoomInfo research tools.
```

**This demo’s equivalent:** the user prompt names the job in natural language; Jev classifies `GtmJob`; the reply is a cited conversational answer from GTM CLI (or fixture) evidence, and Jev decides whether to show views beside it, usually one ([03](./03-genui-components.md), [04](./04-jev-decisions.md)).

---

## 4. Job picker on start-building

Use cases shown on the start page (map to `GtmJob` in spec 01):

| Start-building use case | Demo `GtmJob` |
|-------------------------|---------------|
| Account research | `account_brief` |
| Intent monitoring | `intent_monitor` |
| Lead enrichment | (future: enrich flow) |
| Company search | (future: search results UI) |
| ICP targeting | `gtm_context` / `score_accounts` |

Deep links pattern: `https://gtm.ai/start-building?tool=gtm-cli&useCase=<useCase>`.

---

## 5. Customer context

CRM and conversation history require org-connected sources: [Connect customer context](https://gtm.ai/guides/connect-customer-context).

GenUI sections that expect CRM (`account_brief` engagements) should show **source unavailable** when not connected — same rule as the onboarding prompt (never infer empty history from a failed source).
