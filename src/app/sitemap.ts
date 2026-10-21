import type { MetadataRoute } from "next";
import { PAGE_PATHS, SITE, absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGE_PATHS.map((path) => ({
    url: absoluteUrl(path),
    lastModified: SITE.updated,
    changeFrequency: "weekly",
    priority: 1,
  }));
}
