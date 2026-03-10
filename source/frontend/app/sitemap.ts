import type { MetadataRoute } from "next";
import { searchProperties } from "@/lib/api/client";

const SITE_URL = "https://landomo.cz";
const SEARCH_LIMIT = 100;
const MAX_URLS = 10000;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    for (let page = 1; urls.length < MAX_URLS; page++) {
      const res = await searchProperties({
        countries: ["czech"],
        filters: {},
        page,
        limit: SEARCH_LIMIT,
      });

      for (const p of res.results) {
        urls.push({
          url: `${SITE_URL}/property/${p.id}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : p.created_at ? new Date(p.created_at) : undefined,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }

      if (!res.pagination?.hasNext) break;
    }
  } catch (e) {
    console.error("Sitemap generation error:", e);
  }

  return urls;
}
