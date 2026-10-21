---
title: The /llms.txt file, v2
description: Jeremy Howard's proposal for an /llms.txt Markdown file and .md page variants that help agents use a website.
type: source
source_url: https://llmstxt.org/
media_type: text/html
date_fetched: 2026-10-21
date_updated: 2026-08-10
author: Jeremy Howard
preservation: text-extracted
tags:
  - source
  - immutable
  - layer-ingest
  - text
  - agents
  - llms-txt
---
# The /llms.txt file, v2

Extracted from <https://llmstxt.org/> on 2026-10-21.

## Proposal

Sites add a `/llms.txt` Markdown file with brief background, guidance and links to detailed Markdown files. Pages agents might need should offer a clean Markdown version at the same URL with `.md` appended or the extension replaced; URLs without a file name append `index.html.md` or `index.md`.

Clients find these through standard link relations: `rel="alternate" type="text/markdown"` points to a page's Markdown version, and `rel="describedby"` points to the llms.txt that covers it. They can be HTML link elements or an HTTP `Link` header, for example:

```
Link: </docs/page.html.md>; rel="alternate"; type="text/markdown", </docs/llms.txt>; rel="describedby"
```

## Format

A file following the spec contains these sections, in order:

1. An optional byte-order mark.
2. An H1 with the name of the project or site. This is the only required section.
3. A blockquote with a short summary containing the key information needed to understand the rest of the file.
4. Zero or more Markdown sections of any type except headings, with more detail about the project and how to interpret the files.
5. Zero or more sections delimited by H2 headers, each a "file list": a Markdown list where every item has a required `[name](url)` hyperlink, optionally followed by `:` and notes.

By convention an H2 named "Optional" holds secondary links an agent can skip when it needs a shorter context. Links should point to LLM-friendly content such as Markdown versions of pages.
