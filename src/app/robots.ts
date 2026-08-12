import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/api/",
        "/sign-in",
        "/sign-up",
        "/customer-portal",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
