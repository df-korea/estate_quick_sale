#!/usr/bin/env node
/**
 * populate-complex-coords.mjs
 *
 * Populates complexes.lat / complexes.lon using Naver fin.land API.
 * Uses headful Playwright browser + page.evaluate(fetch) to bypass bot detection.
 *
 * API: fin.land.naver.com/front-api/v1/complex?complexNumber={hscpNo}
 * Response: result.coordinates.xCoordinate (lon), yCoordinate (lat)
 *
 * Usage:
 *   node --env-file=.env scripts/populate-complex-coords.mjs
 *   node --env-file=.env scripts/populate-complex-coords.mjs --limit 100
 *   node --env-file=.env scripts/populate-complex-coords.mjs --resume
 */

import { pool } from './db.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = join(__dirname, '..', 'logs', 'coords-progress.json');
const BATCH_SIZE = 20;       // 배치당 20건씩 브라우저 내부에서 처리
const DELAY_MS = 500;        // 건당 0.5초
const BATCH_REST_MS = 3000;  // 배치 간 3초 휴식

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadProgress() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { completed: [], updated: 0, failed: 0 };
}

function saveProgress(progress) {
  const dir = dirname(PROGRESS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

  console.log('=== Populate Complex Coordinates ===\n');

  const { rows: [{ total, missing }] } = await pool.query(`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE lat IS NULL OR lon IS NULL)::int AS missing
    FROM complexes WHERE is_active = true
  `);
  console.log(`Total active: ${total}, Missing coords: ${missing}\n`);

  if (missing === 0) {
    console.log('All complexes already have coordinates!');
    await pool.end();
    return;
  }

  // Load progress
  const progress = resume ? loadProgress() : { completed: [], updated: 0, failed: 0 };
  const completedSet = new Set(progress.completed);

  const { rows: targets } = await pool.query(`
    SELECT id, hscp_no FROM complexes
    WHERE is_active = true AND (lat IS NULL OR lon IS NULL)
    ORDER BY id
  `);

  const todo = targets.filter(t => !completedSet.has(String(t.hscp_no)));
  const actualLimit = limit ? Math.min(limit, todo.length) : todo.length;

  console.log(`Targets: ${todo.length}${resume ? ` (${completedSet.size} already done)` : ''}`);
  console.log(`Will process: ${actualLimit} (batch=${BATCH_SIZE}, delay=${DELAY_MS}ms)\n`);

  // Launch browser
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Warm up session
  console.log('Warming up session...');
  await page.goto('https://fin.land.naver.com/complexes/22627', { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  let { updated, failed } = progress;
  const startTime = Date.now();

  // Process in batches
  for (let batchStart = 0; batchStart < actualLimit; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, actualLimit);
    const batch = todo.slice(batchStart, batchEnd);
    const hscpNos = batch.map(t => t.hscp_no);

    // Run batch fetch inside browser
    const results = await page.evaluate(async ({ ids, delay }) => {
      const out = [];
      for (const id of ids) {
        try {
          const res = await fetch(`/front-api/v1/complex?complexNumber=${id}`);
          const data = await res.json();
          if (data.isSuccess && data.result?.coordinates) {
            const c = data.result.coordinates;
            out.push({ hscp_no: id, lat: c.yCoordinate, lon: c.xCoordinate });
          } else if (data.detailCode === 'TOO_MANY_REQUESTS') {
            out.push({ hscp_no: id, error: 'RATE_LIMIT' });
          } else {
            out.push({ hscp_no: id, error: data.detailCode || 'NO_COORDS' });
          }
        } catch (e) {
          out.push({ hscp_no: id, error: e.message });
        }
        await new Promise(r => setTimeout(r, delay));
      }
      return out;
    }, { ids: hscpNos, delay: DELAY_MS });

    // Process results
    let rateLimited = false;
    for (const r of results) {
      const target = batch.find(t => t.hscp_no === r.hscp_no);
      if (!target) continue;

      if (r.error === 'RATE_LIMIT') {
        rateLimited = true;
        failed++;
      } else if (r.error) {
        failed++;
      } else if (r.lat > 30 && r.lat < 40 && r.lon > 124 && r.lon < 132) {
        await pool.query('UPDATE complexes SET lat=$1, lon=$2 WHERE id=$3', [r.lat, r.lon, target.id]);
        updated++;
      } else {
        failed++;
      }

      progress.completed.push(String(r.hscp_no));
    }

    progress.updated = updated;
    progress.failed = failed;
    saveProgress(progress);

    // Progress
    const done = Math.min(batchEnd, actualLimit);
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const eta = done > 0 ? (((Date.now() - startTime) / done) * (actualLimit - done) / 60000).toFixed(0) : '?';
    console.log(`[${elapsed}min] ${done}/${actualLimit} | ok: ${updated} | fail: ${failed} | ETA: ${eta}min`);

    // Rate limit handling
    if (rateLimited) {
      console.log('  Rate limited — pausing 30s...');
      await sleep(30000);
    } else {
      await sleep(BATCH_REST_MS);
    }
  }

  await browser.close();

  console.log(`\n=== Done ===`);
  console.log(`Updated: ${updated}, Failed: ${failed}`);

  const { rows: [{ remaining }] } = await pool.query(`
    SELECT count(*) FILTER (WHERE lat IS NULL OR lon IS NULL)::int AS remaining
    FROM complexes WHERE is_active = true
  `);
  console.log(`Still missing: ${remaining}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
