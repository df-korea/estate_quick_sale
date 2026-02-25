#!/usr/bin/env node
/**
 * fingerprint-match-v2.mjs
 *
 * fin.land realPrice API의 실거래(년월+금액+층)를 국토부 real_transactions와
 * 비교하여 complexes.rt_apt_nm 매핑. rt_apt_nm 전체 클리어 후 전수 매칭.
 *
 * 1) rt_apt_nm + complex_id 전체 클리어
 * 2) 전수 핑거프린트 매칭 (fin.land → real_transactions)
 * 3) complex_id 일괄 반영
 *
 * Usage:
 *   node --env-file=.env scripts/fingerprint-match-v2.mjs              # 전체
 *   node --env-file=.env scripts/fingerprint-match-v2.mjs --resume     # 이어서
 *   node --env-file=.env scripts/fingerprint-match-v2.mjs --dry-run    # DB 변경 없이
 *   node --env-file=.env scripts/fingerprint-match-v2.mjs --hscp 111515 # 단일 테스트
 *   node --env-file=.env scripts/fingerprint-match-v2.mjs --limit 500  # 500개만
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── CLI args ──

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
}
const hasFlag = (name) => args.includes(`--${name}`);

const SINGLE_HSCP = getArg('hscp');
const LIMIT = getArg('limit') ? parseInt(getArg('limit')) : null;
const RESUME = hasFlag('resume');
const DRY_RUN = hasFlag('dry-run');

const BATCH_SIZE = 100;      // 100개 단지 병렬 API
const BATCH_REST_MS = 100;   // 배치 간 휴식

// ── Paths ──

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = join(__dirname, 'data', '.fingerprint-match-v2-progress.json');

// ── Progress ──

function loadProgress() {
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return null; }
}

function saveProgress(lastId, stats) {
  try {
    writeFileSync(PROGRESS_FILE, JSON.stringify({
      lastId,
      matched: stats.matched,
      matchFailed: stats.matchFailed,
      noApiData: stats.noApiData,
      ts: new Date().toISOString(),
    }));
  } catch { /* ignore */ }
}

// ── Ensure index ──

async function ensureIndex() {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rt_fingerprint
      ON real_transactions(sgg_cd, deal_year, deal_month, deal_amount, floor)
  `);
}

// ── Batch fetch real prices from fin.land ──
// pyeongNo=1 먼저 → 없으면 2~5 → 그래도 없으면 6~10 한 번 더

async function batchFetchRealPrices(page, hscpNos, sampleCount) {
  return await page.evaluate(async ({ hscpList, count }) => {
    const fetchPyeong = async (hscp, pn, size) => {
      try {
        const r = await fetch(
          `/front-api/v1/complex/pyeong/realPrice?complexNumber=${hscp}&pyeongTypeNumber=${pn}&page=1&size=${size}&tradeType=A1`
        );
        if (!r.ok) return [];
        const d = await r.json();
        return (d.result?.list || []).filter(item => !item.isDelete && item.floor);
      } catch { return []; }
    };

    const collectTxs = (items, txs, count) => {
      for (const item of items) {
        if (txs.length >= count) break;
        txs.push({
          tradeDate: item.tradeDate, dealPrice: item.dealPrice, floor: item.floor,
        });
      }
    };

    return await Promise.all(hscpList.map(async (hscp) => {
      try {
        const txs = [];

        // 1차: pyeongNo=1 (거의 항상 존재)
        collectTxs(await fetchPyeong(hscp, 1, count), txs, count);

        // 2차: 부족하면 pyeongNo 2~5 병렬
        if (txs.length < count) {
          const extras = await Promise.all([2, 3, 4, 5].map(pn => fetchPyeong(hscp, pn, count)));
          for (const list of extras) { collectTxs(list, txs, count); }
        }

        // 3차: 그래도 없으면 pyeongNo 6~10 병렬 (마지막 시도)
        if (txs.length === 0) {
          const extras = await Promise.all([6, 7, 8, 9, 10].map(pn => fetchPyeong(hscp, pn, count)));
          for (const list of extras) { collectTxs(list, txs, count); }
        }

        return { hscp, ok: txs.length > 0, transactions: txs };
      } catch {
        return { hscp, ok: false, transactions: [] };
      }
    }));
  }, { hscpList: hscpNos.map(String), count: sampleCount });
}

// ── Parse fin.land transaction ──

function parseTx(tx) {
  const dealAmount = Math.round(Number(tx.dealPrice) / 10000);
  const td = tx.tradeDate || '';
  const parts = td.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const floor = parseInt(tx.floor);
  return { dealAmount, year, month, floor };
}

// ── Browser manager (크래시 시 자동 재생성) ──

let _browser = null;
let _page = null;

async function ensureBrowser() {
  // 기존 페이지가 살아있으면 재사용
  if (_page) {
    try {
      await _page.evaluate(() => 1);
      return _page;
    } catch { /* dead */ }
  }
  // 기존 브라우저 정리
  if (_browser) {
    try { await _browser.close(); } catch { /* ignore */ }
  }
  console.log('  브라우저 (재)시작...');
  _browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await _browser.newContext();
  _page = await context.newPage();
  await _page.goto('https://fin.land.naver.com/complexes/22627', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  console.log('  브라우저 준비 완료.');
  return _page;
}

async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch { /* ignore */ }
    _browser = null;
    _page = null;
  }
}

// ══════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════

async function main() {
  console.log(`=== fingerprint-match-v2 [${SINGLE_HSCP ? 'single(' + SINGLE_HSCP + ')' : 'full'}${DRY_RUN ? ', DRY-RUN' : ''}${RESUME ? ', RESUME' : ''}] ===`);
  console.log(`배치: ${BATCH_SIZE}개 병렬, 휴식 ${BATCH_REST_MS}ms\n`);

  try {
    await ensureIndex();
    console.log('idx_rt_fingerprint 인덱스 확인 완료');

    // ── Step 1: rt_apt_nm + complex_id 전체 클리어 ──
    if (!RESUME && !SINGLE_HSCP) {
      if (!DRY_RUN) {
        const { rowCount: cleared } = await pool.query(
          `UPDATE complexes SET rt_apt_nm = NULL WHERE rt_apt_nm IS NOT NULL AND is_active = true`
        );
        console.log(`rt_apt_nm 클리어: ${cleared}건`);
        const { rowCount: cidCleared } = await pool.query(
          `UPDATE real_transactions SET complex_id = NULL WHERE complex_id IS NOT NULL`
        );
        console.log(`complex_id 클리어: ${cidCleared}건`);
      } else {
        console.log('(dry-run: 클리어 스킵)');
      }
    }

    // ── 브라우저 시작 ──
    const page = await ensureBrowser();

    // ── Step 2: 전수 핑거프린트 매칭 ──
    console.log('\n' + '='.repeat(50));
    console.log('전수 핑거프린트 매칭');
    console.log('='.repeat(50));

    let whereClause = 'WHERE sgg_cd IS NOT NULL AND is_active = true AND rt_apt_nm IS NULL';
    const params = [];

    if (SINGLE_HSCP) {
      whereClause += ` AND hscp_no = $${params.length + 1}`;
      params.push(SINGLE_HSCP);
    }

    const stats = {
      startTime: Date.now(),
      matched: 0, matchFailed: 0, noApiData: 0,
      complexIdUpdated: 0,
    };

    if (RESUME) {
      const progress = loadProgress();
      if (progress?.lastId) {
        whereClause += ` AND id > $${params.length + 1}`;
        params.push(progress.lastId);
        stats.matched = progress.matched || 0;
        stats.matchFailed = progress.matchFailed || 0;
        stats.noApiData = progress.noApiData || 0;
        console.log(`이어서: id > ${progress.lastId} (기존 매칭:${stats.matched})`);
      }
    }

    const { rows: targets } = await pool.query(
      `SELECT id, hscp_no, complex_name, sgg_cd FROM complexes ${whereClause} ORDER BY id ASC ${LIMIT ? `LIMIT ${LIMIT}` : ''}`,
      params
    );
    console.log(`대상: ${targets.length}건\n`);

    let processed = 0;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      const hscpNos = batch.map(c => c.hscp_no);

      // 브라우저 크래시 시 자동 재생성 (최대 3회 재시도)
      let results;
      for (let retry = 0; retry < 3; retry++) {
        try {
          const p = await ensureBrowser();
          results = await batchFetchRealPrices(p, hscpNos, 20);
          break;
        } catch (e) {
          console.log(`  에러 (retry ${retry + 1}/3): ${e.message}`);
          _page = null; // 다음 ensureBrowser에서 재생성
          if (retry === 2) {
            console.log('  3회 실패, 배치 스킵');
            results = hscpNos.map(h => ({ hscp: h, ok: false, transactions: [] }));
          }
        }
      }

      // 배치 전체의 fingerprint를 모아서 한 번에 DB 탐색
      const idxArr = [], sggArr = [], yearArr = [], monthArr = [], amtArr = [], floorArr = [];
      const complexHasTx = new Set();

      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (!result || !result.ok || result.transactions.length === 0) {
          stats.noApiData++;
          processed++;
          continue;
        }
        let hasTx = false;
        for (const tx of result.transactions) {
          const { dealAmount, year, month, floor } = parseTx(tx);
          if (!year || !month || !dealAmount || !floor) continue;
          idxArr.push(j);
          sggArr.push(batch[j].sgg_cd);
          yearArr.push(year);
          monthArr.push(month);
          amtArr.push(dealAmount);
          floorArr.push(floor);
          hasTx = true;
        }
        if (hasTx) {
          complexHasTx.add(j);
        } else {
          stats.noApiData++;
          processed++;
        }
      }

      if (idxArr.length > 0) {
        // 한 번의 쿼리로 모든 fingerprint의 apt_nm 탐색 (가격 ±1 허용)
        const { rows: hits } = await pool.query(`
          SELECT v.idx, rt.apt_nm
          FROM unnest($1::int[], $2::text[], $3::int[], $4::int[], $5::int[], $6::int[])
            AS v(idx, sgg_cd, deal_year, deal_month, deal_amount, floor)
          JOIN real_transactions rt ON rt.sgg_cd = v.sgg_cd
            AND rt.deal_year = v.deal_year AND rt.deal_month = v.deal_month
            AND rt.deal_amount BETWEEN v.deal_amount - 1 AND v.deal_amount + 1
            AND rt.floor = v.floor
        `, [idxArr, sggArr, yearArr, monthArr, amtArr, floorArr]);

        // complexIdx별 apt_nm 투표
        const votesByComplex = new Map();
        for (const row of hits) {
          if (!votesByComplex.has(row.idx)) votesByComplex.set(row.idx, new Map());
          const votes = votesByComplex.get(row.idx);
          votes.set(row.apt_nm, (votes.get(row.apt_nm) || 0) + 1);
        }

        for (const j of complexHasTx) {
          const c = batch[j];
          const votes = votesByComplex.get(j);
          if (!votes) {
            stats.matchFailed++;
            processed++;
            continue;
          }

          let bestName = null, bestVotes = 0;
          for (const [name, count] of votes) {
            if (count > bestVotes) { bestVotes = count; bestName = name; }
          }

          // 2표 이상 또는 후보가 1개뿐이면 1표도 수용
          const accept = bestName && (bestVotes >= 2 || (bestVotes === 1 && votes.size === 1));
          if (accept) {
            if (!DRY_RUN) {
              await pool.query('UPDATE complexes SET rt_apt_nm = $1 WHERE id = $2', [bestName, c.id]);
            }
            stats.matched++;
            if (stats.matched <= 30 || bestVotes >= 8) {
              console.log(`  ✓ ${c.complex_name} → "${bestName}" (${bestVotes}표${bestVotes === 1 ? ',유일' : ''})`);
            }
          } else {
            stats.matchFailed++;
          }
          processed++;
        }
      }

      if (processed % 200 < BATCH_SIZE || processed >= targets.length) {
        const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
        const rps = (processed / Math.max(1, (Date.now() - stats.startTime) / 1000)).toFixed(1);
        const eta = processed > 0 ? (((targets.length - processed) / (processed / ((Date.now() - stats.startTime) / 1000))) / 60).toFixed(1) : '?';
        console.log(`  [${processed}/${targets.length}] 매칭:${stats.matched} 실패:${stats.matchFailed} noAPI:${stats.noApiData} | ${elapsed}s ${rps}/s ETA:${eta}분`);
      }

      if (processed % 200 < BATCH_SIZE) {
        saveProgress(batch[batch.length - 1].id, stats);
      }

      await sleep(BATCH_REST_MS);
    }

    await closeBrowser();

    // ── Step 3: complex_id 일괄 반영 ──
    console.log('\n' + '='.repeat(50));
    console.log('complex_id 일괄 반영');
    console.log('='.repeat(50));

    if (DRY_RUN) {
      const { rows: [preview] } = await pool.query(`
        SELECT count(*)::int AS cnt FROM real_transactions rt
        JOIN complexes c ON c.sgg_cd = rt.sgg_cd AND c.rt_apt_nm = rt.apt_nm AND c.is_active = true
        WHERE rt.complex_id IS NULL
      `);
      console.log(`  반영 대상: ${preview.cnt}건 (dry-run)`);
      stats.complexIdUpdated = preview.cnt;
    } else {
      const { rowCount } = await pool.query(`
        UPDATE real_transactions rt SET complex_id = c.id
        FROM complexes c
        WHERE c.sgg_cd = rt.sgg_cd AND c.rt_apt_nm = rt.apt_nm
          AND c.is_active = true AND rt.complex_id IS NULL
      `);
      stats.complexIdUpdated = rowCount;
      console.log(`  반영 완료: ${rowCount}건`);
    }

    // ── 최종 리포트 ──
    const totalTime = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(50));
    console.log('=== 최종 결과 ===');
    console.log('='.repeat(50));
    console.log(`매칭 성공: ${stats.matched}건`);
    console.log(`매칭 실패: ${stats.matchFailed}건`);
    console.log(`API 데이터 없음: ${stats.noApiData}건`);
    console.log(`complex_id 반영: ${stats.complexIdUpdated}건`);
    console.log(`소요 시간: ${totalTime}초`);

    const { rows: [rtSummary] } = await pool.query(`
      SELECT count(*)::int AS total, count(rt_apt_nm)::int AS has_rt
      FROM complexes WHERE is_active = true
    `);
    console.log(`\nrt_apt_nm: ${rtSummary.has_rt}/${rtSummary.total} (${(rtSummary.has_rt / rtSummary.total * 100).toFixed(1)}%)`);

    const { rows: [txSummary] } = await pool.query(`
      SELECT count(*)::int AS total, count(complex_id)::int AS matched
      FROM real_transactions
    `);
    console.log(`complex_id: ${txSummary.matched}/${txSummary.total} (${(txSummary.matched / txSummary.total * 100).toFixed(1)}%)`);

  } finally {
    await closeBrowser();
    await pool.end();
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
