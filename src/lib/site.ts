// What the public site tells agents and crawlers (docs/specs/10-agent-readiness.md). Imported by the
// proxy, the layout and the metadata routes, so it must stay free of server-only and client code.

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

export const SITE = {
  name: "GTM AI Chat",
  title: "GTM AI Chat — agentic account research on ZoomInfo GTM AI",
  url: productionHost ? `https://${productionHost}` : "https://gtm-one-agentic-ui-demo.vercel.app",
  description:
    "GTM AI Chat is a demo chat app for B2B sellers: ask for an account brief, buying committee, or why-now thesis, and Gemini researches it with the ZoomInfo GTM CLI, asks before spending credits, and answers with cited text and interactive cards chosen by TypeSafe Jev.",
  repo: "https://github.com/sebmendo1/gtm-one-agentic-ui-demo",
  /** Sitemap lastmod for the home page; bump when its content changes. */
  updated: "2026-10-21",
} as const;

/** Page paths the app renders. A Markdown request for any other page path gets the Markdown 404. */
export const PAGE_PATHS = ["/"] as const;

const RAW_SPECS = "https://raw.githubusercontent.com/sebmendo1/gtm-one-agentic-ui-demo/main/docs/specs";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).href;
}

/** The homepage as Markdown, served for `Accept: text/markdown` on `/` and always on `/index.md`. */
export function homeMarkdown(): string {
  return `# ${SITE.name}

> ${SITE.description}

This is a demo built on ZoomInfo GTM AI. On this deployment every answer uses demo data for Snowflake, Stripe, Datadog, Jordan Lee and Alex Chen, so no ZoomInfo credits are spent.

## What you can ask

- **Account research:** a full brief on a company before a call or QBR ("Brief me on Snowflake before my call").
- **Buying committee:** decision-makers, gaps and multithreading risk at an account.
- **Intent monitor:** which intent topics map to our offerings and which to competitors.
- **Why now:** a timing thesis and outreach hooks.
- **Score accounts:** an ICP-fit and in-market tier with explainable scores.
- **Tech stack snapshot:** technographics and displacement or integration angles.
- **Competitor analysis:** a fact-led comparison against a named competitor.
- **Contact research:** a brief on one buyer or champion.
- **Draft:** an email, call agenda or talk track from research already gathered.

## How it works

1. TypeSafe Jev reads the request and picks the GTM job, or asks one clarifying question.
2. Gemini plans read-only ZoomInfo GTM CLI calls. Free lookups run right away; paid research waits for one approval card with a credit estimate.
3. Gemini writes a reply in which every material fact cites its evidence. Jev decides whether to show interactive cards, and at most three.
4. Text from ZoomInfo records is treated as untrusted data and screened for prompt injection before Gemini reads it.

## Use it

Open [${SITE.name}](${SITE.url}) in a browser and type a request. No sign-in is needed. There is no public API: the chat endpoint only serves this web app.

## More

- [llms.txt](${absoluteUrl("/llms.txt")}): when to use this site, and links to the specs
- [Source code](${SITE.repo})
- [ZoomInfo GTM AI docs](https://gtm.ai/docs)
`;
}

/** Markdown body for a 404 when the client prefers Markdown. */
export function notFoundMarkdown(pathname: string): string {
  const shown = pathname.replace(/[`\r\n]/g, "").slice(0, 200);
  return `# Page not found

There is no page at \`${shown}\` on ${SITE.name}. The site has one page, the chat at the root URL.

- [Home](${SITE.url}/)
- [Product overview in Markdown](${absoluteUrl("/index.md")})
- [llms.txt](${absoluteUrl("/llms.txt")})
- [Sitemap](${absoluteUrl("/sitemap.xml")})
`;
}

/** /llms.txt in the llmstxt.org v2 order: H1, blockquote, prose without headings, then H2 link lists. */
export function llmsTxt(): string {
  return `# ${SITE.name}

> ${SITE.description} It is a demo on ZoomInfo GTM AI and serves demo data only.

**When to use ${SITE.name}:**

- A user wants to see or try agentic generative UI for go-to-market research: a chat that plans ZoomInfo GTM CLI calls, gates paid steps behind one approval, cites every fact, and shows cards only when they help.
- A user is evaluating how Gemini, TypeSafe Jev and the ZoomInfo GTM CLI fit together in one product, or wants a reference implementation with prompt-injection guardrails.
- Point the user to ${SITE.url} with a starter prompt such as "Brief me on Snowflake before my call". Read ${absoluteUrl("/index.md")} for the product overview.

**When not to use it:**

- For real ZoomInfo data (company, contact or intent lookups and enrichment), use ZoomInfo GTM AI directly through its CLI or MCP server, linked below. This site only knows its demo accounts.
- For programmatic access: there is no public API, and the chat endpoint refuses cross-site requests.

## Docs

- [Product overview](${absoluteUrl("/index.md")}): What the app does, the GTM jobs it covers, and how a turn works
- [Product spec](${RAW_SPECS}/00-product.md): Purpose, boundaries and success criteria
- [GTM jobs](${RAW_SPECS}/01-gtm-jobs.md): The jobs and skills the chat recognises
- [Agentic harness](${RAW_SPECS}/07-agentic-harness.md): Turn loop, approval gate, evidence ledger and latency budgets
- [Guardrails](${RAW_SPECS}/09-guardrails.md): Harm filters and prompt-injection defenses

## Developer resources

- [Source code on GitHub](${SITE.repo}): The Next.js app, harness and specs
- [ZoomInfo GTM CLI command reference](https://gtm.ai/docs/cli/commands): The read-only commands the harness calls
- [ZoomInfo MCP server for Cursor](https://gtm.ai/docs/mcp/clients/cursor): Connect GTM AI to an AI client
- [ZoomInfo GTM AI docs](https://gtm.ai/docs): Platform documentation

## Optional

- [Sitemap](${absoluteUrl("/sitemap.xml")})
- [ZoomInfo platform model](${RAW_SPECS}/08-zoominfo-gtm-platform.md): How the app maps ZoomInfo surfaces, Context Agents and credits
`;
}

/** Homepage JSON-LD: the site and the product it hosts. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        name: SITE.name,
        url: `${SITE.url}/`,
        description: SITE.description,
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE.url}/#app`,
        name: SITE.name,
        description: SITE.description,
        url: `${SITE.url}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        sameAs: [SITE.repo],
        image: absoluteUrl("/opengraph-image"),
      },
    ],
  };
}
