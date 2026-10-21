---
title: "Agent readiness: Markdown, llms.txt and machine-readable identity"
description: "How the public site serves AI agents: Markdown content negotiation, Markdown 404s, llms.txt, sitemap, robots, structured data and metadata."
tags:
  - spec
  - agents
  - seo
  - markdown
status: active
sources:
  - ../external-sources/is-agentic-report-2026-10-21.md
  - ../external-sources/acceptmarkdown-content-negotiation.md
  - ../external-sources/llms-txt-v2.md
updated: 2026-10-21
---
# Agent readiness

This spec defines what the deployed site (`https://gtm-one-agentic-ui-demo.vercel.app`) returns to AI agents and crawlers. It answers the [Is Agentic report](../external-sources/is-agentic-report-2026-10-21.md), which scored the site 63/100. Negotiation follows [acceptmarkdown.com](../external-sources/acceptmarkdown-content-negotiation.md) and the agent files follow [llms.txt v2](../external-sources/llms-txt-v2.md). The chat product itself is unchanged; see the [product spec](./00-product.md).

One module, `src/lib/site.ts`, holds the site name, URL, description, the Markdown documents and the JSON-LD, so every surface says the same thing.

## A1. Markdown content negotiation

`src/proxy.ts` negotiates every page path. API routes, Next internals and file paths (anything with a dot in the last segment) are skipped, except `/index.md`.

1. It parses `Accept` as the recipe does: most specific matching range per type, `q=0` rejects, highest q wins, ties go to client order. A missing header, or one that matches nothing but HTML, gets HTML.
2. `/` with Markdown preferred returns `200`, `Content-Type: text/markdown; charset=utf-8`, `Vary: Accept`, and the product overview.
3. `/index.md` always returns the same overview, whatever `Accept` says ([llms.txt v2](../external-sources/llms-txt-v2.md) puts a root page's Markdown at `index.md`).
4. If the client accepts neither type, for example `Accept: application/pdf`, the response is `406` in plain text listing `text/html` and `text/markdown`, with `Vary: Accept` and `Cache-Control: no-store`.
5. Otherwise the HTML page renders as before, with `Accept` appended to Next's `Vary` header.
6. Markdown and HTML responses for `/` carry `Link: </index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"`.

## A2. Agent-friendly 404s

An unknown page path keeps its `404` status. When Markdown is preferred, the body is Markdown that says the page doesn't exist and links to the home page, `/index.md`, `/llms.txt` and `/sitemap.xml`. Browsers still get the normal Next.js 404 page.

The known page paths are listed in `src/lib/site.ts`. A new page must be added there, or Markdown clients will get a 404 for it.

## A3. llms.txt and when-to-use guidance

`/llms.txt` is served from a route handler as `text/plain; charset=utf-8`, in the v2 order: H1 name, blockquote summary, prose with no headings, then H2 link lists. The prose includes **When to use GTM AI Chat** and **When not to use it**: it's a demo of agentic generative UI for ZoomInfo GTM research on demo data, it has no public API, and real ZoomInfo data comes from GTM AI itself. The link lists cover the Markdown overview, the specs (raw Markdown on GitHub), developer resources (source code, GTM CLI reference, ZoomInfo MCP docs), and an Optional section.

## A4. Sitemap and robots

`/sitemap.xml` lists the indexable pages with `lastmod`. `/robots.txt` allows all crawlers, disallows `/api/`, and points to the sitemap.

## A5. Structured data and metadata

The root layout renders one JSON-LD `@graph` with a `WebSite` and a `SoftwareApplication`: name, description, url, `applicationCategory`, `operatingSystem`, a free `Offer`, and `sameAs` the GitHub repository. `<` is escaped as `\u003c`.

The page head has a canonical URL, `og:type` `website`, `og:url`, `og:site_name`, a generated 1200×630 `og:image` in Figtree on the GTM tokens, a large-image Twitter card, and a `text/markdown` alternate link. The page title names the product and what it does: "GTM AI Chat — agentic account research on ZoomInfo GTM AI".

## A6. Verification

`npm run test:agents` runs `scripts/agent-readiness.ts`. It unit-tests Accept parsing, the proxy's responses, the llms.txt format and the JSON-LD. With `BASE_URL` set, it also checks every public endpoint over HTTP: both representations of `/`, `/index.md`, a Markdown 404, a 406, `/llms.txt`, `/sitemap.xml`, `/robots.txt`, the Open Graph image, and the homepage's JSON-LD and meta tags.

## Not covered yet

These report checks need information or decisions that only the owner can give:

- **Organization schema**: needs a real contact email or phone and a postal address.
- **Trust pages**: `/about`, `/contact` and `/privacy` need real owner, contact and data-handling text. The privacy page is a legal statement.
- **MCP server**: exposing the chat as MCP tools would make `/api/generate` a public API, which spec 09's same-origin rule (G7) currently blocks.
- **Search ranking**: the brand and developer-resource checks depend on search indexing and links from other sites. This spec only covers the on-page parts (titles, llms.txt links).

## Related

- [Guardrails](./09-guardrails.md): the request guard on `/api/generate`, which agent negotiation doesn't touch.
- [Design system](./02-design-system.md): the fonts and tokens used for the Open Graph image.
