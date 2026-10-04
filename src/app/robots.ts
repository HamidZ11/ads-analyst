import type { MetadataRoute } from "next";
import { robotsFor } from "@/features/marketing/seo";
import { publicOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return robotsFor(publicOrigin());
}
