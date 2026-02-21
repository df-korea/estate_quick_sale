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
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'estate_quick_sale',
  user: process.env.USER,
});

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// 급매 (Bargains)
// ============================================

// GET /api/bargains?limit=50
app.get('/api/bargains', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.atcl_no, a.complex_id, a.trade_type,
        a.price_text, a.price_amount, a.warrant_price_text, a.rent_price_text,
        a.area_exclusive, a.floor_info, a.direction, a.description, a.building_name,
        a.rep_image_url, a.realtor_name, a.bargain_keyword, a.first_seen_at, a.tag_list,
        c.complex_name, c.property_type, c.hscp_no
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
        c.complex_name, c.property_type AS complex_property_type, c.hscp_no AS complex_hscp_no, c.total_households
      FROM articles a
      JOIN complexes c ON a.complex_id = c.id
      WHERE a.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    // Reshape to match frontend expectation
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
      `SELECT id, price_amount, price_text, recorded_at FROM price_history WHERE article_id=$1 ORDER BY recorded_at ASC`,
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
      SELECT id, atcl_no, price_text, price_amount, area_exclusive, floor_info, direction,
        description, is_bargain, bargain_keyword, first_seen_at
      FROM articles
      WHERE complex_id=$1 AND trade_type=$2 AND article_status='active'
      ORDER BY price_amount ASC NULLS LAST
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

    // 기간 필터
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
// 아파트별 실거래 요약 (평균가, 최고가, 최저가, 건수)
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
      // 면적 범위 ±2㎡
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

// ── 분석용 엔드포인트 (호갱노노/네이버 스타일 그래프) ──

// GET /api/real-transactions/price-trend?aptNm=잠실엘스&sggCd=11710&excluUseAr=84.82
// 월별 시세 추이 그래프용 (평균가, 최고가, 최저가, 거래건수)
app.get('/api/real-transactions/price-trend', async (req, res) => {
  const { aptNm, sggCd, excluUseAr, months = 12 } = req.query;
  try {
    let where = [];
    let params = [];
    let idx = 1;

    if (aptNm) {
      where.push(`apt_nm = $${idx++}`);
      params.push(aptNm);
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

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);
    const fromYm = from.getFullYear() * 100 + (from.getMonth() + 1);
    where.push(`(deal_year * 100 + deal_month) >= $${idx++}`);
    params.push(fromYm);

    // 해제 건 제외
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

// GET /api/real-transactions/floor-analysis?aptNm=잠실엘스&sggCd=11710&excluUseAr=84.82
// 층별 거래가 분석
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

// GET /api/real-transactions/area-types?aptNm=잠실엘스&sggCd=11710
// 면적별 시세 비교 (타입별 평균가)
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

// GET /api/real-transactions/region-compare?sggCd=11710,11680,11650&excluUseAr=84&months=12
// 지역별 시세 비교 (여러 구 비교)
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

// GET /api/real-transactions/volume-trend?sggCd=11710&months=12
// 거래량 추이 (월별)
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
// 호가 vs 실거래가 비교 (articles 테이블과 조인)
app.get('/api/real-transactions/listing-vs-actual', async (req, res) => {
  const { complexName } = req.query;
  if (!complexName) return res.status(400).json({ error: 'complexName required' });

  try {
    // 매물 호가 (현재 리스팅)
    const listings = await pool.query(`
      SELECT
        a.area_exclusive,
        round(a.area_exclusive / 3.3058)::int AS pyeong,
        count(*)::int AS listing_count,
        round(avg(a.price_amount))::bigint AS avg_listing_price,
        min(a.price_amount) AS min_listing_price,
        max(a.price_amount) AS max_listing_price
      FROM articles a
      JOIN complexes c ON a.complex_id = c.id
      WHERE c.complex_name ILIKE $1
        AND a.trade_type = 'A1'
        AND a.article_status = 'active'
        AND a.price_amount > 0
      GROUP BY a.area_exclusive
      ORDER BY a.area_exclusive
    `, [`%${complexName}%`]);

    // 실거래가 (최근 3개월)
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
  console.log(`🚀 API server running at http://localhost:${PORT}`);
  console.log(`   Database: estate_quick_sale (localhost:5432)`);
});
