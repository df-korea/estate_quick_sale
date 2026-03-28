#!/usr/bin/env node
/**
 * 다운받은 CSV를 estate_rt DB에 임포트
 *
 * Usage:
 *   node --env-file=.env scripts/rt-bulk/import-csv.mjs
 *   node --env-file=.env scripts/rt-bulk/import-csv.mjs --type APT_TRADE
 *   node --env-file=.env scripts/rt-bulk/import-csv.mjs --file data/csv/APT_TRADE/202603.csv
 */

import { pool } from './db-rt.mjs';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_DIR = path.join(__dirname, 'data/csv');

// ============================================
// Args
// ============================================

const { values: args } = parseArgs({
  options: {
    type: { type: 'string', default: '' },
    file: { type: 'string', default: '' },
  },
  strict: false,
});

// ============================================
// 시군구 역매핑
// ============================================

const SGG_CODES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data/sgg-codes.json'), 'utf8')
);

const SIDO_FULL_TO_SHORT = {
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구',
  '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
  '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기',
  '충청북도': '충북', '충청남도': '충남', '전라남도': '전남',
  '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주',
  '강원특별자치도': '강원', '전북특별자치도': '전북',
  // 과거 명칭
  '강원도': '강원', '전라북도': '전북', '제주도': '제주',
};

// sgg-codes.json에서 역매핑 빌드: "서울 강남구" → "11680"
const sggLookup = new Map();
for (const sgg of SGG_CODES) {
  sggLookup.set(sgg.name, sgg.code);
  // 공백 변형도 등록
  const parts = sgg.name.split(' ');
  if (parts.length === 2) {
    sggLookup.set(`${parts[0]} ${parts[1]}`, sgg.code);
  }
}

function parseSigungu(raw) {
  // "전북특별자치도 전주시 완산구 중노송동" → {sido_nm, sgg_nm, umd_nm, sgg_cd}
  if (!raw || raw === '-') return { sido_nm: '', sgg_nm: '', umd_nm: '', sgg_cd: '' };

  const tokens = raw.trim().split(/\s+/);
  if (tokens.length < 2) return { sido_nm: raw, sgg_nm: '', umd_nm: '', sgg_cd: '' };

  const sidoFull = tokens[0];
  const sidoShort = SIDO_FULL_TO_SHORT[sidoFull] || sidoFull;

  // 시군구 파싱: 특별시/광역시는 token[1]이 구, 도는 token[1]+token[2]이 시+구
  let sgg_nm = '';
  let umd_nm = '';
  let lookupKey = '';

  if (tokens.length >= 4 && (tokens[2].endsWith('구') || tokens[2].endsWith('군'))) {
    // "경기도 성남시 분당구 야탑동" → sgg: "성남시분당구", umd: "야탑동"
    sgg_nm = `${tokens[1]} ${tokens[2]}`;
    umd_nm = tokens.slice(3).join(' ');
    lookupKey = `${sidoShort} ${tokens[1]}${tokens[2]}`;
  } else if (tokens.length >= 3) {
    // "서울특별시 강남구 도곡동" → sgg: "강남구", umd: "도곡동"
    sgg_nm = tokens[1];
    umd_nm = tokens.slice(2).join(' ');
    lookupKey = `${sidoShort} ${tokens[1]}`;
  } else {
    sgg_nm = tokens[1];
    lookupKey = `${sidoShort} ${tokens[1]}`;
  }

  const sgg_cd = sggLookup.get(lookupKey) || '';

  // fallback: 공백 없는 버전으로 재시도
  if (!sgg_cd && sgg_nm.includes(' ')) {
    const noSpace = `${sidoShort} ${sgg_nm.replace(/\s+/g, '')}`;
    const fallback = sggLookup.get(noSpace);
    if (fallback) return { sido_nm: sidoFull, sgg_nm, umd_nm, sgg_cd: fallback };
  }

  return { sido_nm: sidoFull, sgg_nm, umd_nm, sgg_cd };
}

// ============================================
// 유틸
// ============================================

function log(msg) {
  const ts = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`[${ts}] ${msg}`);
}

function parseAmount(text) {
  if (!text || text === '-') return 0;
  return parseInt(String(text).replace(/,/g, '').trim()) || 0;
}

function parseYear(text) {
  if (!text || text === '-') return null;
  return parseInt(String(text).trim()) || null;
}

function parseFloor(text) {
  if (!text || text === '-') return null;
  return parseInt(String(text).trim()) || null;
}

function parseArea(text) {
  if (!text || text === '-') return null;
  return parseFloat(String(text).replace(/,/g, '').trim()) || null;
}

function clean(text) {
  if (!text || text === '-') return null;
  const trimmed = String(text).trim();
  return trimmed || null;
}

// ============================================
// CSV 파싱
// ============================================

function parseCSVFile(filePath) {
  const raw = fs.readFileSync(filePath);
  const decoded = iconv.decode(raw, 'euc-kr');

  // 헤더 줄 찾기: "NO","시군구" 로 시작하는 줄
  const lines = decoded.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (lines[i].includes('"NO"') && lines[i].includes('"시군구"')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return { headers: [], rows: [] };
  }

  const dataSection = lines.slice(headerIdx).join('\n');

  const records = parse(dataSection, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  return records;
}

// ============================================
// 매매 임포트
// ============================================

const SALE_TYPES = new Set(['APT_TRADE', 'OFFI_TRADE', 'PRESALE_TRADE']);
const RENT_TYPES = new Set(['APT_RENT', 'OFFI_RENT']);

async function importSaleBatch(rows, tradeType) {
  if (!rows.length) return 0;

  const values = [];
  const params = [];
  let idx = 1;

  for (const row of rows) {
    const sigungu = parseSigungu(row['시군구']);
    const contractYm = clean(row['계약년월']);
    const dealYear = contractYm ? parseInt(contractYm.substring(0, 4)) : null;
    const dealMonth = contractYm ? parseInt(contractYm.substring(4, 6)) : null;
    const dealAmount = parseAmount(row['거래금액(만원)']);
    const aptNm = clean(row['단지명']);

    if (!aptNm || !dealAmount) continue;

    values.push(
      `($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},` +
      `$${idx+10},$${idx+11},$${idx+12},$${idx+13},$${idx+14},$${idx+15},$${idx+16},$${idx+17},$${idx+18},` +
      `$${idx+19},$${idx+20},$${idx+21},$${idx+22},$${idx+23},$${idx+24})`
    );
    params.push(
      tradeType,               // 1
      sigungu.sgg_cd || null,  // 2
      sigungu.sido_nm || null, // 3
      sigungu.sgg_nm || null,  // 4
      sigungu.umd_nm || null,  // 5
      clean(row['번지']),      // 6
      clean(row['본번']),      // 7
      clean(row['부번']),      // 8
      aptNm,                   // 9
      parseArea(row['전용면적(㎡)']), // 10
      contractYm,              // 11
      clean(row['계약일']),    // 12
      dealAmount,              // 13
      clean(row['동']),        // 14
      parseFloor(row['층']),   // 15
      clean(row['매수자']),    // 16
      clean(row['매도자']),    // 17
      parseYear(row['건축년도']), // 18
      clean(row['도로명']),    // 19
      clean(row['해제사유발생일']), // 20
      clean(row['거래유형']),  // 21
      clean(row['중개사소재지']), // 22
      clean(row['등기일자']),  // 23
      dealYear,                // 24
      dealMonth,               // 25
    );
    idx += 25;
  }

  if (!values.length) return 0;

  const result = await pool.query(`
    INSERT INTO real_transactions
      (trade_type, sgg_cd, sido_nm, sgg_nm, umd_nm, jibun, bonbun, bubun,
       apt_nm, exclu_use_ar, contract_ym, contract_day, deal_amount,
       dong, floor, buyer_gbn, sler_gbn, build_year, road_nm,
       cdeal_day, dealing_gbn, estate_agent_sgg_nm, rgst_date,
       deal_year, deal_month)
    VALUES ${values.join(',')}
    ON CONFLICT ON CONSTRAINT uq_rt_sale DO NOTHING
  `, params);

  return result.rowCount;
}

async function importRentBatch(rows, tradeType) {
  if (!rows.length) return 0;

  const values = [];
  const params = [];
  let idx = 1;

  for (const row of rows) {
    const sigungu = parseSigungu(row['시군구']);
    const contractYm = clean(row['계약년월']);
    const dealYear = contractYm ? parseInt(contractYm.substring(0, 4)) : null;
    const dealMonth = contractYm ? parseInt(contractYm.substring(4, 6)) : null;
    const aptNm = clean(row['단지명']);
    // 전월세 CSV는 '보증금(만원)' 또는 '보증금' 컬럼명 사용
    const deposit = parseAmount(row['보증금(만원)']);
    // 전월세 CSV는 '월세금(만원)' 또는 '월세(만원)' 컬럼명 사용
    const monthlyRent = parseAmount(row['월세금(만원)'] || row['월세(만원)']);

    if (!aptNm) continue;

    values.push(
      `($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},` +
      `$${idx+10},$${idx+11},$${idx+12},$${idx+13},$${idx+14},$${idx+15},$${idx+16},$${idx+17},$${idx+18},` +
      `$${idx+19},$${idx+20},$${idx+21},$${idx+22},$${idx+23},$${idx+24},$${idx+25})`
    );
    params.push(
      tradeType,               // 1
      sigungu.sgg_cd || null,  // 2
      sigungu.sido_nm || null, // 3
      sigungu.sgg_nm || null,  // 4
      sigungu.umd_nm || null,  // 5
      clean(row['번지']),      // 6
      clean(row['본번']),      // 7
      clean(row['부번']),      // 8
      aptNm,                   // 9
      parseArea(row['전용면적(㎡)']), // 10
      contractYm,              // 11
      clean(row['계약일']),    // 12
      deposit,                 // 13
      monthlyRent,             // 14
      clean(row['동']),        // 15 (전월세 CSV에 없으면 null)
      parseFloor(row['층']),   // 16
      parseYear(row['건축년도']), // 17
      clean(row['도로명']),    // 18
      clean(row['계약구분']),  // 19
      clean(row['계약기간']),  // 20
      clean(row['갱신요구권 사용'] || row['갱신요구권사용']), // 21
      clean(row['종전계약 보증금(만원)'] || row['종전보증금']), // 22
      clean(row['종전계약 월세(만원)'] || row['종전월세']),   // 23
      clean(row['해제사유발생일']), // 24
      dealYear,                // 25
      dealMonth,               // 26
    );
    idx += 26;
  }

  if (!values.length) return 0;

  const result = await pool.query(`
    INSERT INTO real_rent_transactions
      (trade_type, sgg_cd, sido_nm, sgg_nm, umd_nm, jibun, bonbun, bubun,
       apt_nm, exclu_use_ar, contract_ym, contract_day, deposit, monthly_rent,
       dong, floor, build_year, road_nm,
       contract_type, contract_period, renewal_right_used,
       previous_deposit, previous_monthly_rent,
       cdeal_day, deal_year, deal_month)
    VALUES ${values.join(',')}
    ON CONFLICT ON CONSTRAINT uq_rt_rent DO NOTHING
  `, params);

  return result.rowCount;
}

// ============================================
// 파일 임포트
// ============================================

async function importFile(filePath, tradeType) {
  const records = parseCSVFile(filePath);

  if (!records || records.length === 0) {
    return 0;
  }

  const BATCH_SIZE = 500;
  let totalInserted = 0;
  const isSale = SALE_TYPES.has(tradeType);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      const inserted = isSale
        ? await importSaleBatch(batch, tradeType)
        : await importRentBatch(batch, tradeType);
      totalInserted += inserted;
    } catch (err) {
      log(`  배치 에러 (행 ${i}~${i + batch.length}): ${err.message}`);
      // 개별 행으로 fallback
      for (const row of batch) {
        try {
          const inserted = isSale
            ? await importSaleBatch([row], tradeType)
            : await importRentBatch([row], tradeType);
          totalInserted += inserted;
        } catch (e) {
          // 개별 행 에러는 스킵
        }
      }
    }
  }

  return totalInserted;
}

// ============================================
// 메인
// ============================================

async function main() {
  const startTime = Date.now();
  const typeFilter = args.type.toUpperCase();
  const singleFile = args.file;

  // 단일 파일 모드
  if (singleFile) {
    const fullPath = path.resolve(singleFile);
    const dirName = path.basename(path.dirname(fullPath));
    log(`단일 파일 임포트: ${fullPath} (${dirName})`);
    const inserted = await importFile(fullPath, dirName);
    log(`완료: ${inserted}건 삽입`);
    await pool.end();
    return;
  }

  // 전체/타입별 임포트
  const types = typeFilter
    ? [typeFilter]
    : ['APT_TRADE', 'APT_RENT', 'OFFI_TRADE', 'OFFI_RENT', 'PRESALE_TRADE'];

  log('========================================');
  log('  CSV → estate_rt DB 임포트');
  log(`  종류: ${types.join(', ')}`);
  log('========================================\n');

  let totalFiles = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  for (const type of types) {
    const typeDir = path.join(CSV_DIR, type);
    if (!fs.existsSync(typeDir)) {
      log(`${type}: 디렉토리 없음, 스킵`);
      continue;
    }

    const files = fs.readdirSync(typeDir)
      .filter((f) => f.endsWith('.csv'))
      .sort();

    log(`\n━━━ ${type} (${files.length}개 파일) ━━━`);

    for (const file of files) {
      const filePath = path.join(typeDir, file);
      const taskKey = `${type}|${file.replace('.csv', '')}`;

      try {
        // 이미 imported 확인
        const { rows } = await pool.query(
          "SELECT status FROM download_progress WHERE task_key = $1 AND status = 'imported'",
          [taskKey]
        );
        if (rows.length > 0) {
          continue; // 스킵
        }

        const fileSize = fs.statSync(filePath).size;
        if (fileSize < 100) {
          await pool.query(
            "UPDATE download_progress SET status = 'imported', row_count = 0 WHERE task_key = $1",
            [taskKey]
          );
          continue;
        }

        const inserted = await importFile(filePath, type);
        totalInserted += inserted;
        totalFiles++;

        await pool.query(
          "UPDATE download_progress SET status = 'imported', row_count = $2, completed_at = NOW() WHERE task_key = $1",
          [taskKey, inserted]
        );

        if (inserted > 0) {
          log(`  ${file}: ${inserted.toLocaleString()}건 삽입`);
        }
      } catch (err) {
        totalErrors++;
        log(`  ${file}: ERROR ${err.message}`);
        await pool.query(
          "UPDATE download_progress SET status = 'error', error_msg = $2 WHERE task_key = $1",
          [taskKey, err.message]
        );
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  log('\n========================================');
  log('  임포트 완료');
  log(`  소요: ${elapsed}분`);
  log(`  처리 파일: ${totalFiles}개`);
  log(`  삽입: ${totalInserted.toLocaleString()}건`);
  log(`  에러: ${totalErrors}건`);
  log('========================================');

  // 최종 통계
  const stats1 = await pool.query('SELECT trade_type, count(*)::int as cnt, min(deal_year) as min_year, max(deal_year) as max_year FROM real_transactions GROUP BY trade_type ORDER BY trade_type');
  const stats2 = await pool.query('SELECT trade_type, count(*)::int as cnt, min(deal_year) as min_year, max(deal_year) as max_year FROM real_rent_transactions GROUP BY trade_type ORDER BY trade_type');

  if (stats1.rows.length) {
    log('\n매매 테이블:');
    console.table(stats1.rows);
  }
  if (stats2.rows.length) {
    log('전월세 테이블:');
    console.table(stats2.rows);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
