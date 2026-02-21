#!/usr/bin/env node
/**
 * collect-articles.mjs  —  매물 수집기 (통합본)
 *
 * 기능:
 *   - 적응형 딜레이 + 서킷브레이커 (차단 방지)
 *   - 배치 휴식 (20건마다 40~55초)
 *   - deal_count=0 단지 자동 스킵
 *   - 호가 변동 감지 → price_history 기록
 *   - 급매 전환 감지 → bargain_detections 기록
 *   - 사라진 매물 자동 제거 (removed 처리)
 *   - 진행 저장 + 이어하기 (--resume)
 *   - collection_runs 기록
 *
 * Usage:
 *   node scripts/collect-articles.mjs               # 전체 수집
 *   node scripts/collect-articles.mjs --resume       # 이전 중단점부터 이어서
 *   node scripts/collect-articles.mjs --hscp 22627   # 단일 단지 테스트
 *   node scripts/collect-articles.mjs --smart        # deal_count 차등 스캔 (~6시간)
 */

import pg from 'pg';
import fs from 'node:fs';
import { parseArgs } from 'node:util';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'estate_quick_sale', user: process.env.USER, max: 5,
});

// ── 설정 ──

const BARGAIN_KEYWORDS = ['급매', '급처분', '급전', '급히', '마이너스피'];
const TRADE_TYPES = ['A1'];

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0.6167.171 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
];

// ── Args ──

const { values: cliArgs } = parseArgs({
  options: {
    resume: { type: 'boolean', default: false },
    hscp: { type: 'string', default: '' },
    smart: { type: 'boolean', default: false },
  },
  strict: false,
});

// ── 적응형 딜레이 + 서킷브레이커 ──

const REQUEST_DELAY = 4000;
const MAX_DELAY = 12000;
const BATCH_SIZE = 20;
const BATCH_REST = 40000;

let currentDelay = REQUEST_DELAY;
let consecutive307 = 0;
let requestsSinceBatchRest = 0;
let totalRequests = 0;
let total307 = 0;

function getDelay() {
  return currentDelay * (0.85 + Math.random() * 0.3);
}

function onSuccess() {
  consecutive307 = 0;
  requestsSinceBatchRest++;
  if (currentDelay > REQUEST_DELAY) {
    currentDelay = Math.max(REQUEST_DELAY, currentDelay - 200);
  }
}

async function onRateLimit() {
  consecutive307++;
  total307++;
  currentDelay = Math.min(currentDelay + 2000, MAX_DELAY);

  if (consecutive307 >= 10) {
    console.log(`\n  ⛔ 연속 ${consecutive307}회 차단! 10분 휴식...`);
    await sleep(600000);
    consecutive307 = 0;
    requestsSinceBatchRest = 0;
    currentDelay = REQUEST_DELAY + 2000;
  } else if (consecutive307 >= 5) {
    console.log(`\n  ⚠ 연속 ${consecutive307}회 차단, 5분 휴식...`);
    await sleep(300000);
    consecutive307 = 0;
    requestsSinceBatchRest = 0;
    currentDelay = REQUEST_DELAY + 1000;
  } else if (consecutive307 >= 3) {
    console.log(`  ⏳ 연속 차단, 45초 대기...`);
    await sleep(45000);
  }
}

async function maybeBatchRest() {
  if (requestsSinceBatchRest >= BATCH_SIZE) {
    const rest = BATCH_REST + Math.random() * 15000;
    console.log(`  💤 배치 휴식 (${(rest/1000).toFixed(0)}초, ${requestsSinceBatchRest}건 후)`);
    await sleep(rest);
    requestsSinceBatchRest = 0;
    currentDelay = REQUEST_DELAY;
  }
}

// ── 유틸 ──

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getHeaders() {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Referer': 'https://m.land.naver.com/',
    'Accept': 'application/json',
  };
}

function parsePrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '').trim();
  const match = cleaned.match(/(\d+)억\s*(\d+)?/);
  if (match) return parseInt(match[1]) * 10000 + (match[2] ? parseInt(match[2]) : 0);
  const num = cleaned.match(/^(\d+)$/);
  return num ? parseInt(num[1]) : null;
}

function parseFloor(info) {
  if (!info) return { current: null, total: null };
  const parts = info.split('/');
  if (parts.length !== 2) return { current: null, total: null };
  return { current: parseInt(parts[0]) || null, total: parseInt(parts[1]) || null };
}

function detectBargain(desc, tags) {
  if (desc) for (const kw of BARGAIN_KEYWORDS) if (desc.includes(kw)) return { found: true, keyword: kw, source: 'description' };
  if (tags && Array.isArray(tags)) for (const tag of tags) for (const kw of BARGAIN_KEYWORDS) if (tag.includes(kw)) return { found: true, keyword: kw, source: 'tag' };
  return { found: false, keyword: '', source: '' };
}

// ── API ──

async function fetchPage(hscpNo, tradTpCd, page) {
  const url = `https://m.land.naver.com/complex/getComplexArticleList?hscpNo=${hscpNo}&tradTpCd=${tradTpCd}&order=prc&showR0=N&page=${page}`;
  totalRequests++;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: getHeaders(), redirect: 'follow' });

    if (res.status === 307 || res.status === 302 || res.status === 429) {
      await onRateLimit();
      await sleep(getDelay());
      continue;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data.result;
    if (!result) return { articles: [], totalCount: 0, hasMore: false };

    onSuccess();
    const list = result.list || [];
    const total = parseInt(result.totAtclCnt) || 0;
    return { articles: list, totalCount: total, hasMore: list.length === 20 && page * 20 < total };
  }

  return { articles: [], totalCount: 0, hasMore: false, skipped: true };
}

// ── DB upsert ──

async function upsertArticle(row) {
  const { rows } = await pool.query(`
    INSERT INTO articles (
      atcl_no, complex_id, hscp_no, trade_type, price_text, price_amount,
      warrant_price_text, warrant_price_amount, rent_price_text, rent_price_amount,
      area_supply, area_exclusive, building_name, floor_info, floor_current, floor_total,
      direction, description, tag_list, rep_image_url, realtor_name, cp_name,
      same_addr_cnt, confirm_date, is_bargain, bargain_keyword, bargain_keyword_source,
      raw_data, last_seen_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,NOW()
    )
    ON CONFLICT (atcl_no, trade_type) DO UPDATE SET
      price_text=EXCLUDED.price_text, price_amount=EXCLUDED.price_amount,
      warrant_price_text=EXCLUDED.warrant_price_text, warrant_price_amount=EXCLUDED.warrant_price_amount,
      rent_price_text=EXCLUDED.rent_price_text, rent_price_amount=EXCLUDED.rent_price_amount,
      area_supply=EXCLUDED.area_supply, area_exclusive=EXCLUDED.area_exclusive,
      building_name=EXCLUDED.building_name, floor_info=EXCLUDED.floor_info,
      floor_current=EXCLUDED.floor_current, floor_total=EXCLUDED.floor_total,
      direction=EXCLUDED.direction, description=EXCLUDED.description,
      tag_list=EXCLUDED.tag_list, rep_image_url=EXCLUDED.rep_image_url,
      realtor_name=EXCLUDED.realtor_name, cp_name=EXCLUDED.cp_name,
      same_addr_cnt=EXCLUDED.same_addr_cnt, confirm_date=EXCLUDED.confirm_date,
      is_bargain=EXCLUDED.is_bargain, bargain_keyword=EXCLUDED.bargain_keyword,
      bargain_keyword_source=EXCLUDED.bargain_keyword_source,
      raw_data=EXCLUDED.raw_data, last_seen_at=NOW(),
      article_status='active', removed_at=NULL
    RETURNING id, atcl_no, price_amount, warrant_price_amount, is_bargain,
      (xmax = 0) AS is_insert
  `, [
    row.atcl_no, row.complex_id, row.hscp_no, row.trade_type,
    row.price_text, row.price_amount,
    row.warrant_price_text, row.warrant_price_amount,
    row.rent_price_text, row.rent_price_amount,
    row.area_supply, row.area_exclusive,
    row.building_name, row.floor_info, row.floor_current, row.floor_total,
    row.direction, row.description,
    row.tag_list, row.rep_image_url,
    row.realtor_name, row.cp_name,
    row.same_addr_cnt, row.confirm_date,
    row.is_bargain, row.bargain_keyword, row.bargain_keyword_source,
    JSON.stringify(row.raw_data),
  ]);
  return rows[0];
}

// ── 단지 수집 ──

async function collectComplex(complexId, hscpNo) {
  const result = { found: 0, new_: 0, updated: 0, bargains: 0, priceChanges: 0, removed: 0, errors: 0, pages: 0, skipped: false };

  for (const tradTpCd of TRADE_TYPES) {
    let page = 1;
    let hasMore = true;
    const seenAtclNos = new Set();
    let hadError = false;

    while (hasMore && page <= 50) {
      try {
        await maybeBatchRest();
        const resp = await fetchPage(hscpNo, tradTpCd, page);
        if (resp.skipped) { result.skipped = true; return result; }

        hasMore = resp.hasMore;
        result.pages++;
        if (resp.articles.length === 0) break;
        result.found += resp.articles.length;

        for (const art of resp.articles) {
          if (!art.atclNo) continue;
          seenAtclNos.add(art.atclNo);

          const desc = art.atclFetrDesc || null;
          const tagList = art.tagList || [];
          const bargain = detectBargain(desc, tagList);
          const floor = parseFloor(art.flrInfo);
          const priceAmount = tradTpCd === 'A1' ? parsePrice(art.prcInfo) : null;

          // 이전 상태 조회 (호가 변동 + 급매 전환 감지용)
          const { rows: prevRows } = await pool.query(
            `SELECT id, price_amount, warrant_price_amount, is_bargain FROM articles WHERE atcl_no=$1 AND trade_type=$2`,
            [art.atclNo, tradTpCd]
          );
          const prev = prevRows[0] || null;

          try {
            const u = await upsertArticle({
              atcl_no: art.atclNo, complex_id: complexId, hscp_no: hscpNo, trade_type: tradTpCd,
              price_text: art.prcInfo || null, price_amount: priceAmount,
              warrant_price_text: null, warrant_price_amount: null,
              rent_price_text: null, rent_price_amount: null,
              area_supply: art.spc1 ? parseFloat(art.spc1) : null,
              area_exclusive: art.spc2 ? parseFloat(art.spc2) : null,
              building_name: art.bildNm || null,
              floor_info: art.flrInfo || null, floor_current: floor.current, floor_total: floor.total,
              direction: art.direction || null, description: desc,
              tag_list: tagList.length > 0 ? tagList : null,
              rep_image_url: art.repImgUrl || null,
              realtor_name: art.rltrNm || null, cp_name: art.cpNm || null,
              same_addr_cnt: art.sameAddrCnt ? parseInt(art.sameAddrCnt) : null,
              confirm_date: art.cfmYmd || null,
              is_bargain: bargain.found, bargain_keyword: bargain.found ? bargain.keyword : null,
              bargain_keyword_source: bargain.found ? bargain.source : null,
              raw_data: art,
            });

            if (u.is_insert) {
              result.new_++;
              if (u.is_bargain) {
                await pool.query(
                  `INSERT INTO bargain_detections (article_id, complex_id, keyword, keyword_source, price_amount) VALUES ($1,$2,$3,$4,$5)`,
                  [u.id, complexId, bargain.keyword, bargain.source, priceAmount]
                );
                result.bargains++;
              }
            } else {
              result.updated++;
              // 호가 변동 감지
              if (prev) {
                const prevPrice = prev.price_amount || prev.warrant_price_amount;
                const newPrice = u.price_amount || u.warrant_price_amount;
                if (prevPrice && newPrice && prevPrice !== newPrice) {
                  await pool.query(
                    `INSERT INTO price_history (article_id, price_amount, price_text) VALUES ($1,$2,$3)`,
                    [u.id, newPrice, art.prcInfo]
                  );
                  result.priceChanges++;
                }
                // 급매 전환 감지
                if (u.is_bargain && !prev.is_bargain) {
                  await pool.query(
                    `INSERT INTO bargain_detections (article_id, complex_id, keyword, keyword_source, price_amount) VALUES ($1,$2,$3,$4,$5)`,
                    [u.id, complexId, bargain.keyword, bargain.source, priceAmount]
                  );
                  result.bargains++;
                }
              }
            }
          } catch { result.errors++; }
        }

        page++;
        if (hasMore) await sleep(getDelay());
      } catch (e) {
        result.errors++;
        hadError = true;
        page++;
        await sleep(5000);
      }
    }

    // 사라진 매물 감지
    if (!hadError && !result.skipped && seenAtclNos.size > 0) {
      const placeholders = [...seenAtclNos].map((_, i) => `$${i + 3}`).join(',');
      const { rowCount } = await pool.query(`
        UPDATE articles SET article_status='removed', removed_at=NOW()
        WHERE complex_id=$1 AND trade_type=$2 AND article_status='active'
          AND atcl_no NOT IN (${placeholders})
      `, [complexId, tradTpCd, ...seenAtclNos]);
      if (rowCount > 0) result.removed += rowCount;
    }
  }

  // 단지 last_collected_at 업데이트
  if (!result.skipped) {
    await pool.query(`UPDATE complexes SET last_collected_at=NOW() WHERE id=$1`, [complexId]);
  }

  return result;
}

// ── 진행상황 ──

const PROGRESS_FILE = 'logs/collect-progress.json';

function loadProgress() {
  try { if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch {}
  return { lastComplexId: 0 };
}

function saveProgress(p) {
  fs.mkdirSync('logs', { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p));
}

// ── deal_count 차등 스캔 (--smart) ──

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

async function fetchClusterComplexList(lat, lon, latDelta, lonDelta, propertyType) {
  const btm = lat, top = lat + latDelta, lft = lon, rgt = lon + lonDelta;
  const centerLat = lat + latDelta / 2, centerLon = lon + lonDelta / 2;
  const url = `https://m.land.naver.com/cluster/ajax/complexList?rletTpCd=${propertyType}&tradTpCd=A1&z=13&lat=${centerLat}&lon=${centerLon}&btm=${btm}&lft=${lft}&top=${top}&rgt=${rgt}&showR0=N`;
  totalRequests++;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: getHeaders() });
      if (res.status === 307 || res.status === 302 || res.status === 429) {
        await onRateLimit();
        await sleep(getDelay());
        continue;
      }
      if (!res.ok) { console.error(`  cluster HTTP ${res.status}`); return []; }
      const data = await res.json();
      onSuccess();
      return data.result || [];
    } catch (e) {
      console.error(`  cluster fetch error: ${e.message}`);
      await sleep(3000);
    }
  }
  return [];
}

async function refreshDealCounts() {
  console.log(`\n📡 [1단계] deal_count 갱신 (cluster API 격자 스캔)...`);
  const startTime = Date.now();
  let totalCells = 0, updatedCount = 0, foundComplexes = new Map();

  for (const region of REGIONS) {
    const { step } = region;
    let regionCells = 0;

    for (const propType of ['APT', 'OPST']) {
      for (let lat = region.latMin; lat < region.latMax; lat += step) {
        for (let lon = region.lonMin; lon < region.lonMax; lon += step) {
          const items = await fetchClusterComplexList(lat, lon, step, step, propType);
          totalCells++;
          regionCells++;

          for (const item of items) {
            if (!item.hscpNo) continue;
            const dealCnt = item.dealCnt ? parseInt(item.dealCnt) : 0;
            // 같은 단지가 여러 격자에 나올 수 있음 → 최신 값 우선
            foundComplexes.set(item.hscpNo, dealCnt);
          }

          await maybeBatchRest();
          await sleep(2000 + Math.random() * 2000);
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    process.stdout.write(`  [${region.name}] ${regionCells}셀 완료 (${elapsed}분 경과)\n`);
  }

  // DB 업데이트: prev_deal_count ← deal_count, deal_count ← 새 값
  if (foundComplexes.size > 0) {
    // 먼저 모든 단지의 prev_deal_count를 현재 deal_count로 저장
    await pool.query(`UPDATE complexes SET prev_deal_count = deal_count WHERE is_active = true`);

    // 배치 업데이트
    let batch = [];
    for (const [hscpNo, dealCnt] of foundComplexes) {
      batch.push({ hscpNo, dealCnt });
      if (batch.length >= 100) {
        await updateDealCountBatch(batch);
        updatedCount += batch.length;
        batch = [];
      }
    }
    if (batch.length > 0) {
      await updateDealCountBatch(batch);
      updatedCount += batch.length;
    }
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`  ✅ deal_count 갱신 완료: ${foundComplexes.size}개 단지, ${totalCells}셀, ${elapsed}분 소요`);
  return foundComplexes.size;
}

async function updateDealCountBatch(batch) {
  // unnest 기반 배치 업데이트
  const hscpNos = batch.map(b => b.hscpNo);
  const dealCnts = batch.map(b => b.dealCnt);
  await pool.query(`
    UPDATE complexes SET deal_count = data.deal_count
    FROM (SELECT unnest($1::text[]) AS hscp_no, unnest($2::int[]) AS deal_count) AS data
    WHERE complexes.hscp_no = data.hscp_no
  `, [hscpNos, dealCnts]);
}

async function getChangedComplexes() {
  const { rows } = await pool.query(`
    SELECT c.id, c.hscp_no, c.complex_name, c.property_type, c.deal_count,
      count(a.id) FILTER (WHERE a.article_status='active' AND a.trade_type='A1') AS db_active_count
    FROM complexes c
    LEFT JOIN articles a ON a.complex_id = c.id
    WHERE c.is_active = true AND c.deal_count > 0
    GROUP BY c.id
    HAVING c.deal_count != count(a.id) FILTER (WHERE a.article_status='active' AND a.trade_type='A1')
       OR c.last_collected_at IS NULL
       OR c.last_collected_at < NOW() - INTERVAL '3 days'
    ORDER BY c.id
  `);
  return rows;
}

// ── smart scan ──

async function runSmartScan() {
  console.log(`\n🧠 Smart Scan 모드 (deal_count 차등 스캔)`);
  const globalStart = Date.now();

  // [1단계] cluster API로 deal_count 갱신
  const refreshedCount = await refreshDealCounts();

  // [2단계] 변동 단지 식별
  console.log(`\n🔍 [2단계] 변동 단지 식별...`);
  const complexes = await getChangedComplexes();

  // 전체 active 단지 수 조회 (비율 계산용)
  const { rows: [{ cnt: totalActive }] } = await pool.query(
    `SELECT count(*) AS cnt FROM complexes WHERE is_active = true AND deal_count > 0`
  );

  const pct = totalActive > 0 ? ((complexes.length / totalActive) * 100).toFixed(1) : '?';
  console.log(`  ✅ 변동 감지: ${complexes.length}개 단지 (전체 ${totalActive}개 중 ${pct}%)`);

  if (complexes.length === 0) {
    console.log(`\n✅ 변동 없음! 수집 완료.`);
    return;
  }

  // [3단계] 변동 단지만 deep scan
  console.log(`\n🏗 [3단계] 변동 단지 deep scan (${complexes.length}개)...`);

  const { rows: [run] } = await pool.query(
    `INSERT INTO collection_runs (run_type, status, total_complexes) VALUES ('smart-collect', 'running', $1) RETURNING id`,
    [complexes.length]
  );
  const runId = run.id;

  const startTime = Date.now();
  let totalFound = 0, totalNew = 0, totalUpdated = 0, totalBargains = 0;
  let totalPriceChanges = 0, totalRemoved = 0, totalErrors = 0, skippedCount = 0;

  for (let i = 0; i < complexes.length; i++) {
    const c = complexes[i];
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    const pct = ((i / complexes.length) * 100).toFixed(1);
    const speed = i > 0 ? (i / (Date.now() - startTime) * 60000).toFixed(1) : '?';
    const eta = i > 0 ? (((Date.now() - startTime) / i * (complexes.length - i)) / 60000).toFixed(0) : '?';

    process.stdout.write(
      `[${pct}% ${elapsed}m ETA:${eta}m ${speed}/min d:${(currentDelay/1000).toFixed(1)}s] ${c.complex_name} (dc:${c.deal_count} db:${c.db_active_count}) `
    );

    const r = await collectComplex(c.id, c.hscp_no);

    if (r.skipped) {
      console.log('→ ⏭ 차단(스킵)');
      skippedCount++;
    } else if (r.found > 0) {
      totalFound += r.found;
      totalNew += r.new_;
      totalUpdated += r.updated;
      totalBargains += r.bargains;
      totalPriceChanges += r.priceChanges;
      totalRemoved += r.removed;
      totalErrors += r.errors;
      let info = `→ ${r.found}건(+${r.new_})`;
      if (r.bargains > 0) info += ` 🔥${r.bargains}급매`;
      if (r.priceChanges > 0) info += ` 💰${r.priceChanges}변동`;
      if (r.removed > 0) info += ` 🗑${r.removed}제거`;
      console.log(info);
    } else {
      console.log('→ 0건');
    }

    // collection_runs 업데이트 (매 10개)
    if (i % 10 === 0) {
      await pool.query(`
        UPDATE collection_runs SET processed_complexes=$1, new_articles=$2, updated_articles=$3,
          new_bargains=$4, removed_articles=$5, errors=$6
        WHERE id=$7
      `, [i + 1, totalNew, totalUpdated, totalBargains, totalRemoved, totalErrors, runId]);
    }

    await maybeBatchRest();
    await sleep(r.pages === 0 ? 800 : 1000 + Math.random() * 1000);
  }

  // 최종 기록
  await pool.query(`
    UPDATE collection_runs SET
      status=$1, processed_complexes=$2,
      new_articles=$3, updated_articles=$4, new_bargains=$5, removed_articles=$6, errors=$7, completed_at=NOW()
    WHERE id=$8
  `, [
    totalErrors > complexes.length / 2 ? 'partial' : 'completed',
    complexes.length, totalNew, totalUpdated, totalBargains, totalRemoved, totalErrors, runId,
  ]);

  const totalElapsed = ((Date.now() - globalStart) / 60000).toFixed(1);
  const deepElapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log(`\n✅ Smart Scan 완료!`);
  console.log(`   총 소요: ${totalElapsed}분 (deal_count갱신 + deep scan ${deepElapsed}분)`);
  console.log(`   스캔 대상: ${complexes.length}개 / 전체 ${totalActive}개 (${pct}%)`);
  console.log(`   API: ${totalRequests}건 (307: ${total307}건)`);
  console.log(`   매물: ${totalFound.toLocaleString()}건 | 신규: ${totalNew.toLocaleString()}건 | 갱신: ${totalUpdated.toLocaleString()}건`);
  console.log(`   급매: ${totalBargains}건 | 호가변동: ${totalPriceChanges}건 | 제거: ${totalRemoved}건`);
  console.log(`   차단스킵: ${skippedCount}건 | 에러: ${totalErrors}건\n`);
}

// ── 메인 ──

async function main() {
  const singleHscp = cliArgs.hscp || null;
  const resume = cliArgs.resume;
  const smartMode = cliArgs.smart;

  // --smart 모드: deal_count 차등 스캔
  if (smartMode && !singleHscp) {
    await runSmartScan();
    await pool.end();
    return;
  }

  // 단지 목록 조회
  let complexes;
  if (singleHscp) {
    const { rows } = await pool.query(
      `SELECT id, hscp_no, complex_name, property_type, deal_count FROM complexes WHERE hscp_no=$1`,
      [singleHscp]
    );
    complexes = rows;
  } else {
    const { rows } = await pool.query(`
      SELECT id, hscp_no, complex_name, property_type, deal_count
      FROM complexes WHERE is_active = true AND deal_count > 0
      ORDER BY id
    `);
    complexes = rows;
  }

  if (!complexes || complexes.length === 0) {
    console.log('수집 대상 단지가 없습니다.');
    await pool.end();
    process.exit(0);
  }

  // 이어하기
  let startIdx = 0;
  if (resume && !singleHscp) {
    const progress = loadProgress();
    if (progress.lastComplexId > 0) {
      startIdx = complexes.findIndex(c => c.id > progress.lastComplexId);
      if (startIdx < 0) startIdx = complexes.length;
    }
  }

  const remaining = complexes.length - startIdx;

  console.log(`\n🏠 매물 수집기`);
  console.log(`   대상: ${complexes.length}개 단지 (매물 있는 단지만)`);
  console.log(`   남은: ${remaining}개${startIdx > 0 ? ` (${startIdx}개 완료)` : ''}`);
  console.log(`   딜레이: ${REQUEST_DELAY}ms | 배치: ${BATCH_SIZE}건마다 ${BATCH_REST/1000}초 휴식\n`);

  // collection_runs 기록
  const { rows: [run] } = await pool.query(
    `INSERT INTO collection_runs (run_type, status, total_complexes) VALUES ('collect', 'running', $1) RETURNING id`,
    [remaining]
  );
  const runId = run.id;

  const startTime = Date.now();
  let totalFound = 0, totalNew = 0, totalUpdated = 0, totalBargains = 0;
  let totalPriceChanges = 0, totalRemoved = 0, totalErrors = 0, skippedCount = 0;

  for (let i = startIdx; i < complexes.length; i++) {
    const c = complexes[i];
    const done = i - startIdx;
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    const pct = ((done / remaining) * 100).toFixed(1);
    const speed = done > 0 ? (done / (Date.now() - startTime) * 60000).toFixed(1) : '?';
    const eta = done > 0 ? (((Date.now() - startTime) / done * (remaining - done)) / 60000).toFixed(0) : '?';

    process.stdout.write(
      `[${pct}% ${elapsed}m ETA:${eta}m ${speed}/min d:${(currentDelay/1000).toFixed(1)}s] ${c.complex_name} `
    );

    const r = await collectComplex(c.id, c.hscp_no);

    if (r.skipped) {
      console.log('→ ⏭ 차단(스킵)');
      skippedCount++;
    } else if (r.found > 0) {
      totalFound += r.found;
      totalNew += r.new_;
      totalUpdated += r.updated;
      totalBargains += r.bargains;
      totalPriceChanges += r.priceChanges;
      totalRemoved += r.removed;
      totalErrors += r.errors;
      let info = `→ ${r.found}건(+${r.new_})`;
      if (r.bargains > 0) info += ` 🔥${r.bargains}급매`;
      if (r.priceChanges > 0) info += ` 💰${r.priceChanges}변동`;
      if (r.removed > 0) info += ` 🗑${r.removed}제거`;
      console.log(info);
    } else {
      console.log('→ 0건');
    }

    // 진행 저장 + collection_runs 업데이트 (매 10개)
    if (done % 10 === 0) {
      saveProgress({ lastComplexId: c.id });
      await pool.query(`
        UPDATE collection_runs SET processed_complexes=$1, new_articles=$2, updated_articles=$3,
          new_bargains=$4, removed_articles=$5, errors=$6
        WHERE id=$7
      `, [done + 1, totalNew, totalUpdated, totalBargains, totalRemoved, totalErrors, runId]);
    }

    await maybeBatchRest();
    await sleep(r.pages === 0 ? 800 : 1000 + Math.random() * 1000);
  }

  // 최종 기록
  await pool.query(`
    UPDATE collection_runs SET
      status=$1, processed_complexes=$2,
      new_articles=$3, updated_articles=$4, new_bargains=$5, removed_articles=$6, errors=$7, completed_at=NOW()
    WHERE id=$8
  `, [
    totalErrors > remaining / 2 ? 'partial' : 'completed',
    remaining, totalNew, totalUpdated, totalBargains, totalRemoved, totalErrors, runId,
  ]);

  const totalElapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log(`\n✅ 수집 완료!`);
  console.log(`   소요: ${totalElapsed}분 | API: ${totalRequests}건 (307: ${total307}건)`);
  console.log(`   매물: ${totalFound.toLocaleString()}건 | 신규: ${totalNew.toLocaleString()}건 | 갱신: ${totalUpdated.toLocaleString()}건`);
  console.log(`   급매: ${totalBargains}건 | 호가변동: ${totalPriceChanges}건 | 제거: ${totalRemoved}건`);
  console.log(`   차단스킵: ${skippedCount}건 | 에러: ${totalErrors}건\n`);

  // 완료 시 진행파일 삭제
  if (!singleHscp && startIdx + remaining >= complexes.length) {
    try { fs.unlinkSync(PROGRESS_FILE); } catch {}
  }

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
