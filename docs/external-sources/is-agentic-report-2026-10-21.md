---
title: Is Agentic report — gtm-one-agentic-ui-demo.vercel.app (63/100)
description: The Is Agentic agent-readiness audit of the deployed demo, scanned 2026-10-21, with each failed or partial check.
type: source
source_url: https://is-agentic.com/scan/gtm-one-agentic-ui-demo.vercel.app
media_type: application/json
date_fetched: 2026-10-21
author: Is Agentic
preservation: text-extracted
tags:
  - source
  - immutable
  - layer-ingest
  - text
  - agents
  - audit
---
# Is Agentic report — gtm-one-agentic-ui-demo.vercel.app

From `GET https://is-agentic.com/api/v1/report?url=https://gtm-one-agentic-ui-demo.vercel.app`, scanned 2026-10-21T13:16:24Z. Score 63/100: essential 56 of 80 (3 of 5 passing), recommended 5.8 of 20 (2 of 11 passing), bonus 1.

| Check | Tier | Result | Evidence and recommendation |
| --- | --- | --- | --- |
| Agent-friendly 404s | Essential | Partial | A probe path returns HTTP 404 but no Markdown body. With `Accept: text/markdown`, return a Markdown body (`Content-Type: text/markdown`) of at least 20 characters explaining the error, with a link to docs, sitemap or llms.txt. |
| Markdown content negotiation | Essential | Failed | `Accept: text/markdown` on the homepage returned `text/html`, and `Vary` lacked `Accept`. The homepage itself must return a nonempty Markdown body with `Content-Type: text/markdown` and `Vary: Accept`, and keep serving HTML for `Accept: text/html`. |
| Developer resource discoverability | Recommended | Failed | A search found no developer resources. Use predictable URLs, link them in llms.txt, and put the product name in titles and headings. |
| Brand name discoverability | Recommended | Failed | The domain was not in the top 10 for "GTM AI Chat". Describe the main product clearly in the homepage title and headings. |
| JSON-LD structured data | Recommended | Failed | No JSON-LD on the homepage. Add SoftwareApplication JSON-LD with name, description, url and fields such as offers and sameAs. |
| Agent instruction / when-to-use | Recommended | Failed | No when-to-use guidance. Add a "when to use this" section to llms.txt naming best-fit use cases and how an agent should call the site. |
| Sitemap exists | Recommended | Failed | No `/sitemap.xml`. Add a valid XML sitemap with lastmod dates. |
| Organization schema completeness | Recommended | Failed | No Organization JSON-LD with contactPoint (email or phone, contactType) and a PostalAddress. |
| Trust anchor pages | Recommended | Failed | No /about, /contact or /privacy pages with at least 500 characters each. |
| Metadata completeness | Recommended | Partial | Only `html lang` present; missing canonical link, `og:image` and `og:type`. |
| MCP server / manifest | Recommended | Partial | No live MCP handshake; add `/.well-known/mcp` and a Streamable HTTP MCP server. |
