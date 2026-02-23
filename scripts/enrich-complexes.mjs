#!/usr/bin/env node
/**
 * enrich-complexes.mjs
 *
 * fin.land.naver.com /front-api/v1/complex API로 단지 정보 보강.
 * 좌표, 주소(city/division/sector), 준공일, 세대수 등 업데이트.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-complexes.mjs                 # 전체
 *   node --env-file=.env scripts/enrich-complexes.mjs --limit 100     # 100개만
 *   node --env-file=.env scripts/enrich-complexes.mjs --resume        # 이어서
 *   node --env-file=.env scripts/enrich-complexes.mjs --hscp 22627    # 단일 단지
 *   node --env-file=.env scripts/enrich-complexes.mjs --missing-only  # 좌표/주소 없는것만
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const PROGRESS_FILE = join(DATA_DIR, '.enrich-progress.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── CLI args ──

const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const hasFlag = (name) => args.includes(`--${name}`);

const SINGLE_HSCP = getArg('hscp');
const LIMIT = getArg('limit') ? parseInt(getArg('limit')) : null;
const RESUME = hasFlag('resume');
const MISSING_ONLY = hasFlag('missing-only');

const BATCH_SIZE = 20;
const DELAY_MS = 100;       // fin.land rate limit 없음
const BATCH_REST_MS = 1000;

// ── Progress ──

function loadProgress() {
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return null; }
}

function saveProgress(lastHscpNo) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(PROGRESS_FILE, JSON.stringify({ lastHscpNo, ts: new Date().toISOString() }));
  } catch {}
}

// ── fin.land complex detail API ──

async function fetchComplexBatch(page, hscpNos) {
  return await page.evaluate(async ({ ids, delay }) => {
    const results = [];
    for (const id of ids) {
      const start = Date.now();
      try {
        const res = await fetch(`/front-api/v1/complex?complexNumber=${id}`);
        const data = await res.json();
        const elapsed = Date.now() - start;

        if (!data.isSuccess) {
          results.push({ hscp_no: id, ok: false, error: data.detailCode || 'API_ERROR', elapsed });
        } else {
          const r = data.result || {};
          results.push({
            hscp_no: id,
            ok: true,
            elapsed,
            lat: r.coordinates?.yCoordinate ?? null,
            lon: r.coordinates?.xCoordinate ?? null,
            city: r.address?.city ?? null,
            division: r.address?.division ?? null,
            sector: r.address?.sector ?? null,
            address: r.address?.fullAddress ?? null,
            complex_name: r.complexName ?? null,
            total_dong: r.totalDongCount ?? null,
            total_households: r.totalHouseholdCount ?? null,
            building_date: r.useApprovalDate ?? r.buildingConjunctionDate ?? null,
            approval_elapsed_year: r.approvalElapsedYear ?? null,
            deal_count: r.dealCount ?? null,
            lease_count: r.leaseCount ?? null,
            rent_count: r.rentCount ?? null,
          });
        }
      } catch (e) {
        results.push({ hscp_no: id, ok: false, error: e.message, elapsed: Date.now() - start });
      }
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }
    return results;
  }, { ids: hscpNos, delay: DELAY_MS });
}

// ── Main ──

async function main() {
  console.log('=== fin.land 단지 정보 보강 ===\n');

  // 1. 대상 단지 로드
  let query, params = [];

  if (SINGLE_HSCP) {
    query = `SELECT id, hscp_no FROM complexes WHERE hscp_no = $1`;
    params = [SINGLE_HSCP];
  } else {
    let where = ['is_active = true'];

    if (MISSING_ONLY) {
      where.push('(lat IS NULL OR city IS NULL)');
    }

    if (RESUME) {
      const progress = loadProgress();
      if (progress?.lastHscpNo) {
        where.push(`hscp_no > '${progress.lastHscpNo}'`);
        console.log(`이어서: hscp_no > ${progress.lastHscpNo}`);
      }
    }

    query = `SELECT id, hscp_no FROM complexes WHERE ${where.join(' AND ')} ORDER BY hscp_no ASC`;
    if (LIMIT) query += ` LIMIT ${LIMIT}`;
  }

  const { rows: targets } = await pool.query(query, params);
  console.log(`대상: ${targets.length}개 단지${MISSING_ONLY ? ' (미보강)' : ''}\n`);

  if (targets.length === 0) {
    console.log('보강할 단지가 없습니다.');
    await pool.end();
    return;
  }

  // 2. 브라우저 시작
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

  // 3. 배치 처리
  const stats = { updated: 0, failed: 0, skipped: 0, requests: 0 };
  const scanStart = Date.now();

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const hscpNos = batch.map(t => t.hscp_no);

    const results = await fetchComplexBatch(page, hscpNos);
    stats.requests += results.length;

    for (const r of results) {
      const target = batch.find(t => t.hscp_no === r.hscp_no);
      if (!target) continue;

      if (!r.ok) {
        stats.failed++;
        continue;
      }

      // 좌표 유효성 체크
      const validCoords = r.lat && r.lon && r.lat > 30 && r.lat < 40 && r.lon > 124 && r.lon < 132;

      await pool.query(`
        UPDATE complexes SET
          lat = COALESCE($2, lat),
          lon = COALESCE($3, lon),
          city = COALESCE($4, city),
          division = COALESCE($5, division),
          sector = COALESCE($6, sector),
          address = COALESCE($7, address),
          total_dong = COALESCE($8, total_dong),
          total_households = COALESCE($9, total_households),
          building_date = COALESCE($10, building_date),
          approval_elapsed_year = COALESCE($11, approval_elapsed_year),
          deal_count = COALESCE($12, deal_count),
          lease_count = COALESCE($13, lease_count),
          rent_count = COALESCE($14, rent_count)
        WHERE id = $1
      `, [
        target.id,
        validCoords ? r.lat : null,
        validCoords ? r.lon : null,
        r.city, r.division, r.sector, r.address,
        r.total_dong, r.total_households,
        r.building_date, r.approval_elapsed_year,
        r.deal_count, r.lease_count, r.rent_count,
      ]);
      stats.updated++;
    }

    // progress
    saveProgress(batch[batch.length - 1].hscp_no);

    // 로그
    const done = Math.min(i + BATCH_SIZE, targets.length);
    if (done % 200 === 0 || done >= targets.length || SINGLE_HSCP) {
      const elapsed = ((Date.now() - scanStart) / 1000).toFixed(1);
      const rps = (stats.requests / Math.max(1, (Date.now() - scanStart) / 1000)).toFixed(1);
      console.log(`[${done}/${targets.length}] ${stats.updated}건 업데이트, ${stats.failed}건 실패 | ${elapsed}s, ${rps}req/s`);
    }

    await sleep(BATCH_REST_MS);
  }

  await browser.close();

  const totalTime = ((Date.now() - scanStart) / 1000).toFixed(1);

  // 4. 요약
  console.log('\n' + '='.repeat(50));
  console.log('=== 보강 결과 ===');
  console.log('='.repeat(50));
  console.log(`업데이트: ${stats.updated}건`);
  console.log(`실패:     ${stats.failed}건`);
  console.log(`요청:     ${stats.requests}건`);
  console.log(`소요:     ${totalTime}초`);

  // 현황
  const { rows: [counts] } = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE lat IS NOT NULL)::int AS has_coords,
      count(*) FILTER (WHERE city IS NOT NULL)::int AS has_city,
      count(*) FILTER (WHERE building_date IS NOT NULL)::int AS has_building_date
    FROM complexes WHERE is_active = true
  `);
  console.log(`\n현황: 좌표 ${counts.has_coords}/${counts.total}, 주소 ${counts.has_city}/${counts.total}, 준공일 ${counts.has_building_date}/${counts.total}`);

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
