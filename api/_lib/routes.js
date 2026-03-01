import { getPool } from './db.js';
import { extractUser } from './jwt.js';
import { cached } from './cache.js';

// ── Helpers ──

function formatWon(won) {
  if (!won && won !== 0) return null;
  const num = Number(won);
  if (num >= 100000000) {
    const eok = Math.floor(num / 100000000);
    const remainder = Math.round((num % 100000000) / 10000);
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
  }
  return `${Math.round(num / 10000).toLocaleString()}만`;
}

function bargainTypeCondition(bargainType, alias = 'a') {
  if (bargainType === 'keyword') return `${alias}.bargain_type IN ('keyword', 'both')`;
  if (bargainType === 'price') return `${alias}.bargain_type IN ('price', 'both')`;
  return `${alias}.is_bargain = true`;
}

const CANCEL_FILTER = `(cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')`;

// ── Path matching ──

function matchPath(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const pa = path.split('/').filter(Boolean);
  if (pp.length !== pa.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) {
      params[pp[i].slice(1)] = decodeURIComponent(pa[i]);
    } else if (pp[i] !== pa[i]) {
      return null;
    }
  }
  return params;
}

// ── Route table (order matters: static before dynamic) ──

const routes = [
  // Briefing
  { m: 'GET', p: '/briefing', h: handleBriefing },

  // Bargains
  { m: 'GET', p: '/bargains/count', h: handleBargainsCount },
  { m: 'GET', p: '/bargains/filtered', h: handleBargainsFiltered },
  { m: 'GET', p: '/bargains/by-region', h: handleBargainsByRegion },
  { m: 'GET', p: '/bargains/by-complexes', h: handleBargainsByComplexes },
  { m: 'GET', p: '/bargains', h: handleBargains },

  // Articles
  { m: 'GET', p: '/articles/search', h: handleArticlesSearch },
  { m: 'GET', p: '/articles/:id/price-history', h: handleArticlePriceHistory },
  { m: 'GET', p: '/articles/:id/assessment', h: handleArticleAssessment },
  { m: 'GET', p: '/articles/:id', h: handleArticleDetail },

  // Complexes
  { m: 'GET', p: '/complexes/search', h: handleComplexesSearch },
  { m: 'GET', p: '/complexes/:id/pyeong-types', h: handleComplexPyeongTypes },
  { m: 'GET', p: '/complexes/:id/dongs', h: handleComplexDongs },
  { m: 'GET', p: '/complexes/:id/articles', h: handleComplexArticles },
  { m: 'GET', p: '/complexes/:id/market/stats', h: handleMarketStats },
  { m: 'GET', p: '/complexes/:id/market/area-types', h: handleMarketAreaTypes },
  { m: 'GET', p: '/complexes/:id/market/trend', h: handleMarketTrend },
  { m: 'GET', p: '/complexes/:id/market/transactions', h: handleMarketTransactions },
  { m: 'GET', p: '/complexes/:id/market/floor-analysis', h: handleMarketFloorAnalysis },
  { m: 'GET', p: '/complexes/:id', h: handleComplexDetail },

  // Real transactions
  { m: 'GET', p: '/real-transactions/summary', h: handleRealTxSummary },
  { m: 'GET', p: '/real-transactions/count', h: handleRealTxCount },
  { m: 'GET', p: '/real-transactions/price-trend', h: handleRealTxPriceTrend },
  { m: 'GET', p: '/real-transactions/floor-analysis', h: handleRealTxFloorAnalysis },
  { m: 'GET', p: '/real-transactions/area-types', h: handleRealTxAreaTypes },
  { m: 'GET', p: '/real-transactions/region-compare', h: handleRealTxRegionCompare },
  { m: 'GET', p: '/real-transactions/volume-trend', h: handleRealTxVolumeTrend },
  { m: 'GET', p: '/real-transactions/listing-vs-actual', h: handleRealTxListingVsActual },
  { m: 'GET', p: '/real-transactions', h: handleRealTransactions },

  // Analysis
  { m: 'GET', p: '/analysis/overview', h: handleAnalysisOverview },
  { m: 'GET', p: '/analysis/bargain-leaderboard', h: handleBargainLeaderboard },
  { m: 'GET', p: '/analysis/recent-price-changes', h: handleRecentPriceChanges },
  { m: 'GET', p: '/analysis/top-price-drops', h: handleTopPriceDrops },
  { m: 'GET', p: '/analysis/district-heatmap', h: handleDistrictHeatmap },
  { m: 'GET', p: '/analysis/district-bargains', h: handleDistrictBargains },
  { m: 'GET', p: '/analysis/regional-dong-rankings', h: handleRegionalDongRankings },
  { m: 'GET', p: '/analysis/regional-dong-articles', h: handleRegionalDongArticles },

  // Map
  { m: 'GET', p: '/map/sido-heatmap', h: handleSidoHeatmap },
  { m: 'GET', p: '/map/sigungu-heatmap', h: handleSigunguHeatmap },
  { m: 'GET', p: '/map/sigungu-complexes', h: handleSigunguComplexes },

  // Stats
  { m: 'GET', p: '/stats', h: handleStats },
  { m: 'GET', p: '/districts', h: handleDistricts },

  // Users
  { m: 'GET', p: '/users/profile', h: handleGetProfile },
  { m: 'PUT', p: '/users/nickname', h: handleUpdateNickname },

  // Community
  { m: 'GET', p: '/community/posts/:id/comments', h: handleCommunityPostDetail }, // redirect
  { m: 'POST', p: '/community/posts/:id/comments', h: handleCommunityAddComment },
  { m: 'POST', p: '/community/posts/:id/like', h: handleCommunityLike },
  { m: 'DELETE', p: '/community/posts/:id/like', h: handleCommunityUnlike },
  { m: 'GET', p: '/community/posts/:id', h: handleCommunityPostDetail },
  { m: 'GET', p: '/community/posts', h: handleCommunityPosts },
  { m: 'POST', p: '/community/posts', h: handleCommunityCreatePost },
];

export async function route(req, res, path) {
  for (const r of routes) {
    if (r.m !== req.method) continue;
    const params = matchPath(r.p, path);
    if (params) {
      req.params = params;
      try {
        await r.h(req, res);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
      return true;
    }
  }
  return false;
}

// ════════════════════════════════════════
// Briefing
// ════════════════════════════════════════

async function handleBriefing(_req, res) {
  const data = await cached('briefing', 30_000, async () => {
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
      .filter(r => r.prev_price != null && r.new_price < r.prev_price)
      .slice(0, 5)
      .map(r => ({
        ...r,
        change_pct: Math.round(((r.new_price - r.prev_price) / r.prev_price) * 1000) / 10,
      }));

    return {
      summary: overview.rows[0],
      new_bargains: newBargains.rows,
      price_drops: drops,
      hot_complexes: hotComplexes.rows,
    };
  });
  res.json(data);
}

// ════════════════════════════════════════
// Bargains
// ════════════════════════════════════════

async function handleBargains(req, res) {
  const pool = getPool();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const bargainWhere = bargainTypeCondition(req.query.bargain_type);
  const { rows } = await pool.query(`
    SELECT a.id, a.article_no, a.complex_id, a.trade_type,
      a.deal_price, a.warranty_price, a.rent_price, a.formatted_price,
      a.exclusive_space, a.supply_space, a.target_floor, a.total_floor,
      a.direction, a.description, a.dong_name,
      a.image_url, a.brokerage_name, a.bargain_keyword,
      a.bargain_type, a.bargain_score,
      a.first_seen_at, a.management_fee, a.verification_type,
      a.price_change_status, a.image_count,
      c.complex_name, c.property_type, c.hscp_no,
      (SELECT count(*)::int FROM price_history ph WHERE ph.article_id = a.id) AS price_change_count,
      (SELECT ph2.deal_price FROM price_history ph2 WHERE ph2.article_id = a.id ORDER BY ph2.recorded_at ASC LIMIT 1) AS initial_price
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE ${bargainWhere} AND a.article_status = 'active'
    ORDER BY a.first_seen_at DESC
    LIMIT $1
  `, [limit]);
  res.json(rows);
}

async function handleBargainsCount(_req, res) {
  const data = await cached('bargains:count', 60_000, async () => {
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT
        count(*) FILTER (WHERE is_bargain = true)::int AS count,
        count(*) FILTER (WHERE bargain_type = 'keyword')::int AS keyword_count,
        count(*) FILTER (WHERE bargain_type = 'price')::int AS price_count,
        count(*) FILTER (WHERE bargain_type = 'both')::int AS both_count
      FROM articles WHERE article_status = 'active'
    `);
    return rows[0];
  });
  res.json(data);
}

async function handleBargainsFiltered(req, res) {
  const pool = getPool();
  const { sort = 'newest', minPrice, maxPrice, minArea, maxArea, district, city, bargain_type: bt, limit: lim = 50 } = req.query;
  const limit = Math.min(parseInt(lim) || 50, 200);
  let where = [bargainTypeCondition(bt), `a.article_status = 'active'`];
  let params = [];
  let idx = 1;

  if (minPrice) { where.push(`COALESCE(NULLIF(a.deal_price,0), a.warranty_price) >= $${idx++}`); params.push(parseInt(minPrice)); }
  if (maxPrice) { where.push(`COALESCE(NULLIF(a.deal_price,0), a.warranty_price) <= $${idx++}`); params.push(parseInt(maxPrice)); }
  if (minArea) { where.push(`a.exclusive_space >= $${idx++}`); params.push(parseFloat(minArea)); }
  if (maxArea) { where.push(`a.exclusive_space <= $${idx++}`); params.push(parseFloat(maxArea)); }
  if (district) { where.push(`c.division = $${idx++}`); params.push(district); }
  if (city) { where.push(`c.city = $${idx++}`); params.push(city); }

  const priceExpr = 'COALESCE(NULLIF(a.deal_price,0), a.warranty_price)';
  const sortMap = {
    newest: 'a.first_seen_at DESC',
    price_asc: `${priceExpr} ASC NULLS LAST`,
    price_desc: `${priceExpr} DESC NULLS LAST`,
    area_asc: 'a.exclusive_space ASC NULLS LAST',
    area_desc: 'a.exclusive_space DESC NULLS LAST',
    score_desc: 'a.bargain_score DESC NULLS LAST',
  };
  const orderBy = sortMap[sort] || sortMap.newest;
  params.push(limit);

  const { rows } = await pool.query(`
    SELECT a.id, a.article_no, a.complex_id, a.trade_type,
      a.deal_price, a.formatted_price, a.warranty_price, a.rent_price,
      a.exclusive_space, a.target_floor, a.total_floor, a.direction,
      a.description, a.dong_name,
      a.bargain_keyword, a.bargain_type, a.bargain_score, a.score_factors, a.first_seen_at,
      c.complex_name, c.property_type, c.hscp_no,
      (SELECT count(*)::int FROM price_history ph WHERE ph.article_id = a.id) AS price_change_count
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT $${idx}
  `, params);
  res.json(rows);
}

async function handleBargainsByRegion(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  const data = await cached(`bargains:by-region:${limit}`, 60_000, async () => {
    const pool = getPool();
    const { rows } = await pool.query(`
      WITH ranked AS (
        SELECT a.id, a.article_no, a.complex_id, a.trade_type,
          a.deal_price, a.formatted_price, a.warranty_price, a.rent_price,
          a.exclusive_space, a.target_floor, a.total_floor, a.direction,
          a.description, a.bargain_keyword, a.bargain_type, a.bargain_score,
          a.first_seen_at,
          c.complex_name, c.division, c.hscp_no,
          ROW_NUMBER() OVER (PARTITION BY c.division ORDER BY a.bargain_score DESC NULLS LAST) AS rn
        FROM articles a
        JOIN complexes c ON a.complex_id = c.id
        WHERE a.is_bargain = true AND a.article_status = 'active'
          AND a.bargain_type IN ('price', 'both')
          AND c.division IS NOT NULL
      )
      SELECT * FROM ranked WHERE rn <= $1
      ORDER BY division, rn
    `, [limit]);

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.division]) grouped[row.division] = [];
      grouped[row.division].push(row);
    }
    return Object.entries(grouped)
      .map(([division, articles]) => ({ division, articles, count: articles.length }))
      .sort((a, b) => (b.articles[0]?.bargain_score ?? 0) - (a.articles[0]?.bargain_score ?? 0));
  });
  res.json(data);
}

async function handleBargainsByComplexes(req, res) {
  const pool = getPool();
  const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
  if (ids.length === 0) return res.json([]);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await pool.query(`
    SELECT
      c.id AS complex_id, c.complex_name,
      count(*) FILTER (WHERE a.article_status = 'active')::int AS total_articles,
      count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::int AS bargain_count,
      count(*) FILTER (WHERE a.article_status = 'active' AND a.first_seen_at >= CURRENT_DATE - INTERVAL '1 day')::int AS new_today,
      round(avg(a.deal_price) FILTER (WHERE a.deal_price > 0 AND a.article_status = 'active'))::bigint AS avg_price,
      min(a.deal_price) FILTER (WHERE a.deal_price > 0 AND a.article_status = 'active') AS min_price
    FROM complexes c
    LEFT JOIN articles a ON a.complex_id = c.id AND a.trade_type = 'A1'
    WHERE c.id IN (${placeholders})
    GROUP BY c.id, c.complex_name
  `, ids);
  res.json(rows);
}

// ════════════════════════════════════════
// Articles
// ════════════════════════════════════════

async function handleArticlesSearch(req, res) {
  const pool = getPool();
  const q = (req.query.q || '').trim();
  if (q.length < 1) return res.json([]);
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);
  const { rows } = await pool.query(`
    SELECT a.id, a.article_no, a.deal_price, a.formatted_price,
      a.exclusive_space, a.trade_type, a.target_floor, a.total_floor,
      a.bargain_score, a.bargain_keyword, a.space_name, a.direction,
      a.description, a.dong_name, a.score_factors, a.first_seen_at,
      c.complex_name, c.id AS complex_id
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE a.article_status = 'active'
      AND (c.complex_name ILIKE $1 OR a.article_no = $2)
    ORDER BY a.deal_price DESC NULLS LAST
    LIMIT $3
  `, [`%${q}%`, q, limit]);
  res.json(rows);
}

async function handleArticleDetail(req, res) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT a.*,
      c.complex_name, c.property_type AS complex_property_type, c.hscp_no AS complex_hscp_no, c.total_households,
      c.sgg_cd, c.rt_apt_nm,
      (SELECT count(*)::int FROM price_history ph WHERE ph.article_id = a.id) AS price_change_count,
      (SELECT ph2.deal_price FROM price_history ph2 WHERE ph2.article_id = a.id ORDER BY ph2.recorded_at ASC LIMIT 1) AS initial_price
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE a.id = $1
  `, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const row = rows[0];
  row.complexes = {
    complex_name: row.complex_name,
    property_type: row.complex_property_type,
    hscp_no: row.complex_hscp_no,
    total_households: row.total_households,
    sgg_cd: row.sgg_cd,
    rt_apt_nm: row.rt_apt_nm,
  };
  res.json(row);
}

async function handleArticlePriceHistory(req, res) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, deal_price, formatted_price, source, modified_date, recorded_at
     FROM price_history WHERE article_id=$1 ORDER BY recorded_at ASC`,
    [req.params.id]
  );
  res.json(rows);
}

async function handleArticleAssessment(req, res) {
  const pool = getPool();
  const { rows: [article] } = await pool.query(`
    SELECT a.id, a.deal_price, a.exclusive_space, a.first_seen_at, a.is_bargain,
      a.bargain_keyword, a.complex_id, c.complex_name, c.sgg_cd, c.rt_apt_nm
    FROM articles a JOIN complexes c ON a.complex_id = c.id
    WHERE a.id = $1
  `, [req.params.id]);
  if (!article) return res.status(404).json({ error: 'Not found' });

  const { rows: [complexStats] } = await pool.query(`
    SELECT count(*)::int AS count,
      round(avg(deal_price))::bigint AS avg_price,
      min(deal_price) AS min_price,
      max(deal_price) AS max_price
    FROM articles
    WHERE complex_id = $1 AND trade_type = 'A1' AND article_status = 'active'
      AND deal_price > 0
      AND exclusive_space BETWEEN $2::numeric - 3 AND $2::numeric + 3
  `, [article.complex_id, parseFloat(article.exclusive_space) || 0]);

  const now = new Date();
  const from6m = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const fromYm = from6m.getFullYear() * 100 + (from6m.getMonth() + 1);
  const area = parseFloat(article.exclusive_space) || 0;
  const { rows: [txStats] } = await pool.query(`
    SELECT count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_tx_price
    FROM real_transactions
    WHERE complex_id = $1
      AND exclu_use_ar BETWEEN $2::numeric - 3 AND $2::numeric + 3
      AND (deal_year * 100 + deal_month) >= $3
      AND ${CANCEL_FILTER}
  `, [article.complex_id, area, fromYm]);

  const { rows: [phCount] } = await pool.query(
    `SELECT count(*)::int AS cnt FROM price_history WHERE article_id = $1`,
    [article.id]
  );

  let score = 0;
  const factors = [];

  const avgPrice = complexStats?.avg_price;
  let discountVsComplex = null;
  if (avgPrice && article.deal_price && avgPrice > 0) {
    discountVsComplex = ((article.deal_price - avgPrice) / avgPrice) * 100;
    if (discountVsComplex < -15) { score += 40; factors.push({ name: '단지 대비 15%+ 저렴', value: 40 }); }
    else if (discountVsComplex < -10) { score += 30; factors.push({ name: '단지 대비 10%+ 저렴', value: 30 }); }
    else if (discountVsComplex < -5) { score += 20; factors.push({ name: '단지 대비 5%+ 저렴', value: 20 }); }
    else if (discountVsComplex < 0) { score += 8; factors.push({ name: '단지 평균 이하', value: 8 }); }
  }

  let discountVsTx = null;
  const txAvgWon = txStats?.avg_tx_price ? txStats.avg_tx_price * 10000 : null;
  if (txAvgWon && article.deal_price && txAvgWon > 0) {
    discountVsTx = ((article.deal_price - txAvgWon) / txAvgWon) * 100;
    if (discountVsTx < -10) { score += 40; factors.push({ name: '실거래 대비 10%+ 저렴', value: 40 }); }
    else if (discountVsTx < -5) { score += 28; factors.push({ name: '실거래 대비 5%+ 저렴', value: 28 }); }
    else if (discountVsTx < 0) { score += 12; factors.push({ name: '실거래 이하', value: 12 }); }
  }

  if (phCount.cnt >= 4) { score += 20; factors.push({ name: '호가 4회+ 변동', value: 20 }); }
  else if (phCount.cnt >= 3) { score += 14; factors.push({ name: '호가 3회 변동', value: 14 }); }
  else if (phCount.cnt >= 2) { score += 8; factors.push({ name: '호가 2회 변동', value: 8 }); }

  const daysOnMarket = Math.floor((Date.now() - new Date(article.first_seen_at).getTime()) / 86400000);
  const isLowest = complexStats?.min_price && article.deal_price && article.deal_price <= complexStats.min_price;

  res.json({
    score: Math.min(score, 100),
    factors,
    discount_vs_complex: discountVsComplex ? Math.round(discountVsComplex * 10) / 10 : null,
    discount_vs_transaction: discountVsTx ? Math.round(discountVsTx * 10) / 10 : null,
    complex_avg_price: avgPrice,
    complex_listing_count: complexStats?.count || 0,
    tx_avg_price: txAvgWon || null,
    tx_count: txStats?.tx_count || 0,
    days_on_market: daysOnMarket,
    price_change_count: phCount.cnt,
    is_lowest_in_complex: isLowest,
  });
}

// ════════════════════════════════════════
// Complexes
// ════════════════════════════════════════

async function handleComplexesSearch(req, res) {
  const pool = getPool();
  const q = req.query.q || '';
  if (q.length < 1) return res.json([]);
  const { rows } = await pool.query(`
    SELECT id, hscp_no, complex_name, property_type, total_households, deal_count, lease_count, rent_count
    FROM complexes
    WHERE is_active = true AND complex_name ILIKE $1
    ORDER BY total_households DESC NULLS LAST
    LIMIT 20
  `, [`%${q}%`]);
  res.json(rows);
}

async function handleComplexDetail(req, res) {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM complexes WHERE id=$1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}

async function handleComplexPyeongTypes(req, res) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT space_name, exclusive_space,
      round(exclusive_space / 3.3058)::int AS pyeong,
      count(*)::int AS article_count
    FROM articles
    WHERE complex_id = $1 AND article_status = 'active' AND space_name IS NOT NULL
    GROUP BY space_name, exclusive_space
    ORDER BY exclusive_space ASC
  `, [req.params.id]);
  res.json(rows);
}

async function handleComplexDongs(req, res) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT dong_name, count(*)::int AS article_count
    FROM articles
    WHERE complex_id = $1 AND article_status = 'active' AND dong_name IS NOT NULL AND dong_name != ''
    GROUP BY dong_name ORDER BY dong_name
  `, [req.params.id]);
  res.json(rows);
}

async function handleComplexArticles(req, res) {
  const pool = getPool();
  const tradeType = req.query.tradeType || 'A1';
  const sort = req.query.sort || 'price_asc';
  const bargainOnly = req.query.bargainOnly === 'true';
  const spaceName = req.query.spaceName;
  const dongName = req.query.dongName;
  const priceExpr = 'COALESCE(NULLIF(deal_price,0), warranty_price)';
  const sortMap = {
    price_asc: `${priceExpr} ASC NULLS LAST`,
    price_desc: `${priceExpr} DESC NULLS LAST`,
    newest: 'first_seen_at DESC',
  };
  const orderBy = sortMap[sort] || sortMap.price_asc;
  let where = ['complex_id=$1', "article_status='active'"];
  let params = [req.params.id];
  let idx = 2;
  if (tradeType !== 'all') { where.push(`trade_type=$${idx++}`); params.push(tradeType); }
  if (bargainOnly) where.push('is_bargain = true');
  if (spaceName) { where.push(`space_name = $${idx++}`); params.push(spaceName); }
  if (dongName) { where.push(`dong_name = $${idx++}`); params.push(dongName); }
  params.push(100);
  const { rows } = await pool.query(`
    SELECT id, article_no, trade_type, deal_price, warranty_price, rent_price,
      formatted_price, exclusive_space, space_name, dong_name,
      target_floor, total_floor, direction, description,
      is_bargain, bargain_keyword, bargain_score, score_factors, first_seen_at,
      (SELECT count(*)::int FROM price_history ph WHERE ph.article_id = articles.id) AS price_change_count
    FROM articles
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT $${idx}
  `, params);
  res.json(rows);
}

// ════════════════════════════════════════
// Market (real_transactions by complex_id)
// ════════════════════════════════════════

async function handleMarketStats(req, res) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT count(*)::int AS total_count,
      count(DISTINCT round(exclu_use_ar::numeric))::int AS area_type_count,
      min(deal_year * 100 + deal_month) AS earliest,
      max(deal_year * 100 + deal_month) AS latest
    FROM real_transactions
    WHERE complex_id = $1 AND ${CANCEL_FILTER}
  `, [req.params.id]);
  res.json(rows[0]);
}

async function handleMarketAreaTypes(req, res) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT area_bucket::float8 AS area_bucket,
      round(area_bucket / 3.3058)::int AS pyeong,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      min(deal_amount) AS min_price,
      max(deal_amount) AS max_price
    FROM (
      SELECT deal_amount, round(exclu_use_ar::numeric * 2) / 2 AS area_bucket
      FROM real_transactions
      WHERE complex_id = $1 AND ${CANCEL_FILTER}
    ) sub
    GROUP BY area_bucket
    ORDER BY area_bucket
  `, [req.params.id]);
  res.json(rows);
}

async function handleMarketTrend(req, res) {
  const pool = getPool();
  const areaBucket = req.query.areaBucket ? parseFloat(req.query.areaBucket) : null;
  const months = parseInt(req.query.months) || 36;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const fromYm = from.getFullYear() * 100 + (from.getMonth() + 1);

  let where = [`complex_id = $1`, `(deal_year * 100 + deal_month) >= $2`, CANCEL_FILTER];
  let params = [req.params.id, fromYm];
  let idx = 3;
  if (areaBucket != null) { where.push(`round(exclu_use_ar::numeric * 2) / 2 = $${idx++}`); params.push(areaBucket); }

  const { rows } = await pool.query(`
    SELECT
      deal_year || '-' || lpad(deal_month::text, 2, '0') AS month,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      min(deal_amount) AS min_price,
      max(deal_amount) AS max_price
    FROM real_transactions
    WHERE ${where.join(' AND ')}
    GROUP BY deal_year, deal_month
    ORDER BY deal_year, deal_month
  `, params);
  res.json(rows);
}

async function handleMarketTransactions(req, res) {
  const pool = getPool();
  const areaBucket = req.query.areaBucket ? parseFloat(req.query.areaBucket) : null;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  let where = [`complex_id = $1`];
  let params = [req.params.id];
  let idx = 2;
  if (areaBucket != null) { where.push(`round(exclu_use_ar::numeric * 2) / 2 = $${idx++}`); params.push(areaBucket); }
  params.push(limit);

  const { rows } = await pool.query(`
    SELECT deal_year, deal_month, deal_day,
      deal_amount, floor,
      round(exclu_use_ar::numeric / 3.3058)::int || '평' AS pyeong_name,
      CASE WHEN cdeal_type = 'O' THEN true ELSE false END AS is_cancel
    FROM real_transactions
    WHERE ${where.join(' AND ')}
    ORDER BY deal_year DESC, deal_month DESC, deal_day DESC NULLS LAST
    LIMIT $${idx}
  `, params);
  res.json(rows);
}

async function handleMarketFloorAnalysis(req, res) {
  const pool = getPool();
  const areaBucket = req.query.areaBucket ? parseFloat(req.query.areaBucket) : null;
  const months = parseInt(req.query.months) || 36;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const fromYm = from.getFullYear() * 100 + (from.getMonth() + 1);

  let where = [`complex_id = $1`, `(deal_year * 100 + deal_month) >= $2`,
    `floor IS NOT NULL`, CANCEL_FILTER];
  let params = [req.params.id, fromYm];
  let idx = 3;
  if (areaBucket != null) { where.push(`round(exclu_use_ar::numeric * 2) / 2 = $${idx++}`); params.push(areaBucket); }

  const { rows } = await pool.query(`
    SELECT
      floor,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      min(deal_amount) AS min_price,
      max(deal_amount) AS max_price
    FROM real_transactions
    WHERE ${where.join(' AND ')}
    GROUP BY floor
    ORDER BY floor
  `, params);
  res.json(rows);
}

// ════════════════════════════════════════
// Real Transactions (global)
// ════════════════════════════════════════

async function handleRealTransactions(req, res) {
  const pool = getPool();
  const { aptNm, sggCd, months = 12, limit = 100 } = req.query;
  let where = [];
  let params = [];
  let idx = 1;

  if (aptNm) { where.push(`apt_nm ILIKE $${idx++}`); params.push(`%${aptNm}%`); }
  if (sggCd) { where.push(`sgg_cd = $${idx++}`); params.push(sggCd); }

  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);
  const fromYm = fromDate.getFullYear() * 100 + (fromDate.getMonth() + 1);
  where.push(`(deal_year * 100 + deal_month) >= $${idx++}`);
  params.push(fromYm);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Math.min(parseInt(limit) || 100, 500));

  const { rows } = await pool.query(`
    SELECT * FROM real_transactions
    ${whereClause}
    ORDER BY deal_year DESC, deal_month DESC, deal_day DESC NULLS LAST
    LIMIT $${idx}
  `, params);
  res.json(rows);
}

async function handleRealTxSummary(req, res) {
  const pool = getPool();
  const { aptNm, sggCd, excluUseAr } = req.query;
  let where = [];
  let params = [];
  let idx = 1;

  if (aptNm) { where.push(`apt_nm ILIKE $${idx++}`); params.push(`%${aptNm}%`); }
  if (sggCd) { where.push(`sgg_cd = $${idx++}`); params.push(sggCd); }
  if (excluUseAr) {
    const area = parseFloat(excluUseAr);
    where.push(`exclu_use_ar BETWEEN $${idx++} AND $${idx++}`);
    params.push(area - 2, area + 2);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT
      apt_nm, sgg_cd, umd_nm, exclu_use_ar,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      min(deal_amount) AS min_price,
      max(deal_amount) AS max_price,
      max(deal_year * 10000 + deal_month * 100 + coalesce(deal_day,0)) AS latest_deal
    FROM real_transactions
    ${whereClause}
    GROUP BY apt_nm, sgg_cd, umd_nm, exclu_use_ar
    ORDER BY tx_count DESC
    LIMIT 50
  `, params);
  res.json(rows);
}

async function handleRealTxCount(_req, res) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT count(*)::int AS count FROM real_transactions');
  res.json({ count: rows[0].count });
}

async function handleRealTxPriceTrend(req, res) {
  const pool = getPool();
  const { aptNm, sggCd, excluUseAr, months = 12 } = req.query;
  let where = [];
  let params = [];
  let idx = 1;

  if (aptNm) { where.push(`apt_nm = $${idx++}`); params.push(aptNm); }
  if (sggCd) { where.push(`sgg_cd = $${idx++}`); params.push(sggCd); }
  if (excluUseAr) {
    const area = parseFloat(excluUseAr);
    where.push(`exclu_use_ar BETWEEN $${idx++} AND $${idx++}`);
    params.push(area - 2, area + 2);
  }
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);
  const fromYm = from.getFullYear() * 100 + (from.getMonth() + 1);
  where.push(`(deal_year * 100 + deal_month) >= $${idx++}`);
  params.push(fromYm);
  where.push(CANCEL_FILTER);

  const { rows } = await pool.query(`
    SELECT
      deal_year || '-' || lpad(deal_month::text, 2, '0') AS month,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      min(deal_amount) AS min_price,
      max(deal_amount) AS max_price,
      round(avg(deal_amount / NULLIF(exclu_use_ar, 0) * 3.3058))::bigint AS avg_price_per_pyeong
    FROM real_transactions
    WHERE ${where.join(' AND ')}
    GROUP BY deal_year, deal_month
    ORDER BY deal_year, deal_month
  `, params);
  res.json(rows);
}

async function handleRealTxFloorAnalysis(req, res) {
  const pool = getPool();
  const { aptNm, sggCd, excluUseAr, months = 12 } = req.query;
  let where = [];
  let params = [];
  let idx = 1;

  if (aptNm) { where.push(`apt_nm = $${idx++}`); params.push(aptNm); }
  if (sggCd) { where.push(`sgg_cd = $${idx++}`); params.push(sggCd); }
  if (excluUseAr) {
    const area = parseFloat(excluUseAr);
    where.push(`exclu_use_ar BETWEEN $${idx++} AND $${idx++}`);
    params.push(area - 2, area + 2);
  }
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);
  where.push(`(deal_year * 100 + deal_month) >= $${idx++}`);
  params.push(from.getFullYear() * 100 + (from.getMonth() + 1));
  where.push(`floor IS NOT NULL`);
  where.push(CANCEL_FILTER);

  const { rows } = await pool.query(`
    SELECT
      floor,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      max(deal_amount) AS max_price,
      min(deal_amount) AS min_price
    FROM real_transactions
    WHERE ${where.join(' AND ')}
    GROUP BY floor
    ORDER BY floor
  `, params);
  res.json(rows);
}

async function handleRealTxAreaTypes(req, res) {
  const pool = getPool();
  const { aptNm, sggCd, months = 6 } = req.query;
  let where = [];
  let params = [];
  let idx = 1;

  if (aptNm) { where.push(`apt_nm = $${idx++}`); params.push(aptNm); }
  if (sggCd) { where.push(`sgg_cd = $${idx++}`); params.push(sggCd); }
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);
  where.push(`(deal_year * 100 + deal_month) >= $${idx++}`);
  params.push(from.getFullYear() * 100 + (from.getMonth() + 1));
  where.push(CANCEL_FILTER);

  const { rows } = await pool.query(`
    SELECT
      exclu_use_ar,
      round(exclu_use_ar / 3.3058)::int AS pyeong,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      round(avg(deal_amount / NULLIF(exclu_use_ar, 0) * 3.3058))::bigint AS avg_price_per_pyeong,
      max(deal_amount) AS max_price,
      min(deal_amount) AS min_price
    FROM real_transactions
    WHERE ${where.join(' AND ')}
    GROUP BY exclu_use_ar
    ORDER BY exclu_use_ar
  `, params);
  res.json(rows);
}

async function handleRealTxRegionCompare(req, res) {
  const pool = getPool();
  const { sggCd, excluUseAr, months = 12 } = req.query;
  if (!sggCd) return res.status(400).json({ error: 'sggCd required (comma-separated)' });

  const codes = sggCd.split(',').map(s => s.trim()).filter(Boolean);
  let params = [...codes];
  let idx = codes.length + 1;

  let areaFilter = '';
  if (excluUseAr) {
    const area = parseFloat(excluUseAr);
    areaFilter = `AND exclu_use_ar BETWEEN $${idx++} AND $${idx++}`;
    params.push(area - 5, area + 5);
  }

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);
  const fromYm = from.getFullYear() * 100 + (from.getMonth() + 1);
  params.push(fromYm);

  const placeholders = codes.map((_, i) => `$${i + 1}`).join(',');

  const { rows } = await pool.query(`
    SELECT
      sgg_cd,
      deal_year || '-' || lpad(deal_month::text, 2, '0') AS month,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      round(avg(deal_amount / NULLIF(exclu_use_ar, 0) * 3.3058))::bigint AS avg_pyeong_price
    FROM real_transactions
    WHERE sgg_cd IN (${placeholders})
      ${areaFilter}
      AND (deal_year * 100 + deal_month) >= $${idx}
      AND ${CANCEL_FILTER}
    GROUP BY sgg_cd, deal_year, deal_month
    ORDER BY sgg_cd, deal_year, deal_month
  `, params);
  res.json(rows);
}

async function handleRealTxVolumeTrend(req, res) {
  const pool = getPool();
  const { sggCd, sido, months = 12 } = req.query;
  let where = [];
  let params = [];
  let idx = 1;

  if (sggCd) { where.push(`sgg_cd = $${idx++}`); params.push(sggCd); }
  if (sido) {
    const sidoMap = { '서울':'11','부산':'26','대구':'27','인천':'28','광주':'29','대전':'30','울산':'31','세종':'36','경기':'41','강원':'51','충북':'43','충남':'44','전북':'52','전남':'46','경북':'47','경남':'48','제주':'50' };
    const prefix = sidoMap[sido];
    if (prefix) { where.push(`sgg_cd LIKE $${idx++}`); params.push(`${prefix}%`); }
  }
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);
  where.push(`(deal_year * 100 + deal_month) >= $${idx++}`);
  params.push(from.getFullYear() * 100 + (from.getMonth() + 1));
  where.push(CANCEL_FILTER);

  const { rows } = await pool.query(`
    SELECT
      deal_year || '-' || lpad(deal_month::text, 2, '0') AS month,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_price,
      sum(deal_amount)::bigint AS total_amount
    FROM real_transactions
    WHERE ${where.join(' AND ')}
    GROUP BY deal_year, deal_month
    ORDER BY deal_year, deal_month
  `, params);
  res.json(rows);
}

async function handleRealTxListingVsActual(req, res) {
  const pool = getPool();
  const { complexName } = req.query;
  if (!complexName) return res.status(400).json({ error: 'complexName required' });

  const listings = await pool.query(`
    SELECT
      a.exclusive_space AS area_exclusive,
      round(a.exclusive_space / 3.3058)::int AS pyeong,
      count(*)::int AS listing_count,
      round(avg(a.deal_price))::bigint AS avg_listing_price,
      min(a.deal_price) AS min_listing_price,
      max(a.deal_price) AS max_listing_price
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE c.complex_name ILIKE $1
      AND a.trade_type = 'A1'
      AND a.article_status = 'active'
      AND a.deal_price > 0
    GROUP BY a.exclusive_space
    ORDER BY a.exclusive_space
  `, [`%${complexName}%`]);

  const now = new Date();
  const from3m = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const fromYm3 = from3m.getFullYear() * 100 + (from3m.getMonth() + 1);

  const actuals = await pool.query(`
    SELECT
      exclu_use_ar AS area_exclusive,
      round(exclu_use_ar / 3.3058)::int AS pyeong,
      count(*)::int AS tx_count,
      round(avg(deal_amount))::bigint AS avg_actual_price,
      min(deal_amount) AS min_actual_price,
      max(deal_amount) AS max_actual_price
    FROM real_transactions
    WHERE apt_nm ILIKE $1
      AND (deal_year * 100 + deal_month) >= $2
      AND ${CANCEL_FILTER}
    GROUP BY exclu_use_ar
    ORDER BY exclu_use_ar
  `, [`%${complexName}%`, fromYm3]);

  res.json({ listings: listings.rows, actuals: actuals.rows });
}

// ════════════════════════════════════════
// Analysis
// ════════════════════════════════════════

async function handleAnalysisOverview(_req, res) {
  const pool = getPool();
  const [bargains, articles, newToday, priceChanges] = await Promise.all([
    pool.query(`SELECT count(*)::int AS count FROM articles WHERE is_bargain = true AND article_status = 'active'`),
    pool.query(`SELECT count(*)::int AS count FROM articles WHERE article_status = 'active'`),
    pool.query(`SELECT count(*)::int AS count FROM articles WHERE article_status = 'active' AND first_seen_at >= CURRENT_DATE`),
    pool.query(`SELECT count(*)::int AS count FROM price_history WHERE recorded_at >= CURRENT_DATE`),
  ]);
  const totalBargains = bargains.rows[0].count;
  const totalArticles = articles.rows[0].count;
  res.json({
    total_bargains: totalBargains,
    total_articles: totalArticles,
    bargain_ratio: totalArticles > 0 ? Math.round((totalBargains / totalArticles) * 1000) / 10 : 0,
    new_today: newToday.rows[0].count,
    price_changes_today: priceChanges.rows[0].count,
  });
}

async function handleBargainLeaderboard(req, res) {
  const pool = getPool();
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const bt = req.query.bargain_type;
  const bargainFilter = bargainTypeCondition(bt);
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
  res.json(rows);
}

async function handleRecentPriceChanges(req, res) {
  const pool = getPool();
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const { rows } = await pool.query(`
    SELECT
      ph.article_id,
      c.complex_name,
      a.exclusive_space,
      ph.deal_price AS new_price,
      ph.formatted_price AS new_price_text,
      lag(ph.deal_price) OVER (PARTITION BY ph.article_id ORDER BY ph.recorded_at) AS prev_price,
      CASE
        WHEN lag(ph.deal_price) OVER (PARTITION BY ph.article_id ORDER BY ph.recorded_at) > 0
        THEN round(
          (ph.deal_price - lag(ph.deal_price) OVER (PARTITION BY ph.article_id ORDER BY ph.recorded_at))::numeric
          / lag(ph.deal_price) OVER (PARTITION BY ph.article_id ORDER BY ph.recorded_at)::numeric * 100, 1
        )
        ELSE NULL
      END AS change_pct,
      ph.recorded_at
    FROM price_history ph
    JOIN articles a ON ph.article_id = a.id
    JOIN complexes c ON a.complex_id = c.id
    WHERE a.article_status = 'active'
    ORDER BY ph.recorded_at DESC
    LIMIT $1 * 2
  `, [limit]);
  const filtered = rows.filter(r => r.prev_price != null).slice(0, limit);
  res.json(filtered);
}

async function handleTopPriceDrops(req, res) {
  const pool = getPool();
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
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
    ORDER BY drop_amount DESC
    LIMIT $1
  `, [limit]);
  res.json(rows);
}

async function handleDistrictHeatmap(_req, res) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      c.division AS district,
      count(*) FILTER (WHERE a.article_status = 'active')::int AS total_articles,
      count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::int AS bargain_count,
      CASE WHEN count(*) FILTER (WHERE a.article_status = 'active') > 0
        THEN round(
          count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::numeric
          / count(*) FILTER (WHERE a.article_status = 'active')::numeric * 100, 1
        )
        ELSE 0
      END AS bargain_ratio,
      round(avg(a.deal_price) FILTER (WHERE a.deal_price > 0 AND a.article_status = 'active'))::bigint AS avg_price,
      count(DISTINCT c.id)::int AS complex_count
    FROM complexes c
    LEFT JOIN articles a ON a.complex_id = c.id AND a.trade_type = 'A1'
    WHERE c.is_active = true AND c.division IS NOT NULL
    GROUP BY c.division
    HAVING count(*) FILTER (WHERE a.article_status = 'active') > 0
    ORDER BY count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active') DESC
  `);
  res.json(rows);
}

async function handleDistrictBargains(req, res) {
  const pool = getPool();
  const { district } = req.query;
  if (!district) return res.status(400).json({ error: 'district required' });
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const { rows } = await pool.query(`
    SELECT a.id, a.article_no, a.deal_price, a.formatted_price, a.exclusive_space,
      a.target_floor, a.total_floor, a.direction, a.description, a.bargain_keyword, a.first_seen_at,
      c.complex_name, c.property_type
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE a.is_bargain = true AND a.article_status = 'active'
      AND c.division = $1 AND a.trade_type = 'A1'
    ORDER BY a.first_seen_at DESC
    LIMIT $2
  `, [district, limit]);
  res.json(rows);
}

async function handleRegionalDongRankings(req, res) {
  const pool = getPool();
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const bt = req.query.bargainType || 'all';
  let bargainWhere;
  if (bt === 'keyword') bargainWhere = `a.bargain_type IN ('keyword', 'both')`;
  else if (bt === 'price') bargainWhere = `a.bargain_score >= 60 AND a.bargain_type IN ('price', 'both')`;
  else bargainWhere = `a.is_bargain = true`;

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
  res.json(rows);
}

async function handleRegionalDongArticles(req, res) {
  const pool = getPool();
  const { division, sector } = req.query;
  if (!division || !sector) return res.status(400).json({ error: 'division and sector required' });
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  const { rows } = await pool.query(`
    SELECT a.id, a.article_no, a.deal_price, a.formatted_price, a.exclusive_space,
      a.target_floor, a.total_floor, a.bargain_keyword, a.bargain_score,
      a.first_seen_at, a.bargain_type,
      c.complex_name, c.id AS complex_id, c.hscp_no
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE a.is_bargain = true AND a.article_status = 'active'
      AND c.division = $1 AND c.sector = $2 AND a.trade_type = 'A1'
    ORDER BY a.bargain_score DESC NULLS LAST
    LIMIT $3
  `, [division, sector, limit]);
  res.json(rows);
}

// ════════════════════════════════════════
// Map
// ════════════════════════════════════════

async function handleSidoHeatmap(req, res) {
  const pool = getPool();
  const bt = req.query.bargain_type;
  const bargainFilter = bt === 'keyword'
    ? `a.bargain_type IN ('keyword', 'both')`
    : bt === 'price'
    ? `a.bargain_type IN ('price', 'both')`
    : `a.is_bargain = true`;
  const { rows } = await pool.query(`
    SELECT
      c.city AS sido_name,
      count(*) FILTER (WHERE a.article_status = 'active')::int AS total_articles,
      count(*) FILTER (WHERE ${bargainFilter} AND a.article_status = 'active')::int AS bargain_count,
      CASE WHEN count(*) FILTER (WHERE a.article_status = 'active') > 0
        THEN round(
          count(*) FILTER (WHERE ${bargainFilter} AND a.article_status = 'active')::numeric
          / count(*) FILTER (WHERE a.article_status = 'active')::numeric * 100, 1
        )
        ELSE 0
      END AS bargain_ratio,
      count(DISTINCT c.id)::int AS complex_count
    FROM complexes c
    LEFT JOIN articles a ON a.complex_id = c.id AND a.trade_type = 'A1'
    WHERE c.is_active = true AND c.city IS NOT NULL
    GROUP BY c.city
    ORDER BY count(*) FILTER (WHERE ${bargainFilter} AND a.article_status = 'active') DESC
  `);
  res.json(rows);
}

async function handleSigunguHeatmap(req, res) {
  const pool = getPool();
  const { sido } = req.query;
  if (!sido) return res.status(400).json({ error: 'sido required' });
  const bt = req.query.bargain_type;
  const bargainFilter = bt === 'keyword'
    ? `a.bargain_type IN ('keyword', 'both')`
    : bt === 'price'
    ? `a.bargain_type IN ('price', 'both')`
    : `a.is_bargain = true`;
  const { rows } = await pool.query(`
    SELECT
      c.division AS sgg_name,
      count(*) FILTER (WHERE a.article_status = 'active')::int AS total_articles,
      count(*) FILTER (WHERE ${bargainFilter} AND a.article_status = 'active')::int AS bargain_count,
      CASE WHEN count(*) FILTER (WHERE a.article_status = 'active') > 0
        THEN round(
          count(*) FILTER (WHERE ${bargainFilter} AND a.article_status = 'active')::numeric
          / count(*) FILTER (WHERE a.article_status = 'active')::numeric * 100, 1
        )
        ELSE 0
      END AS bargain_ratio,
      count(DISTINCT c.id)::int AS complex_count
    FROM complexes c
    LEFT JOIN articles a ON a.complex_id = c.id AND a.trade_type = 'A1'
    WHERE c.is_active = true AND c.city = $1
    GROUP BY c.division
    ORDER BY count(*) FILTER (WHERE ${bargainFilter} AND a.article_status = 'active') DESC
  `, [sido]);
  res.json(rows);
}

async function handleSigunguComplexes(req, res) {
  const pool = getPool();
  const { sggCd, division, city, bargain_type } = req.query;
  const divisionFilter = division || sggCd;
  if (!divisionFilter) return res.status(400).json({ error: 'division or sggCd required' });
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  let where = ['c.division = $1', 'c.is_active = true'];
  let params = [divisionFilter];
  let idx = 2;
  if (city) { where.push(`c.city = $${idx++}`); params.push(city); }
  if (bargain_type === 'price') {
    where.push(`EXISTS (SELECT 1 FROM articles a2 WHERE a2.complex_id = c.id AND a2.article_status = 'active' AND a2.bargain_type IN ('price','both'))`);
  } else if (bargain_type === 'keyword') {
    where.push(`EXISTS (SELECT 1 FROM articles a2 WHERE a2.complex_id = c.id AND a2.article_status = 'active' AND a2.bargain_type IN ('keyword','both'))`);
  }
  params.push(limit);

  const { rows } = await pool.query(`
    SELECT
      c.id AS complex_id,
      c.complex_name,
      c.lat, c.lon,
      count(*) FILTER (WHERE a.article_status = 'active')::int AS total_articles,
      count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::int AS bargain_count,
      CASE WHEN count(*) FILTER (WHERE a.article_status = 'active') > 0
        THEN round(
          count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::numeric
          / count(*) FILTER (WHERE a.article_status = 'active')::numeric * 100, 1
        )
        ELSE 0
      END AS bargain_ratio,
      round(avg(a.deal_price) FILTER (WHERE a.deal_price > 0 AND a.article_status = 'active'))::bigint AS avg_price
    FROM complexes c
    LEFT JOIN articles a ON a.complex_id = c.id AND a.trade_type = 'A1'
    WHERE ${where.join(' AND ')}
    GROUP BY c.id, c.complex_name, c.lat, c.lon
    ORDER BY count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active') DESC, total_articles DESC
    LIMIT $${idx}
  `, params);
  res.json(rows);
}

// ════════════════════════════════════════
// Stats
// ════════════════════════════════════════

async function handleStats(_req, res) {
  const data = await cached('stats', 60_000, async () => {
    const pool = getPool();
    const [complexes, articles, bargains, removed, realTx, runs, lastCollection] = await Promise.all([
      pool.query(`SELECT count(*)::int as count FROM complexes`),
      pool.query(`SELECT count(*)::int as count FROM articles WHERE article_status='active'`),
      pool.query(`SELECT count(*)::int as count FROM articles WHERE is_bargain = true AND article_status='active'`),
      pool.query(`SELECT count(*)::int as count FROM articles WHERE article_status='removed'`),
      pool.query(`SELECT count(*)::int as count FROM real_transactions`),
      pool.query(`SELECT * FROM collection_runs ORDER BY started_at DESC LIMIT 5`),
      pool.query(`SELECT max(last_collected_at) AS last_collected_at FROM complexes`),
    ]);
    return {
      complexCount: complexes.rows[0].count,
      articleCount: articles.rows[0].count,
      bargainCount: bargains.rows[0].count,
      removedCount: removed.rows[0].count,
      realTransactionCount: realTx.rows[0].count,
      lastCollectionAt: lastCollection.rows[0].last_collected_at,
      recentRuns: runs.rows,
    };
  });
  res.json(data);
}

async function handleDistricts(_req, res) {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT DISTINCT division AS district
    FROM complexes
    WHERE is_active = true AND division IS NOT NULL
    ORDER BY division
  `);
  res.json(rows.map(r => r.district));
}

// ════════════════════════════════════════
// Users
// ════════════════════════════════════════

async function handleGetProfile(req, res) {
  const pool = getPool();
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { rows } = await pool.query(
    `SELECT id, nickname, nickname_changed_at, created_at FROM users WHERE id = $1`,
    [user.userId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
}

async function handleUpdateNickname(req, res) {
  const pool = getPool();
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { nickname } = req.body || {};
  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({ error: '닉네임을 입력해주세요' });
  }
  const trimmed = nickname.trim();
  if (trimmed.length < 2 || trimmed.length > 12) {
    return res.status(400).json({ error: '닉네임은 2~12자여야 합니다' });
  }

  // Check 30-day restriction
  const { rows: [me] } = await pool.query(
    `SELECT nickname_changed_at FROM users WHERE id = $1`,
    [user.userId]
  );
  if (me?.nickname_changed_at) {
    const lastChanged = new Date(me.nickname_changed_at);
    const nextAllowed = new Date(lastChanged.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (new Date() < nextAllowed) {
      return res.status(400).json({
        error: `닉네임 변경은 30일마다 가능합니다`,
        next_change_at: nextAllowed.toISOString(),
      });
    }
  }

  // Check duplicate
  const { rows: dup } = await pool.query(
    `SELECT id FROM users WHERE nickname = $1 AND id != $2`,
    [trimmed, user.userId]
  );
  if (dup.length > 0) {
    return res.status(400).json({ error: '이미 사용 중인 닉네임입니다' });
  }

  await pool.query(
    `UPDATE users SET nickname = $1, nickname_changed_at = NOW() WHERE id = $2`,
    [trimmed, user.userId]
  );
  res.json({ nickname: trimmed });
}

// ════════════════════════════════════════
// Community
// ════════════════════════════════════════

async function handleCommunityPosts(req, res) {
  const pool = getPool();
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const sort = req.query.sort || 'newest';
  const offset = (page - 1) * limit;
  const user = extractUser(req);
  const userId = user?.userId || null;

  const orderBy = sort === 'popular'
    ? 'p.like_count DESC, p.created_at DESC'
    : 'p.created_at DESC';

  const { rows } = await pool.query(`
    SELECT p.id, p.title, p.content, p.nickname,
      p.attached_article_id, p.view_count, p.like_count, p.comment_count,
      p.created_at, p.updated_at,
      CASE WHEN p.attached_article_id IS NOT NULL THEN (
        SELECT row_to_json(sub) FROM (
          SELECT a.id, a.deal_price, a.formatted_price, a.exclusive_space,
            a.trade_type, a.space_name, a.direction, a.description, a.dong_name,
            a.score_factors, a.first_seen_at, a.target_floor, a.total_floor,
            a.bargain_score, a.bargain_keyword, c.complex_name, c.id AS complex_id
          FROM articles a JOIN complexes c ON a.complex_id = c.id
          WHERE a.id = p.attached_article_id
        ) sub
      ) END AS attached_article,
      CASE WHEN $3::bigint IS NOT NULL THEN EXISTS(
        SELECT 1 FROM community_likes cl WHERE cl.post_id = p.id AND cl.user_id = $3
      ) ELSE false END AS liked_by_me
    FROM community_posts p
    WHERE p.is_deleted = false
    ORDER BY ${orderBy}
    LIMIT $1 OFFSET $2
  `, [limit, offset, userId]);

  const { rows: [{ count }] } = await pool.query(
    `SELECT count(*)::int FROM community_posts WHERE is_deleted = false`
  );

  res.json({ posts: rows, total: count, page, limit });
}

async function handleCommunityCreatePost(req, res) {
  const pool = getPool();
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { title, content, attached_article_id } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'title and content required' });
  }
  const { rows: [u] } = await pool.query(`SELECT nickname FROM users WHERE id = $1`, [user.userId]);
  const nickname = u?.nickname || '익명';

  const { rows } = await pool.query(`
    INSERT INTO community_posts (title, content, nickname, attached_article_id, user_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [title.trim(), content.trim(), nickname, attached_article_id || null, user.userId]);
  res.status(201).json(rows[0]);
}

async function handleCommunityPostDetail(req, res) {
  const pool = getPool();
  const user = extractUser(req);
  const userId = user?.userId || null;

  await pool.query(
    `UPDATE community_posts SET view_count = view_count + 1 WHERE id = $1`,
    [req.params.id]
  );

  const { rows: [post] } = await pool.query(`
    SELECT p.*,
      CASE WHEN p.attached_article_id IS NOT NULL THEN (
        SELECT row_to_json(sub) FROM (
          SELECT a.id, a.deal_price, a.formatted_price, a.exclusive_space,
            a.trade_type, a.target_floor, a.total_floor, a.bargain_score,
            a.bargain_keyword, a.space_name, a.direction, a.description, a.dong_name,
            a.score_factors, a.first_seen_at, c.complex_name, c.id AS complex_id
          FROM articles a JOIN complexes c ON a.complex_id = c.id
          WHERE a.id = p.attached_article_id
        ) sub
      ) END AS attached_article,
      CASE WHEN $2::bigint IS NOT NULL THEN EXISTS(
        SELECT 1 FROM community_likes cl WHERE cl.post_id = p.id AND cl.user_id = $2
      ) ELSE false END AS liked_by_me
    FROM community_posts p
    WHERE p.id = $1 AND p.is_deleted = false
  `, [req.params.id, userId]);
  if (!post) return res.status(404).json({ error: 'Not found' });

  const { rows: comments } = await pool.query(`
    SELECT cc.*,
      CASE WHEN $2::bigint IS NOT NULL THEN EXISTS(
        SELECT 1 FROM community_likes cl WHERE cl.comment_id = cc.id AND cl.user_id = $2
      ) ELSE false END AS liked_by_me
    FROM community_comments cc
    WHERE cc.post_id = $1 AND cc.is_deleted = false
    ORDER BY cc.created_at ASC
  `, [req.params.id, userId]);

  res.json({ ...post, comments });
}

async function handleCommunityAddComment(req, res) {
  const pool = getPool();
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { content, parent_id } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content required' });

  const { rows: [u] } = await pool.query(`SELECT nickname FROM users WHERE id = $1`, [user.userId]);
  const nickname = u?.nickname || '익명';

  const { rows } = await pool.query(`
    INSERT INTO community_comments (post_id, parent_id, content, nickname, user_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [req.params.id, parent_id || null, content.trim(), nickname, user.userId]);

  await pool.query(
    `UPDATE community_posts SET comment_count = (
      SELECT count(*)::int FROM community_comments WHERE post_id = $1 AND is_deleted = false
    ) WHERE id = $1`,
    [req.params.id]
  );

  res.status(201).json(rows[0]);
}

async function handleCommunityLike(req, res) {
  const pool = getPool();
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await pool.query(
    `INSERT INTO community_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.params.id, user.userId]
  );
  await pool.query(
    `UPDATE community_posts SET like_count = (
      SELECT count(*)::int FROM community_likes WHERE post_id = $1
    ) WHERE id = $1`,
    [req.params.id]
  );
  const { rows: [{ like_count }] } = await pool.query(
    `SELECT like_count FROM community_posts WHERE id = $1`,
    [req.params.id]
  );
  res.json({ like_count, liked: true });
}

async function handleCommunityUnlike(req, res) {
  const pool = getPool();
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await pool.query(
    `DELETE FROM community_likes WHERE post_id = $1 AND user_id = $2`,
    [req.params.id, user.userId]
  );
  await pool.query(
    `UPDATE community_posts SET like_count = (
      SELECT count(*)::int FROM community_likes WHERE post_id = $1
    ) WHERE id = $1`,
    [req.params.id]
  );
  const { rows: [{ like_count }] } = await pool.query(
    `SELECT like_count FROM community_posts WHERE id = $1`,
    [req.params.id]
  );
  res.json({ like_count, liked: false });
}
