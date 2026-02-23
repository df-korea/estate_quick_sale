#!/usr/bin/env node
/**
 * collect-finland.mjs
 *
 * fin.land.naver.com API로 매물 수집 + DB UPSERT.
 * Playwright headful 모드로 실행 (rate limit 없음, ~120ms/req).
 *
 * Modes:
 *   --full          전수 UPSERT (기본). 초기 로드/데이터 복구용.
 *   --quick         count 비교 → 변화 단지만 deep scan (~20분)
 *   --incremental   전수 diff scan + 삭제/가격변동 감지 (~35분)
 *
 * Usage:
 *   node --env-file=.env scripts/collect-finland.mjs              # full (기본)
 *   node --env-file=.env scripts/collect-finland.mjs --quick      # 증분
 *   node --env-file=.env scripts/collect-finland.mjs --incremental # 전수 diff
 *   node --env-file=.env scripts/collect-finland.mjs --resume     # 중단점부터
 *   node --env-file=.env scripts/collect-finland.mjs --limit 100  # 100개 단지만
 *   node --env-file=.env scripts/collect-finland.mjs --hscp 22627 # 단일 단지
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── CLI args ──

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
}
const hasFlag = (name) => args.includes(`--${name}`);

const SINGLE_HSCP = getArg('hscp');
const LIMIT = getArg('limit') ? parseInt(getArg('limit')) : null;
const RESUME = hasFlag('resume');
const MODE = SINGLE_HSCP ? 'single'
  : hasFlag('quick') ? 'quick'
  : hasFlag('incremental') ? 'incremental'
  : 'full';

// ── Paths ──

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = join(__dirname, 'data', '.collect-finland-progress.json');
const LOCK_FILE = join(__dirname, 'data', '.collect-finland.lock');

// ── 급매 키워드 ──

const BARGAIN_KEYWORDS = ['급매', '급처분', '급전', '급히', '마이너스피', '마피', '급급', '손절', '최저가', '급하게'];
const BARGAIN_RE = new RegExp(BARGAIN_KEYWORDS.join('|'), 'i');

function detectBargain(description) {
  if (!description) return null;
  const match = description.match(BARGAIN_RE);
  return match ? match[0] : null;
}

// ── Lock file (중복 실행 방지) ──

function acquireLock() {
  try {
    const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    const ageMs = Date.now() - new Date(lockData.ts).getTime();
    if (ageMs < 3600000) { // 1시간 미만 → 활성 lock
      console.error(`다른 수집 프로세스 실행 중 (PID: ${lockData.pid}, ${Math.round(ageMs / 60000)}분 전 시작, mode: ${lockData.mode})`);
      console.error('1시간 후 자동 만료. 강제 해제: rm scripts/data/.collect-finland.lock');
      return false;
    }
    console.log('이전 lock 만료됨, 덮어씁니다.');
  } catch { /* no lock file */ }
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, ts: new Date().toISOString(), mode: MODE }));
  return true;
}

function releaseLock() {
  try { unlinkSync(LOCK_FILE); } catch { /* ignore */ }
}

// ── Progress file (--resume) ──

function loadProgress() {
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return null; }
}

function saveProgress(hscpNo) {
  try { writeFileSync(PROGRESS_FILE, JSON.stringify({ lastHscpNo: hscpNo, ts: new Date().toISOString() })); }
  catch { /* ignore */ }
}

// ── fin.land API (커서 기반 페이지네이션) ──

async function fetchArticles(page, complexNumber, lastInfo = [], size = 30) {
  return await page.evaluate(async ({ complexNumber, lastInfo, size }) => {
    const start = Date.now();
    try {
      const res = await fetch('/front-api/v1/complex/article/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complexNumber: String(complexNumber),
          tradeTypes: [],
          pyeongTypes: [],
          dongNumbers: [],
          size,
          articleSortType: 'RANKING_DESC',
          lastInfo,
        }),
      });
      const elapsed = Date.now() - start;
      if (!res.ok) return { ok: false, error: `HTTP_${res.status}`, elapsed };
      const data = await res.json();
      if (!data.isSuccess) return { ok: false, error: data.detailCode || 'API_ERROR', elapsed };
      return {
        ok: true,
        totalCount: data.result?.totalCount || 0,
        hasNextPage: data.result?.hasNextPage || false,
        articles: data.result?.list || [],
        lastInfo: data.result?.lastInfo || [],
        elapsed,
      };
    } catch (e) {
      return { ok: false, error: e.message, elapsed: Date.now() - start };
    }
  }, { complexNumber, lastInfo, size });
}

// ── Batch count check (page.evaluate 내에서 배치 처리, IPC 최소화) ──

async function batchCountCheck(page, hscpNos) {
  return await page.evaluate(async (hscpNos) => {
    const results = [];
    for (const hscpNo of hscpNos) {
      try {
        const res = await fetch('/front-api/v1/complex/article/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            complexNumber: String(hscpNo),
            tradeTypes: [],
            pyeongTypes: [],
            dongNumbers: [],
            size: 1,
            articleSortType: 'RANKING_DESC',
            lastInfo: [],
          }),
        });
        if (!res.ok) {
          results.push({ hscpNo, totalCount: -1 });
          continue;
        }
        const data = await res.json();
        if (!data.isSuccess) {
          results.push({ hscpNo, totalCount: -1 });
          continue;
        }
        results.push({ hscpNo, totalCount: data.result?.totalCount || 0 });
      } catch {
        results.push({ hscpNo, totalCount: -1 });
      }
    }
    return results;
  }, hscpNos);
}

// ── 매물 → DB row 매핑 ──

function mapArticle(item, complexId) {
  const rep = item.representativeArticleInfo || item;
  const desc = rep.articleDetail?.articleFeatureDescription || '';
  const keyword = detectBargain(desc);

  return {
    article_no: rep.articleNumber,
    complex_id: complexId,
    trade_type: rep.tradeType || 'A1',
    deal_price: rep.priceInfo?.dealPrice ?? null,
    warranty_price: rep.priceInfo?.warrantyPrice ?? null,
    rent_price: rep.priceInfo?.rentPrice ?? null,
    formatted_price: rep.priceInfo?.formattedDealPrice || null,
    management_fee: rep.priceInfo?.managementFeeAmount ?? null,
    price_change_status: rep.priceInfo?.priceChangeStatus || null,
    supply_space: rep.spaceInfo?.supplySpace ?? null,
    exclusive_space: rep.spaceInfo?.exclusiveSpace ?? null,
    contract_space: rep.spaceInfo?.contractSpace ?? null,
    space_name: rep.spaceInfo?.spaceName || null,
    target_floor: rep.articleDetail?.floorDetailInfo?.targetFloor ?? null,
    total_floor: rep.articleDetail?.floorDetailInfo?.totalFloor ?? null,
    direction: rep.articleDetail?.direction || null,
    direction_standard: rep.articleDetail?.directionStandard || null,
    dong_name: rep.dongName || null,
    description: desc || null,
    verification_type: rep.verificationInfo?.verificationType || null,
    exposure_start_date: rep.verificationInfo?.exposureStartDate || null,
    cp_id: rep.brokerInfo?.cpId || null,
    brokerage_name: rep.brokerInfo?.brokerageName || null,
    broker_name: rep.brokerInfo?.brokerName || null,
    image_url: rep.articleMedia?.representativeImageUrl || null,
    image_count: rep.articleMedia?.imageCount ?? 0,
    is_vr_exposed: rep.articleMedia?.isVrExposed ?? false,
    city: rep.address?.city || null,
    division: rep.address?.division || null,
    sector: rep.address?.sector || null,
    building_date: rep.buildingInfo?.buildingConjunctionDate || null,
    approval_elapsed_year: rep.buildingInfo?.approvalElapsedYear ?? null,
    group_article_count: item.groupArticleCount ?? 0,
    group_realtor_count: item.groupRealtorCount ?? 0,
    group_direct_trade_count: item.groupDirectTradeCount ?? 0,
    is_bargain: !!keyword,
    bargain_keyword: keyword,
    price_changes: rep.priceInfo?.priceChangeHistories || [],
    raw_data: item,
  };
}

// ── DB UPSERT ──

async function upsertArticle(client, a) {
  const { rows } = await client.query(`
    INSERT INTO articles (
      article_no, complex_id, trade_type,
      deal_price, warranty_price, rent_price, formatted_price, management_fee, price_change_status,
      supply_space, exclusive_space, contract_space, space_name,
      target_floor, total_floor, direction, direction_standard,
      dong_name, description, article_status,
      verification_type, exposure_start_date,
      cp_id, brokerage_name, broker_name,
      image_url, image_count, is_vr_exposed,
      city, division, sector,
      building_date, approval_elapsed_year,
      group_article_count, group_realtor_count, group_direct_trade_count,
      is_bargain, bargain_keyword,
      first_seen_at, last_seen_at, raw_data
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'active',
      $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,
      NOW(), NOW(), $38
    )
    ON CONFLICT (article_no) DO UPDATE SET
      trade_type = EXCLUDED.trade_type,
      deal_price = EXCLUDED.deal_price,
      warranty_price = EXCLUDED.warranty_price,
      rent_price = EXCLUDED.rent_price,
      formatted_price = EXCLUDED.formatted_price,
      management_fee = EXCLUDED.management_fee,
      price_change_status = EXCLUDED.price_change_status,
      supply_space = EXCLUDED.supply_space,
      exclusive_space = EXCLUDED.exclusive_space,
      contract_space = EXCLUDED.contract_space,
      space_name = EXCLUDED.space_name,
      target_floor = EXCLUDED.target_floor,
      total_floor = EXCLUDED.total_floor,
      direction = EXCLUDED.direction,
      direction_standard = EXCLUDED.direction_standard,
      dong_name = EXCLUDED.dong_name,
      description = EXCLUDED.description,
      article_status = 'active',
      verification_type = EXCLUDED.verification_type,
      exposure_start_date = EXCLUDED.exposure_start_date,
      cp_id = EXCLUDED.cp_id,
      brokerage_name = EXCLUDED.brokerage_name,
      broker_name = EXCLUDED.broker_name,
      image_url = EXCLUDED.image_url,
      image_count = EXCLUDED.image_count,
      is_vr_exposed = EXCLUDED.is_vr_exposed,
      city = EXCLUDED.city,
      division = EXCLUDED.division,
      sector = EXCLUDED.sector,
      building_date = EXCLUDED.building_date,
      approval_elapsed_year = EXCLUDED.approval_elapsed_year,
      group_article_count = EXCLUDED.group_article_count,
      group_realtor_count = EXCLUDED.group_realtor_count,
      group_direct_trade_count = EXCLUDED.group_direct_trade_count,
      is_bargain = EXCLUDED.is_bargain,
      bargain_keyword = EXCLUDED.bargain_keyword,
      last_seen_at = NOW(),
      removed_at = NULL,
      raw_data = EXCLUDED.raw_data
    RETURNING id, (xmax = 0) AS is_new
  `, [
    a.article_no, a.complex_id, a.trade_type,
    a.deal_price, a.warranty_price, a.rent_price, a.formatted_price, a.management_fee, a.price_change_status,
    a.supply_space, a.exclusive_space, a.contract_space, a.space_name,
    a.target_floor, a.total_floor, a.direction, a.direction_standard,
    a.dong_name, a.description,
    a.verification_type, a.exposure_start_date,
    a.cp_id, a.brokerage_name, a.broker_name,
    a.image_url, a.image_count, a.is_vr_exposed,
    a.city, a.division, a.sector,
    a.building_date, a.approval_elapsed_year,
    a.group_article_count, a.group_realtor_count, a.group_direct_trade_count,
    a.is_bargain, a.bargain_keyword,
    JSON.stringify(a.raw_data),
  ]);

  return rows[0];
}

// ── priceChangeHistories → price_history ──

async function insertPriceHistory(client, articleId, priceChanges, currentPrice) {
  if (!priceChanges || priceChanges.length === 0) return 0;

  let inserted = 0;
  for (const pc of priceChanges) {
    const price = pc.dealPrice ?? pc.warrantyPrice ?? pc.rentPrice ?? null;
    const modDate = pc.modifiedDate || null;

    // Skip duplicates
    const { rowCount } = await client.query(`
      INSERT INTO price_history (article_id, deal_price, formatted_price, source, modified_date, recorded_at)
      SELECT $1, $2, $3, 'api_history', $4, COALESCE(TO_TIMESTAMP($4, 'YYYYMMDD'), NOW())
      WHERE NOT EXISTS (
        SELECT 1 FROM price_history WHERE article_id = $1 AND modified_date = $4 AND source = 'api_history'
      )
    `, [articleId, price, pc.formattedPrice || null, modDate]);
    inserted += rowCount;
  }

  return inserted;
}

// ── complexes backfill (city/division/sector) ──

async function backfillComplex(client, complexId, article) {
  if (article.city && article.division) {
    await client.query(`
      UPDATE complexes SET city = $2, division = $3, sector = $4
      WHERE id = $1 AND (city IS NULL OR city = '')
    `, [complexId, article.city, article.division, article.sector]);
  }
}

// ══════════════════════════════════════════════════
// Per-complex collection functions
// ══════════════════════════════════════════════════

// ── collectComplexFull — 기본 수집 (diff 없음, 현행 동작) ──

async function collectComplexFull(page, c, stats) {
  let lastInfo = [];
  let fetched = 0;
  let totalCount = 0;
  let complexArticles = 0;
  let complexNew = 0;
  let complexBargains = 0;
  let pageNum = 0;

  while (true) {
    const result = await fetchArticles(page, c.hscp_no, lastInfo);
    stats.requests++;
    pageNum++;

    if (!result.ok) {
      if (fetched === 0) { stats.errors++; return null; }
      break;
    }

    if (pageNum === 1) totalCount = result.totalCount;

    const client = await pool.connect();
    try {
      for (const item of result.articles) {
        const mapped = mapArticle(item, c.id);
        const dbRow = await upsertArticle(client, mapped);

        if (dbRow.is_new) complexNew++;
        complexArticles++;

        const phInserted = await insertPriceHistory(client, dbRow.id, mapped.price_changes, mapped.deal_price);
        stats.priceHistoryInserted += phInserted;

        if (mapped.is_bargain && dbRow.is_new) {
          await client.query(`
            INSERT INTO bargain_detections (article_id, complex_id, detection_type, keyword, deal_price)
            VALUES ($1, $2, 'keyword', $3, $4)
          `, [dbRow.id, c.id, mapped.bargain_keyword, mapped.deal_price]);
          complexBargains++;
        }

        if (pageNum === 1 && result.articles.indexOf(item) === 0) {
          await backfillComplex(client, c.id, mapped);
        }
      }
    } finally {
      client.release();
    }

    fetched += result.articles.length;
    lastInfo = result.lastInfo || [];

    if (!result.hasNextPage || result.articles.length === 0 ||
        fetched >= totalCount || pageNum >= 100) break;
  }

  stats.scanned++;
  stats.articlesFound += complexArticles;
  stats.articlesNew += complexNew;
  stats.articlesUpdated += (complexArticles - complexNew);
  stats.bargainsDetected += complexBargains;

  await pool.query(
    `UPDATE complexes SET last_collected_at = NOW(), deal_count = $2 WHERE id = $1`,
    [c.id, totalCount]
  );

  return { complexArticles, complexNew, complexBargains };
}

// ── collectComplexWithDiff — diff 감지 (삭제/가격변동 포함) ──

async function collectComplexWithDiff(page, c, stats) {
  // 1. Pre-fetch: DB의 active 매물 목록 + 가격
  const { rows: dbArticles } = await pool.query(
    `SELECT article_no, deal_price FROM articles WHERE complex_id = $1 AND article_status = 'active'`,
    [c.id]
  );
  const dbPriceMap = new Map(dbArticles.map(a => [a.article_no, Number(a.deal_price || 0)]));
  const seenArticleNos = new Set();

  let lastInfo = [];
  let fetched = 0;
  let totalCount = 0;
  let complexArticles = 0;
  let complexNew = 0;
  let complexBargains = 0;
  let complexPriceChanges = 0;
  let pageNum = 0;

  // 2. 전체 페이지네이션
  while (true) {
    const result = await fetchArticles(page, c.hscp_no, lastInfo);
    stats.requests++;
    pageNum++;

    if (!result.ok) {
      if (fetched === 0) { stats.errors++; return null; }
      break;
    }

    if (pageNum === 1) totalCount = result.totalCount;

    const client = await pool.connect();
    try {
      for (const item of result.articles) {
        const mapped = mapArticle(item, c.id);
        seenArticleNos.add(mapped.article_no);

        // 가격 변동 감지 (upsert 전에 비교)
        const oldPrice = dbPriceMap.get(mapped.article_no);
        const newPrice = mapped.deal_price != null ? Number(mapped.deal_price) : null;
        const priceChanged = oldPrice != null && newPrice != null && oldPrice !== 0 && oldPrice !== newPrice;

        const dbRow = await upsertArticle(client, mapped);

        if (dbRow.is_new) complexNew++;
        complexArticles++;

        // scan으로 감지한 가격 변동 → price_history
        if (priceChanged) {
          await client.query(`
            INSERT INTO price_history (article_id, deal_price, formatted_price, source, recorded_at)
            VALUES ($1, $2, $3, 'scan_detected', NOW())
          `, [dbRow.id, mapped.deal_price, mapped.formatted_price]);
          complexPriceChanges++;
        }

        // API 호가 이력
        const phInserted = await insertPriceHistory(client, dbRow.id, mapped.price_changes, mapped.deal_price);
        stats.priceHistoryInserted += phInserted;

        // 급매 감지
        if (mapped.is_bargain && dbRow.is_new) {
          await client.query(`
            INSERT INTO bargain_detections (article_id, complex_id, detection_type, keyword, deal_price)
            VALUES ($1, $2, 'keyword', $3, $4)
          `, [dbRow.id, c.id, mapped.bargain_keyword, mapped.deal_price]);
          complexBargains++;
        }

        if (pageNum === 1 && result.articles.indexOf(item) === 0) {
          await backfillComplex(client, c.id, mapped);
        }
      }
    } finally {
      client.release();
    }

    fetched += result.articles.length;
    lastInfo = result.lastInfo || [];

    if (!result.hasNextPage || result.articles.length === 0 ||
        fetched >= totalCount || pageNum >= 100) break;
  }

  // 3. 삭제 감지: DB에 있지만 API에 없는 매물
  let removedCount = 0;
  const removedNos = dbArticles
    .map(a => a.article_no)
    .filter(no => !seenArticleNos.has(no));

  if (removedNos.length > 0) {
    const { rowCount } = await pool.query(`
      UPDATE articles SET article_status = 'removed', removed_at = NOW()
      WHERE article_no = ANY($1) AND article_status = 'active'
    `, [removedNos]);
    removedCount = rowCount;
  }

  // 4. complex 업데이트
  await pool.query(
    `UPDATE complexes SET last_collected_at = NOW(), prev_deal_count = deal_count, deal_count = $2 WHERE id = $1`,
    [c.id, totalCount]
  );

  stats.scanned++;
  stats.articlesFound += complexArticles;
  stats.articlesNew += complexNew;
  stats.articlesUpdated += (complexArticles - complexNew);
  stats.bargainsDetected += complexBargains;
  stats.articlesRemoved += removedCount;
  stats.priceChanges += complexPriceChanges;

  return { complexArticles, complexNew, complexBargains, removedCount, complexPriceChanges };
}

// ══════════════════════════════════════════════════
// Scan modes
// ══════════════════════════════════════════════════

// ── runFullScan — 전수 UPSERT (기본, diff 없음) ──

async function runFullScan(page, stats) {
  let whereClause = 'WHERE is_active = true';
  let params = [];

  if (RESUME) {
    const progress = loadProgress();
    if (progress?.lastHscpNo) {
      whereClause += ` AND hscp_no > $1`;
      params.push(progress.lastHscpNo);
      console.log(`이어서 수집: hscp_no > ${progress.lastHscpNo}`);
    }
  }

  const { rows: complexes } = await pool.query(
    `SELECT id, hscp_no, complex_name, deal_count FROM complexes
     ${whereClause} ORDER BY hscp_no ASC ${LIMIT ? `LIMIT ${LIMIT}` : ''}`,
    params
  );
  console.log(`수집 대상: ${complexes.length}개 단지\n`);
  if (complexes.length === 0) return;

  for (let i = 0; i < complexes.length; i++) {
    const c = complexes[i];
    const result = await collectComplexFull(page, c, stats);
    saveProgress(c.hscp_no);

    if ((i + 1) % 50 === 0 || i === complexes.length - 1) {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
      const rps = (stats.requests / Math.max(1, (Date.now() - stats.startTime) / 1000)).toFixed(1);
      console.log(`[${i + 1}/${complexes.length}] ${c.complex_name} (${c.hscp_no}) | ${result?.complexArticles || 0}건(+${result?.complexNew || 0}) | 누적: ${stats.articlesFound}건, ${stats.requests}req, ${elapsed}s, ${rps}req/s, 에러:${stats.errors}`);
    }
  }
}

// ── runQuickScan — count 비교 → 변화 단지만 deep scan ──

async function runQuickScan(page, stats) {
  // Phase 1: Count Check
  const { rows: complexes } = await pool.query(
    `SELECT id, hscp_no, complex_name, deal_count, last_collected_at
     FROM complexes WHERE is_active = true ORDER BY hscp_no ASC`
  );
  console.log(`Phase 1: ${complexes.length}개 단지 count 체크...\n`);

  const changedComplexes = [];
  const staleComplexes = [];
  const BATCH_SIZE = 20;
  const complexMap = new Map(complexes.map(c => [c.hscp_no, c]));

  for (let i = 0; i < complexes.length; i += BATCH_SIZE) {
    const batch = complexes.slice(i, i + BATCH_SIZE);
    const hscpNos = batch.map(c => c.hscp_no);
    const results = await batchCountCheck(page, hscpNos);
    stats.requests += hscpNos.length;
    stats.countChecked += hscpNos.length;

    for (const r of results) {
      if (r.totalCount < 0) { stats.errors++; continue; }
      const c = complexMap.get(r.hscpNo);
      if (!c) continue;

      if (r.totalCount !== c.deal_count) {
        changedComplexes.push(c);
      } else {
        // 24시간 이상 미스캔 → stale
        const lastAt = c.last_collected_at ? new Date(c.last_collected_at).getTime() : 0;
        if (Date.now() - lastAt >= 86400000) {
          staleComplexes.push(c);
        }
      }
    }

    const checked = Math.min(i + BATCH_SIZE, complexes.length);
    if (checked % 500 < BATCH_SIZE || checked === complexes.length) {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
      console.log(`  count 체크: ${checked}/${complexes.length} (변화: ${changedComplexes.length}, 미스캔24h: ${staleComplexes.length}) ${elapsed}s`);
    }
  }

  // Phase 2: Deep Scan (변화 + stale 단지만)
  const deepTargets = [...changedComplexes, ...staleComplexes];
  console.log(`\nPhase 2: ${deepTargets.length}개 단지 deep scan (변화: ${changedComplexes.length}, 미스캔: ${staleComplexes.length})\n`);

  if (deepTargets.length === 0) {
    console.log('deep scan 대상 없음, 변화 없습니다.');
    return;
  }

  for (let i = 0; i < deepTargets.length; i++) {
    const c = deepTargets[i];
    const result = await collectComplexWithDiff(page, c, stats);

    if ((i + 1) % 50 === 0 || i === deepTargets.length - 1) {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
      const rps = (stats.requests / Math.max(1, (Date.now() - stats.startTime) / 1000)).toFixed(1);
      console.log(`[${i + 1}/${deepTargets.length}] ${c.complex_name} (${c.hscp_no}) | ${result?.complexArticles || 0}건(+${result?.complexNew || 0}, -${result?.removedCount || 0}, Δ${result?.complexPriceChanges || 0}) | ${elapsed}s, ${rps}req/s`);
    }
  }
}

// ── runIncrementalScan — 전수 diff scan (삭제/가격변동 완전 감지) ──

async function runIncrementalScan(page, stats) {
  let whereClause = 'WHERE is_active = true';
  let params = [];

  if (RESUME) {
    const progress = loadProgress();
    if (progress?.lastHscpNo) {
      whereClause += ` AND hscp_no > $1`;
      params.push(progress.lastHscpNo);
      console.log(`이어서 수집: hscp_no > ${progress.lastHscpNo}`);
    }
  }

  const { rows: complexes } = await pool.query(
    `SELECT id, hscp_no, complex_name, deal_count, last_collected_at
     FROM complexes ${whereClause} ORDER BY hscp_no ASC`,
    params
  );
  console.log(`수집 대상: ${complexes.length}개 단지 (incremental diff scan)\n`);
  if (complexes.length === 0) return;

  for (let i = 0; i < complexes.length; i++) {
    const c = complexes[i];
    const result = await collectComplexWithDiff(page, c, stats);
    saveProgress(c.hscp_no);

    if ((i + 1) % 50 === 0 || i === complexes.length - 1) {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
      const rps = (stats.requests / Math.max(1, (Date.now() - stats.startTime) / 1000)).toFixed(1);
      console.log(`[${i + 1}/${complexes.length}] ${c.complex_name} (${c.hscp_no}) | ${result?.complexArticles || 0}건(+${result?.complexNew || 0}, -${result?.removedCount || 0}, Δ${result?.complexPriceChanges || 0}) | 누적: ${stats.articlesFound}건, ${elapsed}s, ${rps}req/s, 에러:${stats.errors}`);
    }
  }
}

// ══════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════

async function main() {
  console.log(`=== fin.land 매물 수집기 [${MODE}] ===\n`);

  // Lock (단일 단지 제외)
  if (MODE !== 'single') {
    if (!acquireLock()) {
      await pool.end();
      process.exit(1);
    }
  }

  let browser;
  try {
    // 단일 단지 확인
    if (MODE === 'single') {
      const { rows } = await pool.query(
        `SELECT id FROM complexes WHERE hscp_no = $1`, [SINGLE_HSCP]
      );
      if (rows.length === 0) {
        console.log(`단지를 찾을 수 없습니다: ${SINGLE_HSCP}`);
        return;
      }
      console.log(`단일 단지: ${SINGLE_HSCP}`);
    }

    // collection_runs 기록
    const { rows: [run] } = await pool.query(`
      INSERT INTO collection_runs (run_type, started_at, status, notes)
      VALUES ($1, NOW(), 'running', $2)
      RETURNING id
    `, [MODE, `${MODE} scan, PID ${process.pid}`]);
    const runId = run.id;

    // 브라우저 시작
    console.log('브라우저 시작...');
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('fin.land 세션 워밍업...');
    await page.goto('https://fin.land.naver.com/complexes/22627', { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    console.log('준비 완료.\n');

    // Stats
    const stats = {
      startTime: Date.now(),
      scanned: 0, errors: 0,
      articlesFound: 0, articlesNew: 0, articlesUpdated: 0, articlesRemoved: 0,
      priceHistoryInserted: 0, priceChanges: 0,
      bargainsDetected: 0,
      requests: 0, countChecked: 0,
    };

    // 모드별 실행
    if (MODE === 'single') {
      const { rows: [c] } = await pool.query(
        `SELECT id, hscp_no, complex_name, deal_count FROM complexes WHERE hscp_no = $1`,
        [SINGLE_HSCP]
      );
      const result = await collectComplexWithDiff(page, c, stats);
      if (result) {
        console.log(`\n${c.complex_name}: ${result.complexArticles}건 (신규 ${result.complexNew}, 삭제 ${result.removedCount}, 가격변동 ${result.complexPriceChanges})`);
      }
    } else if (MODE === 'quick') {
      await runQuickScan(page, stats);
    } else if (MODE === 'incremental') {
      await runIncrementalScan(page, stats);
    } else {
      await runFullScan(page, stats);
    }

    // collection_runs 업데이트
    await pool.query(`
      UPDATE collection_runs SET
        finished_at = NOW(), status = 'completed',
        complexes_scanned = $2, articles_found = $3, articles_new = $4,
        articles_updated = $5, articles_removed = $6, bargains_detected = $7, errors = $8
      WHERE id = $1
    `, [runId, stats.scanned, stats.articlesFound, stats.articlesNew,
        stats.articlesUpdated, stats.articlesRemoved, stats.bargainsDetected, stats.errors]);

    await browser.close();
    browser = null;

    // 요약 리포트
    const totalTime = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(50));
    console.log(`=== 수집 결과 [${MODE}] ===`);
    console.log('='.repeat(50));
    console.log(`단지 스캔:  ${stats.scanned} (에러 ${stats.errors})`);
    if (stats.countChecked > 0) console.log(`count 체크: ${stats.countChecked}개`);
    console.log(`매물 수집:  ${stats.articlesFound}건 (신규 ${stats.articlesNew}, 업데이트 ${stats.articlesUpdated})`);
    if (stats.articlesRemoved > 0) console.log(`매물 삭제:  ${stats.articlesRemoved}건`);
    if (stats.priceChanges > 0) console.log(`가격 변동:  ${stats.priceChanges}건 (scan 감지)`);
    console.log(`급매 감지:  ${stats.bargainsDetected}건`);
    console.log(`호가 이력:  ${stats.priceHistoryInserted}건`);
    console.log(`API 요청:   ${stats.requests}건`);
    console.log(`소요 시간:  ${totalTime}초`);

  } finally {
    if (browser) try { await browser.close(); } catch { /* ignore */ }
    if (MODE !== 'single') releaseLock();
    await pool.end();
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
