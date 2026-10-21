---
title: "Accept: text/markdown — content negotiation for AI agents"
description: "acceptmarkdown.com rules for serving Markdown from the same URL as HTML: Vary, q-values, 406, caching, and the Next.js recipe."
type: source
source_url: https://acceptmarkdown.com/recipes/nextjs
media_type: text/markdown
date_fetched: 2026-10-21
author: acceptmarkdown.com
preservation: text-extracted
tags:
  - source
  - immutable
  - layer-ingest
  - text
  - agents
  - markdown
  - http
---
# Accept: text/markdown

Extracted from <https://acceptmarkdown.com/>, its guides (`/guides/returning-406`, `/guides/caching-cdn`) and the Next.js recipe (`/recipes/nextjs`), fetched as Markdown on 2026-10-21.

## Readiness checks

The site's readiness check scores a URL against four checks: it serves Markdown for `Accept: text/markdown`, sets `Vary: Accept`, rejects unsupported types with `406`, and honors q-values. A correct Markdown response carries `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept`.

## Parsing Accept (Next.js recipe)

- The server produces `text/html` (default, listed first) and `text/markdown`.
- A missing or empty `Accept` header means the default, `text/html`.
- For each candidate type, the most specific matching range wins (exact type over `type/*` over `*/*`), regardless of q, per RFC 9110 §12.5.1. So `text/html;q=0, */*;q=1` rejects HTML.
- A matched `q=0` is an explicit rejection.
- Across candidates the highest q wins; ties go to the client's order, so `text/markdown, text/html, */*` picks Markdown.
- If no candidate is acceptable and an `Accept` header was sent, respond `406` with `Content-Type: text/plain; charset=utf-8`, `Vary: Accept`, and a body listing the available types.
- Append `Accept` to any existing `Vary` value instead of replacing it, on both the Markdown and the HTML branch.
- The recipe's matcher skips `api/`, `_next/` and `_vercel/`. An explicit `.md` URL always returns Markdown regardless of `Accept`, because crawlers following `rel="alternate"` may send no `Accept` header.

## Returning 406

Return `406` only when every representation has no match or a `q=0` match, for example `Accept: application/pdf` on an HTML-and-Markdown resource. Do not return it for a missing `Accept`, for `*/*`, or when one representation matches. The body should list the available representations. Don't cache a 406 aggressively: use `Vary: Accept` or `Cache-Control: no-store`.

## Caching

`Vary: Accept` is required so shared caches don't serve one representation to the other audience. On Vercel, the edge cache honors `Vary: Accept` on `s-maxage` responses and caches both variants separately.
