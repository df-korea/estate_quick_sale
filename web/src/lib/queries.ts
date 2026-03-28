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

export async function getPopularComplexes() {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT c.id, c.complex_name, c.property_type, c.total_households,
      c.deal_count, c.lease_count, c.rent_count,
      count(*)::int AS view_count
    FROM complex_views cv
    JOIN complexes c ON c.id = cv.complex_id
    WHERE cv.viewed_at >= NOW() - INTERVAL '7 days'
    GROUP BY c.id
    ORDER BY count(*) DESC
    LIMIT 10
  `);
  return rows;
}

export async function getSidoList() {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT c.city AS sido_name,
      COALESCE(sum(ca.total_articles), 0)::int AS total_articles,
      COALESCE(sum(ca.bargain_count), 0)::int AS bargain_count
    FROM complexes c
    LEFT JOIN (
      SELECT complex_id,
        count(*) AS total_articles,
        count(*) FILTER (WHERE is_bargain = true) AS bargain_count
      FROM articles
      WHERE trade_type = 'A1' AND article_status = 'active'
      GROUP BY complex_id
    ) ca ON ca.complex_id = c.id
    WHERE c.is_active = true AND c.city IS NOT NULL
    GROUP BY c.city
    ORDER BY sum(ca.bargain_count) DESC NULLS LAST
  `);
  return rows;
}

export async function getRegionalTopBargains(sido: string, limit = 10) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT a.id, a.deal_price, a.formatted_price, a.exclusive_space,
      a.supply_space, a.target_floor, a.total_floor, a.bargain_score, a.bargain_keyword,
      a.bargain_type, a.first_seen_at,
      a.dong_name, a.direction, a.description, a.space_name,
      c.complex_name, c.id AS complex_id, c.division
    FROM articles a
    JOIN complexes c ON c.id = a.complex_id
    WHERE a.article_status = 'active' AND a.trade_type = 'A1'
      AND (a.bargain_score >= 60 AND a.bargain_type IN ('price', 'both'))
      AND a.first_seen_at >= NOW() - INTERVAL '7 days'
      AND c.city = $1
    ORDER BY a.bargain_score DESC
    LIMIT $2
  `, [sido, limit]);
  return rows;
}

// ── Article detail SSR helpers ──

const CANCEL_FILTER = `(cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')`;

export async function getArticlePriceHistory(articleId: number) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, deal_price, formatted_price, source, modified_date, recorded_at
     FROM price_history WHERE article_id=$1 ORDER BY recorded_at ASC`,
    [articleId]
  );
  return rows;
}

export async function getArticleAssessment(articleId: number) {
  const pool = getPool();

  const { rows: [article] } = await pool.query(`
    SELECT a.id, a.deal_price, a.exclusive_space, a.first_seen_at, a.is_bargain,
      a.bargain_keyword, a.complex_id, c.complex_name, c.sgg_cd, c.rt_apt_nm
    FROM articles a JOIN complexes c ON a.complex_id = c.id
    WHERE a.id = $1
  `, [articleId]);
  if (!article) return null;

  const area = parseFloat(article.exclusive_space) || 0;

  const [{ rows: [complexStats] }, { rows: [txStats] }, { rows: [dropStats] }, { rows: [magStats] }] = await Promise.all([
    pool.query(`
      SELECT count(*)::int AS count,
        round(avg(deal_price))::bigint AS avg_price,
        min(deal_price) AS min_price,
        max(deal_price) AS max_price
      FROM articles
      WHERE complex_id = $1 AND trade_type = 'A1' AND article_status = 'active'
        AND deal_price > 0
        AND exclusive_space BETWEEN $2::numeric - 3 AND $2::numeric + 3
        AND id != $3
    `, [article.complex_id, area, article.id]),
    pool.query(`
      SELECT count(*)::int AS tx_count,
        round(avg(deal_amount))::bigint AS avg_tx_price
      FROM (
        SELECT deal_amount,
          ROW_NUMBER() OVER (ORDER BY deal_year DESC, deal_month DESC, deal_day DESC NULLS LAST) AS rn
        FROM real_transactions
        WHERE complex_id = $1
          AND exclu_use_ar BETWEEN $2::numeric - 3 AND $2::numeric + 3
          AND ${CANCEL_FILTER}
      ) sub WHERE rn <= 5
    `, [article.complex_id, area]),
    pool.query(`
      SELECT count(*)::int AS drop_count FROM (
        SELECT deal_price, lag(deal_price) OVER (ORDER BY recorded_at) AS prev_price
        FROM price_history WHERE article_id = $1
      ) sub WHERE prev_price IS NOT NULL AND deal_price < prev_price
    `, [article.id]),
    pool.query(`
      SELECT CASE WHEN a.deal_price < ph.initial_price
        THEN round((1 - a.deal_price::numeric / ph.initial_price) * 100, 1) ELSE 0 END AS drop_pct
      FROM articles a, (
        SELECT deal_price AS initial_price FROM price_history WHERE article_id = $1 ORDER BY recorded_at ASC LIMIT 1
      ) ph WHERE a.id = $1
    `, [article.id]),
  ]);

  let score = 0;
  const factors: { name: string; value: number }[] = [];
  const price = Number(article.deal_price);

  const avgPrice = Number(complexStats?.avg_price);
  let discountVsComplex: number | null = null;
  if (avgPrice && price && avgPrice > 0) {
    discountVsComplex = ((price - avgPrice) / avgPrice) * 100;
    if (price < avgPrice && complexStats.count >= 2) {
      const complexScore = Math.min(Math.round((1.0 - price / avgPrice) / 0.005), 40);
      score += complexScore;
      factors.push({ name: `단지 대비 ${Math.abs(Math.round(discountVsComplex * 10) / 10)}% 저렴`, value: complexScore });
    }
  }

  let discountVsTx: number | null = null;
  const txAvgWon = txStats?.avg_tx_price ? Number(txStats.avg_tx_price) * 10000 : null;
  if (txAvgWon && price && txAvgWon > 0) {
    discountVsTx = ((price - txAvgWon) / txAvgWon) * 100;
    if (price < txAvgWon) {
      const txScore = Math.min(Math.round((1.0 - price / txAvgWon) / 0.005), 40);
      score += txScore;
      factors.push({ name: `실거래 대비 ${Math.abs(Math.round(discountVsTx * 10) / 10)}% 저렴`, value: txScore });
    }
  }

  const dropCount = dropStats?.drop_count || 0;
  if (dropCount >= 1) {
    const dropScore = Math.min(dropCount * 2, 10);
    score += dropScore;
    factors.push({ name: `가격 ${dropCount}회 인하`, value: dropScore });
  }

  const dropPct = magStats?.drop_pct || 0;
  if (dropPct > 0) {
    const magScore = Math.min(Math.round(dropPct / 2.0), 10);
    score += magScore;
    factors.push({ name: `누적 ${dropPct}% 인하`, value: magScore });
  }

  const daysOnMarket = Math.floor((Date.now() - new Date(article.first_seen_at).getTime()) / 86400000);
  const isLowest = complexStats?.min_price && price && price <= Number(complexStats.min_price);

  return {
    score: Math.min(score, 100),
    factors,
    discount_vs_complex: discountVsComplex ? Math.round(discountVsComplex * 10) / 10 : null,
    discount_vs_transaction: discountVsTx ? Math.round(discountVsTx * 10) / 10 : null,
    complex_avg_price: avgPrice,
    complex_listing_count: complexStats?.count || 0,
    tx_avg_price: txAvgWon || null,
    tx_count: txStats?.tx_count || 0,
    days_on_market: daysOnMarket,
    price_change_count: dropCount,
    is_lowest_in_complex: !!isLowest,
  };
}

export async function getArticleRealTransactions(complexId: number, exclusiveSpace: number, months = 12) {
  const pool = getPool();
  const area = parseFloat(String(exclusiveSpace)) || 0;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const fromYm = from.getFullYear() * 100 + (from.getMonth() + 1);

  const [trendResult, individualResult] = await Promise.all([
    pool.query(`
      SELECT
        deal_year || '-' || lpad(deal_month::text, 2, '0') AS month,
        count(*)::int AS tx_count,
        round(avg(deal_amount))::bigint AS avg_price,
        min(deal_amount) AS min_price,
        max(deal_amount) AS max_price,
        round(avg(deal_amount / NULLIF(exclu_use_ar, 0) * 3.3058))::bigint AS avg_price_per_pyeong
      FROM real_transactions
      WHERE complex_id = $1
        AND exclu_use_ar BETWEEN $2::numeric - 2 AND $2::numeric + 2
        AND (deal_year * 100 + deal_month) >= $3
        AND ${CANCEL_FILTER}
      GROUP BY deal_year, deal_month
      ORDER BY deal_year, deal_month
    `, [complexId, area, fromYm]),
    pool.query(`
      SELECT deal_year, deal_month, deal_day,
        deal_amount, floor, exclu_use_ar,
        CASE WHEN cdeal_type = 'O' THEN true ELSE false END AS is_cancel
      FROM real_transactions
      WHERE complex_id = $1
        AND exclu_use_ar BETWEEN $2::numeric - 2 AND $2::numeric + 2
        AND (deal_year * 100 + deal_month) >= $3
      ORDER BY deal_year DESC, deal_month DESC, deal_day DESC NULLS LAST
      LIMIT 100
    `, [complexId, area, fromYm]),
  ]);

  return { trend: trendResult.rows, transactions: individualResult.rows };
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
