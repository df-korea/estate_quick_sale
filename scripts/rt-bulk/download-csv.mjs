#!/usr/bin/env node
/**
 * rt.molit.go.kr 실거래가 CSV 벌크 다운로드
 *
 * 전국 1개월 단위로 CSV 다운로드 (2006-01 ~ 2026-03)
 * 5종류: 아파트매매, 아파트전월세, 오피스텔매매, 오피스텔전월세, 분양권매매
 *
 * Usage:
 *   node --env-file=.env scripts/rt-bulk/download-csv.mjs
 *   node --env-file=.env scripts/rt-bulk/download-csv.mjs --type APT_TRADE
 *   node --env-file=.env scripts/rt-bulk/download-csv.mjs --from 2020
 *   node --env-file=.env scripts/rt-bulk/download-csv.mjs --resume
 */

import { pool } from './db-rt.mjs';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_DIR = path.join(__dirname, 'data/csv');

// ============================================
// 설정
// ============================================

const TRADE_TYPES = [
  { key: 'APT_TRADE',     srhThingNo: 'A', srhDelngSecd: '1', name: '아파트 매매' },
  { key: 'APT_RENT',      srhThingNo: 'A', srhDelngSecd: '2', name: '아파트 전월세' },
  { key: 'OFFI_TRADE',    srhThingNo: 'D', srhDelngSecd: '1', name: '오피스텔 매매' },
  { key: 'OFFI_RENT',     srhThingNo: 'D', srhDelngSecd: '2', name: '오피스텔 전월세' },
  { key: 'PRESALE_TRADE', srhThingNo: 'E', srhDelngSecd: '1', name: '분양권 매매' },
];

const BASE_URL = 'https://rt.molit.go.kr/pt/xls/ptXlsCSVDown.do';
const DELAY_MS = 200;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 60000;

// ============================================
// Args
// ============================================

const { values: args } = parseArgs({
  options: {
    type: { type: 'string', default: '' },
    from: { type: 'string', default: '2006' },
    to: { type: 'string', default: '2026' },
    resume: { type: 'boolean', default: false },
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

function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function generateMonthList(fromYear, toYear) {
  const months = [];
  const now = new Date();
  const currentYM = now.getFullYear() * 100 + (now.getMonth() + 1);

  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y * 100 + m > currentYM) break;
      const ym = `${y}${String(m).padStart(2, '0')}`;
      const fromDt = `${y}-${String(m).padStart(2, '0')}-01`;
      const toDt = `${y}-${String(m).padStart(2, '0')}-${getLastDayOfMonth(y, m)}`;
      months.push({ ym, fromDt, toDt, year: y, month: m });
    }
  }
  return months;
}

// ============================================
// 다운로드
// ============================================

async function downloadCSV(tradeType, monthInfo) {
  const formData = new URLSearchParams({
    srhThingNo: tradeType.srhThingNo,
    srhDelngSecd: tradeType.srhDelngSecd,
    srhFromDt: monthInfo.fromDt,
    srhToDt: monthInfo.toDt,
    srhSidoCd: '',
    srhSggCd: '',
    srhEmdCd: '',
    srhHsmpCd: '',
    srhLoadCd: '',
    srhArea: '',
    srhLrArea: '',
    srhFromAmount: '',
    srhToAmount: '',
    srhAddrGbn: '1',
    srhLfstsSecd: '1',
    srhNewRonSecd: '',
    srhRoadNm: '',
    sidoNm: '전체',
    sggNm: '전체',
    emdNm: '전체',
    loadNm: '',
    areaNm: '전체',
    hsmpNm: '전체',
    mobileAt: '',
  });

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://rt.molit.go.kr/pt/xls/xls.do',
    },
    body: formData.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const text = await res.text();
    if (text.includes('alert') || text.includes('에러') || text.includes('오류')) {
      throw new Error('Server returned error page');
    }
    // 빈 결과일 수 있음
    if (text.length < 500) {
      return null;
    }
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer;
}

async function downloadWithRetry(tradeType, monthInfo) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await downloadCSV(tradeType, monthInfo);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const waitMs = attempt * 5000 + Math.random() * 5000;
      log(`  재시도 ${attempt}/${MAX_RETRIES} (${Math.round(waitMs / 1000)}s 대기): ${err.message}`);
      await sleep(waitMs);
    }
  }
}

// ============================================
// 진행 추적
// ============================================

async function getCompletedTasks() {
  const { rows } = await pool.query(
    "SELECT task_key FROM download_progress WHERE status = 'imported' OR status = 'downloaded'"
  );
  return new Set(rows.map((r) => r.task_key));
}

async function updateProgress(taskKey, tradeType, ym, status, csvPath, csvSize, rowCount, errorMsg) {
  await pool.query(
    `INSERT INTO download_progress (task_key, trade_type, year_month, status, csv_path, csv_size, row_count, error_msg, started_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
       CASE WHEN $4 = 'downloading' THEN NOW() ELSE NULL END,
       CASE WHEN $4 IN ('downloaded','imported','error') THEN NOW() ELSE NULL END)
     ON CONFLICT (task_key) DO UPDATE SET
       status = $4, csv_path = COALESCE($5, download_progress.csv_path),
       csv_size = COALESCE($6, download_progress.csv_size),
       row_count = COALESCE($7, download_progress.row_count),
       error_msg = $8,
       started_at = CASE WHEN $4 = 'downloading' THEN NOW() ELSE download_progress.started_at END,
       completed_at = CASE WHEN $4 IN ('downloaded','imported','error') THEN NOW() ELSE download_progress.completed_at END`,
    [taskKey, tradeType, ym, status, csvPath, csvSize, rowCount, errorMsg]
  );
}

// ============================================
// 메인
// ============================================

async function main() {
  const startTime = Date.now();
  const fromYear = parseInt(args.from);
  const toYear = parseInt(args.to);
  const typeFilter = args.type.toUpperCase();
  const resume = args.resume;

  const types = typeFilter
    ? TRADE_TYPES.filter((t) => t.key === typeFilter)
    : TRADE_TYPES;

  if (types.length === 0) {
    console.error(`Unknown type: ${typeFilter}. Available: ${TRADE_TYPES.map((t) => t.key).join(', ')}`);
    process.exit(1);
  }

  const months = generateMonthList(fromYear, toYear);
  const completedTasks = resume ? await getCompletedTasks() : new Set();

  const totalTasks = types.length * months.length;
  const skipCount = completedTasks.size;

  log('========================================');
  log('  rt.molit.go.kr CSV 벌크 다운로드');
  log(`  기간: ${fromYear}-01 ~ ${toYear}-${String(months[months.length - 1]?.month || 12).padStart(2, '0')}`);
  log(`  종류: ${types.map((t) => t.name).join(', ')}`);
  log(`  총 작업: ${totalTasks}건 (스킵: ${skipCount}건)`);
  log('========================================\n');

  let downloaded = 0;
  let skipped = 0;
  let errors = 0;
  let emptyCount = 0;
  let consecutiveErrors = 0;

  for (const type of types) {
    log(`\n━━━ ${type.name} (${type.key}) ━━━`);
    const typeDir = path.join(CSV_DIR, type.key);
    fs.mkdirSync(typeDir, { recursive: true });

    for (const m of months) {
      const taskKey = `${type.key}|${m.ym}`;

      if (completedTasks.has(taskKey)) {
        skipped++;
        continue;
      }

      const csvPath = path.join(typeDir, `${m.ym}.csv`);

      try {
        await updateProgress(taskKey, type.key, m.ym, 'downloading', csvPath, null, null, null);

        const buffer = await downloadWithRetry(type, m);

        if (!buffer || buffer.length < 100) {
          emptyCount++;
          await updateProgress(taskKey, type.key, m.ym, 'downloaded', csvPath, 0, 0, 'empty');
          log(`  ${m.ym}: 데이터 없음`);
        } else {
          fs.writeFileSync(csvPath, buffer);
          const lineCount = buffer.toString('binary').split('\n').length;
          downloaded++;
          await updateProgress(taskKey, type.key, m.ym, 'downloaded', csvPath, buffer.length, lineCount, null);
          const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
          log(`  ${m.ym}: ${sizeMB}MB, ~${lineCount}줄`);
        }

        consecutiveErrors = 0;
      } catch (err) {
        errors++;
        consecutiveErrors++;
        await updateProgress(taskKey, type.key, m.ym, 'error', csvPath, null, null, err.message);
        log(`  ${m.ym}: ERROR ${err.message}`);

        if (consecutiveErrors >= 5) {
          log('  연속 에러 5회! 60초 대기...');
          await sleep(60000);
          consecutiveErrors = 0;
        }
      }

      await sleep(DELAY_MS);
    }
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  log('\n========================================');
  log('  다운로드 완료');
  log(`  소요: ${elapsed}분`);
  log(`  다운로드: ${downloaded}건`);
  log(`  스킵(이미 완료): ${skipped}건`);
  log(`  빈 응답: ${emptyCount}건`);
  log(`  에러: ${errors}건`);
  log('========================================');

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
