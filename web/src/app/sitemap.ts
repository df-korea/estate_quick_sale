import { MetadataRoute } from 'next';
import { getPool } from '@api/_lib/db.js';

export const dynamic = 'force-dynamic';

const BASE = 'https://estate-rader.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pool = getPool();

  const [complexes, articles] = await Promise.all([
    pool.query(`
      SELECT id, updated_at FROM complexes
      WHERE id IN (SELECT DISTINCT complex_id FROM articles WHERE article_status = 'active')
      ORDER BY updated_at DESC
    `),
    pool.query(`
      SELECT id, updated_at FROM articles
      WHERE article_status = 'active' AND bargain_score > 50
      ORDER BY bargain_score DESC, updated_at DESC
      LIMIT 5000
    `),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${BASE}/search`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'monthly', priority: 0.2 },
  ];

  const complexPages: MetadataRoute.Sitemap = complexes.rows.map((r: any) => ({
    url: `${BASE}/complex/${r.id}`,
    lastModified: r.updated_at,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.rows.map((r: any) => ({
    url: `${BASE}/article/${r.id}`,
    lastModified: r.updated_at,
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...complexPages, ...articlePages];
}
