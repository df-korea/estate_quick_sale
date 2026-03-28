#!/usr/bin/env node
/**
 * data.go.kr API를 이용한 실거래가 벌크 수집 (estate_rt DB)
 *
 * 5개 API를 병렬로 동시 수집하여 최대 속도로 처리
 * 250시군구 × N개월 × 5종류
 *
 * Usage:
 *   node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs
 *   node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs --type APT_TRADE
 *   node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs --from 2006 --to 2015
 *   node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs --concurrency 5
 */

import { pool } from './db-rt.mjs';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================
// 설정
// ============================================

const SERVICE_KEY = 'c0f54f9f3d2354efe7d3dbcf4571fc687dd8694479df431de883391688a0a790';
const ROWS_PER_PAGE = 1000;
const DELAY_MS = 100;

const TRADE_TYPES = [
  { key: 'APT_TRADE', url: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade', table: 'sale' },
  { key: 'APT_RENT', url: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent', table: 'rent' },
  { key: 'OFFI_TRADE', url: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade', table: 'sale' },
  { key: 'OFFI_RENT', url: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent', table: 'rent' },
  { key: 'PRESALE_TRADE', url: 'https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade', table: 'sale' },
];

const SGG_CODES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data/sgg-codes.json'), 'utf8')
);

const xmlParser = new XMLParser({ trimValues: true });

// ============================================
// Args
// ============================================

const { values: args } = parseArgs({
  options: {
    type: { type: 'string', default: '' },
    from: { type: 'string', default: '2006' },
    to: { type: 'string', default: '2026' },
    concurrency: { type: 'string', default: '10' },
  },
  strict: false,
});

// ============================================
// 유틸
// ============================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`[${ts}] ${msg}`);
}

function getMonthList(fromYear, toYear) {
  const months = [];
  const now = new Date();
  const currentYM = now.getFullYear() * 100 + (now.getMonth() + 1);
  // 최신순: 최근 데이터부터 수집 (사용자에게 더 가치있는 데이터 우선)
  for (let y = toYear; y >= fromYear; y--) {
    const startM = (y === toYear) ? Math.min(now.getMonth() + 1, 12) : 12;
    for (let m = startM; m >= 1; m--) {
      if (y * 100 + m > currentYM) continue;
      months.push(`${y}${String(m).padStart(2, '0')}`);
    }
  }
  return months;
}

function parseAmount(text) {
  if (!text) return 0;
  return parseInt(String(text).replace(/,/g, '').trim()) || 0;
}

// ============================================
// API 호출
// ============================================

let apiCallCount = 0;

async function fetchPage(baseUrl, sggCode, dealYmd, pageNo = 1) {
  apiCallCount++;
  const params = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    LAWD_CD: sggCode,
    DEAL_YMD: dealYmd,
    pageNo: String(pageNo),
    numOfRows: String(ROWS_PER_PAGE),
  });

  const res = await fetch(`${baseUrl}?${params}`, {
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  if (xml.includes('quota exceeded') || xml.includes('LIMITED_NUMBER')) throw new Error('API quota exceeded');
  if (xml.startsWith('<!DOCTYPE') || xml.startsWith('<HTML')) throw new Error('WAF blocked');

  const parsed = xmlParser.parse(xml);
  const rc = String(parsed?.response?.header?.resultCode ?? '');

  if (rc === '99') throw new Error('API limit exceeded');
  if (!['0', '00', '000'].includes(rc)) {
    throw new Error(`API ${rc}: ${parsed?.response?.header?.resultMsg}`);
  }

  const body = parsed?.response?.body;
  if (!body) return { items: [], totalCount: 0 };

  let items = body.items?.item || [];
  if (!Array.isArray(items)) items = [items];
  return { items, totalCount: body.totalCount || 0 };
}

async function fetchAll(baseUrl, sggCode, dealYmd) {
  const first = await fetchPage(baseUrl, sggCode, dealYmd, 1);
  let allItems = first.items;
  if (first.totalCount > ROWS_PER_PAGE) {
    const totalPages = Math.ceil(first.totalCount / ROWS_PER_PAGE);
    for (let p = 2; p <= totalPages; p++) {
      await sleep(200);
      const extra = await fetchPage(baseUrl, sggCode, dealYmd, p);
      allItems = allItems.concat(extra.items);
    }
  }
  return allItems;
}

// ============================================
// DB Upsert
// ============================================

async function upsertSaleBatch(items, tradeType) {
  if (!items.length) return 0;

  const values = [];
  const params = [];
  let idx = 1;
  const seen = new Set();

  for (const item of items) {
    const sggCd = String(item.sggCd || '').trim();
    const aptNm = String(item.aptNm || item.offiNm || '').trim();
    const excluUseAr = parseFloat(String(item.excluUseAr || '').trim()) || null;
    const floor = parseInt(String(item.floor || '').trim()) || null;
    const dealYear = parseInt(item.dealYear) || null;
    const dealMonth = parseInt(item.dealMonth) || null;
    const dealDay = String(item.dealDay || '').trim() || null;
    const dealAmount = parseAmount(item.dealAmount);

    if (!sggCd || !aptNm || !dealYear || !dealMonth || !dealAmount) continue;

    const key = `${sggCd}|${aptNm}|${excluUseAr}|${dealYear}|${dealMonth}|${dealDay}|${floor}|${dealAmount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const contractYm = `${dealYear}${String(dealMonth).padStart(2, '0')}`;

    values.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},$${idx+10},$${idx+11},$${idx+12},$${idx+13},$${idx+14},$${idx+15},$${idx+16},$${idx+17})`);
    params.push(
      tradeType, sggCd, String(item.umdNm || '').trim(), String(item.jibun || '').trim(),
      aptNm, excluUseAr, contractYm, dealDay, dealAmount,
      String(item.aptDong || '').trim() || null, floor,
      String(item.buyerGbn || '').trim() || null, String(item.slerGbn || '').trim() || null,
      parseInt(String(item.buildYear || '').trim()) || null,
      String(item.dealingGbn || '').trim() || null, String(item.cdealType || '').trim() || null,
      dealYear, dealMonth
    );
    idx += 18;
  }

  if (!values.length) return 0;

  const result = await pool.query(`
    INSERT INTO real_transactions
      (trade_type, sgg_cd, umd_nm, jibun, apt_nm, exclu_use_ar, contract_ym, contract_day, deal_amount,
       dong, floor, buyer_gbn, sler_gbn, build_year, dealing_gbn, cdeal_day, deal_year, deal_month)
    VALUES ${values.join(',')}
    ON CONFLICT ON CONSTRAINT uq_rt_sale DO NOTHING
  `, params);

  return result.rowCount;
}

async function upsertRentBatch(items, tradeType) {
  if (!items.length) return 0;

  const values = [];
  const params = [];
  let idx = 1;
  const seen = new Set();

  for (const item of items) {
    const sggCd = String(item.sggCd || '').trim();
    const aptNm = String(item.aptNm || item.offiNm || '').trim();
    const excluUseAr = parseFloat(String(item.excluUseAr || '').trim()) || null;
    const floor = parseInt(String(item.floor || '').trim()) || null;
    const dealYear = parseInt(item.dealYear) || null;
    const dealMonth = parseInt(item.dealMonth) || null;
    const dealDay = String(item.dealDay || '').trim() || null;
    const deposit = parseAmount(item.deposit);
    const monthlyRent = parseAmount(item.monthlyRent);

    if (!sggCd || !aptNm || !dealYear || !dealMonth) continue;

    const key = `${sggCd}|${aptNm}|${excluUseAr}|${dealYear}|${dealMonth}|${dealDay}|${floor}|${deposit}|${monthlyRent}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const contractYm = `${dealYear}${String(dealMonth).padStart(2, '0')}`;

    values.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},$${idx+10},$${idx+11},$${idx+12},$${idx+13},$${idx+14},$${idx+15})`);
    params.push(
      tradeType, sggCd, String(item.umdNm || '').trim(), String(item.jibun || '').trim(),
      aptNm, excluUseAr, contractYm, dealDay, deposit, monthlyRent,
      floor, parseInt(String(item.buildYear || '').trim()) || null,
      String(item.contractType || '').trim() || null,
      String(item.contractTerm || '').trim() || null,
      dealYear, dealMonth
    );
    idx += 16;
  }

  if (!values.length) return 0;

  const result = await pool.query(`
    INSERT INTO real_rent_transactions
      (trade_type, sgg_cd, umd_nm, jibun, apt_nm, exclu_use_ar, contract_ym, contract_day,
       deposit, monthly_rent, floor, build_year, contract_type, contract_period, deal_year, deal_month)
    VALUES ${values.join(',')}
    ON CONFLICT ON CONSTRAINT uq_rt_rent DO NOTHING
  `, params);

  return result.rowCount;
}

// ============================================
// 이미 수집된 개월 조회
// ============================================

async function getCollectedMonths(tradeType) {
  const table = ['APT_RENT', 'OFFI_RENT'].includes(tradeType)
    ? 'real_rent_transactions' : 'real_transactions';

  // 해당 타입+년월에 10건 이상 있으면 수집 완료로 간주
  const { rows } = await pool.query(`
    SELECT deal_year * 100 + deal_month as ym, count(*)::int as cnt
    FROM ${table}
    WHERE trade_type = $1 AND deal_year IS NOT NULL
    GROUP BY deal_year * 100 + deal_month
    HAVING count(*) >= 10
  `, [tradeType]);

  return new Set(rows.map(r => String(r.ym)));
}

// ============================================
// 단일 타입 수집
// ============================================

async function collectType(type, months, concurrency) {
  const startTime = Date.now();
  let totalInserted = 0;
  let totalItems = 0;
  let errors = 0;
  let skipped = 0;
  let consecutiveErrors = 0;

  const collected = await getCollectedMonths(type.key);
  const remaining = months.filter(m => !collected.has(m));

  log(`━━━ ${type.key} 시작 (전체 ${months.length}개월, 수집완료 ${collected.size}개월, 남은 ${remaining.length}개월) ━━━`);

  if (!remaining.length) {
    log(`  ${type.key}: 모든 개월 수집 완료, 스킵`);
    return { totalInserted: 0, totalItems: 0, errors: 0, limitHit: false, skipped: collected.size };
  }

  for (const month of remaining) {
    // 시군구를 concurrency개씩 병렬
    let monthInserted = 0;

    for (let i = 0; i < SGG_CODES.length; i += concurrency) {
      const batch = SGG_CODES.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(async (sgg) => {
          try {
            const items = await fetchAll(type.url, sgg.code, month);
            if (!items.length) return 0;

            totalItems += items.length;
            const inserted = type.table === 'sale'
              ? await upsertSaleBatch(items, type.key)
              : await upsertRentBatch(items, type.key);
            return inserted;
          } catch (err) {
            if (err.message.includes('limit exceeded') || err.message.includes('quota exceeded')) throw err;
            errors++;
            consecutiveErrors++;
            return 0;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          monthInserted += r.value;
          consecutiveErrors = 0;
        }
        if (r.status === 'rejected') {
          const msg = r.reason?.message || '';
          if (msg.includes('limit') || msg.includes('quota')) {
            log(`  ⚠ API 한도 도달! ${type.key} ${month}에서 중단`);
            totalInserted += monthInserted;
            return { totalInserted, totalItems, errors, limitHit: true, skipped };
          }
        }
      }

      // 연속 에러 5회 → API 서버 문제, 잠시 대기
      if (consecutiveErrors >= 5) {
        log(`  연속 에러 ${consecutiveErrors}회, 30초 대기...`);
        await sleep(30000);
        consecutiveErrors = 0;
      }

      await sleep(DELAY_MS);
    }

    totalInserted += monthInserted;
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    log(`  ${type.key} ${month}: +${monthInserted.toLocaleString()}건 (${elapsed}분, API:${apiCallCount}, 에러:${errors})`);
  }

  return { totalInserted, totalItems, errors, limitHit: false, skipped };
}

// ============================================
// 메인
// ============================================

async function main() {
  const startTime = Date.now();
  const fromYear = parseInt(args.from);
  const toYear = parseInt(args.to);
  const concurrency = parseInt(args.concurrency);
  const typeFilter = args.type.toUpperCase();

  const types = typeFilter
    ? TRADE_TYPES.filter((t) => t.key === typeFilter)
    : TRADE_TYPES;

  const months = getMonthList(fromYear, toYear);

  log('========================================');
  log('  data.go.kr API 벌크 수집 → estate_rt');
  log(`  기간: ${months[0]} ~ ${months[months.length - 1]} (${months.length}개월)`);
  log(`  종류: ${types.map((t) => t.key).join(', ')}`);
  log(`  시군구: ${SGG_CODES.length}개`);
  log(`  병렬: ${concurrency}개`);
  log(`  예상 호출: ~${(months.length * SGG_CODES.length * types.length).toLocaleString()}건`);
  log('========================================\n');

  // 모든 타입을 순차적으로 (각 타입 내에서는 병렬)
  const results = {};
  for (const type of types) {
    results[type.key] = await collectType(type, months, concurrency);
    if (results[type.key].limitHit) {
      log(`\n⚠ ${type.key}에서 API 한도 도달. 나머지 타입은 다음 실행에서 처리.`);
      break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  log('\n========================================');
  log('  수집 완료');
  log(`  소요: ${elapsed}분 | API 호출: ${apiCallCount.toLocaleString()}건`);
  for (const [key, r] of Object.entries(results)) {
    log(`  ${key}: ${r.totalInserted.toLocaleString()}건 삽입 (에러: ${r.errors})`);
  }
  log('========================================');

  // DB 통계
  const s1 = await pool.query('SELECT trade_type, count(*)::int as cnt FROM real_transactions GROUP BY trade_type ORDER BY trade_type');
  const s2 = await pool.query('SELECT trade_type, count(*)::int as cnt FROM real_rent_transactions GROUP BY trade_type ORDER BY trade_type');
  if (s1.rows.length) { log('\n매매:'); console.table(s1.rows); }
  if (s2.rows.length) { log('전월세:'); console.table(s2.rows); }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
