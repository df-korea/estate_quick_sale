/**
 * Server-side data queries for SSR pages.
 * These run directly against the database (no API roundtrip).
 */
import { getPool } from '@api/_lib/db.js';

function formatWon(won: number | null): string | null {
  if (!won && won !== 0) return null;
  const num = Number(won);
  if (num >= 100000000) {
    const eok = Math.floor(num / 100000000);
    const remainder = Math.round((num % 100000000) / 10000);
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
  }
  return `${Math.round(num / 10000).toLocaleString()}만`;
}

export async function getArticleById(id: number) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      a.*,
      c.complex_name, c.property_type, c.hscp_no,
      c.total_households, c.sgg_cd, c.rt_apt_nm,
      (SELECT count(*)::int FROM price_history WHERE article_id = a.id) AS price_change_count,
      (SELECT deal_price FROM price_history WHERE article_id = a.id ORDER BY recorded_at ASC LIMIT 1) AS initial_price
    FROM articles a
    JOIN complexes c ON c.id = a.complex_id
    WHERE a.id = $1
  `, [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r,
    formatted_price: formatWon(r.deal_price) || '',
    complexes: {
      complex_name: r.complex_name,
      property_type: r.property_type,
      hscp_no: r.hscp_no,
      total_households: r.total_households,
      sgg_cd: r.sgg_cd,
      rt_apt_nm: r.rt_apt_nm,
    },
  };
}

export async function getComplexById(id: number) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT c.*,
      (SELECT count(*)::int FROM articles WHERE complex_id = c.id AND article_status = 'active' AND trade_type = 'A1') AS deal_count,
      (SELECT count(*)::int FROM articles WHERE complex_id = c.id AND article_status = 'active' AND trade_type = 'B1') AS lease_count,
      (SELECT count(*)::int FROM articles WHERE complex_id = c.id AND article_status = 'active' AND trade_type = 'B2') AS rent_count
    FROM complexes c WHERE c.id = $1
  `, [id]);
  return rows[0] || null;
}

export async function getBriefing() {
  const pool = getPool();
  const [overview] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM articles WHERE is_bargain = true AND article_status = 'active') AS total_bargains,
        (SELECT count(*)::int FROM articles WHERE article_status = 'active') AS total_articles,
        (SELECT count(*)::int FROM articles WHERE article_status = 'active' AND first_seen_at >= CURRENT_DATE) AS new_today,
        (SELECT count(*)::int FROM articles WHERE is_bargain = true AND article_status = 'active' AND first_seen_at >= CURRENT_DATE) AS new_bargains_today,
        (SELECT count(*)::int FROM price_history WHERE recorded_at >= CURRENT_DATE) AS price_changes_today,
        (SELECT count(*)::int FROM articles WHERE article_status = 'removed' AND last_seen_at >= CURRENT_DATE) AS removed_today
    `),
  ]);
  return overview.rows[0];
}

export async function getCommunityPosts(page: number = 1, limit: number = 20) {
  const pool = getPool();
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(`
    SELECT p.id, p.title, p.content, p.nickname, p.created_at,
      (SELECT count(*)::int FROM community_comments WHERE post_id = p.id) AS comment_count,
      (SELECT count(*)::int FROM community_likes WHERE post_id = p.id) AS like_count
    FROM community_posts p
    ORDER BY p.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  return rows;
}

export async function getCommunityPost(id: number) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT p.*, u.nickname AS author_nickname,
      (SELECT count(*)::int FROM community_likes WHERE post_id = p.id) AS like_count
    FROM community_posts p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = $1
  `, [id]);
  return rows[0] || null;
}
