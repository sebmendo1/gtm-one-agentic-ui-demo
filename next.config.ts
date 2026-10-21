import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The GTM CLI is spawned, not imported, and the grounding docs are read at runtime, so tracing can't
  // see either. The CLI's dist is a single self-contained file.
  outputFileTracingIncludes: {
    "/api/generate": [
      "./node_modules/@zoominfo/gtm-ai-cli/package.json",
      "./node_modules/@zoominfo/gtm-ai-cli/dist/index.js",
      "./docs/specs/06-setup-gtm-ai.md",
      "./docs/specs/08-zoominfo-gtm-platform.md",
      "./docs/external-sources/zoominfo-gtm-ai-knowledge-base.md",
    ],
  },
};

export default nextConfig;
