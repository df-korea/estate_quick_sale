#!/usr/bin/env node
/**
 * API server for estate_quick_sale frontend.
 * Connects to local PostgreSQL and serves REST endpoints.
 *
 * Usage: node apps/api/server.mjs
 * Default port: 3001
 */

import express from 'express';
import cors from 'cors';
import { pool } from '../../scripts/db.mjs';

const app = express();
app.use(cors());
app.use(express.json());

// ── 가격 포맷 헬퍼 (원 → 억/만원) ──

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

// ============================================
// 급매 (Bargains)
// ============================================

// GET /api/bargains?limit=50
app.get('/api/bargains', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.article_no, a.complex_id, a.trade_type,
        a.deal_price, a.warranty_price, a.rent_price, a.formatted_price,
        a.exclusive_space, a.supply_space, a.target_floor, a.total_floor,
        a.direction, a.description, a.dong_name,
        a.image_url, a.brokerage_name, a.bargain_keyword,
        a.first_seen_at, a.management_fee, a.verification_type,
        a.price_change_status, a.image_count,
        c.complex_name, c.property_type, c.hscp_no,
        (SELECT count(*)::int FROM price_history ph WHERE ph.article_id = a.id) AS price_change_count,
        (SELECT ph2.deal_price FROM price_history ph2 WHERE ph2.article_id = a.id ORDER BY ph2.recorded_at ASC LIMIT 1) AS initial_price
      FROM articles a
      JOIN complexes c ON a.complex_id = c.id
      WHERE a.is_bargain = true AND a.article_status = 'active'
      ORDER BY a.first_seen_at DESC
      LIMIT $1
    `, [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/bargains/count
app.get('/api/bargains/count', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int as count FROM articles WHERE is_bargain = true AND article_status = 'active'`
    );
    res.json({ count: rows[0].count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 매물 상세 (Article Detail)
// ============================================

// GET /api/articles/:id
app.get('/api/articles/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*,
        c.complex_name, c.property_type AS complex_property_type, c.hscp_no AS complex_hscp_no, c.total_households,
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
    };
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/articles/:id/price-history
app.get('/api/articles/:id/price-history', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, deal_price, formatted_price, source, modified_date, recorded_at
       FROM price_history WHERE article_id=$1 ORDER BY recorded_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 단지 (Complexes)
// ============================================

// GET /api/complexes/search?q=잠실
app.get('/api/complexes/search', async (req, res) => {
  const q = req.query.q || '';
  if (q.length < 1) return res.json([]);
  try {
    const { rows } = await pool.query(`
      SELECT id, hscp_no, complex_name, property_type, total_households, deal_count, lease_count, rent_count
      FROM complexes
      WHERE is_active = true AND complex_name ILIKE $1
      ORDER BY total_households DESC NULLS LAST
      LIMIT 20
    `, [`%${q}%`]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/complexes/:id
app.get('/api/complexes/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM complexes WHERE id=$1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/complexes/:id/articles?tradeType=A1
app.get('/api/complexes/:id/articles', async (req, res) => {
  const tradeType = req.query.tradeType || 'A1';
  try {
    const { rows } = await pool.query(`
      SELECT id, article_no, deal_price, formatted_price, exclusive_space,
        target_floor, total_floor, direction, description,
        is_bargain, bargain_keyword, first_seen_at
      FROM articles
      WHERE complex_id=$1 AND trade_type=$2 AND article_status='active'
      ORDER BY deal_price ASC NULLS LAST
      LIMIT 100
    `, [req.params.id, tradeType]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 실거래가 (Real Transactions)
// ============================================

// GET /api/real-transactions?aptNm=잠실엘스&months=12&sggCd=11710
app.get('/api/real-transactions', async (req, res) => {
  const { aptNm, sggCd, months = 12, limit = 100 } = req.query;
  try {
    let where = [];
    let params = [];
    let idx = 1;

    if (aptNm) {
      where.push(`apt_nm ILIKE $${idx++}`);
      params.push(`%${aptNm}%`);
    }
    if (sggCd) {
      where.push(`sgg_cd = $${idx++}`);
      params.push(sggCd);
    }

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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/real-transactions/summary?aptNm=잠실엘스&sggCd=11710
app.get('/api/real-transactions/summary', async (req, res) => {
  const { aptNm, sggCd, excluUseAr } = req.query;
  try {
    let where = [];
    let params = [];
    let idx = 1;

    if (aptNm) {
      where.push(`apt_nm ILIKE $${idx++}`);
      params.push(`%${aptNm}%`);
    }
    if (sggCd) {
      where.push(`sgg_cd = $${idx++}`);
      params.push(sggCd);
    }
    if (excluUseAr) {
      const area = parseFloat(excluUseAr);
      where.push(`exclu_use_ar BETWEEN $${idx++} AND $${idx++}`);
      params.push(area - 2, area + 2);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT
        apt_nm,
        sgg_cd,
        umd_nm,
        exclu_use_ar,
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/real-transactions/count
app.get('/api/real-transactions/count', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM real_transactions');
    res.json({ count: rows[0].count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/real-transactions/price-trend?aptNm=잠실엘스&sggCd=11710&excluUseAr=84.82
app.get('/api/real-transactions/price-trend', async (req, res) => {
  const { aptNm, sggCd, excluUseAr, months = 12 } = req.query;
  try {
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
    where.push(`(cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')`);

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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/real-transactions/floor-analysis
app.get('/api/real-transactions/floor-analysis', async (req, res) => {
  const { aptNm, sggCd, excluUseAr, months = 12 } = req.query;
  try {
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
    where.push(`(cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')`);

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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/real-transactions/area-types
app.get('/api/real-transactions/area-types', async (req, res) => {
  const { aptNm, sggCd, months = 6 } = req.query;
  try {
    let where = [];
    let params = [];
    let idx = 1;

    if (aptNm) { where.push(`apt_nm = $${idx++}`); params.push(aptNm); }
    if (sggCd) { where.push(`sgg_cd = $${idx++}`); params.push(sggCd); }
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);
    where.push(`(deal_year * 100 + deal_month) >= $${idx++}`);
    params.push(from.getFullYear() * 100 + (from.getMonth() + 1));
    where.push(`(cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')`);

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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/real-transactions/region-compare
app.get('/api/real-transactions/region-compare', async (req, res) => {
  const { sggCd, excluUseAr, months = 12 } = req.query;
  if (!sggCd) return res.status(400).json({ error: 'sggCd required (comma-separated)' });

  try {
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
        AND (cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')
      GROUP BY sgg_cd, deal_year, deal_month
      ORDER BY sgg_cd, deal_year, deal_month
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/real-transactions/volume-trend
app.get('/api/real-transactions/volume-trend', async (req, res) => {
  const { sggCd, sido, months = 12 } = req.query;
  try {
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
    where.push(`(cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')`);

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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/real-transactions/listing-vs-actual?complexName=잠실엘스
app.get('/api/real-transactions/listing-vs-actual', async (req, res) => {
  const { complexName } = req.query;
  if (!complexName) return res.status(400).json({ error: 'complexName required' });

  try {
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
        AND (cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')
      GROUP BY exclu_use_ar
      ORDER BY exclu_use_ar
    `, [`%${complexName}%`, fromYm3]);

    res.json({ listings: listings.rows, actuals: actuals.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 분석 (Analysis)
// ============================================

// GET /api/analysis/overview
app.get('/api/analysis/overview', async (_req, res) => {
  try {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/analysis/bargain-leaderboard?limit=20
app.get('/api/analysis/bargain-leaderboard', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id AS complex_id,
        c.complex_name,
        count(*) FILTER (WHERE a.is_bargain = true)::int AS bargain_count,
        count(*)::int AS total_count,
        CASE WHEN count(*) > 0
          THEN round(count(*) FILTER (WHERE a.is_bargain = true)::numeric / count(*)::numeric * 100, 1)
          ELSE 0
        END AS bargain_ratio,
        round(avg(a.deal_price) FILTER (WHERE a.deal_price > 0))::bigint AS avg_price
      FROM articles a
      JOIN complexes c ON a.complex_id = c.id
      WHERE a.article_status = 'active'
      GROUP BY c.id, c.complex_name
      HAVING count(*) FILTER (WHERE a.is_bargain = true) > 0
      ORDER BY count(*) FILTER (WHERE a.is_bargain = true) DESC, bargain_ratio DESC
      LIMIT $1
    `, [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/analysis/recent-price-changes?limit=20
app.get('/api/analysis/recent-price-changes', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 관심단지 (Watchlist)
// ============================================

// GET /api/bargains/by-complexes?ids=1,2,3
app.get('/api/bargains/by-complexes', async (req, res) => {
  const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
  if (ids.length === 0) return res.json([]);
  try {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 급매 스코어 + 가격 판단 (Assessment)
// ============================================

// GET /api/articles/:id/assessment
app.get('/api/articles/:id/assessment', async (req, res) => {
  try {
    const { rows: [article] } = await pool.query(`
      SELECT a.id, a.deal_price, a.exclusive_space, a.first_seen_at, a.is_bargain,
        a.bargain_keyword, a.complex_id, c.complex_name
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
    const { rows: [txStats] } = await pool.query(`
      SELECT count(*)::int AS tx_count,
        round(avg(deal_amount))::bigint AS avg_tx_price
      FROM real_transactions
      WHERE apt_nm = $1
        AND exclu_use_ar BETWEEN $2::numeric - 3 AND $2::numeric + 3
        AND (deal_year * 100 + deal_month) >= $3
        AND (cdeal_type IS NULL OR cdeal_type = '' OR cdeal_type != 'O')
    `, [article.complex_name, parseFloat(article.exclusive_space) || 0, fromYm]);

    const { rows: [phCount] } = await pool.query(
      `SELECT count(*)::int AS cnt FROM price_history WHERE article_id = $1`,
      [article.id]
    );

    // 급매 스코어 계산
    let score = 0;
    const factors = [];

    if (article.is_bargain) {
      score += 25;
      factors.push({ name: '급매 키워드', value: 25 });
    }

    const avgPrice = complexStats?.avg_price;
    let discountVsComplex = null;
    if (avgPrice && article.deal_price && avgPrice > 0) {
      discountVsComplex = ((article.deal_price - avgPrice) / avgPrice) * 100;
      if (discountVsComplex < -15) { score += 30; factors.push({ name: '단지 대비 15%+ 저렴', value: 30 }); }
      else if (discountVsComplex < -10) { score += 22; factors.push({ name: '단지 대비 10%+ 저렴', value: 22 }); }
      else if (discountVsComplex < -5) { score += 15; factors.push({ name: '단지 대비 5%+ 저렴', value: 15 }); }
      else if (discountVsComplex < 0) { score += 5; factors.push({ name: '단지 평균 이하', value: 5 }); }
    }

    let discountVsTx = null;
    if (txStats?.avg_tx_price && article.deal_price && txStats.avg_tx_price > 0) {
      discountVsTx = ((article.deal_price - txStats.avg_tx_price) / txStats.avg_tx_price) * 100;
      if (discountVsTx < -10) { score += 25; factors.push({ name: '실거래 대비 10%+ 저렴', value: 25 }); }
      else if (discountVsTx < -5) { score += 18; factors.push({ name: '실거래 대비 5%+ 저렴', value: 18 }); }
      else if (discountVsTx < 0) { score += 8; factors.push({ name: '실거래 이하', value: 8 }); }
    }

    if (phCount.cnt > 2) { score += 10; factors.push({ name: '호가 3회+ 변동', value: 10 }); }
    else if (phCount.cnt > 1) { score += 5; factors.push({ name: '호가 변동 이력', value: 5 }); }

    const daysOnMarket = Math.floor((Date.now() - new Date(article.first_seen_at).getTime()) / 86400000);
    if (daysOnMarket > 60) { score += 10; factors.push({ name: '60일+ 미판매', value: 10 }); }
    else if (daysOnMarket > 30) { score += 6; factors.push({ name: '30일+ 미판매', value: 6 }); }
    else if (daysOnMarket > 14) { score += 3; factors.push({ name: '2주+ 미판매', value: 3 }); }

    const isLowest = complexStats?.min_price && article.deal_price && article.deal_price <= complexStats.min_price;

    res.json({
      score: Math.min(score, 100),
      factors,
      discount_vs_complex: discountVsComplex ? Math.round(discountVsComplex * 10) / 10 : null,
      discount_vs_transaction: discountVsTx ? Math.round(discountVsTx * 10) / 10 : null,
      complex_avg_price: avgPrice,
      complex_listing_count: complexStats?.count || 0,
      tx_avg_price: txStats?.avg_tx_price || null,
      tx_count: txStats?.tx_count || 0,
      days_on_market: daysOnMarket,
      price_change_count: phCount.cnt,
      is_lowest_in_complex: isLowest,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 브리핑 (Daily Briefing)
// ============================================

// GET /api/briefing
app.get('/api/briefing', async (_req, res) => {
  try {
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

    res.json({
      summary: overview.rows[0],
      new_bargains: newBargains.rows,
      price_drops: drops,
      hot_complexes: hotComplexes.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 지도 히트맵 (Map — complexes.city/division 직접 사용)
// ============================================

// GET /api/map/sido-heatmap
app.get('/api/map/sido-heatmap', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.city AS sido_name,
        count(*) FILTER (WHERE a.article_status = 'active')::int AS total_articles,
        count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::int AS bargain_count,
        CASE WHEN count(*) FILTER (WHERE a.article_status = 'active') > 0
          THEN round(
            count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::numeric
            / count(*) FILTER (WHERE a.article_status = 'active')::numeric * 100, 1
          )
          ELSE 0
        END AS bargain_ratio,
        count(DISTINCT c.id)::int AS complex_count
      FROM complexes c
      LEFT JOIN articles a ON a.complex_id = c.id AND a.trade_type = 'A1'
      WHERE c.is_active = true AND c.city IS NOT NULL
      GROUP BY c.city
      ORDER BY count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active') DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/map/sigungu-heatmap?sido=서울특별시
app.get('/api/map/sigungu-heatmap', async (req, res) => {
  const { sido } = req.query;
  if (!sido) return res.status(400).json({ error: 'sido required' });
  try {
    const { rows } = await pool.query(`
      SELECT
        c.division AS sgg_name,
        count(*) FILTER (WHERE a.article_status = 'active')::int AS total_articles,
        count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::int AS bargain_count,
        CASE WHEN count(*) FILTER (WHERE a.article_status = 'active') > 0
          THEN round(
            count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active')::numeric
            / count(*) FILTER (WHERE a.article_status = 'active')::numeric * 100, 1
          )
          ELSE 0
        END AS bargain_ratio,
        count(DISTINCT c.id)::int AS complex_count
      FROM complexes c
      LEFT JOIN articles a ON a.complex_id = c.id AND a.trade_type = 'A1'
      WHERE c.is_active = true AND c.city = $1
      GROUP BY c.division
      ORDER BY count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active') DESC
    `, [sido]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/map/sigungu-complexes?division=송파구&limit=50
app.get('/api/map/sigungu-complexes', async (req, res) => {
  const { sggCd, division } = req.query;
  const divisionFilter = division || sggCd;
  if (!divisionFilter) return res.status(400).json({ error: 'division or sggCd required' });
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id AS complex_id,
        c.complex_name,
        c.lat,
        c.lon,
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
      WHERE c.division = $1 AND c.is_active = true
      GROUP BY c.id, c.complex_name, c.lat, c.lon
      HAVING count(*) FILTER (WHERE a.article_status = 'active') > 0
      ORDER BY count(*) FILTER (WHERE a.is_bargain = true AND a.article_status = 'active') DESC, total_articles DESC
      LIMIT $2
    `, [divisionFilter, limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 구/동별 급매 히트맵 (District) — complexes.division 사용
// ============================================

// GET /api/analysis/district-heatmap
app.get('/api/analysis/district-heatmap', async (_req, res) => {
  try {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/analysis/district-bargains?district=송파구
app.get('/api/analysis/district-bargains', async (req, res) => {
  const { district } = req.query;
  if (!district) return res.status(400).json({ error: 'district required' });
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  try {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 고급 필터 (Enhanced Search)
// ============================================

// GET /api/bargains/filtered
app.get('/api/bargains/filtered', async (req, res) => {
  const { sort = 'newest', minPrice, maxPrice, minArea, maxArea, district, limit: lim = 50 } = req.query;
  const limit = Math.min(parseInt(lim) || 50, 200);
  try {
    let where = [`a.is_bargain = true`, `a.article_status = 'active'`, `a.trade_type = 'A1'`];
    let params = [];
    let idx = 1;

    if (minPrice) { where.push(`a.deal_price >= $${idx++}`); params.push(parseInt(minPrice)); }
    if (maxPrice) { where.push(`a.deal_price <= $${idx++}`); params.push(parseInt(maxPrice)); }
    if (minArea) { where.push(`a.exclusive_space >= $${idx++}`); params.push(parseFloat(minArea)); }
    if (maxArea) { where.push(`a.exclusive_space <= $${idx++}`); params.push(parseFloat(maxArea)); }
    if (district) { where.push(`c.division = $${idx++}`); params.push(district); }

    const sortMap = {
      newest: 'a.first_seen_at DESC',
      price_asc: 'a.deal_price ASC NULLS LAST',
      price_desc: 'a.deal_price DESC NULLS LAST',
      area_asc: 'a.exclusive_space ASC NULLS LAST',
      area_desc: 'a.exclusive_space DESC NULLS LAST',
    };
    const orderBy = sortMap[sort] || sortMap.newest;
    params.push(limit);

    const { rows } = await pool.query(`
      SELECT a.id, a.article_no, a.complex_id, a.trade_type,
        a.deal_price, a.formatted_price, a.warranty_price, a.rent_price,
        a.exclusive_space, a.target_floor, a.total_floor, a.direction,
        a.description, a.dong_name,
        a.bargain_keyword, a.first_seen_at,
        c.complex_name, c.property_type, c.hscp_no,
        (SELECT count(*)::int FROM price_history ph WHERE ph.article_id = a.id) AS price_change_count
      FROM articles a
      JOIN complexes c ON a.complex_id = c.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${idx}
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/districts — 구 목록
app.get('/api/districts', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT division AS district
      FROM complexes
      WHERE is_active = true AND division IS NOT NULL
      ORDER BY division
    `);
    res.json(rows.map(r => r.district));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// 통계 (Stats)
// ============================================

// GET /api/stats
app.get('/api/stats', async (_req, res) => {
  try {
    const [complexes, articles, bargains, removed, realTx, runs, lastCollection] = await Promise.all([
      pool.query(`SELECT count(*)::int as count FROM complexes`),
      pool.query(`SELECT count(*)::int as count FROM articles WHERE article_status='active'`),
      pool.query(`SELECT count(*)::int as count FROM articles WHERE is_bargain = true AND article_status='active'`),
      pool.query(`SELECT count(*)::int as count FROM articles WHERE article_status='removed'`),
      pool.query(`SELECT count(*)::int as count FROM real_transactions`),
      pool.query(`SELECT * FROM collection_runs ORDER BY started_at DESC LIMIT 5`),
      pool.query(`SELECT max(last_collected_at) AS last_collected_at FROM complexes`),
    ]);
    res.json({
      complexCount: complexes.rows[0].count,
      articleCount: articles.rows[0].count,
      bargainCount: bargains.rows[0].count,
      removedCount: removed.rows[0].count,
      realTransactionCount: realTx.rows[0].count,
      lastCollectionAt: lastCollection.rows[0].last_collected_at,
      recentRuns: runs.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// Start
// ============================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`   Database: estate_quick_sale (localhost:5432)`);
});
