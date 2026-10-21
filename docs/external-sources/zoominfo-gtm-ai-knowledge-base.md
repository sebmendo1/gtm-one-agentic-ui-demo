---
title: ZoomInfo and GTM AI Knowledge Base
description: "ZoomInfo is a B2B data company whose data now feeds two things: its own GTM apps, and outside AI agents through GTM AI."
type: source
provenance: Pasted into chat by @Sebastian on 2026-10-20; compiled from the web sources listed in its Sources section
media_type: text/plain
date_fetched: 2026-10-20
author: "@Sebastian"
preservation: text-extracted
tags:
  - source
  - immutable
  - layer-ingest
  - text
  - zoominfo
  - gtm-ai
---
> [!NOTE]
> Preserved verbatim from the chat paste. The paste arrived with its tables flattened to one cell per line; only the table layout was restored. Wording is unchanged. Link targets for the inline source names did not survive the paste.

# ZoomInfo and GTM AI Knowledge Base

Oct 20, 2026 · @Sebastian

## At a glance

ZoomInfo is a B2B data company whose data now feeds two things: its own GTM apps, and outside AI agents through GTM AI.

GTM AI is the left column. It merges your data with ZoomInfo's in the Context Graph and runs research through Context Agents. It then serves the answers over MCP, a CLI or a REST API. ZoomInfo's own apps draw on the same data.

## ZoomInfo

ZoomInfo sells B2B company and contact data, plus the tools that act on it, to sales, marketing, ops and recruiting teams. It calls itself a Go-To-Market Intelligence Platform: one system that combines first- and third-party data, AI, buying signals, orchestration and execution (ZoomInfo blog).

| Fact | Detail |
| --- | --- |
| Customers | 35,000+ companies (Why ZoomInfo) |
| Employees | About 3,500, as of May 2025 (Business Wire) |
| Headquarters | Vancouver, Washington |
| CEO | Henry Schuck |
| Ticker | Nasdaq: GTM since May 13, 2025 (previously ZI) |
| Positioning | "The first dedicated platform for GTM", compared to Workday for HR and ServiceNow for IT |

### Products, as ZoomInfo lists them today

| Product | What it does |
| --- | --- |
| Sales | Company and contact database for prospecting |
| Marketing | Account-based marketing: targeting, activation, measurement |
| Operations | Lead routing and data quality |
| Data as a Service (DaaS) | ZoomInfo data piped into your own systems |
| Talent | Recruiting data; Talent Autopilot is its AI recruiting agent |
| Copilot | AI sales agent that uses signals to pick accounts and draft outreach |
| GTM Workspace | AI workspace for go-to-market teams |
| GTM Studio | Builds and runs workflows triggered by buying signals |
| ZoomInfo MCP | Connects AI tools to ZoomInfo data |
| API, ZoomInfo in ChatGPT | Programmatic and in-assistant access |

The current site no longer uses the older SalesOS and MarketingOS names. Solutions are grouped as Intelligence (search, intent, website visitors), Engagement (sales automation, conversation intelligence, chat, forms, ads) and Orchestration (workflows, CRM enrichment, predictive models, data management).

## The GTM platform

"GTM" is now ZoomInfo's umbrella brand. It's the stock ticker, the platform name, and the prefix on its newest products. I found no product called "GTM One". This section covers the GTM-branded pieces; tell me if you meant something else.

| Piece | Role | Who uses it |
| --- | --- | --- |
| GTM Intelligence Platform | The whole system: data, AI, signals, orchestration, execution | Everyone; it's the frame |
| GTM Studio | Workspace to design, enrich and launch GTM plays from buying signals. Launched May 2025 | RevOps, marketing ops |
| GTM Workspace | AI workspace for day-to-day GTM work | Sellers, marketers |
| GTM AI (gtm.ai) | Developer platform that serves ZoomInfo data and context to AI agents | GTM and AI engineers |

**How they connect.** ZoomInfo's data feeds every product. GTM Studio turns signals into workflows, and Copilot turns them into seller actions. GTM AI exposes the same data to agents built outside ZoomInfo's apps, such as Claude, ChatGPT, Cursor or your own code. Signing up on gtm.ai lands you in GTM Studio's connector setup, so the developer platform and Studio share one account.

## GTM AI

GTM AI is ZoomInfo's developer platform for AI agents. It combines ZoomInfo's company, contact and signal data with your CRM, calls and playbooks, and serves the result to any agent through one API (gtm.ai).

### Ways in

| Surface | Use it for | Docs |
| --- | --- | --- |
| MCP | Call ZoomInfo tools from an agent (Claude, ChatGPT, Cursor, Codex, Gemini, Perplexity, Vertex AI, Amazon Quick and others) | MCP docs |
| CLI | Research and enrich from a terminal or script | CLI docs |
| REST API | Build context into your own application | API reference |
| Claude Code plugin | One-line install: `claude plugin install zoominfo@claude-plugins-official` | Start building |

All three share one data foundation, so an answer from the CLI matches one from MCP.

The Context Graph is the engine underneath. It merges ZoomInfo data with your connected sources and keeps the links current as new evidence arrives:

1. **Unified profile.** CRM, marketing and warehouse records for one company resolve to a single company ID.
2. **Linking and hierarchy.** Parents, subsidiaries, sites and rebrands stay connected.
3. **Contact to company.** After a job change, the person moves to the new employer, and their past activity stays with the old account.
4. **Activity intelligence.** Calls, emails and meetings are joined with buying intent and website visits per account.

Context Agents do research for your agent and hand back interpreted answers (tool docs):

| Agent | Answers |
| --- | --- |
| Account Research | Company intelligence, deal history and recent changes, as a briefing |
| Contact Research | Who the buyer is and how the relationship has developed |
| Conversation Intelligence | Requirements, objections, commitments and next steps across calls |
| Signals | Intent, news and business events per account, newest first |
| Web Research | Current web findings per account, via audience AI columns |
| Business Context | Your offerings, personas, ICPs and positioning; admins turn briefs and battlecards into reusable context |

Skills package a repeatable job on top of those agents: what to research, which tools to call, and what to deliver. The published set covers Account Health, Decision Process Mapper, Commitment Ledger, Next Best Action, Account Research and Build List (Marketplace).

**Benchmark claim.** In ZoomInfo's GTM Bench v1, which ran 10 research tasks on Claude Opus 4.8, the ZoomInfo CLI used 24× fewer work tokens than Claude with web search (460K vs. 11.1M). It also cost 32% less than the next-cheapest option ($10.12 vs. $14.78). This is a vendor-run test (GTM Bench).

Other tools on the site: Playground (try company and contact tools), Framework (plan a GTM AI workflow), Release Hub (changelog), Guides, and an llms.txt for agents.

## Data foundation

ZoomInfo reports 100M+ companies, 500M+ contacts and 1.5B+ data points processed daily (gtm.ai). What an agent can reach follows your ZoomInfo entitlements; customer history follows your connected sources and their permissions.

| Data type | Includes |
| --- | --- |
| Companies | Name, domain, industry, revenue, headcount, locations, funding, investors |
| Contacts | Role, department, seniority, email, direct dial, mobile, career history, job changes |
| Company relationships | Parents, subsidiaries, branches, sites, ownership, rebrands |
| Technographics | Installed technologies, software categories, vendors |
| Buying intent | 5,000+ research topics, activity surges, signal scores, relevance, recency |
| News and Scoops | Leadership moves, hiring, funding, M&A, IPOs, earnings, expansions, launches, partnerships, layoffs, stated pain points |
| Your customer context | CRM accounts, contacts, opportunities and stages, plus calls, meetings and emails |

Specialty data sets (12), with record counts as published:

| Data set | Records |
| --- | --- |
| UCC Filings | 15,000,000+ |
| US Commercial Fleet | 3,000,000+ |
| National Insurance Producers | 2,500,000+ |
| US Restaurants | 1,100,000+ |
| Licensed Professional Contractors | 900,000+ |
| Form 5500 Filings | 800,000+ |
| US Franchises | 500,000+ |
| US Franchise Owners | 450,000+ |
| US Franchisees | 300,000+ |
| US Commercial Real Estate Agents | 200,000+ |
| Managed Service Providers | 90,000+ |
| ZoomInfo Intent Data | 5,000+ topics |

## Pricing and access

GTM AI runs on two credit types. Every new account starts with 1,000 data credits and 1,000 AI credits, with no credit card required (gtm.ai).

- Data credits most likely pay for ZoomInfo records (enrichment and lookups), and AI credits for Context Agent and skill runs. This is inferred from the names; the pricing page wasn't reachable to confirm it.
- Sign-up goes through ZoomInfo's account system and lands in GTM Studio's connector setup.
- Paid plans and per-call rates: see gtm.ai/pricing. Open question: how credits map to existing ZoomInfo contracts.

## Glossary

| Term | Meaning |
| --- | --- |
| GTM | Go-to-market: the sales, marketing and revenue work of finding and winning customers. Also ZoomInfo's ticker |
| GTM Intelligence Platform | ZoomInfo's name for its whole product suite |
| GTM AI | ZoomInfo's developer platform for AI agents, at gtm.ai |
| GTM Studio | ZoomInfo workspace for building signal-triggered GTM plays and workflows |
| GTM Workspace | ZoomInfo's AI workspace for GTM teams |
| Copilot | ZoomInfo's AI sales agent |
| MCP | Model Context Protocol, the standard that lets AI apps call external tools |
| Context Graph | GTM AI's merged, continuously updated model of companies, contacts and activity |
| Context Agents | GTM AI research tools that return interpreted answers to your agent |
| Skills | Prebuilt, repeatable jobs built on Context Agents |
| Entitlements | The data your ZoomInfo contract lets you access; agents inherit them |
| Intent data | Signals that a company is researching a topic, a hint it may be buying |
| Scoops | ZoomInfo's business-event news: leadership moves, funding, expansions |
| Technographics | Data on which software and technology a company uses |
| Firmographics | Basic company attributes such as industry, size, revenue and location |
| Entity resolution | Matching records about the same company or person into one ID |
| ICP | Ideal customer profile |
| RevOps | Revenue operations: the team that runs GTM systems and data |

## Sources

- gtm.ai, homepage, read October 20, 2026
- Why ZoomInfo
- ZoomInfo ticker change from ZI to GTM, ZoomInfo blog
- ZoomInfo launches GTM Studio and new ticker, Business Wire, May 12, 2025

Not reachable this session: gtm.ai/pricing, gtm.ai/framework and gtm.ai/llms.txt. They're the next pages to read to confirm credit details and fill out the tool list.
