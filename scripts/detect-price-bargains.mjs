#!/usr/bin/env node
/**
 * detect-price-bargains.mjs
 *
 * 가격 기반 급매 판정 배치 스크립트.
 * 단지 내 동일평형 평균, 실거래가, 가격 인하 이력, 누적 인하율을 조합하여
 * bargain_score(0~100)를 산정하고 score >= 50이면 is_bargain = true로 설정.
 *
 * Usage:
 *   node --env-file=.env scripts/detect-price-bargains.mjs            # 전체 실행
 *   node --env-file=.env scripts/detect-price-bargains.mjs --dry-run  # 변경 없이 결과만 출력
 *   node --env-file=.env scripts/detect-price-bargains.mjs --verbose  # 상세 로그
 */

import { pool } from './db.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const THRESHOLD = 50;

async function main() {
  console.log(`=== 가격 기반 급매 판정 [${DRY_RUN ? 'DRY-RUN' : 'LIVE'}] ===\n`);
  const startTime = Date.now();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Migration: score_factors 컬럼 추가
    await client.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS score_factors jsonb');

    // 6개월 전 기준 (YYYYMM)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const sixMonthsAgoYm = sixMonthsAgo.getFullYear() * 100 + (sixMonthsAgo.getMonth() + 1);

    // ── Step 1: 단지 내 비교 (peer avg, ±3㎡, peer_count >= 2) ──
    console.log('Step 1: 단지 내 동일평형 비교...');
    await client.query(`
      CREATE TEMP TABLE _complex_comparison AS
      SELECT a.id AS article_id, a.deal_price,
        round(avg(peer.deal_price))::bigint AS peer_avg_price,
        count(peer.id)::int AS peer_count
      FROM articles a
      JOIN articles peer ON peer.complex_id = a.complex_id
        AND peer.trade_type = 'A1' AND peer.article_status = 'active' AND peer.deal_price > 0
        AND peer.exclusive_space BETWEEN a.exclusive_space - 3 AND a.exclusive_space + 3
        AND peer.id != a.id
      WHERE a.article_status = 'active' AND a.trade_type = 'A1' AND a.deal_price > 0
      GROUP BY a.id, a.deal_price
    `);
    const { rows: [s1] } = await client.query('SELECT count(*)::int AS cnt FROM _complex_comparison WHERE peer_count >= 2');
    console.log(`  → ${s1.cnt}건 (peer >= 2)\n`);

    // ── Step 2: 실거래 비교 (complexes.complex_name = rt.apt_nm, ±3㎡, 최근 6개월) ──
    console.log('Step 2: 실거래가 비교...');
    await client.query(`
      CREATE TEMP TABLE _tx_comparison AS
      SELECT a.id AS article_id,
        round(avg(tx.deal_amount * 10000))::bigint AS tx_avg_price_won,
        count(tx.*)::int AS tx_count
      FROM articles a
      JOIN complexes c ON c.id = a.complex_id
      JOIN real_transactions tx ON tx.apt_nm = COALESCE(c.rt_apt_nm, c.complex_name)
        AND (c.sgg_cd IS NULL OR tx.sgg_cd = c.sgg_cd)
        AND tx.exclu_use_ar BETWEEN a.exclusive_space - 3 AND a.exclusive_space + 3
        AND (tx.deal_year * 100 + tx.deal_month) >= $1
        AND (tx.cdeal_type IS NULL OR tx.cdeal_type != 'O')
      WHERE a.article_status = 'active' AND a.trade_type = 'A1' AND a.deal_price > 0
      GROUP BY a.id
    `, [sixMonthsAgoYm]);
    const { rows: [s2] } = await client.query('SELECT count(*)::int AS cnt FROM _tx_comparison WHERE tx_count >= 1');
    console.log(`  → ${s2.cnt}건 (실거래 매칭)\n`);

    // ── Step 3: 가격 인하 이력 (price_history에서 인하 횟수) ──
    console.log('Step 3: 가격 인하 이력...');
    await client.query(`
      CREATE TEMP TABLE _price_drops AS
      SELECT article_id, count(*)::int AS drop_count
      FROM (
        SELECT ph.article_id, ph.deal_price,
          lag(ph.deal_price) OVER (PARTITION BY ph.article_id ORDER BY ph.recorded_at) AS prev_price
        FROM price_history ph
        JOIN articles a ON a.id = ph.article_id
        WHERE a.article_status = 'active' AND a.trade_type = 'A1'
      ) sub
      WHERE prev_price IS NOT NULL AND deal_price < prev_price
      GROUP BY article_id
    `);
    const { rows: [s3] } = await client.query('SELECT count(*)::int AS cnt FROM _price_drops');
    console.log(`  → ${s3.cnt}건 (인하 이력 있음)\n`);

    // ── Step 3.5: 누적 인하율 (초기가격 대비 현재가격 하락률) ──
    console.log('Step 3.5: 누적 인하율...');
    await client.query(`
      CREATE TEMP TABLE _drop_magnitude AS
      SELECT ph_first.article_id,
        round((1 - a.deal_price::numeric / ph_first.initial_price) * 100, 1) AS drop_pct
      FROM (
        SELECT DISTINCT ON (article_id) article_id, deal_price AS initial_price
        FROM price_history
        ORDER BY article_id, recorded_at ASC
      ) ph_first
      JOIN articles a ON a.id = ph_first.article_id
      WHERE a.article_status = 'active' AND a.trade_type = 'A1' AND a.deal_price > 0
        AND a.deal_price < ph_first.initial_price
    `);
    const { rows: [s35] } = await client.query('SELECT count(*)::int AS cnt FROM _drop_magnitude');
    console.log(`  → ${s35.cnt}건 (누적 인하 있음)\n`);

    // ── Step 4: 점수 합산 + UPDATE ──
    console.log('Step 4: 점수 합산...');

    // 점수 계산 + UPDATE를 단일 쿼리로 실행
    const updateQuery = `
      WITH scores AS (
        SELECT a.id,
          -- 1) 단지 내 비교 (최대 40점, 선형: 20%할인=40점)
          CASE
            WHEN cc.peer_count >= 2 AND cc.peer_avg_price > 0 AND a.deal_price < cc.peer_avg_price THEN
              LEAST(round((1.0 - a.deal_price::numeric / cc.peer_avg_price) * 200)::int, 40)
            ELSE 0
          END AS complex_score,
          -- 2) 실거래 비교 (최대 35점, 선형: 15%할인=35점)
          CASE
            WHEN tc.tx_count >= 1 AND tc.tx_avg_price_won > 0 AND a.deal_price < tc.tx_avg_price_won THEN
              LEAST(round((1.0 - a.deal_price::numeric / tc.tx_avg_price_won) / 0.15 * 35)::int, 35)
            ELSE 0
          END AS tx_score,
          -- 3) 가격 인하 이력 (최대 20점, 선형: 인하 1회=4점)
          CASE
            WHEN pd.drop_count >= 1 THEN LEAST(pd.drop_count * 4, 20)
            ELSE 0
          END AS drop_score,
          -- 4) 누적 인하율 (최대 5점, 선형: 5%=1점)
          CASE
            WHEN dm.drop_pct > 0 THEN LEAST(round(dm.drop_pct / 5.0)::int, 5)
            ELSE 0
          END AS magnitude_score
        FROM articles a
        LEFT JOIN _complex_comparison cc ON cc.article_id = a.id
        LEFT JOIN _tx_comparison tc ON tc.article_id = a.id
        LEFT JOIN _price_drops pd ON pd.article_id = a.id
        LEFT JOIN _drop_magnitude dm ON dm.article_id = a.id
        WHERE a.article_status = 'active' AND a.trade_type = 'A1' AND a.deal_price > 0
      )
      UPDATE articles a SET
        bargain_score = LEAST(s.complex_score + s.tx_score + s.drop_score + s.magnitude_score, 100),
        score_factors = jsonb_build_object('complex', s.complex_score, 'tx', s.tx_score, 'drops', s.drop_score, 'magnitude', s.magnitude_score),
        is_bargain = CASE
          WHEN (s.complex_score + s.tx_score + s.drop_score + s.magnitude_score) >= ${THRESHOLD} THEN true
          WHEN a.bargain_keyword IS NOT NULL THEN true
          ELSE false
        END,
        bargain_type = CASE
          WHEN a.bargain_keyword IS NOT NULL AND (s.complex_score + s.tx_score + s.drop_score + s.magnitude_score) >= ${THRESHOLD} THEN 'both'
          WHEN (s.complex_score + s.tx_score + s.drop_score + s.magnitude_score) >= ${THRESHOLD} THEN 'price'
          WHEN a.bargain_keyword IS NOT NULL THEN 'keyword'
          ELSE NULL
        END
      FROM scores s
      WHERE a.id = s.id
      RETURNING a.id, a.bargain_score, a.bargain_type, a.is_bargain
    `;

    if (DRY_RUN) {
      // dry-run: 점수만 조회, UPDATE 안 함
      const dryQuery = `
        WITH scores AS (
          SELECT a.id, a.deal_price, a.bargain_keyword, a.exclusive_space,
            c.complex_name,
            CASE
              WHEN cc.peer_count >= 2 AND cc.peer_avg_price > 0 THEN
                CASE
                  WHEN (a.deal_price::numeric / cc.peer_avg_price) <= 0.85 THEN 40
                  WHEN (a.deal_price::numeric / cc.peer_avg_price) <= 0.90 THEN 30
                  WHEN (a.deal_price::numeric / cc.peer_avg_price) <= 0.95 THEN 20
                  WHEN (a.deal_price::numeric / cc.peer_avg_price) < 1.00 THEN 5
                  ELSE 0
                END
              ELSE 0
            END AS complex_score,
            CASE
              WHEN tc.tx_count >= 1 AND tc.tx_avg_price_won > 0 THEN
                CASE
                  WHEN (a.deal_price::numeric / tc.tx_avg_price_won) <= 0.90 THEN 35
                  WHEN (a.deal_price::numeric / tc.tx_avg_price_won) <= 0.95 THEN 25
                  WHEN (a.deal_price::numeric / tc.tx_avg_price_won) < 1.00 THEN 10
                  ELSE 0
                END
              ELSE 0
            END AS tx_score,
            CASE
              WHEN pd.drop_count >= 5 THEN 20
              WHEN pd.drop_count >= 4 THEN 17
              WHEN pd.drop_count >= 3 THEN 15
              WHEN pd.drop_count = 2 THEN 10
              WHEN pd.drop_count = 1 THEN 5
              ELSE 0
            END AS drop_score,
            CASE
              WHEN dm.drop_pct >= 20 THEN 5
              WHEN dm.drop_pct >= 10 THEN 3
              WHEN dm.drop_pct >= 5 THEN 2
              ELSE 0
            END AS magnitude_score
          FROM articles a
          JOIN complexes c ON c.id = a.complex_id
          LEFT JOIN _complex_comparison cc ON cc.article_id = a.id
          LEFT JOIN _tx_comparison tc ON tc.article_id = a.id
          LEFT JOIN _price_drops pd ON pd.article_id = a.id
          LEFT JOIN _drop_magnitude dm ON dm.article_id = a.id
          WHERE a.article_status = 'active' AND a.trade_type = 'A1' AND a.deal_price > 0
        )
        SELECT *,
          (complex_score + tx_score + drop_score + magnitude_score) AS total_score,
          CASE
            WHEN bargain_keyword IS NOT NULL AND (complex_score + tx_score + drop_score + magnitude_score) >= ${THRESHOLD} THEN 'both'
            WHEN (complex_score + tx_score + drop_score + magnitude_score) >= ${THRESHOLD} THEN 'price'
            WHEN bargain_keyword IS NOT NULL THEN 'keyword'
            ELSE NULL
          END AS computed_type
        FROM scores
        ORDER BY (complex_score + tx_score + drop_score + magnitude_score) DESC
      `;

      const { rows } = await client.query(dryQuery);

      // 점수 분포
      const dist = { '0-19': 0, '20-39': 0, '40-49': 0, '50-69': 0, '70-89': 0, '90-100': 0 };
      let priceBargains = 0;
      let bothBargains = 0;
      let keywordOnly = 0;

      for (const r of rows) {
        const s = r.total_score;
        if (s < 20) dist['0-19']++;
        else if (s < 40) dist['20-39']++;
        else if (s < 50) dist['40-49']++;
        else if (s < 70) dist['50-69']++;
        else if (s < 90) dist['70-89']++;
        else dist['90-100']++;

        if (r.computed_type === 'price') priceBargains++;
        else if (r.computed_type === 'both') bothBargains++;
        else if (r.computed_type === 'keyword') keywordOnly++;
      }

      console.log('\n  점수 분포:');
      for (const [range, cnt] of Object.entries(dist)) {
        console.log(`    ${range}: ${cnt}건`);
      }
      console.log(`\n  급매 유형:`);
      console.log(`    keyword: ${keywordOnly}건`);
      console.log(`    price: ${priceBargains}건`);
      console.log(`    both: ${bothBargains}건`);
      console.log(`    합계: ${priceBargains + bothBargains + keywordOnly}건`);

      if (VERBOSE) {
        console.log('\n  Top 20 가격 급매:');
        const top = rows.filter(r => r.total_score >= THRESHOLD).slice(0, 20);
        for (const r of top) {
          console.log(`    [${r.total_score}점] ${r.complex_name} ${r.exclusive_space}㎡ ${Math.round(r.deal_price / 100000000 * 10) / 10}억 (단지${r.complex_score} 실거래${r.tx_score} 인하${r.drop_score} 누적${r.magnitude_score}) ${r.computed_type}`);
        }
      }

      await client.query('ROLLBACK');
      console.log('\n  [DRY-RUN] 변경 없이 롤백됨.');
    } else {
      // LIVE 실행
      const { rows } = await client.query(updateQuery);

      const priceBargains = rows.filter(r => r.bargain_type === 'price').length;
      const bothBargains = rows.filter(r => r.bargain_type === 'both').length;
      const keywordOnly = rows.filter(r => r.bargain_type === 'keyword').length;
      const totalBargains = rows.filter(r => r.is_bargain).length;

      console.log(`  → ${rows.length}건 점수 갱신`);
      console.log(`  → 급매 판정: keyword=${keywordOnly}, price=${priceBargains}, both=${bothBargains}, 합계=${totalBargains}\n`);

      // Step 5: bargain_detections INSERT (가격 급매, 중복 방지)
      console.log('Step 5: bargain_detections 기록...');
      const newPriceBargains = rows.filter(r => r.bargain_type === 'price' || r.bargain_type === 'both');
      let detectionInserted = 0;

      for (const r of newPriceBargains) {
        const { rowCount } = await client.query(`
          INSERT INTO bargain_detections (article_id, complex_id, detection_type, deal_price, bargain_score, detected_at)
          SELECT a.id, a.complex_id, 'price', a.deal_price, $2, NOW()
          FROM articles a WHERE a.id = $1
          AND NOT EXISTS (
            SELECT 1 FROM bargain_detections bd
            WHERE bd.article_id = $1 AND bd.detection_type = 'price'
          )
        `, [r.id, r.bargain_score]);
        detectionInserted += rowCount;
      }
      console.log(`  → ${detectionInserted}건 신규 감지 기록\n`);

      await client.query('COMMIT');

      // 점수 분포 요약
      if (VERBOSE) {
        const dist = { '0-19': 0, '20-39': 0, '40-49': 0, '50-69': 0, '70-89': 0, '90-100': 0 };
        for (const r of rows) {
          const s = r.bargain_score;
          if (s < 20) dist['0-19']++;
          else if (s < 40) dist['20-39']++;
          else if (s < 50) dist['40-49']++;
          else if (s < 70) dist['50-69']++;
          else if (s < 90) dist['70-89']++;
          else dist['90-100']++;
        }
        console.log('  점수 분포:');
        for (const [range, cnt] of Object.entries(dist)) {
          console.log(`    ${range}: ${cnt}건`);
        }
      }
    }

    // Cleanup
    await client.query('DROP TABLE IF EXISTS _complex_comparison, _tx_comparison, _price_drops, _drop_magnitude');

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n완료 (${elapsed}초)`);
  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
