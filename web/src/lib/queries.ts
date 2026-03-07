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

export async function getFullBriefing() {
  const pool = getPool();
  const [overview, newBargains, topDrops, hotComplexes] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM articles WHERE is_bargain = true AND article_status = 'active') AS total_bargains,
        (SELECT count(*)::int FROM articles WHERE article_status = 'active') AS total_articles,
        (SELECT count(*)::int FROM articles WHERE article_status = 'active' AND first_seen_at >= CURRENT_DATE) AS new_today,
        (SELECT count(*)::int FROM articles WHERE is_bargain = true AND article_status = 'active' AND first_seen_at >= CURRENT_DATE) AS new_bargains_today,
        (SELECT count(*)::int FROM price_history WHERE recorded_at >= CURRENT_DATE) AS price_changes_today,
        (SELECT count(*)::int FROM articles WHERE article_status = 'removed' AND removed_at >= CURRENT_DATE) AS removed_today
    `),
    pool.query(`
      SELECT a.id, a.deal_price, a.formatted_price, a.exclusive_space,
        c.complex_name, a.bargain_keyword, a.first_seen_at
      FROM articles a JOIN complexes c ON a.complex_id = c.id
      WHERE a.is_bargain = true AND a.article_status = 'active'
      ORDER BY a.first_seen_at DESC LIMIT 5
    `),
    pool.query(`
      SELECT ph.article_id, c.complex_name, a.exclusive_space,
        ph.deal_price AS new_price, ph.formatted_price,
        lag(ph.deal_price) OVER (PARTITION BY ph.article_id ORDER BY ph.recorded_at) AS prev_price,
        ph.recorded_at
      FROM price_history ph
      JOIN articles a ON ph.article_id = a.id
      JOIN complexes c ON a.complex_id = c.id
      WHERE a.article_status = 'active'
      ORDER BY ph.recorded_at DESC
      LIMIT 30
    `),
    pool.query(`
      SELECT c.id AS complex_id, c.complex_name,
        count(*)::int AS recent_bargains
      FROM articles a JOIN complexes c ON a.complex_id = c.id
      WHERE a.is_bargain = true AND a.article_status = 'active'
        AND a.first_seen_at >= CURRENT_DATE - INTERVAL '3 days'
      GROUP BY c.id, c.complex_name
      HAVING count(*) >= 2
      ORDER BY count(*) DESC
      LIMIT 5
    `),
  ]);
  const drops = topDrops.rows
    .filter((r: any) => r.prev_price != null && r.new_price < r.prev_price)
    .slice(0, 5)
    .map((r: any) => ({
      ...r,
      change_pct: Math.round(((r.new_price - r.prev_price) / r.prev_price) * 1000) / 10,
    }));
  return {
    summary: overview.rows[0],
    new_bargains: newBargains.rows,
    price_drops: drops,
    hot_complexes: hotComplexes.rows,
  };
}

export async function getLeaderboard(limit = 10, bargainType = 'all') {
  const pool = getPool();
  const bargainFilter = bargainType === 'keyword'
    ? `a.bargain_type IN ('keyword', 'both')`
    : bargainType === 'price'
    ? `a.bargain_score >= 60 AND a.bargain_type IN ('price', 'both')`
    : `a.is_bargain = true`;
  const { rows } = await pool.query(`
    SELECT
      c.id AS complex_id,
      c.complex_name,
      c.city, c.division, c.sector,
      count(*) FILTER (WHERE ${bargainFilter})::int AS bargain_count,
      count(*)::int AS total_count,
      CASE WHEN count(*) > 0
        THEN round(count(*) FILTER (WHERE ${bargainFilter})::numeric / count(*)::numeric * 100, 1)
        ELSE 0
      END AS bargain_ratio,
      round(avg(a.deal_price) FILTER (WHERE a.deal_price > 0))::bigint AS avg_price,
      round(avg(a.bargain_score) FILTER (WHERE ${bargainFilter}), 1) AS avg_bargain_score
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE a.article_status = 'active'
    GROUP BY c.id, c.complex_name, c.city, c.division, c.sector
    HAVING count(*) FILTER (WHERE ${bargainFilter}) > 0
    ORDER BY count(*) FILTER (WHERE ${bargainFilter}) DESC, bargain_ratio DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

export async function getTopPriceDrops(limit = 10, sort: 'amount' | 'rate' = 'amount') {
  const pool = getPool();
  const { rows } = await pool.query(`
    WITH first_last AS (
      SELECT DISTINCT ON (ph.article_id)
        ph.article_id,
        first_value(ph.deal_price) OVER w AS initial_price,
        a.deal_price AS current_price,
        a.exclusive_space,
        a.formatted_price,
        a.target_floor,
        a.total_floor,
        a.bargain_score,
        a.bargain_keyword,
        c.complex_name,
        c.id AS complex_id,
        c.hscp_no
      FROM price_history ph
      JOIN articles a ON a.id = ph.article_id
      JOIN complexes c ON c.id = a.complex_id
      WHERE a.article_status = 'active' AND a.trade_type = 'A1' AND a.deal_price > 0
      WINDOW w AS (PARTITION BY ph.article_id ORDER BY ph.recorded_at ASC)
    ),
    drops AS (
      SELECT fl.*,
        (fl.initial_price - fl.current_price) AS drop_amount,
        round((1 - fl.current_price::numeric / fl.initial_price) * 100, 1) AS drop_pct,
        (SELECT count(*)::int FROM (
          SELECT ph2.deal_price,
            lag(ph2.deal_price) OVER (ORDER BY ph2.recorded_at) AS prev
          FROM price_history ph2
          WHERE ph2.article_id = fl.article_id
        ) sub WHERE prev IS NOT NULL AND sub.deal_price < sub.prev) AS drop_count
      FROM first_last fl
      WHERE fl.initial_price > fl.current_price
    )
    SELECT article_id, complex_name, complex_id, hscp_no,
      exclusive_space, formatted_price, target_floor, total_floor,
      bargain_score, bargain_keyword,
      initial_price, current_price, drop_amount, drop_pct, drop_count
    FROM drops
    ORDER BY ${sort === 'rate' ? 'drop_pct' : 'drop_amount'} DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

export async function getDongRankings(limit = 10, bargainType = 'keyword') {
  const pool = getPool();
  const bargainWhere = bargainType === 'keyword'
    ? `a.bargain_type IN ('keyword', 'both')`
    : bargainType === 'price'
    ? `a.bargain_score >= 60 AND a.bargain_type IN ('price', 'both')`
    : `a.is_bargain = true`;
  const { rows } = await pool.query(`
    SELECT c.city, c.division, c.sector,
      c.division || ' ' || c.sector AS region_name,
      count(*)::int AS bargain_count,
      round(avg(a.bargain_score), 1) AS avg_bargain_score,
      round(avg(a.deal_price) FILTER (WHERE a.deal_price > 0))::bigint AS avg_price
    FROM articles a JOIN complexes c ON a.complex_id = c.id
    WHERE ${bargainWhere}
      AND a.article_status = 'active'
      AND c.sector IS NOT NULL AND a.trade_type = 'A1'
    GROUP BY c.city, c.division, c.sector
    HAVING count(*) >= 2
    ORDER BY count(*) DESC, c.division, c.sector
    LIMIT $1
  `, [limit]);
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
