import { NextResponse } from 'next/server';
import { getPool } from '@api/_lib/db.js';
import { cached } from '@api/_lib/cache.js';

export const dynamic = 'force-dynamic';

const BASE = 'https://estate-rader.com';

export async function GET() {
  const xml = await cached('sitemap:full', 3600_000, buildSitemap);
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

async function buildSitemap(): Promise<string> {
  const pool = getPool();
  const today = new Date().toISOString().split('T')[0];
  const urls: string[] = [];

  // 1. Static pages (6개)
  urls.push(entry(BASE, today, 'daily', '1.0'));
  urls.push(entry(`${BASE}/search`, today, 'daily', '0.8'));
  urls.push(entry(`${BASE}/community`, today, 'daily', '0.7'));
  urls.push(entry(`${BASE}/about`, today, 'monthly', '0.5'));
  urls.push(entry(`${BASE}/terms`, today, 'monthly', '0.3'));
  urls.push(entry(`${BASE}/privacy`, today, 'monthly', '0.3'));

  // 2. Popular complexes: 최근 12개월 실거래 30건 이상 (~5,821개)
  try {
    const { rows } = await pool.query(`
      SELECT c.id
      FROM complexes c
      JOIN real_transactions rt ON rt.complex_id = c.id
      WHERE rt.deal_year >= 2025 AND rt.cdeal_type IS NULL
      GROUP BY c.id
      HAVING count(rt.id) >= 30
      ORDER BY count(rt.id) DESC
    `);
    for (const r of rows) {
      urls.push(entry(`${BASE}/complex/${r.id}`, today, 'daily', '0.7'));
    }
  } catch { /* fallback */ }

  // 3. Price bargain articles: 가격급매 매물 (~6,528개)
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.first_seen_at
      FROM articles a
      WHERE a.article_status = 'active'
        AND a.bargain_type IN ('price', 'both')
      ORDER BY a.bargain_score DESC, a.first_seen_at DESC
    `);
    for (const r of rows) {
      const date = new Date(r.first_seen_at).toISOString().split('T')[0];
      urls.push(entry(`${BASE}/article/${r.id}`, date, 'daily', '0.6'));
    }
  } catch { /* fallback */ }

  // 4. Community posts
  try {
    const { rows } = await pool.query(`
      SELECT id, created_at FROM community_posts ORDER BY created_at DESC LIMIT 500
    `);
    for (const r of rows) {
      const date = new Date(r.created_at).toISOString().split('T')[0];
      urls.push(entry(`${BASE}/community/${r.id}`, date, 'weekly', '0.4'));
    }
  } catch { /* fallback */ }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

function entry(url: string, lastmod: string, freq: string, priority: string): string {
  return `<url><loc>${url}</loc><lastmod>${lastmod}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;
}
