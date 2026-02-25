#!/usr/bin/env node
/**
 * discover-newland.mjs
 *
 * new.land.naver.com 지역 API 기반 단지 전체 재적재.
 * 시도→시군구→동→단지 계층 탐색으로 누락 없이 전국 단지를 수집.
 *
 * Phase 1: 지역 계층 수집 (시도→시군구→동) → regions 테이블 UPSERT
 * Phase 2: 동별 단지 수집 (APT + OPST) → complexes 테이블 UPSERT
 * Phase 3: 검증 리포트 (articles/real_transactions 매칭률)
 *
 * Usage:
 *   node --env-file=.env scripts/discover-newland.mjs                  # 전체 수집
 *   node --env-file=.env scripts/discover-newland.mjs --resume         # 이어서
 *   node --env-file=.env scripts/discover-newland.mjs --sido 서울시    # 특정 시도만
 *   node --env-file=.env scripts/discover-newland.mjs --dry-run        # DB 반영 없이 카운트만
 *   node --env-file=.env scripts/discover-newland.mjs --verify-only    # 수집 없이 매칭 검증만
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const PROGRESS_FILE = join(DATA_DIR, '.discover-newland-progress.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── CLI args ──

const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const hasFlag = (name) => args.includes(`--${name}`);

const SIDO_FILTER = getArg('sido');
const DRY_RUN = hasFlag('dry-run');
const RESUME = hasFlag('resume');
const VERIFY_ONLY = hasFlag('verify-only');

const ALLOWED_TYPES = new Set(['APT', 'OPST']);
const BATCH_REST_MS = 50;

// ── Progress ──

function loadProgress() {
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return null; }
}

function saveProgress(data) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(PROGRESS_FILE, JSON.stringify({ ...data, ts: new Date().toISOString() }));
  } catch {}
}

// ── 주소 파싱 ──
// "서울시 강남구 개포동" → city="서울시", division="강남구", sector="개포동"
// "경기도 성남시 분당구 야탑동" → city="경기도", division="성남시 분당구", sector="야탑동"

function parseAddress(cortarAddress) {
  if (!cortarAddress) return { city: null, division: null, sector: null };
  const tokens = cortarAddress.trim().split(/\s+/);
  if (tokens.length < 2) return { city: tokens[0] || null, division: null, sector: null };
  return {
    city: tokens[0],
    division: tokens.slice(1, -1).join(' ') || null,
    sector: tokens[tokens.length - 1],
  };
}

// ══════════════════════════════════════════════════
// Phase 1: 지역 계층 수집
// ══════════════════════════════════════════════════

async function collectRegions(page) {
  console.log('=== Phase 1: 지역 계층 수집 ===\n');
  const stats = { sido: 0, sigungu: 0, dong: 0, requests: 0 };

  // 시도 목록
  const sidoList = await page.evaluate(async () => {
    const res = await fetch('/api/regions/list?cortarNo=0000000000');
    return (await res.json()).regionList || [];
  });
  stats.requests++;

  // 시도 필터
  const filteredSido = SIDO_FILTER
    ? sidoList.filter(s => s.cortarName.includes(SIDO_FILTER))
    : sidoList;

  if (SIDO_FILTER && filteredSido.length === 0) {
    console.error(`시도 "${SIDO_FILTER}"를 찾을 수 없습니다. 사용 가능:`);
    sidoList.forEach(s => console.log(`  ${s.cortarName}`));
    return null;
  }

  console.log(`시도: ${filteredSido.length}개${SIDO_FILTER ? ` (필터: ${SIDO_FILTER})` : ''}`);

  const allDongs = [];

  for (const sido of filteredSido) {
    // UPSERT 시도
    if (!DRY_RUN) {
      await pool.query(`
        INSERT INTO regions (cortar_no, cortar_name, region_level, parent_cortar_no)
        VALUES ($1, $2, 'sido', NULL)
        ON CONFLICT (cortar_no) DO UPDATE SET cortar_name = EXCLUDED.cortar_name
      `, [sido.cortarNo, sido.cortarName]);
    }
    stats.sido++;

    // 시군구 목록
    const sigunguList = await page.evaluate(async (code) => {
      const res = await fetch(`/api/regions/list?cortarNo=${code}`);
      return (await res.json()).regionList || [];
    }, sido.cortarNo);
    stats.requests++;

    for (const sigungu of sigunguList) {
      if (!DRY_RUN) {
        await pool.query(`
          INSERT INTO regions (cortar_no, cortar_name, region_level, parent_cortar_no)
          VALUES ($1, $2, 'sigungu', $3)
          ON CONFLICT (cortar_no) DO UPDATE SET cortar_name = EXCLUDED.cortar_name, parent_cortar_no = EXCLUDED.parent_cortar_no
        `, [sigungu.cortarNo, sigungu.cortarName, sido.cortarNo]);
      }
      stats.sigungu++;

      // 동 목록
      const dongList = await page.evaluate(async (code) => {
        const res = await fetch(`/api/regions/list?cortarNo=${code}`);
        return (await res.json()).regionList || [];
      }, sigungu.cortarNo);
      stats.requests++;

      for (const dong of dongList) {
        if (!DRY_RUN) {
          await pool.query(`
            INSERT INTO regions (cortar_no, cortar_name, region_level, parent_cortar_no)
            VALUES ($1, $2, 'dong', $3)
            ON CONFLICT (cortar_no) DO UPDATE SET cortar_name = EXCLUDED.cortar_name, parent_cortar_no = EXCLUDED.parent_cortar_no
          `, [dong.cortarNo, dong.cortarName, sigungu.cortarNo]);
        }
        stats.dong++;
        allDongs.push({
          cortarNo: dong.cortarNo,
          cortarName: dong.cortarName,
          sidoName: sido.cortarName,
          sigunguName: sigungu.cortarName,
        });
      }

      await sleep(BATCH_REST_MS);
    }

    console.log(`  ${sido.cortarName}: ${sigunguList.length}개 시군구, ${allDongs.filter(d => d.sidoName === sido.cortarName).length}개 동`);
  }

  console.log(`\n지역 수집 완료: 시도 ${stats.sido}, 시군구 ${stats.sigungu}, 동 ${stats.dong} (${stats.requests} API 호출)\n`);
  return allDongs;
}

// ══════════════════════════════════════════════════
// Phase 2: 동별 단지 수집
// ══════════════════════════════════════════════════

async function collectComplexes(page, allDongs) {
  console.log('=== Phase 2: 동별 단지 수집 ===\n');

  // 기존 complexes 현황 (전후 비교용)
  const { rows: [beforeCounts] } = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE is_active)::int AS active,
      count(*) FILTER (WHERE NOT is_active)::int AS inactive
    FROM complexes
  `);
  console.log(`변경 전 DB: 총 ${beforeCounts.total}개 (active ${beforeCounts.active}, inactive ${beforeCounts.inactive})`);

  // resume 처리
  let startIdx = 0;
  let resumeStats = null;
  if (RESUME) {
    const progress = loadProgress();
    if (progress?.phase === 'complexes' && progress.dongIndex != null) {
      startIdx = progress.dongIndex;
      resumeStats = progress.stats;
      console.log(`이어서: 동 인덱스 ${startIdx}/${allDongs.length}부터`);
      if (resumeStats) {
        console.log(`이전 진행: ${resumeStats.newComplexes}개 신규, ${resumeStats.updatedComplexes}개 갱신`);
      }
    }
  }

  // Phase 2 시작 전: 기존 전체를 is_active = false (dry-run 아닐 때만)
  if (!DRY_RUN && startIdx === 0) {
    await pool.query(`UPDATE complexes SET is_active = false`);
    console.log('기존 complexes 전체 is_active = false 설정 완료');
  }

  const stats = {
    requests: 0,
    newComplexes: resumeStats?.newComplexes || 0,
    updatedComplexes: resumeStats?.updatedComplexes || 0,
    skippedType: resumeStats?.skippedType || 0,
    totalFound: resumeStats?.totalFound || 0,
    errors: 0,
  };
  const scanStart = Date.now();
  const discoveredHscpNos = new Set();

  for (let di = startIdx; di < allDongs.length; di++) {
    const dong = allDongs[di];

    for (const realEstateType of ['APT', 'OPST']) {
      let complexList;
      try {
        complexList = await page.evaluate(async ({ cortarNo, realEstateType }) => {
          const res = await fetch(`/api/regions/complexes?cortarNo=${cortarNo}&realEstateType=${realEstateType}&order=`);
          if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
          const data = await res.json();
          return { ok: true, list: data.complexList || [] };
        }, { cortarNo: dong.cortarNo, realEstateType });
        stats.requests++;
      } catch (e) {
        stats.errors++;
        console.error(`  에러 (${dong.cortarName} ${realEstateType}): ${e.message}`);
        continue;
      }

      if (!complexList.ok) {
        stats.errors++;
        continue;
      }

      for (const c of complexList.list) {
        const hscpNo = String(c.complexNo);
        discoveredHscpNos.add(hscpNo);
        stats.totalFound++;

        if (DRY_RUN) continue;

        const addr = parseAddress(c.cortarAddress);
        const lat = c.latitude && c.latitude > 30 && c.latitude < 40 ? c.latitude : null;
        const lon = c.longitude && c.longitude > 124 && c.longitude < 132 ? c.longitude : null;

        try {
          const { rows } = await pool.query(`
            INSERT INTO complexes (
              hscp_no, complex_name, property_type,
              lat, lon, city, division, sector, address,
              total_dong, total_households, building_date,
              deal_count, lease_count, rent_count,
              cortar_no, is_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true)
            ON CONFLICT (hscp_no) DO UPDATE SET
              complex_name = EXCLUDED.complex_name,
              property_type = EXCLUDED.property_type,
              lat = COALESCE(EXCLUDED.lat, complexes.lat),
              lon = COALESCE(EXCLUDED.lon, complexes.lon),
              city = COALESCE(EXCLUDED.city, complexes.city),
              division = COALESCE(EXCLUDED.division, complexes.division),
              sector = COALESCE(EXCLUDED.sector, complexes.sector),
              address = COALESCE(EXCLUDED.address, complexes.address),
              total_dong = COALESCE(EXCLUDED.total_dong, complexes.total_dong),
              total_households = COALESCE(EXCLUDED.total_households, complexes.total_households),
              building_date = COALESCE(EXCLUDED.building_date, complexes.building_date),
              deal_count = EXCLUDED.deal_count,
              lease_count = EXCLUDED.lease_count,
              rent_count = EXCLUDED.rent_count,
              cortar_no = EXCLUDED.cortar_no,
              is_active = true
            RETURNING (xmax = 0) AS is_new
          `, [
            hscpNo,
            c.complexName || `단지_${hscpNo}`,
            realEstateType,
            lat, lon,
            addr.city, addr.division, addr.sector,
            c.cortarAddress || null,
            c.totalBuildingCount ?? null,
            c.totalHouseholdCount ?? null,
            c.useApproveYmd || null,
            c.dealCount ?? 0,
            c.leaseCount ?? 0,
            c.rentCount ?? 0,
            dong.cortarNo,
          ]);

          if (rows[0]?.is_new) {
            stats.newComplexes++;
          } else {
            stats.updatedComplexes++;
          }
        } catch (e) {
          stats.errors++;
          if (stats.errors <= 5) {
            console.error(`  DB 에러 (${hscpNo} ${c.complexName}): ${e.message}`);
          }
        }
      }
    }

    // Progress 저장 (100개 동마다)
    if ((di + 1) % 100 === 0) {
      saveProgress({ phase: 'complexes', dongIndex: di + 1, stats });
    }

    // 로그 (200개 동마다)
    if ((di + 1) % 200 === 0 || di === allDongs.length - 1) {
      const elapsed = ((Date.now() - scanStart) / 1000).toFixed(1);
      const rps = (stats.requests / Math.max(1, (Date.now() - scanStart) / 1000)).toFixed(1);
      const pct = (((di + 1) / allDongs.length) * 100).toFixed(1);
      console.log(
        `[${di + 1}/${allDongs.length} ${pct}%] ` +
        `신규 ${stats.newComplexes} | 갱신 ${stats.updatedComplexes} | ` +
        `발견 ${stats.totalFound} | 에러 ${stats.errors} | ` +
        `${elapsed}s ${rps}req/s`
      );
    }

    await sleep(BATCH_REST_MS);
  }

  // 최종 progress 저장
  saveProgress({ phase: 'completed', stats });

  const totalTime = ((Date.now() - scanStart) / 1000).toFixed(1);

  // 변경 후 현황
  const { rows: [afterCounts] } = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE is_active)::int AS active,
      count(*) FILTER (WHERE NOT is_active)::int AS inactive
    FROM complexes
  `);

  console.log('\n' + '='.repeat(60));
  console.log('=== 단지 수집 결과 ===');
  console.log('='.repeat(60));
  console.log(`신규 발견:    ${stats.newComplexes}개`);
  console.log(`기존 갱신:    ${stats.updatedComplexes}개`);
  console.log(`타입 제외:    ${stats.skippedType}개`);
  console.log(`총 발견:      ${stats.totalFound}개`);
  console.log(`에러:         ${stats.errors}개`);
  console.log(`API 요청:     ${stats.requests}회`);
  console.log(`소요 시간:    ${totalTime}초`);
  console.log();
  console.log(`DB 변경 전:   총 ${beforeCounts.total}개 (active ${beforeCounts.active}, inactive ${beforeCounts.inactive})`);
  console.log(`DB 변경 후:   총 ${afterCounts.total}개 (active ${afterCounts.active}, inactive ${afterCounts.inactive})`);
  console.log(`신규 단지:    ${afterCounts.total - beforeCounts.total}개`);
  console.log(`비활성화:     ${afterCounts.inactive}개 (new.land에 없는 단지)`);

  return stats;
}

// ══════════════════════════════════════════════════
// Phase 3: 검증 리포트
// ══════════════════════════════════════════════════

async function verifyData() {
  console.log('\n=== Phase 3: 매칭 검증 리포트 ===\n');

  // 3-1. complexes 현황
  const { rows: [cx] } = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE is_active)::int AS active,
      count(*) FILTER (WHERE NOT is_active)::int AS inactive,
      count(*) FILTER (WHERE lat IS NOT NULL)::int AS has_coords,
      count(*) FILTER (WHERE city IS NOT NULL)::int AS has_city,
      count(*) FILTER (WHERE cortar_no IS NOT NULL)::int AS has_cortar,
      count(*) FILTER (WHERE property_type = 'APT')::int AS apt,
      count(*) FILTER (WHERE property_type = 'OPST')::int AS opst
    FROM complexes
  `);
  console.log('[ complexes 현황 ]');
  console.log(`  총:       ${cx.total}개 (APT ${cx.apt}, OPST ${cx.opst})`);
  console.log(`  active:   ${cx.active}개`);
  console.log(`  inactive: ${cx.inactive}개`);
  console.log(`  좌표:     ${cx.has_coords}개 (${(cx.has_coords / cx.total * 100).toFixed(1)}%)`);
  console.log(`  주소:     ${cx.has_city}개 (${(cx.has_city / cx.total * 100).toFixed(1)}%)`);
  console.log(`  cortar:   ${cx.has_cortar}개 (${(cx.has_cortar / cx.total * 100).toFixed(1)}%)`);

  // 3-2. articles 매칭
  const { rows: [art] } = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE c.is_active)::int AS matched_active,
      count(*) FILTER (WHERE NOT c.is_active)::int AS matched_inactive
    FROM articles a
    JOIN complexes c ON a.complex_id = c.id
  `);
  const { rows: [orphan] } = await pool.query(`
    SELECT count(*)::int AS cnt
    FROM articles a
    LEFT JOIN complexes c ON a.complex_id = c.id
    WHERE c.id IS NULL
  `);

  console.log('\n[ articles 매칭 ]');
  console.log(`  총 articles:        ${art.total}개`);
  console.log(`  active 단지 매칭:   ${art.matched_active}개 (${art.total > 0 ? (art.matched_active / art.total * 100).toFixed(1) : 0}%)`);
  console.log(`  inactive 단지 매칭: ${art.matched_inactive}개`);
  console.log(`  FK 깨진 (고아):     ${orphan.cnt}개`);

  // 3-3. real_transactions 매칭
  const { rows: [rt] } = await pool.query(`
    SELECT
      count(DISTINCT apt_nm)::int AS total_names,
      count(DISTINCT CASE WHEN c.id IS NOT NULL AND c.is_active THEN rt.apt_nm END)::int AS matched_active,
      count(DISTINCT CASE WHEN c.id IS NOT NULL THEN rt.apt_nm END)::int AS matched_any
    FROM (SELECT DISTINCT apt_nm FROM real_transactions) rt
    LEFT JOIN complexes c ON c.complex_name = rt.apt_nm
  `);

  console.log('\n[ real_transactions 매칭 (단지명 기준) ]');
  console.log(`  고유 단지명:         ${rt.total_names}개`);
  console.log(`  active 단지 매칭:    ${rt.matched_active}개 (${rt.total_names > 0 ? (rt.matched_active / rt.total_names * 100).toFixed(1) : 0}%)`);
  console.log(`  전체 단지 매칭:      ${rt.matched_any}개 (${rt.total_names > 0 ? (rt.matched_any / rt.total_names * 100).toFixed(1) : 0}%)`);

  // 3-4. 시도별 분포
  const { rows: sidoDist } = await pool.query(`
    SELECT city, count(*)::int AS cnt,
           count(*) FILTER (WHERE is_active)::int AS active_cnt
    FROM complexes
    WHERE city IS NOT NULL
    GROUP BY city ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log('\n[ 시도별 단지 분포 (상위 20) ]');
  for (const row of sidoDist) {
    console.log(`  ${row.city}: ${row.cnt}개 (active ${row.active_cnt})`);
  }

  console.log();
}

// ══════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════

async function main() {
  console.log('=== new.land 지역 API 기반 단지 전체 재적재 ===\n');

  if (DRY_RUN) console.log('[DRY-RUN 모드: DB 반영 없음]\n');

  // verify-only: 수집 없이 검증만
  if (VERIFY_ONLY) {
    await verifyData();
    await pool.end();
    return;
  }

  // 브라우저 시작
  console.log('브라우저 시작...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('new.land 세션 워밍업...');
  await page.goto('https://new.land.naver.com/', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  console.log('준비 완료.\n');

  try {
    // Phase 1: 지역 수집
    const allDongs = await collectRegions(page);
    if (!allDongs) {
      await browser.close();
      await pool.end();
      return;
    }

    // Phase 2: 단지 수집
    await collectComplexes(page, allDongs);

    await browser.close();

    // Phase 3: 검증
    await verifyData();

  } catch (e) {
    console.error('Fatal error:', e);
    try { await browser.close(); } catch {}
  }

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
