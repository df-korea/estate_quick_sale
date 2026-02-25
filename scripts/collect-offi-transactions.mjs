#!/usr/bin/env node
/**
 * 국토교통부 오피스텔 매매 실거래가 수집 (전국)
 * API: https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade
 *
 * 아파트 수집(collect-real-transactions.mjs)과 동일 구조,
 * 오피스텔 전용 엔드포인트 + 필드 매핑.
 *
 * Usage:
 *   node --env-file=.env scripts/collect-offi-transactions.mjs [--months 12] [--resume] [--sido 서울]
 *   node --env-file=.env scripts/collect-offi-transactions.mjs --incremental  # 최근 2개월
 *
 * API 일일 트래픽: 10,000건
 */

import { pool } from './db.mjs';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

// ============================================
// 설정
// ============================================

const SERVICE_KEY = 'c0f54f9f3d2354efe7d3dbcf4571fc687dd8694479df431de883391688a0a790';
const BASE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade';
const DAILY_LIMIT = 10000;
const ROWS_PER_PAGE = 1000;
const DELAY_MS = 0;

// ============================================
// Args 파싱
// ============================================

const { values: args } = parseArgs({
  options: {
    months: { type: 'string', default: '12' },
    resume: { type: 'boolean', default: false },
    sido: { type: 'string', default: '' },
    incremental: { type: 'boolean', default: false },
  },
  strict: false,
});

const MONTHS_BACK = args.incremental ? 2 : (parseInt(args.months) || 12);
const RESUME = args.resume;
const SIDO_FILTER = args.sido;
const PROGRESS_FILE = 'logs/offi-tx-progress.json';

// ============================================
// 시군구 코드 로드
// ============================================

const SGG_CODES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'data/sgg-codes.json'), 'utf8')
);

// ============================================
// XML 파서
// ============================================

const xmlParser = new XMLParser({ trimValues: true });

// ============================================
// 월 목록 (YYYYMM)
// ============================================

function getMonthList(monthsBack) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// ============================================
// API 호출
// ============================================

let apiCallCount = 0;

async function fetchPage(sggCode, dealYmd, pageNo = 1) {
  apiCallCount++;
  if (apiCallCount > DAILY_LIMIT - 100) {
    throw new Error(`일일 API 한도 근접 (${apiCallCount}/${DAILY_LIMIT}). 내일 --resume으로 이어하세요.`);
  }

  const params = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    LAWD_CD: sggCode,
    DEAL_YMD: dealYmd,
    pageNo: String(pageNo),
    numOfRows: String(ROWS_PER_PAGE),
  });

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/xml',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const xml = await res.text();

  if (xml.startsWith('<!DOCTYPE') || xml.startsWith('<HTML') || xml.startsWith('Forbidden')) {
    throw new Error('WAF blocked or 403 Forbidden — API 활용신청 확인 필요');
  }

  const parsed = xmlParser.parse(xml);
  const header = parsed?.response?.header;
  const rc = String(header?.resultCode ?? '');

  if (!['0', '00', '000'].includes(rc)) {
    throw new Error(`API ${rc}: ${header?.resultMsg}`);
  }

  const body = parsed?.response?.body;
  if (!body) return { items: [], totalCount: 0 };

  const totalCount = body.totalCount || 0;
  let items = body.items?.item || [];
  if (!Array.isArray(items)) items = [items];

  return { items, totalCount };
}

// ============================================
// 한 시군구+월 전체 페이지 수집
// ============================================

async function fetchAll(sggCode, dealYmd) {
  const first = await fetchPage(sggCode, dealYmd, 1);
  let allItems = first.items;

  if (first.totalCount > ROWS_PER_PAGE) {
    const totalPages = Math.ceil(first.totalCount / ROWS_PER_PAGE);
    for (let p = 2; p <= totalPages; p++) {
      await sleep(500);
      const extra = await fetchPage(sggCode, dealYmd, p);
      allItems = allItems.concat(extra.items);
    }
  }

  return { items: allItems, totalCount: first.totalCount };
}

// ============================================
// 거래금액 파싱
// ============================================

function parseDealAmount(text) {
  if (!text) return 0;
  return parseInt(String(text).replace(/,/g, '').trim()) || 0;
}

// ============================================
// 배치 upsert
// 오피스텔 API 필드: offiNm, excluUseAr, floor, dealAmount, dealYear, dealMonth, dealDay,
//   sggCd, umdNm, jibun, buildYear, buyerGbn, slerGbn, cdealType, cdealDay, dealingGbn,
//   estateAgentSggNm, rgstDate, landLeaseholdGbn
// → real_transactions 테이블에 apt_nm = offiNm으로 저장
// ============================================

async function upsertBatch(items) {
  if (!items.length) return { inserted: 0, skipped: 0 };

  // 배치 내 중복 제거 (UNIQUE key 기준)
  const seen = new Set();
  const uniqueItems = [];
  for (const item of items) {
    const sggCd = String(item.sggCd || '').trim();
    const offiNm = String(item.offiNm || '').trim();
    const excluUseAr = parseFloat(String(item.excluUseAr || '').trim()) || 0;
    const floor = parseInt(String(item.floor || '').trim()) || 0;
    const dealYear = parseInt(item.dealYear) || 0;
    const dealMonth = parseInt(item.dealMonth) || 0;
    const dealDay = parseInt(String(item.dealDay || '').trim()) || 0;
    const dealAmount = parseDealAmount(item.dealAmount);
    const key = `${sggCd}|${offiNm}|${excluUseAr}|${dealYear}|${dealMonth}|${dealDay}|${floor}|${dealAmount}`;
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
    const offiNm = String(item.offiNm || '').trim();
    const excluUseAr = parseFloat(String(item.excluUseAr || '').trim()) || null;
    const floor = parseInt(String(item.floor || '').trim()) || null;
    const dealYear = parseInt(item.dealYear) || null;
    const dealMonth = parseInt(item.dealMonth) || null;
    const dealDay = parseInt(String(item.dealDay || '').trim()) || null;

    if (!sggCd || !offiNm || !dealYear || !dealMonth) continue;

    values.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},$${idx+10},$${idx+11},$${idx+12},$${idx+13},$${idx+14},$${idx+15},$${idx+16},$${idx+17},$${idx+18},$${idx+19},$${idx+20},(SELECT id FROM complexes WHERE sgg_cd=$${idx} AND rt_apt_nm=$${idx+3} AND is_active=true LIMIT 1))`);
    params.push(
      sggCd,
      String(item.umdNm || '').trim(),
      String(item.jibun || '').trim() || null,
      offiNm,
      null,  // apt_dong (오피스텔 API에 없음)
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

  if (!values.length) return { inserted: 0, skipped: 0 };

  const result = await pool.query(`
    INSERT INTO real_transactions
      (sgg_cd, umd_nm, jibun, apt_nm, apt_dong, exclu_use_ar, floor,
       build_year, deal_year, deal_month, deal_day, deal_amount, deal_amount_text,
       dealing_gbn, buyer_gbn, sler_gbn, estate_agent_sgg_nm,
       cdeal_type, cdeal_day, land_leasehold_gbn, rgst_date, complex_id)
    VALUES ${values.join(',')}
    ON CONFLICT (sgg_cd, apt_nm, exclu_use_ar, deal_year, deal_month, deal_day, floor, deal_amount)
    DO UPDATE SET complex_id = EXCLUDED.complex_id
      WHERE real_transactions.complex_id IS NULL AND EXCLUDED.complex_id IS NOT NULL
  `, params);

  return { inserted: result.rowCount, skipped: values.length - result.rowCount };
}

// ============================================
// 진행상황
// ============================================

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch {}
  return { completed: [], stats: { inserted: 0, skipped: 0, apiCalls: 0 } };
}

function saveProgress(progress) {
  fs.mkdirSync('logs', { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================
// 메인
// ============================================

async function main() {
  let sggList = SGG_CODES;
  if (SIDO_FILTER) {
    sggList = SGG_CODES.filter(s => s.sido === SIDO_FILTER);
    if (!sggList.length) {
      console.error(`"${SIDO_FILTER}" 시도를 찾을 수 없습니다.`);
      process.exit(1);
    }
  }

  const months = getMonthList(MONTHS_BACK);

  console.log('==========================================');
  console.log('  국토부 오피스텔 매매 실거래가 수집');
  console.log(`  기간: ${months[months.length - 1]} ~ ${months[0]} (${MONTHS_BACK}개월)`);
  console.log(`  대상: ${SIDO_FILTER || '전국'} ${sggList.length}개 시군구`);
  console.log(`  ${new Date().toLocaleString('ko-KR')}`);
  console.log('==========================================\n');

  const tasks = [];
  for (const sgg of sggList) {
    for (const month of months) {
      tasks.push({ sgg, month });
    }
  }
  const totalTasks = tasks.length;
  console.log(`전체: ${totalTasks}건 (${sggList.length}시군구 x ${months.length}개월)\n`);

  let progress = loadProgress();
  if (RESUME && progress.completed.length > 0) {
    apiCallCount = progress.stats.apiCalls || 0;
    console.log(`이어하기: ${progress.completed.length}/${totalTasks} 완료, API ${apiCallCount}건 사용`);
  } else if (!RESUME) {
    progress = { completed: [], stats: { inserted: 0, skipped: 0, apiCalls: 0 } };
  }

  let { inserted: totalInserted, skipped: totalSkipped } = progress.stats;
  let errorCount = 0;
  let consecutiveErrors = 0;
  const startTime = Date.now();
  let lastSido = '';

  for (let i = 0; i < totalTasks; i++) {
    const { sgg, month } = tasks[i];
    const taskKey = `${sgg.code}_${month}`;

    if (progress.completed.includes(taskKey)) continue;

    if (sgg.sido !== lastSido) {
      lastSido = sgg.sido;
      console.log(`\n--- ${sgg.sido} ---`);
    }

    const pct = ((progress.completed.length / totalTasks) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(0);
    process.stdout.write(`[${pct}% ${elapsed}m API:${apiCallCount}] ${sgg.name} ${month} ... `);

    try {
      const { items, totalCount } = await fetchAll(sgg.code, month);

      if (totalCount === 0 || items.length === 0) {
        console.log('0건');
      } else {
        const { inserted, skipped } = await upsertBatch(items);
        totalInserted += inserted;
        totalSkipped += skipped;
        console.log(`${totalCount}건 → ${inserted}건 신규`);
      }

      consecutiveErrors = 0;
      progress.completed.push(taskKey);
      progress.stats = { inserted: totalInserted, skipped: totalSkipped, apiCalls: apiCallCount };
      saveProgress(progress);

    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errorCount++;
      consecutiveErrors++;

      if (err.message.includes('일일 API 한도')) {
        console.log('\n일일 API 한도 도달. 내일 --resume으로 이어서 수집하세요.');
        progress.stats = { inserted: totalInserted, skipped: totalSkipped, apiCalls: apiCallCount };
        saveProgress(progress);
        break;
      }

      if (err.message.includes('403') || err.message.includes('Forbidden')) {
        console.log('\nAPI 활용신청이 필요합니다. data.go.kr에서 오피스텔 API를 신청하세요.');
        break;
      }

      if (consecutiveErrors >= 5) {
        console.log('  연속 에러 5회, 60초 대기...');
        await sleep(60000);
        consecutiveErrors = 0;
      } else if (consecutiveErrors >= 3) {
        await sleep(15000);
      }
    }

    await sleep(DELAY_MS);
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log('\n==========================================');
  console.log('  오피스텔 수집 완료');
  console.log(`  소요: ${elapsed}분 | API: ${apiCallCount}건`);
  console.log(`  신규: ${totalInserted.toLocaleString()}건 | 중복: ${totalSkipped.toLocaleString()}건 | 에러: ${errorCount}건`);
  console.log(`  진행: ${progress.completed.length}/${totalTasks}건`);
  console.log('==========================================');

  const { rows: [s] } = await pool.query(`
    SELECT count(*)::int AS total, count(DISTINCT sgg_cd)::int AS sgg_count
    FROM real_transactions
  `);
  console.log(`\nDB 현황: ${s.total.toLocaleString()}건 (${s.sgg_count}개 시군구)`);

  if (progress.completed.length >= totalTasks) {
    try { fs.unlinkSync(PROGRESS_FILE); } catch {}
    console.log('전체 수집 완료! 진행파일 삭제됨.');
  } else {
    console.log(`미완료 (${totalTasks - progress.completed.length}건 남음). --resume으로 이어서 수집 가능.`);
  }

  await pool.end();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
