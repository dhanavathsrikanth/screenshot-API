import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { screenshotGuides } from "@/lib/screenshot-guides";
import { comparisons } from "@/lib/comparisons";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticPages: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }> = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/docs", priority: 0.9, changeFrequency: "weekly" },
    { path: "/tools", priority: 0.8, changeFrequency: "monthly" },
    { path: "/tools/full-page", priority: 0.8, changeFrequency: "monthly" },
    { path: "/tools/pdf", priority: 0.8, changeFrequency: "monthly" },
    { path: "/tools/markdown", priority: 0.8, changeFrequency: "monthly" },
    { path: "/status", priority: 0.4, changeFrequency: "daily" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
    { path: "/cookies", priority: 0.2, changeFrequency: "yearly" },
    { path: "/refunds", priority: 0.2, changeFrequency: "yearly" },
    { path: "/aup", priority: 0.2, changeFrequency: "yearly" },
  ];

  return [
    ...staticPages.map((page) => ({
      url: `${siteConfig.url}${page.path}`,
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...screenshotGuides.map((guide) => ({
      url: `${siteConfig.url}/screenshot-api/${guide.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...comparisons.map((comparison) => ({
      url: `${siteConfig.url}/vs/${comparison.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
