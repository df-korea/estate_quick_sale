#!/usr/bin/env node
/**
 * discover-finland.mjs
 *
 * [DEPRECATED] discover-newland.mjs로 대체됨.
 * new.land 지역 API 기반 계층 탐색이 더 정확하고 효율적.
 *
 * fin.land.naver.com complex detail API를 ID 범위 스캔하여 미발견 단지를 발견.
 * m.land 격자 스캔의 누락 문제를 해결하기 위해 hscp_no를 전수 스캔.
 *
 * 스캔 범위: [1..30000] + [100000..190500] = ~120K IDs
 * 30000~99999 빈 구간, 190500+ 미존재 확인됨
 *
 * API 특성:
 *   - isSuccess는 항상 true (존재 판별 불가)
 *   - result != null 이면 존재, null이면 미존재
 *   - 필드명: name, type(A01/A02/B01), dongCount, totalHouseholdNumber
 *
 * Usage:
 *   node --env-file=.env scripts/discover-finland.mjs                        # 전체 스캔
 *   node --env-file=.env scripts/discover-finland.mjs --resume               # 이어서
 *   node --env-file=.env scripts/discover-finland.mjs --range 100000 110000  # 특정 범위
 *   node --env-file=.env scripts/discover-finland.mjs --check 149463         # 단일 ID 확인
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const PROGRESS_FILE = join(DATA_DIR, '.discover-finland-progress.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── CLI args ──

const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const hasFlag = (name) => args.includes(`--${name}`);

const SINGLE_CHECK = getArg('check');
const RANGE_START = getArg('range') ? parseInt(getArg('range')) : null;
const RANGE_END = RANGE_START != null ? parseInt(args[args.indexOf('--range') + 2]) : null;
const RESUME = hasFlag('resume');

const BATCH_SIZE = 30;        // 병렬 요청 수
const BATCH_REST_MS = 200;    // 배치 간 휴식

// 대상 property_type (APT=A01, OPST=A02만 수집)
const ALLOWED_TYPES = new Set(['APT', 'OPST']);

// ── Progress ──

function loadProgress() {
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return null; }
}

function saveProgress(lastId, stats) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(PROGRESS_FILE, JSON.stringify({
      lastId,
      ...stats,
      ts: new Date().toISOString(),
    }));
  } catch {}
}

// ── ID 범위 생성 ──

function buildScanRange() {
  if (SINGLE_CHECK) return [parseInt(SINGLE_CHECK)];

  if (RANGE_START != null && RANGE_END != null) {
    return Array.from({ length: RANGE_END - RANGE_START + 1 }, (_, i) => RANGE_START + i);
  }

  // 실측 기반 범위: [1..30000] + [100000..190500]
  // 30000~99999 빈 구간, 190500+ 미존재 확인됨
  const ids = [];
  for (let i = 1; i <= 30000; i++) ids.push(i);
  for (let i = 100000; i <= 190500; i++) ids.push(i);
  return ids;
}

// ── fin.land complex detail API (배치 내 병렬 호출) ──

async function fetchComplexBatch(page, hscpNos) {
  return await page.evaluate(async ({ ids }) => {
    const fetchOne = async (id) => {
      const start = Date.now();
      try {
        const res = await fetch(`/front-api/v1/complex?complexNumber=${id}`);
        const data = await res.json();
        const elapsed = Date.now() - start;

        // result가 없으면 미존재 ID (isSuccess는 항상 true)
        if (!data.result || !data.result.name) {
          return { hscp_no: id, ok: false, elapsed };
        }

        const r = data.result;
        return {
          hscp_no: id,
          ok: true,
          elapsed,
          complex_name: r.name ?? null,
          real_estate_type: r.type ?? null,
          lat: r.coordinates?.yCoordinate ?? null,
          lon: r.coordinates?.xCoordinate ?? null,
          city: r.address?.city ?? null,
          division: r.address?.division ?? null,
          sector: r.address?.sector ?? null,
          address: r.address?.roadName ? `${r.address.city} ${r.address.division} ${r.address.sector} ${r.address.roadName}` : null,
          total_dong: r.dongCount ?? null,
          total_households: r.totalHouseholdNumber ?? null,
          building_date: r.useApprovalDate ?? null,
          approval_elapsed_year: r.approvalElapsedYear ?? null,
        };
      } catch (e) {
        return { hscp_no: id, ok: false, error: e.message, elapsed: Date.now() - start };
      }
    };

    // Promise.all 병렬 호출
    return await Promise.all(ids.map(id => fetchOne(id)));
  }, { ids: hscpNos });
}

// ── property_type 매핑 (fin.land type 코드) ──

function mapPropertyType(typeCode) {
  if (!typeCode) return null;
  // A01=아파트, A02=오피스텔, B01=빌라/연립 등
  if (typeCode === 'A01') return 'APT';
  if (typeCode === 'A02') return 'OPST';
  return typeCode; // 원본 반환 (필터링에서 제외됨)
}

// ── Main ──

async function main() {
  console.log('=== fin.land 단지 발견 스캔 ===\n');

  // 1. 기존 단지 ID Set 로드
  const { rows: existing } = await pool.query(`SELECT hscp_no FROM complexes`);
  const existingSet = new Set(existing.map(r => r.hscp_no));
  console.log(`기존 DB: ${existingSet.size}개 단지`);

  // 2. 스캔 범위 생성
  let allIds = buildScanRange();

  if (SINGLE_CHECK) {
    console.log(`\n단일 ID 확인: ${SINGLE_CHECK} (DB ${existingSet.has(SINGLE_CHECK) ? '존재' : '미존재'})`);
  } else {
    // 기존 ID 제외
    const beforeCount = allIds.length;
    allIds = allIds.filter(id => !existingSet.has(String(id)));
    console.log(`스캔 범위: ${beforeCount}개 중 기존 ${beforeCount - allIds.length}개 제외 → ${allIds.length}개 스캔`);

    // resume: 마지막 스캔 ID 이후부터
    if (RESUME) {
      const progress = loadProgress();
      if (progress?.lastId) {
        const resumeFrom = progress.lastId;
        allIds = allIds.filter(id => id > resumeFrom);
        console.log(`이어서: ID > ${resumeFrom} (남은 ${allIds.length}개)`);
        if (progress.discovered != null) {
          console.log(`이전 진행: ${progress.discovered}개 발견, ${progress.skipped_type}개 타입제외`);
        }
      }
    }
  }

  if (allIds.length === 0) {
    console.log('\n스캔할 ID가 없습니다.');
    await pool.end();
    return;
  }

  // 배치 30개 병렬 × ~120ms = 배치당 ~120ms + 200ms rest = ~320ms/배치
  const estimatedMin = ((allIds.length / BATCH_SIZE) * 320 / 60000).toFixed(1);
  console.log(`예상 소요: ~${estimatedMin}분 (배치 ${BATCH_SIZE}개 병렬)\n`);

  // 3. 브라우저 시작
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

  // 4. 배치 스캔
  const stats = { discovered: 0, updated: 0, not_found: 0, skipped_type: 0, errors: 0, requests: 0 };
  const scanStart = Date.now();
  const newTypes = {};  // 발견된 타입별 카운트

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batch = allIds.slice(i, i + BATCH_SIZE);

    let results;
    try {
      results = await fetchComplexBatch(page, batch);
    } catch (e) {
      console.error(`배치 에러 (ID ${batch[0]}~${batch[batch.length - 1]}):`, e.message);
      stats.errors += batch.length;
      continue;
    }

    stats.requests += results.length;

    for (const r of results) {
      if (!r.ok) {
        stats.not_found++;
        continue;
      }

      const propertyType = mapPropertyType(r.real_estate_type);
      newTypes[propertyType || 'UNKNOWN'] = (newTypes[propertyType || 'UNKNOWN'] || 0) + 1;

      // 단일 확인 모드: 결과 출력만
      if (SINGLE_CHECK) {
        console.log('\nAPI 응답:');
        console.log(JSON.stringify(r, null, 2));
        console.log(`\ntype 매핑: ${r.real_estate_type} → ${propertyType}`);
        console.log(`ALLOWED: ${ALLOWED_TYPES.has(propertyType) ? 'YES' : 'NO'}`);
        continue;
      }

      // APT/OPST만 DB에 저장
      if (!ALLOWED_TYPES.has(propertyType)) {
        stats.skipped_type++;
        continue;
      }

      // 좌표 유효성
      const validCoords = r.lat && r.lon && r.lat > 30 && r.lat < 40 && r.lon > 124 && r.lon < 132;

      const isExisting = existingSet.has(String(r.hscp_no));

      try {
        await pool.query(`
          INSERT INTO complexes (
            hscp_no, complex_name, property_type,
            lat, lon, city, division, sector, address,
            total_dong, total_households, building_date, approval_elapsed_year
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (hscp_no) DO UPDATE SET
            complex_name = COALESCE(EXCLUDED.complex_name, complexes.complex_name),
            property_type = COALESCE(EXCLUDED.property_type, complexes.property_type),
            lat = COALESCE(EXCLUDED.lat, complexes.lat),
            lon = COALESCE(EXCLUDED.lon, complexes.lon),
            city = COALESCE(EXCLUDED.city, complexes.city),
            division = COALESCE(EXCLUDED.division, complexes.division),
            sector = COALESCE(EXCLUDED.sector, complexes.sector),
            address = COALESCE(EXCLUDED.address, complexes.address),
            total_dong = COALESCE(EXCLUDED.total_dong, complexes.total_dong),
            total_households = COALESCE(EXCLUDED.total_households, complexes.total_households),
            building_date = COALESCE(EXCLUDED.building_date, complexes.building_date),
            approval_elapsed_year = COALESCE(EXCLUDED.approval_elapsed_year, complexes.approval_elapsed_year)
        `, [
          String(r.hscp_no),
          r.complex_name || `단지_${r.hscp_no}`,
          propertyType,
          validCoords ? r.lat : null,
          validCoords ? r.lon : null,
          r.city, r.division, r.sector, r.address,
          r.total_dong, r.total_households, r.building_date, r.approval_elapsed_year,
        ]);

        if (isExisting) {
          stats.updated++;
        } else {
          stats.discovered++;
          existingSet.add(String(r.hscp_no));
        }
      } catch (e) {
        console.error(`DB 에러 (hscp_no=${r.hscp_no}):`, e.message);
        stats.errors++;
      }
    }

    // Progress 저장
    const lastId = batch[batch.length - 1];
    saveProgress(lastId, stats);

    // 로그
    const done = Math.min(i + BATCH_SIZE, allIds.length);
    if (done % 3000 === 0 || done >= allIds.length || SINGLE_CHECK) {
      const elapsed = ((Date.now() - scanStart) / 1000).toFixed(1);
      const rps = (stats.requests / Math.max(1, (Date.now() - scanStart) / 1000)).toFixed(1);
      const pct = ((done / allIds.length) * 100).toFixed(1);
      console.log(
        `[${done}/${allIds.length} ${pct}%] ` +
        `발견 ${stats.discovered} | 타입제외 ${stats.skipped_type} | 미존재 ${stats.not_found} | ` +
        `${elapsed}s ${rps}req/s`
      );
    }

    await sleep(BATCH_REST_MS);
  }

  await browser.close();

  if (SINGLE_CHECK) {
    await pool.end();
    return;
  }

  const totalTime = ((Date.now() - scanStart) / 1000).toFixed(1);

  // 5. 요약
  console.log('\n' + '='.repeat(60));
  console.log('=== 발견 스캔 결과 ===');
  console.log('='.repeat(60));
  console.log(`신규 발견:  ${stats.discovered}개`);
  console.log(`기존 갱신:  ${stats.updated}개`);
  console.log(`타입 제외:  ${stats.skipped_type}개`);
  console.log(`미존재 ID:  ${stats.not_found}개`);
  console.log(`에러:       ${stats.errors}개`);
  console.log(`총 요청:    ${stats.requests}개`);
  console.log(`소요 시간:  ${totalTime}초`);

  if (Object.keys(newTypes).length > 0) {
    console.log(`\n발견된 타입 분포:`);
    for (const [type, count] of Object.entries(newTypes).sort((a, b) => b[1] - a[1])) {
      const mark = ALLOWED_TYPES.has(type) ? '✓' : '✗';
      console.log(`  ${mark} ${type}: ${count}개`);
    }
  }

  // 최종 현황
  const { rows: [counts] } = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE property_type = 'APT')::int AS apt,
      count(*) FILTER (WHERE property_type = 'OPST')::int AS opst,
      count(*) FILTER (WHERE lat IS NOT NULL)::int AS has_coords,
      count(*) FILTER (WHERE city IS NOT NULL)::int AS has_city
    FROM complexes
  `);
  console.log(`\nDB 현황: 총 ${counts.total}개 (APT ${counts.apt}, OPST ${counts.opst}) | 좌표 ${counts.has_coords}, 주소 ${counts.has_city}`);

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
