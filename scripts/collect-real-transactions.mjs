#!/usr/bin/env node
/**
 * 국토교통부 아파트 매매 실거래가 수집 (전국)
 * API: https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade
 *
 * Usage:
 *   node scripts/collect-real-transactions.mjs [--months 12] [--resume] [--sido 서울]
 *   node scripts/collect-real-transactions.mjs --incremental  # 최근 2개월만 (당월+전월)
 *
 * Options:
 *   --months N      최근 N개월 수집 (기본: 12)
 *   --incremental   최근 2개월만 빠르게 수집 (--months 무시)
 *   --resume        이전 중단 지점부터 이어서 수집
 *   --sido NAME     특정 시도만 수집 (서울, 경기, 부산 등)
 *
 * API 일일 트래픽: 10,000건
 * 예상 호출: 250시군구 × 12월 = 3,000건 + 페이지네이션 ~500건 = ~3,500건
 */

import pg from 'pg';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const { Pool } = pg;

// ============================================
// 설정
// ============================================

const SERVICE_KEY = 'c0f54f9f3d2354efe7d3dbcf4571fc687dd8694479df431de883391688a0a790';
const BASE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const DAILY_LIMIT = 10000;
const ROWS_PER_PAGE = 1000;
const DELAY_MS = 1000;  // API 호출 간격

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
const PROGRESS_FILE = 'logs/real-tx-progress.json';

// ============================================
// 시군구 코드 로드
// ============================================

const SGG_CODES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'data/sgg-codes.json'), 'utf8')
);

// ============================================
// DB
// ============================================

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'estate_quick_sale',
  user: process.env.USER,
});

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

  // HTML 에러 응답 체크 (WAF 차단 등)
  if (xml.startsWith('<!DOCTYPE') || xml.startsWith('<HTML')) {
    throw new Error('WAF blocked (HTML response)');
  }

  const parsed = xmlParser.parse(xml);
  const header = parsed?.response?.header;
  // resultCode가 숫자 0으로 파싱될 수 있으므로 nullish coalescing 사용
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
// 배치 upsert (한 페이지 분량을 한 번에)
// ============================================

async function upsertBatch(items) {
  if (!items.length) return { inserted: 0, skipped: 0 };

  // VALUES 절 구성
  const values = [];
  const params = [];
  let idx = 1;

  for (const item of items) {
    const dealAmount = parseDealAmount(item.dealAmount);
    const sggCd = String(item.sggCd || '').trim();
    const aptNm = String(item.aptNm || '').trim();
    const excluUseAr = parseFloat(String(item.excluUseAr || '').trim()) || null;
    const floor = parseInt(String(item.floor || '').trim()) || null;
    const dealYear = parseInt(item.dealYear) || null;
    const dealMonth = parseInt(item.dealMonth) || null;
    const dealDay = parseInt(String(item.dealDay || '').trim()) || null;

    if (!sggCd || !aptNm || !dealYear || !dealMonth) continue;

    values.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},$${idx+10},$${idx+11},$${idx+12},$${idx+13},$${idx+14},$${idx+15},$${idx+16},$${idx+17},$${idx+18},$${idx+19},$${idx+20})`);
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

  if (!values.length) return { inserted: 0, skipped: 0 };

  const result = await pool.query(`
    INSERT INTO real_transactions
      (sgg_cd, umd_nm, jibun, apt_nm, apt_dong, exclu_use_ar, floor,
       build_year, deal_year, deal_month, deal_day, deal_amount, deal_amount_text,
       dealing_gbn, buyer_gbn, sler_gbn, estate_agent_sgg_nm,
       cdeal_type, cdeal_day, land_leasehold_gbn, rgst_date)
    VALUES ${values.join(',')}
    ON CONFLICT (sgg_cd, apt_nm, exclu_use_ar, deal_year, deal_month, deal_day, floor, deal_amount)
    DO NOTHING
  `, params);

  const inserted = result.rowCount;
  return { inserted, skipped: values.length - inserted };
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
  // 시군구 필터
  let sggList = SGG_CODES;
  if (SIDO_FILTER) {
    sggList = SGG_CODES.filter(s => s.sido === SIDO_FILTER);
    if (!sggList.length) {
      console.error(`❌ "${SIDO_FILTER}" 시도를 찾을 수 없습니다.`);
      console.error(`   사용 가능: ${[...new Set(SGG_CODES.map(s => s.sido))].join(', ')}`);
      process.exit(1);
    }
  }

  const months = getMonthList(MONTHS_BACK);

  console.log('==========================================');
  console.log('  국토부 아파트 매매 실거래가 수집 (전국)');
  console.log(`  기간: ${months[months.length - 1]} ~ ${months[0]} (${MONTHS_BACK}개월)`);
  console.log(`  대상: ${SIDO_FILTER || '전국'} ${sggList.length}개 시군구`);
  console.log(`  일일 API 한도: ${DAILY_LIMIT}건`);
  console.log(`  ${new Date().toLocaleString('ko-KR')}`);
  console.log('==========================================');
  console.log('');

  // 작업 목록
  const tasks = [];
  for (const sgg of sggList) {
    for (const month of months) {
      tasks.push({ sgg, month });
    }
  }
  const totalTasks = tasks.length;
  console.log(`📋 전체: ${totalTasks}건 (${sggList.length}시군구 × ${months.length}개월)`);
  console.log(`   예상 API 호출: ~${totalTasks + Math.round(totalTasks * 0.15)}건 (페이지네이션 포함)`);
  console.log(`   예상 소요: ~${Math.round(totalTasks * 1.2 / 60)}분`);
  console.log('');

  // 이어하기
  let progress = loadProgress();
  if (RESUME && progress.completed.length > 0) {
    apiCallCount = progress.stats.apiCalls || 0;
    console.log(`📌 이어하기: ${progress.completed.length}/${totalTasks} 완료, API ${apiCallCount}건 사용`);
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

    // 시도 변경 시 헤더 출력
    if (sgg.sido !== lastSido) {
      lastSido = sgg.sido;
      console.log(`\n━━━ ${sgg.sido} ━━━`);
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
      console.log(`❌ ${err.message}`);
      errorCount++;
      consecutiveErrors++;

      if (err.message.includes('일일 API 한도')) {
        console.log('\n⛔ 일일 API 한도에 도달했습니다. 내일 --resume으로 이어서 수집하세요.');
        progress.stats = { inserted: totalInserted, skipped: totalSkipped, apiCalls: apiCallCount };
        saveProgress(progress);
        break;
      }

      if (consecutiveErrors >= 5) {
        console.log('  ⏳ 연속 에러 5회, 60초 대기...');
        await sleep(60000);
        consecutiveErrors = 0;
      } else if (consecutiveErrors >= 3) {
        console.log('  ⏳ 연속 에러, 15초 대기...');
        await sleep(15000);
      }
    }

    await sleep(DELAY_MS);
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log('');
  console.log('==========================================');
  console.log('  수집 완료!');
  console.log(`  소요: ${elapsed}분 | API 호출: ${apiCallCount}건`);
  console.log(`  신규: ${totalInserted.toLocaleString()}건 | 중복: ${totalSkipped.toLocaleString()}건 | 에러: ${errorCount}건`);
  console.log(`  진행: ${progress.completed.length}/${totalTasks}건`);
  console.log('==========================================');

  // DB 집계
  const summary = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(DISTINCT sgg_cd)::int AS sgg_count,
      count(DISTINCT apt_nm)::int AS apt_count,
      min(deal_year * 100 + deal_month) AS earliest,
      max(deal_year * 100 + deal_month) AS latest
    FROM real_transactions
  `);
  const s = summary.rows[0];
  console.log(`\n📊 DB 현황: ${s.total.toLocaleString()}건 | ${s.sgg_count}개 시군구 | ${s.apt_count.toLocaleString()}개 아파트 | ${s.earliest}~${s.latest}`);

  // 시도별 집계
  const sidoSummary = await pool.query(`
    SELECT
      CASE
        WHEN sgg_cd LIKE '11%' THEN '서울'
        WHEN sgg_cd LIKE '26%' THEN '부산'
        WHEN sgg_cd LIKE '27%' THEN '대구'
        WHEN sgg_cd LIKE '28%' THEN '인천'
        WHEN sgg_cd LIKE '29%' THEN '광주'
        WHEN sgg_cd LIKE '30%' THEN '대전'
        WHEN sgg_cd LIKE '31%' THEN '울산'
        WHEN sgg_cd LIKE '36%' THEN '세종'
        WHEN sgg_cd LIKE '41%' THEN '경기'
        WHEN sgg_cd LIKE '51%' THEN '강원'
        WHEN sgg_cd LIKE '43%' THEN '충북'
        WHEN sgg_cd LIKE '44%' THEN '충남'
        WHEN sgg_cd LIKE '52%' THEN '전북'
        WHEN sgg_cd LIKE '46%' THEN '전남'
        WHEN sgg_cd LIKE '47%' THEN '경북'
        WHEN sgg_cd LIKE '48%' THEN '경남'
        WHEN sgg_cd LIKE '50%' THEN '제주'
        ELSE '기타'
      END AS sido,
      count(*)::int AS cnt
    FROM real_transactions
    GROUP BY sido
    ORDER BY cnt DESC
  `);
  console.log('\n시도별 건수:');
  for (const row of sidoSummary.rows) {
    console.log(`  ${row.sido}: ${row.cnt.toLocaleString()}건`);
  }

  // 완료 시 진행파일 삭제
  if (progress.completed.length >= totalTasks) {
    try { fs.unlinkSync(PROGRESS_FILE); } catch {}
    console.log('\n✅ 전체 수집 완료! 진행파일 삭제됨.');
  } else {
    console.log(`\n📌 미완료 (${totalTasks - progress.completed.length}건 남음). --resume으로 이어서 수집 가능.`);
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
