/**
 * Agent-readiness checks (docs/specs/10-agent-readiness.md A6).
 *   npm run test:agents                                 # unit checks
 *   BASE_URL=http://localhost:3000 npm run test:agents  # plus every public endpoint over HTTP
 */
import { NextRequest } from "next/server";
import { appendVaryAccept, preferredType } from "../src/lib/negotiate";
import { proxy } from "../src/proxy";
import { PAGE_PATHS, SITE, homeMarkdown, llmsTxt, notFoundMarkdown, siteJsonLd } from "../src/lib/site";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const MD = "text/markdown; charset=utf-8";
const varies = (res: Response) => (res.headers.get("vary") ?? "").split(",").some((t) => t.trim().toLowerCase() === "accept");

function negotiation() {
  const cases: [string | null, ReturnType<typeof preferredType>][] = [
    [null, "text/html"],
    ["", "text/html"],
    ["*/*", "text/html"],
    ["text/html", "text/html"],
    ["text/markdown", "text/markdown"],
    ["text/markdown, text/html, */*", "text/markdown"],
    ["text/html, text/markdown", "text/html"],
    ["text/markdown;q=0.5, text/html", "text/html"],
    ["text/html;q=0.5, text/markdown;q=0.9", "text/markdown"],
    ["text/html;q=0, */*", "text/markdown"],
    ["text/*", "text/html"],
    ["text/markdown;q=0, text/html;q=0", null],
    ["application/pdf", null],
    ["text/markdown;q=0", null],
    ["TEXT/MARKDOWN", "text/markdown"],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "text/html"],
  ];
  for (const [accept, want] of cases) {
    const got = preferredType(accept);
    check(`Accept ${JSON.stringify(accept)} → ${want}`, got === want, got ?? "406");
  }
  const h = new Headers({ Vary: "rsc, next-router-state-tree" });
  appendVaryAccept(h);
  appendVaryAccept(h);
  check("Vary keeps Next's values and adds Accept once", h.get("vary") === "rsc, next-router-state-tree, Accept", h.get("vary") ?? "");
}

async function proxyResponses() {
  const call = (path: string, accept?: string, method = "GET") =>
    proxy(new NextRequest(`${SITE.url}${path}`, { method, headers: accept ? { accept } : {} }));

  const md = call("/", "text/markdown");
  check("/ with Accept: text/markdown is Markdown with Vary: Accept", md.status === 200 && md.headers.get("content-type") === MD && varies(md));
  check("the Markdown homepage is the product overview", (await md.text()) === homeMarkdown());
  check("/ advertises its Markdown and llms.txt via Link", (md.headers.get("link") ?? "").includes('rel="describedby"'));

  const html = call("/", "text/html");
  check("/ with Accept: text/html passes through to the page with Vary: Accept", html.headers.get("x-middleware-next") === "1" && varies(html));
  check("/ with no Accept header passes through to the page", call("/").headers.get("x-middleware-next") === "1");

  const unacceptable = call("/", "application/pdf");
  const body = await unacceptable.text();
  check("/ with Accept: application/pdf is 406 listing both types", unacceptable.status === 406 && body.includes("text/html") && body.includes("text/markdown") && varies(unacceptable));

  const missing = call("/__probe-missing", "text/markdown");
  const missingBody = await missing.text();
  check("an unknown path with Accept: text/markdown is a Markdown 404", missing.status === 404 && missing.headers.get("content-type") === MD);
  check("the Markdown 404 explains itself and links llms.txt", missingBody.length >= 20 && missingBody.includes("/llms.txt") && missingBody.includes("/sitemap.xml"));
  check("an unknown path in a browser falls through to the HTML 404", call("/__probe-missing", "text/html").headers.get("x-middleware-next") === "1");

  const index = call("/index.md");
  check("/index.md is Markdown with no Accept header", index.status === 200 && index.headers.get("content-type") === MD);
  check("POST is never negotiated", call("/", "text/markdown", "POST").headers.get("x-middleware-next") === "1");
  check("the 404 body can't break out of its code span", !notFoundMarkdown("/a`b\nc").includes("`b\n"));
}

function llmsFormat() {
  const text = llmsTxt();
  const lines = text.split("\n");
  const firstH2 = lines.findIndex((l) => l.startsWith("## "));
  const preamble = lines.slice(1, firstH2);
  check("llms.txt starts with the H1 site name", lines[0] === `# ${SITE.name}`);
  check("llms.txt has the blockquote summary right after the H1", lines[1] === "" && (lines[2] ?? "").startsWith("> "));
  check("llms.txt has no headings before the H2 file lists", !preamble.some((l) => /^#{1,6} /.test(l)));
  check("llms.txt includes when-to-use guidance", /when to use/i.test(preamble.join("\n")) && /when not to use/i.test(preamble.join("\n")));
  const sections = text.split(/^## /m).slice(1);
  const badItems = sections.flatMap((s) =>
    s.split("\n").slice(1).filter((l) => l.trim() && !/^- \[[^\]]+\]\((https?:\/\/[^)\s]+)\)(?::\s.+)?$/.test(l)),
  );
  check("every H2 section is a list of [name](url): notes items", sections.length >= 3 && badItems.length === 0, badItems.join(" | "));
  check("llms.txt ends with the Optional section", sections.at(-1)?.startsWith("Optional\n") ?? false);
  check("the sitemap and Markdown overview cover the same pages", PAGE_PATHS.length === 1 && homeMarkdown().startsWith(`# ${SITE.name}`));
}

function jsonLd() {
  const ld = siteJsonLd();
  const app = ld["@graph"].find((n) => n["@type"] === "SoftwareApplication") as Record<string, unknown> | undefined;
  check("JSON-LD has a SoftwareApplication", Boolean(app));
  check(
    "the SoftwareApplication has name, description, url, offers and sameAs",
    Boolean(app?.name && app.description && app.url && app.offers && Array.isArray(app.sameAs)),
  );
}

async function http(base: string) {
  // Protected Vercel previews accept the linked project's short-lived OIDC token (`vercel env run -- …`).
  const oidc = process.env.VERCEL_OIDC_TOKEN?.trim();
  const auth: Record<string, string> = oidc && base.includes(".vercel.app") ? { "x-vercel-trusted-oidc-idp-token": oidc } : {};
  const fetch = (url: URL | string, init: RequestInit = {}) => globalThis.fetch(url, { ...init, headers: { ...auth, ...(init.headers as Record<string, string>) } });
  const get = (path: string, accept?: string) => fetch(new URL(path, base), { headers: accept ? { accept } : {}, redirect: "follow" });

  const md = await get("/", "text/markdown");
  const mdBody = await md.text();
  check("HTTP / Markdown: 200 text/markdown, Vary: Accept, nonempty", md.status === 200 && md.headers.get("content-type") === MD && varies(md) && mdBody.startsWith("# "), `${md.status} ${md.headers.get("content-type")} vary=${md.headers.get("vary")}`);

  const html = await get("/", "text/html");
  const page = await html.text();
  check("HTTP / HTML: 200 text/html", html.status === 200 && (html.headers.get("content-type") ?? "").startsWith("text/html"));
  // Next overwrites Vary on prerendered pages; on Vercel the vercel.json transform appends Accept at the edge.
  if (/localhost|127\.0\.0\.1/.test(base)) {
    console.log("SKIP  HTTP / HTML Vary: Accept — added by the vercel.json edge transform, not by next start");
  } else {
    check(
      "HTTP Vary lists Accept exactly once on both representations",
      [md, html].every((r) => (r.headers.get("vary") ?? "").split(",").filter((t) => t.trim().toLowerCase() === "accept").length === 1),
      `${md.headers.get("vary")} | ${html.headers.get("vary")}`,
    );
  }
  check("HTTP / HTML still renders the chat", page.includes("What GTM decision do you need?"));
  const ld = page.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
  let parsed: { "@graph"?: { "@type": string }[] } | null = null;
  try {
    parsed = ld ? JSON.parse(ld) : null;
  } catch {
    parsed = null;
  }
  check("HTTP / has parseable SoftwareApplication JSON-LD", Boolean(parsed?.["@graph"]?.some((n) => n["@type"] === "SoftwareApplication")));
  for (const [label, re] of [
    ["canonical", /<link rel="canonical" href="[^"]+"/],
    ["og:type", /<meta property="og:type" content="website"/],
    ["og:image", /<meta property="og:image" content="[^"]+"/],
    ["html lang", /<html[^>]*\slang="en"/],
    ["Markdown alternate", /<link rel="alternate" type="text\/markdown" href="[^"]+"/],
  ] as const) {
    check(`HTTP / has ${label}`, re.test(page));
  }

  const missing = await get("/__ora-404-probe-test", "text/markdown");
  const missingBody = await missing.text();
  check("HTTP Markdown 404: 404 text/markdown with a link to llms.txt", missing.status === 404 && missing.headers.get("content-type") === MD && missingBody.includes("/llms.txt"), `${missing.status} ${missing.headers.get("content-type")}`);
  const missingHtml = await get("/__ora-404-probe-test", "text/html");
  check("HTTP HTML 404 stays an HTML 404", missingHtml.status === 404 && (missingHtml.headers.get("content-type") ?? "").startsWith("text/html"));

  const pdf = await get("/", "application/pdf");
  check("HTTP / with Accept: application/pdf is 406", pdf.status === 406, String(pdf.status));

  const index = await get("/index.md");
  check("HTTP /index.md is Markdown", index.status === 200 && index.headers.get("content-type") === MD);

  const llms = await get("/llms.txt");
  const llmsBody = await llms.text();
  check("HTTP /llms.txt is served as text", llms.status === 200 && (llms.headers.get("content-type") ?? "").startsWith("text/plain") && llmsBody === llmsTxt(), `${llms.status} ${llms.headers.get("content-type")}`);

  const sitemap = await get("/sitemap.xml");
  const xml = await sitemap.text();
  check("HTTP /sitemap.xml lists the home page with lastmod", sitemap.status === 200 && xml.includes("<urlset") && xml.includes(`<loc>${SITE.url}/</loc>`) && xml.includes("<lastmod>"), `${sitemap.status}`);

  const robots = await get("/robots.txt");
  const robotsBody = await robots.text();
  check("HTTP /robots.txt allows crawling and points to the sitemap", robots.status === 200 && /Allow: \//.test(robotsBody) && robotsBody.includes(`Sitemap: ${SITE.url}/sitemap.xml`));

  const ogPath = page.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const og = ogPath ? await fetch(new URL(new URL(ogPath).pathname + new URL(ogPath).search, base)) : null;
  check("HTTP og:image is a PNG", og?.status === 200 && og.headers.get("content-type") === "image/png", `${og?.status} ${og?.headers.get("content-type")}`);

  const api = await fetch(new URL("/api/generate", base), { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  check("HTTP /api/generate is untouched by negotiation (still refuses non-JSON)", api.status === 403, String(api.status));
}

async function main() {
  negotiation();
  await proxyResponses();
  llmsFormat();
  jsonLd();
  const base = process.env.BASE_URL?.trim();
  if (base) await http(base);
  console.log(failed ? `\n${failed} failed` : "\nAll agent-readiness checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
