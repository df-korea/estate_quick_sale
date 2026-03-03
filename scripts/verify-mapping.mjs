#!/usr/bin/env node
/**
 * verify-mapping.mjs
 *
 * 네이버 부동산 실거래가 매핑 검증 스크립트.
 * 각 시군구별 대표 매물 1건을 선정하여, 우리 DB 실거래와 네이버 실거래를 비교.
 *
 * 검증 방법:
 *   - 네이버에서 해당 단지의 모든 평형(pyeongType 1~5) 실거래 수집
 *   - 우리 DB에서 해당 단지(complex_id)의 실거래 수집
 *   - (year, month, amount±1, floor) 기준 매칭
 *   - 일치율 ≥50% → match, <50% → mismatch (매핑 오류 의심)
 *
 * Usage:
 *   xvfb-run --auto-servernum node --env-file=.env scripts/verify-mapping.mjs
 *   xvfb-run --auto-servernum node --env-file=.env scripts/verify-mapping.mjs --limit 10
 *   xvfb-run --auto-servernum node --env-file=.env scripts/verify-mapping.mjs --sgg 11680
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── CLI args ──
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
}
const LIMIT = getArg('limit') ? parseInt(getArg('limit')) : null;
const SINGLE_SGG = getArg('sgg');
const WARP_PROXY = 'socks5://127.0.0.1:40000';

// ── Browser ──
let _browser = null;
let _page = null;

async function ensureBrowser() {
  if (_page) {
    try { await _page.evaluate(() => 1); return _page; } catch { /* dead */ }
  }
  if (_browser) {
    try { await _browser.close(); } catch {}
  }
  console.log('  브라우저 시작 (WARP 프록시)...');
  _browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
    proxy: { server: WARP_PROXY },
  });
  const context = await _browser.newContext();
  _page = await context.newPage();
  // 초기 페이지 로드 (쿠키/세션 확보)
  await _page.goto('https://fin.land.naver.com/complexes/22627', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  console.log('  브라우저 준비 완료.');
  return _page;
}

async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch {}
    _browser = null;
    _page = null;
  }
}

// ── 검증 대상 선정 (시군구별 1건) ──
async function selectTargets() {
  let sggFilter = '';
  const params = [];
  if (SINGLE_SGG) {
    sggFilter = `AND c.sgg_cd = $1`;
    params.push(SINGLE_SGG);
  }

  const { rows } = await pool.query(`
    SELECT DISTINCT ON (c.sgg_cd)
      a.id AS article_id, a.article_no, a.exclusive_space, a.complex_id,
      c.id AS complex_db_id, c.hscp_no, c.complex_name, c.rt_apt_nm, c.sgg_cd
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
    WHERE a.article_status = 'active' AND a.trade_type = 'A1'
      AND c.rt_apt_nm IS NOT NULL AND c.sgg_cd IS NOT NULL
      AND c.hscp_no IS NOT NULL
      ${sggFilter}
    ORDER BY c.sgg_cd,
      (SELECT count(*) FROM real_transactions rt WHERE rt.complex_id = c.id) DESC
  `, params);

  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

// ── 우리 DB 실거래 조회 (complex_id 기준, 전체 평형) ──
async function getOurTransactions(complexId) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 24, 1);
  const fromYm = from.getFullYear() * 100 + (from.getMonth() + 1);

  const { rows } = await pool.query(`
    SELECT deal_year, deal_month, deal_day,
      deal_amount, floor, exclu_use_ar
    FROM real_transactions
    WHERE complex_id = $1
      AND (cdeal_type IS NULL OR cdeal_type != 'O')
      AND (deal_year * 100 + deal_month) >= $2
    ORDER BY deal_year DESC, deal_month DESC, deal_day DESC
    LIMIT 200
  `, [complexId, fromYm]);
  return rows;
}

// ── 네이버 실거래 조회 (pyeongType 1~5 모두) ──
async function getNaverTransactions(page, hscpNo) {
  // 해당 단지 페이지로 이동 (정확한 세션 컨텍스트)
  await page.goto(`https://fin.land.naver.com/complexes/${hscpNo}?tab=transaction`, {
    waitUntil: 'domcontentloaded',
  });
  await sleep(2000 + Math.random() * 1000);

  // 단지명 추출 (document.title에 단지명이 있음)
  const complexName = await page.evaluate(() => document.title?.trim() || null);

  // pyeongType 1~5 순차 fetch
  const allTxs = await page.evaluate(async (hscp) => {
    const results = [];
    for (let pn = 1; pn <= 5; pn++) {
      try {
        const r = await fetch(
          `/front-api/v1/complex/pyeong/realPrice?complexNumber=${hscp}&pyeongTypeNumber=${pn}&page=1&size=50&tradeType=A1`
        );
        if (!r.ok) {
          if (r.status === 429) return { error: '429' };
          continue;
        }
        const d = await r.json();
        const list = (d.result?.list || []).filter(item => !item.isDelete && item.floor);
        for (const item of list) {
          results.push({
            tradeDate: item.tradeDate,
            dealPrice: item.dealPrice,
            floor: item.floor,
            pyeongType: pn,
          });
        }
      } catch { /* skip */ }
      // 짧은 딜레이
      await new Promise(r => setTimeout(r, 300));
    }
    return { error: null, transactions: results };
  }, String(hscpNo));

  return { ...allTxs, complexName };
}

// ── 비교 로직 ──
function compareTransactions(ourTxs, naverTxs) {
  if (!ourTxs.length || !naverTxs.length) {
    return { matchCount: 0, totalCompared: 0, matchRate: 0, details: [] };
  }

  // 네이버 거래 파싱
  const naverParsed = naverTxs.map(tx => {
    const parts = (tx.tradeDate || '').split('-');
    return {
      year: parseInt(parts[0]),
      month: parseInt(parts[1]),
      day: parts[2] ? parseInt(parts[2]) : null,
      amount: Math.round(Number(tx.dealPrice) / 10000),  // 원 → 만원
      floor: parseInt(tx.floor),
      raw: tx,
    };
  }).filter(t => t.year && t.month && t.amount);

  // 우리 DB 거래를 Set으로 만들어 빠른 lookup
  // key: "year-month-floor" → amount 배열
  const ourMap = new Map();
  for (const tx of ourTxs) {
    const key = `${tx.deal_year}-${tx.deal_month}-${parseInt(tx.floor)}`;
    if (!ourMap.has(key)) ourMap.set(key, []);
    ourMap.get(key).push(tx.deal_amount);
  }

  let matchCount = 0;
  const details = [];

  for (const nv of naverParsed) {
    const key = `${nv.year}-${nv.month}-${nv.floor}`;
    const candidates = ourMap.get(key) || [];
    const found = candidates.some(amt => Math.abs(amt - nv.amount) <= 1);

    if (found) matchCount++;
    details.push({
      naver: `${nv.year}-${String(nv.month).padStart(2, '0')}${nv.day ? '-' + String(nv.day).padStart(2, '0') : ''} ${nv.amount}만 ${nv.floor}층`,
      matched: found,
    });
  }

  return {
    matchCount,
    totalCompared: naverParsed.length,
    matchRate: naverParsed.length > 0 ? matchCount / naverParsed.length : 0,
    details,
  };
}

// ── Main ──
async function main() {
  console.log('=== 네이버 부동산 실거래가 매핑 검증 ===\n');

  try {
    // Step 1: 검증 대상 선정
    console.log('Step 1: 검증 대상 선정 (시군구별 1건)...');
    const targets = await selectTargets();
    console.log(`  대상: ${targets.length}건\n`);

    if (targets.length === 0) {
      console.log('검증 대상 없음. 종료.');
      return;
    }

    // Step 2: 브라우저 시작
    const page = await ensureBrowser();

    // Step 3: 순차 검증
    const results = [];
    const stats = { match: 0, mismatch: 0, error: 0, noData: 0, total: targets.length };
    const startTime = Date.now();

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const label = `[${i + 1}/${targets.length}] ${t.sgg_cd} ${t.complex_name} (hscp:${t.hscp_no})`;

      try {
        // A) 우리 DB 실거래
        const ourTxs = await getOurTransactions(t.complex_db_id);

        // B) 네이버 실거래 (재시도 포함)
        let naverResult;
        for (let retry = 0; retry < 3; retry++) {
          try {
            const p = await ensureBrowser();
            naverResult = await getNaverTransactions(p, t.hscp_no);
            if (naverResult.error === '429') {
              console.log(`  ${label} - rate limited, waiting 15s (retry ${retry + 1}/3)...`);
              await sleep(15000);
              continue;
            }
            break;
          } catch (e) {
            console.log(`  ${label} - 브라우저 에러 (retry ${retry + 1}/3): ${e.message}`);
            _page = null;
            if (retry === 2) naverResult = { error: e.message, transactions: [], complexName: null };
          }
        }

        // C) 에러 체크
        if (naverResult.error) {
          console.log(`  ${label} - 에러: ${naverResult.error}`);
          results.push({
            sgg_cd: t.sgg_cd, hscp_no: t.hscp_no,
            complex_name: t.complex_name, rt_apt_nm: t.rt_apt_nm,
            status: 'error', error: naverResult.error,
          });
          stats.error++;
          await sleep(3000);
          continue;
        }

        if (naverResult.transactions.length === 0 || ourTxs.length === 0) {
          const reason = naverResult.transactions.length === 0 ? 'naver_no_data' : 'our_no_data';
          console.log(`  ${label} - ${reason} (naver:${naverResult.transactions.length}, our:${ourTxs.length})`);
          results.push({
            sgg_cd: t.sgg_cd, hscp_no: t.hscp_no,
            complex_name: t.complex_name, rt_apt_nm: t.rt_apt_nm,
            naver_complex_name: naverResult.complexName,
            status: 'no_data', reason,
            naverTxCount: naverResult.transactions.length,
            ourTxCount: ourTxs.length,
          });
          stats.noData++;
          await sleep(3000);
          continue;
        }

        // D) 비교
        const comparison = compareTransactions(ourTxs, naverResult.transactions);
        const isMatch = comparison.matchRate >= 0.5;

        const result = {
          sgg_cd: t.sgg_cd, hscp_no: t.hscp_no,
          complex_name: t.complex_name, rt_apt_nm: t.rt_apt_nm,
          naver_complex_name: naverResult.complexName,
          status: isMatch ? 'match' : 'mismatch',
          matchRate: (comparison.matchRate * 100).toFixed(1) + '%',
          matchCount: comparison.matchCount,
          totalCompared: comparison.totalCompared,
          ourTxCount: ourTxs.length,
          naverTxCount: naverResult.transactions.length,
        };

        if (!isMatch) {
          result.sampleComparison = comparison.details.slice(0, 10);
          result.ourSample = ourTxs.slice(0, 5).map(tx => ({
            date: `${tx.deal_year}-${String(tx.deal_month).padStart(2, '0')}-${String(tx.deal_day || 0).padStart(2, '0')}`,
            amount: tx.deal_amount,
            floor: tx.floor,
            area: tx.exclu_use_ar,
          }));
        }

        results.push(result);

        if (isMatch) {
          stats.match++;
          console.log(`  ${label} ✓ ${comparison.matchCount}/${comparison.totalCompared} (${result.matchRate})`);
        } else {
          stats.mismatch++;
          console.log(`  ${label} ✗ MISMATCH ${comparison.matchCount}/${comparison.totalCompared} (${result.matchRate}) | 우리:${t.rt_apt_nm} vs 네이버:${naverResult.complexName}`);
        }

      } catch (e) {
        console.log(`  ${label} - 예외: ${e.message}`);
        results.push({
          sgg_cd: t.sgg_cd, hscp_no: t.hscp_no,
          complex_name: t.complex_name, rt_apt_nm: t.rt_apt_nm,
          status: 'error', error: e.message,
        });
        stats.error++;
      }

      // 네이버 rate limit 방지: 4~6초 간격
      await sleep(4000 + Math.random() * 2000);
    }

    // Step 4: 결과 저장 및 보고
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const validCount = stats.match + stats.mismatch;

    const report = {
      timestamp: new Date().toISOString(),
      elapsed: `${elapsed}s`,
      stats,
      matchRate: validCount > 0
        ? ((stats.match / validCount) * 100).toFixed(1) + '%'
        : 'N/A',
      results,
      mismatches: results.filter(r => r.status === 'mismatch'),
    };

    mkdirSync(join(__dirname, '..', 'logs'), { recursive: true });
    const reportPath = join(__dirname, '..', 'logs', 'mapping-verification-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 콘솔 요약
    console.log('\n' + '='.repeat(60));
    console.log('=== 검증 결과 요약 ===');
    console.log('='.repeat(60));
    console.log(`총 검증: ${stats.total}건`);
    console.log(`  ✓ match:    ${stats.match}건`);
    console.log(`  ✗ mismatch: ${stats.mismatch}건`);
    console.log(`  ⚠ error:    ${stats.error}건`);
    console.log(`  - no_data:  ${stats.noData}건`);
    console.log(`일치율: ${report.matchRate} (match / (match + mismatch))`);
    console.log(`소요 시간: ${elapsed}초`);

    if (report.mismatches.length > 0) {
      console.log('\n--- MISMATCH 목록 ---');
      for (const m of report.mismatches) {
        console.log(`  ${m.sgg_cd} | ${m.complex_name} | 우리:${m.rt_apt_nm} vs 네이버:${m.naver_complex_name} | ${m.matchRate}`);
      }
    }

    console.log(`\n리포트 저장: ${reportPath}`);

  } finally {
    await closeBrowser();
    await pool.end();
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
