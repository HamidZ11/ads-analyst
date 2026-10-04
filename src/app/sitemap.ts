import type { MetadataRoute } from "next";
import { sitemapFor } from "@/features/marketing/seo";
import { publicOrigin } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor(publicOrigin());
}
