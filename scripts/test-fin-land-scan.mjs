#!/usr/bin/env node
/**
 * test-fin-land-scan.mjs
 *
 * fin.land.naver.com으로 500개 단지를 스캔하고 결과를 CSV로 저장.
 * DB 삽입 없이 데이터 품질 검증 목적.
 *
 * Usage:
 *   node --env-file=.env scripts/test-fin-land-scan.mjs            # 500개 단지
 *   node --env-file=.env scripts/test-fin-land-scan.mjs --limit 50 # 50개만
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const CSV_PATH = join(DATA_DIR, 'fin-land-scan-result.csv');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── fin.land API fetch (via Playwright page.evaluate) ──

async function fetchArticles(page, complexNumber, pageNum = 1, size = 30) {
  return await page.evaluate(async ({ complexNumber, pageNum, size }) => {
    const start = Date.now();
    try {
      const res = await fetch('/front-api/v1/complex/article/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complexNumber: String(complexNumber),
          tradeTypes: ['A1'],
          page: pageNum,
          size,
          orderType: 'RECENT',
        }),
      });
      const elapsed = Date.now() - start;

      if (res.status === 429) return { ok: false, error: 'RATE_LIMIT_429', elapsed };
      if (!res.ok) return { ok: false, error: `HTTP_${res.status}`, elapsed };

      const data = await res.json();
      if (!data.isSuccess) {
        return { ok: false, error: data.detailCode || 'API_ERROR', elapsed };
      }

      return {
        ok: true,
        totalCount: data.result?.totalCount || 0,
        hasNextPage: data.result?.hasNextPage || false,
        articles: data.result?.list || [],
        elapsed,
      };
    } catch (e) {
      return { ok: false, error: e.message, elapsed: Date.now() - start };
    }
  }, { complexNumber, pageNum, size });
}

// ── 매물 → CSV row 변환 ──

function formatPrice(won) {
  if (!won && won !== 0) return '';
  return Math.round(won / 10000);
}

function articleToRow(complexName, hscpNo, item) {
  const rep = item.representativeArticleInfo || item;
  return {
    complex_name: complexName,
    hscp_no: hscpNo,
    atcl_no: rep.articleNumber || '',
    trade_type: rep.tradeType || '',
    price_amount: formatPrice(rep.priceInfo?.dealPrice),
    price_text: rep.priceInfo?.formattedDealPrice || '',
    warrant_price_amount: formatPrice(rep.priceInfo?.warrantyPrice),
    rent_price_amount: formatPrice(rep.priceInfo?.rentPrice),
    area_supply: rep.spaceInfo?.supplySpace ?? '',
    area_exclusive: rep.spaceInfo?.exclusiveSpace ?? '',
    building_name: rep.dongName || '',
    floor_info: rep.articleDetail?.floorInfo || '',
    floor_current: rep.articleDetail?.floorDetailInfo?.targetFloor ?? '',
    floor_total: rep.articleDetail?.floorDetailInfo?.totalFloor ?? '',
    direction: rep.articleDetail?.direction || '',
    description: (rep.articleDetail?.articleFeatureDescription || '').replace(/[\r\n,]/g, ' '),
    confirm_date: rep.verificationInfo?.articleConfirmDate || '',
    realtor_name: (rep.brokerInfo?.brokerageName || '').replace(/,/g, ' '),
    cp_name: (rep.brokerInfo?.brokerName || '').replace(/,/g, ' '),
  };
}

const CSV_COLUMNS = [
  'complex_name', 'hscp_no', 'atcl_no', 'trade_type',
  'price_amount', 'price_text', 'warrant_price_amount', 'rent_price_amount',
  'area_supply', 'area_exclusive', 'building_name',
  'floor_info', 'floor_current', 'floor_total', 'direction',
  'description', 'confirm_date', 'realtor_name', 'cp_name',
];

function escapeCSV(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCSV(row) {
  return CSV_COLUMNS.map(col => escapeCSV(row[col])).join(',');
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 500;

  console.log(`=== fin.land 매물 스캔 테스트 (${limit}개 단지) ===\n`);

  // 1. DB에서 active complexes 로드
  console.log('DB에서 단지 목록 로드 중...');
  const { rows: complexes } = await pool.query(`
    SELECT id, hscp_no, complex_name, deal_count
    FROM complexes
    WHERE is_active = true AND deal_count > 0
    ORDER BY deal_count DESC
    LIMIT $1
  `, [limit]);

  console.log(`단지 ${complexes.length}개 로드 (deal_count > 0, DESC 정렬)\n`);

  if (complexes.length === 0) {
    console.log('스캔할 단지가 없습니다.');
    await pool.end();
    return;
  }

  // 2. Playwright 브라우저 시작
  console.log('브라우저 시작...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('fin.land 세션 워밍업...');
  await page.goto('https://fin.land.naver.com/complexes/22627', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  console.log('준비 완료.\n');

  // 3. 스캔 시작
  const allRows = [];
  const stats = {
    complexScanned: 0,
    complexErrors: 0,
    totalArticles: 0,
    totalRequests: 0,
    totalElapsed: 0,
    errors: [],
  };
  const scanStart = Date.now();

  for (let i = 0; i < complexes.length; i++) {
    const c = complexes[i];
    const label = `[${i + 1}/${complexes.length}] ${c.complex_name} (${c.hscp_no})`;

    let pageNum = 1;
    let complexArticles = 0;
    let complexOk = true;
    let complexTotal = 0;

    while (true) {
      const result = await fetchArticles(page, c.hscp_no, pageNum);
      stats.totalRequests++;
      stats.totalElapsed += result.elapsed;

      if (!result.ok) {
        if (complexArticles === 0) {
          stats.complexErrors++;
          complexOk = false;
          stats.errors.push({ complex: c.complex_name, hscp_no: c.hscp_no, error: result.error, page: pageNum });
        }
        break;
      }

      if (pageNum === 1) complexTotal = result.totalCount;

      for (const item of result.articles) {
        allRows.push(articleToRow(c.complex_name, c.hscp_no, item));
      }
      complexArticles += result.articles.length;

      // Stop: no more pages, empty result, fetched enough, or page cap
      if (!result.hasNextPage || result.articles.length === 0 ||
          complexArticles >= complexTotal || pageNum >= 40) break;
      pageNum++;
    }

    if (complexOk) stats.complexScanned++;
    stats.totalArticles += complexArticles;

    // 진행 상황 (매 20개 단지마다)
    if ((i + 1) % 20 === 0 || i === complexes.length - 1) {
      const elapsed = ((Date.now() - scanStart) / 1000).toFixed(1);
      const rps = (stats.totalRequests / ((Date.now() - scanStart) / 1000)).toFixed(1);
      console.log(`${label} | ${complexArticles}건 | 누적: ${stats.totalArticles}건, ${stats.totalRequests}req, ${elapsed}s, ${rps}req/s`);
    }
  }

  const totalTime = ((Date.now() - scanStart) / 1000).toFixed(1);

  // 4. CSV 저장
  console.log(`\nCSV 저장 중... (${allRows.length}건)`);
  mkdirSync(DATA_DIR, { recursive: true });

  const csvHeader = CSV_COLUMNS.join(',');
  const csvBody = allRows.map(rowToCSV).join('\n');
  writeFileSync(CSV_PATH, '\uFEFF' + csvHeader + '\n' + csvBody, 'utf8'); // BOM for Excel
  console.log(`저장 완료: ${CSV_PATH}`);

  // 5. 브라우저 종료
  await browser.close();

  // 6. 요약 리포트
  const avgResp = stats.totalRequests > 0
    ? (stats.totalElapsed / stats.totalRequests).toFixed(0)
    : 'N/A';

  console.log('\n' + '='.repeat(50));
  console.log('=== 스캔 결과 요약 ===');
  console.log('='.repeat(50));
  console.log(`단지 스캔: ${stats.complexScanned}/${complexes.length} 성공 (${stats.complexErrors} 에러)`);
  console.log(`매물 수집: ${stats.totalArticles}건`);
  console.log(`API 요청:  ${stats.totalRequests}건`);
  console.log(`소요 시간: ${totalTime}초`);
  console.log(`평균 응답: ${avgResp}ms`);
  console.log(`CSV 파일:  ${CSV_PATH}`);

  if (stats.errors.length > 0) {
    console.log(`\n에러 목록 (${stats.errors.length}건):`);
    for (const e of stats.errors.slice(0, 10)) {
      console.log(`  ${e.complex} (${e.hscp_no}): ${e.error} (page ${e.page})`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... 외 ${stats.errors.length - 10}건`);
    }
  }

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
