#!/usr/bin/env node
/**
 * 국토부 실거래가 일일 동기화 (매일 새벽 3시 cron)
 *
 * - 최근 6개월 아파트 + 오피스텔 실거래 데이터를 API로 수집
 * - 신규 거래 INSERT, 기존 거래 변경(해제 등) UPDATE 감지
 * - 거래 해제(cdeal_type='O') 탐지 및 로그
 *
 * Usage:
 *   node --env-file=.env scripts/sync-real-transactions-daily.mjs
 *   node --env-file=.env scripts/sync-real-transactions-daily.mjs --dry-run
 */

import { pool } from './db.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

// ============================================
// 설정
// ============================================

const SERVICE_KEY = 'c0f54f9f3d2354efe7d3dbcf4571fc687dd8694479df431de883391688a0a790';
const MONTHS_BACK = 6;
const ROWS_PER_PAGE = 1000;
const DELAY_MS = 200;
const DRY_RUN = process.argv.includes('--dry-run');

const APIS = [
  {
    name: '아파트',
    url: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
  },
  {
    name: '오피스텔',
    url: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade',
  },
];

// ============================================
// 시군구 코드
// ============================================

const SGG_CODES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'data/sgg-codes.json'), 'utf8')
);

const xmlParser = new XMLParser({ trimValues: true });

// ============================================
// 유틸
// ============================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`[${ts}] ${msg}`);
}

function getMonthList(monthsBack) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function parseDealAmount(text) {
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
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      Accept: 'application/xml',
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  if (xml.startsWith('<!DOCTYPE') || xml.startsWith('<HTML')) {
    throw new Error('WAF blocked');
  }

  const parsed = xmlParser.parse(xml);
  const rc = String(parsed?.response?.header?.resultCode ?? '');
  if (!['0', '00', '000'].includes(rc)) {
    throw new Error(`API ${rc}: ${parsed?.response?.header?.resultMsg}`);
  }

  const body = parsed?.response?.body;
  if (!body) return { items: [], totalCount: 0 };

  const totalCount = body.totalCount || 0;
  let items = body.items?.item || [];
  if (!Array.isArray(items)) items = [items];

  return { items, totalCount };
}

async function fetchAll(baseUrl, sggCode, dealYmd) {
  const first = await fetchPage(baseUrl, sggCode, dealYmd, 1);
  let allItems = first.items;

  if (first.totalCount > ROWS_PER_PAGE) {
    const totalPages = Math.ceil(first.totalCount / ROWS_PER_PAGE);
    for (let p = 2; p <= totalPages; p++) {
      await sleep(500);
      const extra = await fetchPage(baseUrl, sggCode, dealYmd, p);
      allItems = allItems.concat(extra.items);
    }
  }

  return { items: allItems, totalCount: first.totalCount };
}

// ============================================
// Upsert (변경 감지 포함)
// ============================================

async function upsertBatch(items) {
  if (!items.length) return { inserted: 0, updated: 0, cancelled: 0 };

  // 배치 내 중복 제거
  const seen = new Set();
  const uniqueItems = [];
  for (const item of items) {
    const sggCd = String(item.sggCd || '').trim();
    const aptNm = String(item.aptNm || '').trim();
    const excluUseAr = parseFloat(String(item.excluUseAr || '').trim()) || 0;
    const floor = parseInt(String(item.floor || '').trim()) || 0;
    const dealYear = parseInt(item.dealYear) || 0;
    const dealMonth = parseInt(item.dealMonth) || 0;
    const dealDay = parseInt(String(item.dealDay || '').trim()) || 0;
    const dealAmount = parseDealAmount(item.dealAmount);
    const key = `${sggCd}|${aptNm}|${excluUseAr}|${dealYear}|${dealMonth}|${dealDay}|${floor}|${dealAmount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(item);
  }

  const values = [];
  const params = [];
  let idx = 1;

  for (const item of uniqueItems) {
    const dealAmount = parseDealAmount(item.dealAmount);
    const sggCd = String(item.sggCd || '').trim();
    const aptNm = String(item.aptNm || '').trim();
    const excluUseAr = parseFloat(String(item.excluUseAr || '').trim()) || null;
    const floor = parseInt(String(item.floor || '').trim()) || null;
    const dealYear = parseInt(item.dealYear) || null;
    const dealMonth = parseInt(item.dealMonth) || null;
    const dealDay = parseInt(String(item.dealDay || '').trim()) || null;

    if (!sggCd || !aptNm || !dealYear || !dealMonth) continue;

    values.push(
      `($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},` +
      `$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12},` +
      `$${idx + 13},$${idx + 14},$${idx + 15},$${idx + 16},$${idx + 17},$${idx + 18},` +
      `$${idx + 19},$${idx + 20},` +
      `(SELECT id FROM complexes WHERE sgg_cd=$${idx} AND rt_apt_nm=$${idx + 3} AND is_active=true LIMIT 1))`
    );
    params.push(
      sggCd,
      String(item.umdNm || '').trim(),
      String(item.jibun || '').trim() || null,
      aptNm,
      String(item.aptDong || '').trim() || null,
      excluUseAr,
      floor,
      parseInt(String(item.buildYear || '').trim()) || null,
      dealYear,
      dealMonth,
      dealDay,
      dealAmount,
      String(item.dealAmount || '').trim(),
      String(item.dealingGbn || '').trim() || null,
      String(item.buyerGbn || '').trim() || null,
      String(item.slerGbn || '').trim() || null,
      String(item.estateAgentSggNm || '').trim() || null,
      String(item.cdealType || '').trim() || null,
      String(item.cdealDay || '').trim() || null,
      String(item.landLeaseholdGbn || '').trim() || null,
      String(item.rgstDate || '').trim() || null,
    );
    idx += 21;
  }

  if (!values.length) return { inserted: 0, updated: 0, cancelled: 0 };

  // ON CONFLICT: 전체 필드 업데이트 (변경 감지)
  const result = await pool.query(`
    INSERT INTO real_transactions
      (sgg_cd, umd_nm, jibun, apt_nm, apt_dong, exclu_use_ar, floor,
       build_year, deal_year, deal_month, deal_day, deal_amount, deal_amount_text,
       dealing_gbn, buyer_gbn, sler_gbn, estate_agent_sgg_nm,
       cdeal_type, cdeal_day, land_leasehold_gbn, rgst_date, complex_id)
    VALUES ${values.join(',')}
    ON CONFLICT (sgg_cd, apt_nm, exclu_use_ar, deal_year, deal_month, deal_day, floor, deal_amount)
    DO UPDATE SET
      cdeal_type = EXCLUDED.cdeal_type,
      cdeal_day = EXCLUDED.cdeal_day,
      rgst_date = EXCLUDED.rgst_date,
      dealing_gbn = EXCLUDED.dealing_gbn,
      buyer_gbn = EXCLUDED.buyer_gbn,
      sler_gbn = EXCLUDED.sler_gbn,
      estate_agent_sgg_nm = EXCLUDED.estate_agent_sgg_nm,
      land_leasehold_gbn = EXCLUDED.land_leasehold_gbn,
      complex_id = COALESCE(real_transactions.complex_id, EXCLUDED.complex_id)
    WHERE real_transactions.cdeal_type IS DISTINCT FROM EXCLUDED.cdeal_type
       OR real_transactions.cdeal_day IS DISTINCT FROM EXCLUDED.cdeal_day
       OR real_transactions.rgst_date IS DISTINCT FROM EXCLUDED.rgst_date
       OR real_transactions.dealing_gbn IS DISTINCT FROM EXCLUDED.dealing_gbn
       OR real_transactions.buyer_gbn IS DISTINCT FROM EXCLUDED.buyer_gbn
       OR real_transactions.sler_gbn IS DISTINCT FROM EXCLUDED.sler_gbn
       OR (real_transactions.complex_id IS NULL AND EXCLUDED.complex_id IS NOT NULL)
  `, params);

  // 해제 건수 카운트
  let cancelled = 0;
  for (const item of uniqueItems) {
    if (String(item.cdealType || '').trim() === 'O') cancelled++;
  }

  return { inserted: result.rowCount, updated: 0, cancelled };
}

// ============================================
// 메인
// ============================================

async function main() {
  const startTime = Date.now();
  const months = getMonthList(MONTHS_BACK);

  log('========================================');
  log(`  실거래가 일일 동기화 ${DRY_RUN ? '[DRY-RUN]' : '[LIVE]'}`);
  log(`  기간: ${months[months.length - 1]} ~ ${months[0]} (${MONTHS_BACK}개월)`);
  log(`  대상: 전국 ${SGG_CODES.length}개 시군구`);
  log('========================================\n');

  // 동기화 전 현황 스냅샷
  const before = await pool.query(`
    SELECT count(*)::int AS total,
      count(CASE WHEN cdeal_type = 'O' THEN 1 END)::int AS cancelled
    FROM real_transactions
    WHERE deal_year * 100 + deal_month >= $1
  `, [parseInt(months[months.length - 1])]);
  const beforeStats = before.rows[0];
  log(`동기화 전 (최근 ${MONTHS_BACK}개월): ${beforeStats.total.toLocaleString()}건, 해제 ${beforeStats.cancelled.toLocaleString()}건\n`);

  let totalInserted = 0;
  let totalCancelled = 0;
  let errorCount = 0;

  for (const api of APIS) {
    log(`\n━━━ ${api.name} 실거래 수집 ━━━`);
    let apiInserted = 0;
    let apiErrors = 0;
    let consecutiveErrors = 0;

    for (const sgg of SGG_CODES) {
      for (const month of months) {
        try {
          const { items, totalCount } = await fetchAll(api.url, sgg.code, month);

          if (totalCount === 0 || items.length === 0) continue;

          if (DRY_RUN) {
            const cancelledInBatch = items.filter(
              (it) => String(it.cdealType || '').trim() === 'O'
            ).length;
            log(`  [DRY] ${sgg.name} ${month}: ${totalCount}건 (해제 ${cancelledInBatch}건)`);
          } else {
            const { inserted, cancelled } = await upsertBatch(items);
            apiInserted += inserted;
            totalCancelled += cancelled;
            if (inserted > 0) {
              log(`  ${sgg.name} ${month}: ${totalCount}건 → ${inserted}건 신규/변경`);
            }
          }

          consecutiveErrors = 0;
        } catch (err) {
          apiErrors++;
          errorCount++;
          consecutiveErrors++;
          log(`  ${sgg.name} ${month}: ERROR ${err.message}`);

          if (consecutiveErrors >= 5) {
            log('  연속 에러 5회, 60초 대기...');
            await sleep(60000);
            consecutiveErrors = 0;
          } else if (consecutiveErrors >= 3) {
            await sleep(15000);
          }
        }

        await sleep(DELAY_MS);
      }
    }

    totalInserted += apiInserted;
    log(`\n  ${api.name} 완료: ${apiInserted.toLocaleString()}건 신규/변경, 에러 ${apiErrors}건`);
  }

  // 동기화 후 현황
  const after = await pool.query(`
    SELECT count(*)::int AS total,
      count(CASE WHEN cdeal_type = 'O' THEN 1 END)::int AS cancelled
    FROM real_transactions
    WHERE deal_year * 100 + deal_month >= $1
  `, [parseInt(months[months.length - 1])]);
  const afterStats = after.rows[0];

  const newCancelled = afterStats.cancelled - beforeStats.cancelled;
  const newRecords = afterStats.total - beforeStats.total;

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  log('\n========================================');
  log('  동기화 결과');
  log(`  소요: ${elapsed}분 | API 호출: ${apiCallCount}건`);
  log(`  신규 거래: +${newRecords.toLocaleString()}건`);
  log(`  변경(upsert): ${totalInserted.toLocaleString()}건`);
  log(`  신규 해제 감지: +${newCancelled}건 (전체 해제: ${afterStats.cancelled.toLocaleString()}건)`);
  log(`  에러: ${errorCount}건`);
  log(`  현재 DB (최근 ${MONTHS_BACK}개월): ${afterStats.total.toLocaleString()}건`);
  log('========================================');

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
