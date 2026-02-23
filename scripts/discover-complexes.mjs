#!/usr/bin/env node
/**
 * discover-complexes.mjs
 *
 * Discovers all APT + OPST complexes nationwide using Naver cluster API.
 * Stores results in local PostgreSQL.
 *
 * Features:
 *   - Saves to DB after each region (not at the end)
 *   - Progress file for resume support
 *   - Automatically skips completed region+type pairs on resume
 *
 * Usage:
 *   node scripts/discover-complexes.mjs             # Full nationwide scan
 *   node scripts/discover-complexes.mjs --resume     # Resume from where it stopped
 *   node scripts/discover-complexes.mjs --dry-run    # Discover only, don't write to DB
 *   node scripts/discover-complexes.mjs --type APT   # APT only
 *   node scripts/discover-complexes.mjs --region "서울"  # Specific region
 */

import { pool } from './db.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = path.join(__dirname, '..', 'logs', 'discover-progress.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
  'Referer': 'https://m.land.naver.com/',
  'Accept': 'application/json',
};

const REGIONS = [
  { name: '서울/경기/인천', latMin: 37.20, latMax: 37.75, lonMin: 126.60, lonMax: 127.40, step: 0.04 },
  { name: '부산/울산/경남', latMin: 34.90, latMax: 35.60, lonMin: 128.70, lonMax: 129.40, step: 0.05 },
  { name: '대구/경북', latMin: 35.70, latMax: 36.20, lonMin: 128.40, lonMax: 129.10, step: 0.05 },
  { name: '대전/세종/충남', latMin: 36.20, latMax: 36.65, lonMin: 126.70, lonMax: 127.50, step: 0.05 },
  { name: '충북', latMin: 36.50, latMax: 37.00, lonMin: 127.30, lonMax: 127.90, step: 0.05 },
  { name: '광주/전남', latMin: 34.70, latMax: 35.25, lonMin: 126.60, lonMax: 127.10, step: 0.05 },
  { name: '전북', latMin: 35.60, latMax: 36.10, lonMin: 126.80, lonMax: 127.30, step: 0.05 },
  { name: '강원', latMin: 37.30, latMax: 37.95, lonMin: 127.60, lonMax: 129.10, step: 0.06 },
  { name: '제주', latMin: 33.20, latMax: 33.55, lonMin: 126.15, lonMax: 126.95, step: 0.05 },
];

const PROPERTY_TYPES = ['APT', 'OPST'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay() { return 2000 + Math.random() * 3000; }

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
];

function getHeaders() {
  return { ...HEADERS, 'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] };
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { completed: [], totalFound: 0 };
}

function saveProgress(progress) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function fetchComplexList(lat, lon, latDelta, lonDelta, propertyType) {
  const btm = lat, top = lat + latDelta, lft = lon, rgt = lon + lonDelta;
  const centerLat = lat + latDelta / 2, centerLon = lon + lonDelta / 2;
  const url = `https://m.land.naver.com/cluster/ajax/complexList?rletTpCd=${propertyType}&tradTpCd=A1&z=13&lat=${centerLat}&lon=${centerLon}&btm=${btm}&lft=${lft}&top=${top}&rgt=${rgt}&showR0=N`;
  try {
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) { console.error(`HTTP ${res.status} for ${propertyType} at ${lat.toFixed(3)},${lon.toFixed(3)}`); return []; }
    const data = await res.json();
    return data.result || [];
  } catch (e) {
    console.error(`Fetch error for ${propertyType} at ${lat.toFixed(3)},${lon.toFixed(3)}:`, e.message);
    return [];
  }
}

async function upsertComplex(c) {
  await pool.query(`
    INSERT INTO complexes (hscp_no, complex_name, property_type, lat, lon, total_dong, total_households,
      use_approval_date, deal_count, lease_count, rent_count, min_area, max_area, min_deal_price, max_deal_price)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT (hscp_no) DO UPDATE SET
      complex_name=EXCLUDED.complex_name, property_type=EXCLUDED.property_type,
      lat=EXCLUDED.lat, lon=EXCLUDED.lon, total_dong=EXCLUDED.total_dong,
      total_households=EXCLUDED.total_households, use_approval_date=EXCLUDED.use_approval_date,
      deal_count=EXCLUDED.deal_count, lease_count=EXCLUDED.lease_count, rent_count=EXCLUDED.rent_count,
      min_area=EXCLUDED.min_area, max_area=EXCLUDED.max_area,
      min_deal_price=EXCLUDED.min_deal_price, max_deal_price=EXCLUDED.max_deal_price
  `, [c.hscp_no, c.complex_name, c.property_type, c.lat, c.lon, c.total_dong, c.total_households,
      c.use_approval_date, c.deal_count, c.lease_count, c.rent_count, c.min_area, c.max_area,
      c.min_deal_price, c.max_deal_price]);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const resume = args.includes('--resume');
  const typeIdx = args.indexOf('--type');
  const types = typeIdx >= 0 ? [args[typeIdx + 1]] : PROPERTY_TYPES;
  const regionIdx = args.indexOf('--region');
  const regionFilter = regionIdx >= 0 ? args[regionIdx + 1] : null;
  const targetRegions = regionFilter ? REGIONS.filter(r => r.name.includes(regionFilter)) : REGIONS;

  // Load or create progress
  let progress = resume ? loadProgress() : { completed: [], totalFound: 0 };
  if (!resume) saveProgress(progress); // reset progress file

  // Build task list
  const tasks = [];
  for (const propType of types) {
    for (const region of targetRegions) {
      const key = `${region.name}|${propType}`;
      if (progress.completed.includes(key)) {
        console.log(`⏭️  [${region.name}] ${propType} - 이미 완료, 건너뜀`);
        continue;
      }
      tasks.push({ region, propType, key });
    }
  }

  let totalCells = 0;
  for (const t of tasks) {
    const latSteps = Math.ceil((t.region.latMax - t.region.latMin) / t.region.step);
    const lonSteps = Math.ceil((t.region.lonMax - t.region.lonMin) / t.region.step);
    totalCells += latSteps * lonSteps;
  }

  console.log(`\n🔍 전국 단지 발굴 ${resume ? '(이어하기)' : '시작'}`);
  console.log(`   Types: ${types.join(', ')}`);
  console.log(`   남은 작업: ${tasks.length}개 권역×타입 (${totalCells} 격자)`);
  console.log(`   이미 완료: ${progress.completed.length}개`);
  console.log(`   Dry run: ${dryRun}\n`);

  if (tasks.length === 0) {
    console.log('✅ 모든 권역 발굴 완료!');
    await pool.end();
    return;
  }

  const { rows: [run] } = await pool.query(
    `INSERT INTO collection_runs (run_type, status) VALUES ('discover', 'running') RETURNING id`
  );
  const runId = run.id;

  let totalUpserted = 0, totalErrors = 0, globalRequestCount = 0;
  const startTime = Date.now();

  for (const task of tasks) {
    const { region, propType, key } = task;
    console.log(`\n📊 [${region.name}] ${propType} 탐색 중...`);
    const step = region.step;
    const regionComplexes = new Map();
    let regionRequests = 0;

    for (let lat = region.latMin; lat < region.latMax; lat += step) {
      for (let lon = region.lonMin; lon < region.lonMax; lon += step) {
        const items = await fetchComplexList(lat, lon, step, step, propType);
        regionRequests++;
        globalRequestCount++;

        for (const item of items) {
          if (!item.hscpNo) continue;
          if (!regionComplexes.has(item.hscpNo)) {
            regionComplexes.set(item.hscpNo, {
              hscp_no: item.hscpNo,
              complex_name: item.hscpNm || 'Unknown',
              property_type: propType,
              lat: item.lat ? parseFloat(item.lat) : null,
              lon: item.lon ? parseFloat(item.lon) : null,
              total_dong: item.totDongCnt ? parseInt(item.totDongCnt) : null,
              total_households: item.totHsehCnt ? parseInt(item.totHsehCnt) : null,
              use_approval_date: item.useAprvYmd || null,
              deal_count: item.dealCnt ? parseInt(item.dealCnt) : 0,
              lease_count: item.leaseCnt ? parseInt(item.leaseCnt) : 0,
              rent_count: item.rentCnt ? parseInt(item.rentCnt) : 0,
              min_area: item.minSpc ? parseFloat(item.minSpc) : null,
              max_area: item.maxSpc ? parseFloat(item.maxSpc) : null,
              min_deal_price: item.dealPrcMin || null,
              max_deal_price: item.dealPrcMax || null,
            });
          }
        }

        if (regionRequests % 10 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          process.stdout.write(`\r  [${region.name}] ${propType}: ${regionRequests}건 | ${regionComplexes.size}개 발견 (${elapsed}s)`);
        }

        await sleep(randomDelay());
      }
    }

    // 권역 완료 → 즉시 DB 저장
    let regionUpserted = 0;
    if (!dryRun) {
      for (const c of regionComplexes.values()) {
        try {
          await upsertComplex(c);
          regionUpserted++;
        } catch (e) {
          console.error(`  Upsert error ${c.hscp_no}:`, e.message);
          totalErrors++;
        }
      }
    }
    totalUpserted += regionUpserted;

    console.log(`\n  ✅ [${region.name}] ${propType}: ${regionComplexes.size}개 발견, ${regionUpserted}개 저장`);

    // 진행상태 저장
    progress.completed.push(key);
    progress.totalFound += regionComplexes.size;
    saveProgress(progress);
    console.log(`  💾 진행상태 저장됨 (${progress.completed.length}/${tasks.length + progress.completed.length - tasks.length})`);
  }

  // Update collection run
  await pool.query(`
    UPDATE collection_runs SET status=$1, total_complexes=$2, processed_complexes=$3, errors=$4, completed_at=NOW()
    WHERE id=$5
  `, [totalErrors > 0 ? 'partial' : 'completed', progress.totalFound, totalUpserted, totalErrors, runId]);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Discovery complete!`);
  console.log(`   Time: ${totalTime}s`);
  console.log(`   Requests: ${globalRequestCount}`);
  console.log(`   Total complexes found: ${progress.totalFound}`);
  console.log(`   Upserted: ${totalUpserted}`);
  console.log(`   Errors: ${totalErrors}\n`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
