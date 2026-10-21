import { NextResponse, type NextRequest } from "next/server";
import { appendVaryAccept, preferredType } from "@/lib/negotiate";
import { PAGE_PATHS, homeMarkdown, notFoundMarkdown } from "@/lib/site";

// Markdown content negotiation for agents (docs/specs/10-agent-readiness.md A1, A2).

const HOME_LINKS = '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"';

function markdown(body: string, status: number, link: string | null): Response {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    Vary: "Accept",
    "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
  });
  if (link) headers.set("Link", link);
  return new Response(body, { status, headers });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/index.md") return markdown(homeMarkdown(), 200, '</llms.txt>; rel="describedby"');
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

  const isPage = (PAGE_PATHS as readonly string[]).includes(pathname);
  const accept = request.headers.get("accept");
  const chosen = preferredType(accept);

  if (chosen === "text/markdown") {
    return isPage ? markdown(homeMarkdown(), 200, HOME_LINKS) : markdown(notFoundMarkdown(pathname), 404, null);
  }
  if (chosen === null && isPage) {
    return new Response(`Not Acceptable\n\nThis page is available as:\n- text/html\n- text/markdown\n\nYou requested: ${accept?.slice(0, 200)}\n`, {
      status: 406,
      headers: { "Content-Type": "text/plain; charset=utf-8", Vary: "Accept", "Cache-Control": "no-store" },
    });
  }
  const response = NextResponse.next();
  appendVaryAccept(response.headers);
  if (isPage) response.headers.set("Link", HOME_LINKS);
  return response;
}

export const config = {
  // Pages and unknown page paths; not API routes, Next internals, metadata images, or files.
  matcher: ["/((?!api/|_next/|_vercel/|opengraph-image|twitter-image|icon|apple-icon|.*\\.[^/]*$).*)", "/index.md"],
};
