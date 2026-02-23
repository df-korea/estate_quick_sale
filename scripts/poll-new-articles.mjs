#!/usr/bin/env node
/**
 * poll-new-articles.mjs  —  신규 매물 빠른 감지
 *
 * 동작:
 *   [1단계] 활성 타일만 articleList?sort=dates 조회 (~20분)
 *           → DB에 없는 atclNo 발견 시 해당 단지명 기록
 *           → 매물 있던 타일 캐시 저장 (다음 실행에서 빈 타일 스킵)
 *   [2단계] 변동 감지된 단지만 deep scan (collectComplex 로직)
 *           → 호가 변동, 급매 감지, 사라진 매물 제거 포함
 *
 * Usage:
 *   node scripts/poll-new-articles.mjs                # 타일 스캔 + deep scan (신규 + 순환 300개)
 *   node scripts/poll-new-articles.mjs --full-scan    # 전체 타일 스캔 (캐시 갱신)
 *   node scripts/poll-new-articles.mjs --scan-only    # 1단계만 (감지만, deep scan 안함)
 *   node scripts/poll-new-articles.mjs --deep-only    # 타일 스캔 스킵, 순환 deep scan만
 *   node scripts/poll-new-articles.mjs --rotate 500   # 순환 단지 수 변경 (기본 300)
 *   node scripts/poll-new-articles.mjs --region 서울   # 특정 지역만
 */

import { pool } from './db.mjs';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

// ── Args ──

const { values: cliArgs } = parseArgs({
  options: {
    'scan-only': { type: 'boolean', default: false },
    'full-scan': { type: 'boolean', default: false },
    'deep-only': { type: 'boolean', default: false },
    'rotate': { type: 'string', default: '300' },
    region: { type: 'string', default: '' },
  },
  strict: false,
});

const ACTIVE_TILES_FILE = path.join(import.meta.dirname, 'data/active-tiles.json');

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
];

// 격자 정의 (z=13 기준 타일)
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

// ── 적응형 딜레이 + 서킷브레이커 ──

const REQUEST_DELAY = 2000;
const MAX_DELAY = 10000;
const BATCH_SIZE = 30;
const BATCH_REST = 25000;

let currentDelay = REQUEST_DELAY;
let consecutive307 = 0;
let requestsSinceBatchRest = 0;
let totalRequests = 0;
let total307 = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getDelay() { return currentDelay * (0.85 + Math.random() * 0.3); }

function getHeaders() {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Referer': 'https://m.land.naver.com/',
    'Accept': 'application/json',
  };
}

function onSuccess() {
  consecutive307 = 0;
  requestsSinceBatchRest++;
  if (currentDelay > REQUEST_DELAY) currentDelay = Math.max(REQUEST_DELAY, currentDelay - 200);
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
  } else if (consecutive307 >= 3) {
    console.log(`  ⏳ 연속 차단, 45초 대기...`);
    await sleep(45000);
  }
}

async function maybeBatchRest() {
  if (requestsSinceBatchRest >= BATCH_SIZE) {
    const rest = BATCH_REST + Math.random() * 15000;
    console.log(`  💤 배치 휴식 (${(rest / 1000).toFixed(0)}초)`);
    await sleep(rest);
    requestsSinceBatchRest = 0;
    currentDelay = REQUEST_DELAY;
  }
}

// ── 유틸 ──

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

// ── 타일 생성/캐시 ──

function generateAllTiles(regions) {
  const tiles = [];
  for (const region of regions) {
    const { step } = region;
    for (let lat = region.latMin; lat < region.latMax; lat += step) {
      for (let lon = region.lonMin; lon < region.lonMax; lon += step) {
        tiles.push({ lat: parseFloat(lat.toFixed(4)), lon: parseFloat(lon.toFixed(4)), step, region: region.name });
      }
    }
  }
  return tiles;
}

function loadActiveTiles() {
  try {
    if (fs.existsSync(ACTIVE_TILES_FILE)) {
      const data = JSON.parse(fs.readFileSync(ACTIVE_TILES_FILE, 'utf8'));
      const age = (Date.now() - new Date(data.updated).getTime()) / (1000 * 60 * 60 * 24);
      if (age > 7) {
        console.log(`  ⚠ 캐시가 ${age.toFixed(0)}일 전 — --full-scan 권장`);
      }
      return data.tiles;
    }
  } catch {}
  return null;
}

function saveActiveTiles(activeTiles) {
  fs.mkdirSync(path.dirname(ACTIVE_TILES_FILE), { recursive: true });
  fs.writeFileSync(ACTIVE_TILES_FILE, JSON.stringify({
    updated: new Date().toISOString(),
    totalTiles: activeTiles.length,
    tiles: activeTiles,
  }, null, 2));
}

// ── [1단계] 타일별 신규 매물 감지 ──

async function fetchArticleList(lat, lon, step, page) {
  const btm = lat, top = lat + step, lft = lon, rgt = lon + step;
  const centerLat = lat + step / 2, centerLon = lon + step / 2;
  const url = `https://m.land.naver.com/cluster/ajax/articleList?rletTpCd=APT:OPST&tradTpCd=A1&z=13&lat=${centerLat}&lon=${centerLon}&btm=${btm}&lft=${lft}&top=${top}&rgt=${rgt}&sort=dates&page=${page}`;
  totalRequests++;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: getHeaders(), redirect: 'follow' });
      if (res.status === 307 || res.status === 302 || res.status === 429) {
        await onRateLimit();
        await sleep(getDelay());
        continue;
      }
      if (!res.ok) return { body: [], more: false };
      const data = await res.json();
      onSuccess();
      return { body: data.body || [], more: !!data.more };
    } catch (e) {
      console.error(`  fetch error: ${e.message}`);
      await sleep(3000);
    }
  }
  return { body: [], more: false };
}

async function scanForNewArticles(tiles, isFullScan) {
  console.log(`\n📡 [1단계] 타일별 신규 매물 감지 (sort=dates)...`);
  const startTime = Date.now();

  // DB에서 max atclNo 가져오기
  const { rows: [{ max_atcl }] } = await pool.query(
    `SELECT COALESCE(max(atcl_no::bigint), 0) AS max_atcl FROM articles`
  );
  console.log(`  DB max atclNo: ${max_atcl}`);

  // DB에서 모든 active atclNo를 Set에 로드 (빠른 조회용)
  const { rows: existingRows } = await pool.query(
    `SELECT atcl_no FROM articles WHERE article_status='active'`
  );
  const existingAtclNos = new Set(existingRows.map(r => r.atcl_no));
  console.log(`  DB active 매물: ${existingAtclNos.size}개`);

  const expectedTiles = tiles.length;
  let totalTiles = 0, tilesWithNew = 0;
  const changedComplexNames = new Map(); // complexName → Set<atclNo>
  const newArticlesData = [];            // 새 매물 raw data
  const activeTilesFound = [];           // 매물 있는 타일 (캐시용)
  let currentRegion = '';

  for (const tile of tiles) {
    // 지역 변경 시 로그
    if (tile.region !== currentRegion) {
      if (currentRegion) {
        const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
        console.log(`  ✅ [${currentRegion}] (${elapsed}분)`);
      }
      currentRegion = tile.region;
    }

    await maybeBatchRest();

    let page = 1;
    let tileHasNew = false;
    let tileHasArticles = false;
    let foundKnown = false;

    // 페이지를 넘기면서 새 매물이 없을 때까지 (또는 이미 본 매물이 나올 때까지)
    while (!foundKnown && page <= 3) {
      const { body, more } = await fetchArticleList(tile.lat, tile.lon, tile.step, page);
      if (body.length === 0) break;

      tileHasArticles = true;

      for (const art of body) {
        if (!art.atclNo) continue;
        const atclNo = art.atclNo;

        // atclNo 기반 빠른 체크: DB max보다 작거나 같으면 이미 알려진 매물
        if (parseInt(atclNo) <= max_atcl || existingAtclNos.has(atclNo)) {
          foundKnown = true;
          break;
        }

        // 새 매물!
        tileHasNew = true;
        const complexName = art.atclNm || 'Unknown';

        if (!changedComplexNames.has(complexName)) {
          changedComplexNames.set(complexName, new Set());
        }
        changedComplexNames.get(complexName).add(atclNo);
        newArticlesData.push(art);
      }

      if (!more || foundKnown) break;
      page++;
      await sleep(getDelay());
    }

    // 매물 있는 타일 기록 (캐시용)
    if (tileHasArticles) {
      activeTilesFound.push(tile);
    }

    if (tileHasNew) tilesWithNew++;
    totalTiles++;

    // 매 30타일마다 진행 로그
    if (totalTiles % 30 === 0) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      const pct = ((totalTiles / expectedTiles) * 100).toFixed(0);
      process.stdout.write(`  [${pct}% ${totalTiles}/${expectedTiles}타일 ${elapsed}분] 신규 ${newArticlesData.length}건 ${changedComplexNames.size}단지\n`);
    }

    await sleep(getDelay());
  }

  // 마지막 지역 로그
  if (currentRegion) {
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`  ✅ [${currentRegion}] (${elapsed}분)`);
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n  ✅ 스캔 완료: ${totalTiles}타일 (활성 ${activeTilesFound.length}개), ${tilesWithNew}개 타일에서 변동`);
  console.log(`     신규 매물: ${newArticlesData.length}건, ${changedComplexNames.size}개 단지`);
  console.log(`     소요: ${elapsed}분, API: ${totalRequests}건 (307: ${total307}건)`);

  // 풀스캔이면 활성 타일 캐시 저장
  if (isFullScan && activeTilesFound.length > 0) {
    saveActiveTiles(activeTilesFound);
    console.log(`  💾 활성 타일 캐시 저장: ${activeTilesFound.length}개 (${ACTIVE_TILES_FILE})`);
  }

  return { changedComplexNames, newArticlesData };
}

// ── [2단계] 변동 단지 deep scan ──

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

  if (!result.skipped) {
    await pool.query(`UPDATE complexes SET last_collected_at=NOW() WHERE id=$1`, [complexId]);
  }
  return result;
}

async function deepScanChangedComplexes(changedComplexNames, rotateCount = 300) {
  console.log(`\n🏗 [2단계] deep scan...`);

  // ── 2A: 신규 감지 단지 ──
  let newComplexes = [];
  const scannedIds = new Set();

  const names = [...changedComplexNames.keys()];
  if (names.length > 0) {
    const placeholders = names.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await pool.query(
      `SELECT id, hscp_no, complex_name, deal_count FROM complexes
       WHERE complex_name IN (${placeholders}) AND is_active = true
       ORDER BY id`,
      names
    );
    newComplexes = rows;
    rows.forEach(c => scannedIds.add(c.id));

    console.log(`  [2A] 신규 감지: ${names.length}개 단지명 → ${rows.length}개 DB 매핑`);

    const mappedNames = new Set(rows.map(c => c.complex_name));
    const unmapped = names.filter(n => !mappedNames.has(n));
    if (unmapped.length > 0) {
      console.log(`       매핑 실패 ${unmapped.length}건: ${unmapped.slice(0, 5).join(', ')}${unmapped.length > 5 ? '...' : ''}`);
    }
  }

  // ── 2B: 순환 단지 (24시간 이상 미수집, 수도권 우선) ──
  let rotateComplexes = [];
  if (rotateCount > 0) {
    const excludeIds = scannedIds.size > 0 ? [...scannedIds] : [0];
    const excludePlaceholders = excludeIds.map((_, i) => `$${i + 1}`).join(',');

    const { rows } = await pool.query(`
      SELECT id, hscp_no, complex_name, deal_count, sido FROM complexes
      WHERE is_active = true
        AND id NOT IN (${excludePlaceholders})
        AND (last_collected_at IS NULL OR last_collected_at < NOW() - INTERVAL '24 hours')
      ORDER BY
        CASE WHEN sido IN ('서울','경기','인천') THEN 0 ELSE 1 END,
        last_collected_at ASC NULLS FIRST
      LIMIT $${excludeIds.length + 1}
    `, [...excludeIds, rotateCount]);

    rotateComplexes = rows;
    const metroCount = rows.filter(c => ['서울','경기','인천'].includes(c.sido)).length;
    console.log(`  [2B] 순환: ${rows.length}개 단지 (수도권 ${metroCount}개 우선)`);
  }

  // ── 합치기 ──
  const allComplexes = [...newComplexes, ...rotateComplexes];
  if (allComplexes.length === 0) {
    console.log(`  스캔할 단지 없음`);
    return;
  }

  const totalCount = allComplexes.length;
  console.log(`  합계: ${totalCount}개 단지 (신규 ${newComplexes.length} + 순환 ${rotateComplexes.length})`);

  const { rows: [run] } = await pool.query(
    `INSERT INTO collection_runs (run_type, status, total_complexes) VALUES ('poll', 'running', $1) RETURNING id`,
    [totalCount]
  );
  const runId = run.id;

  const startTime = Date.now();
  let totalFound = 0, totalNew = 0, totalUpdated = 0, totalBargains = 0;
  let totalPriceChanges = 0, totalRemoved = 0, totalErrors = 0, skippedCount = 0;

  for (let i = 0; i < allComplexes.length; i++) {
    const c = allComplexes[i];
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    const pct = ((i / totalCount) * 100).toFixed(1);
    const isNew = i < newComplexes.length;
    const label = isNew
      ? `${c.complex_name} (+${changedComplexNames.get(c.complex_name)?.size || '?'}신규)`
      : `${c.complex_name} [순환${c.sido ? ' ' + c.sido : ''}]`;

    process.stdout.write(`[${pct}% ${elapsed}m] ${label} `);

    const r = await collectComplex(c.id, c.hscp_no);

    if (r.skipped) {
      console.log('→ ⏭ 차단');
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

  await pool.query(`
    UPDATE collection_runs SET
      status=$1, processed_complexes=$2,
      new_articles=$3, updated_articles=$4, new_bargains=$5, removed_articles=$6, errors=$7, completed_at=NOW()
    WHERE id=$8
  `, [
    totalErrors > totalCount / 2 ? 'partial' : 'completed',
    totalCount, totalNew, totalUpdated, totalBargains, totalRemoved, totalErrors, runId,
  ]);

  const deepElapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n  ✅ Deep scan 완료: ${deepElapsed}분`);
  console.log(`     매물: ${totalFound}건 | 신규: ${totalNew}건 | 갱신: ${totalUpdated}건`);
  console.log(`     급매: ${totalBargains}건 | 호가변동: ${totalPriceChanges}건 | 제거: ${totalRemoved}건`);
  console.log(`     차단스킵: ${skippedCount}건 | 에러: ${totalErrors}건`);
}

// ── 메인 ──

async function main() {
  const scanOnly = cliArgs['scan-only'];
  const fullScan = cliArgs['full-scan'];
  const deepOnly = cliArgs['deep-only'];
  const rotateCount = parseInt(cliArgs.rotate) || 300;
  const regionFilter = cliArgs.region || null;

  const globalStart = Date.now();

  // ── --deep-only: 1단계 스킵, 순환 deep scan만 실행 ──
  if (deepOnly) {
    console.log(`\n🏗 Deep scan only 모드 (순환 ${rotateCount}개, 수도권 우선)`);
    await deepScanChangedComplexes(new Map(), rotateCount);
    const totalElapsed = ((Date.now() - globalStart) / 60000).toFixed(1);
    console.log(`\n✅ 완료! 총 소요: ${totalElapsed}분 | API: ${totalRequests}건 (307: ${total307}건)\n`);
    await pool.end();
    return;
  }

  const targetRegions = regionFilter
    ? REGIONS.filter(r => r.name.includes(regionFilter))
    : REGIONS;

  if (targetRegions.length === 0) {
    console.log(`지역 "${regionFilter}"을 찾을 수 없습니다.`);
    await pool.end();
    process.exit(1);
  }

  // 타일 리스트 결정: 캐시 or 전체
  let tiles;
  let isFullScan = fullScan || !!regionFilter;

  if (!isFullScan) {
    const cached = loadActiveTiles();
    if (cached && cached.length > 0) {
      tiles = regionFilter
        ? cached.filter(t => t.region.includes(regionFilter))
        : cached;
      console.log(`\n🔔 신규 매물 폴링 (캐시 모드)`);
      console.log(`   활성 타일: ${tiles.length}개 (전체 스캔 시 --full-scan)`);
    } else {
      console.log(`\n🔔 첫 실행 — 전체 스캔으로 활성 타일 캐시 생성`);
      tiles = generateAllTiles(targetRegions);
      isFullScan = true;
    }
  } else {
    tiles = generateAllTiles(targetRegions);
    console.log(`\n🔔 신규 매물 폴링 (전체 스캔)`);
  }

  console.log(`   지역: ${targetRegions.map(r => r.name).join(', ')}`);
  console.log(`   타일: ${tiles.length}개`);
  console.log(`   모드: ${scanOnly ? '스캔만 (deep scan 안함)' : `스캔 + deep scan (순환 ${rotateCount}개)`}`);

  // [1단계] 신규 매물 감지
  const { changedComplexNames, newArticlesData } = await scanForNewArticles(tiles, isFullScan);

  if (changedComplexNames.size === 0 && scanOnly) {
    console.log(`\n✅ 새 매물 없음!`);
    const elapsed = ((Date.now() - globalStart) / 60000).toFixed(1);
    console.log(`   총 소요: ${elapsed}분\n`);
    await pool.end();
    return;
  }

  // [2단계] deep scan (신규 + 순환)
  if (!scanOnly) {
    await deepScanChangedComplexes(changedComplexNames, rotateCount);
  } else {
    console.log(`\n📋 변동 단지 목록 (--scan-only):`);
    for (const [name, atclNos] of changedComplexNames) {
      console.log(`  ${name}: +${atclNos.size}건`);
    }
  }

  const totalElapsed = ((Date.now() - globalStart) / 60000).toFixed(1);
  console.log(`\n✅ 완료! 총 소요: ${totalElapsed}분 | API: ${totalRequests}건 (307: ${total307}건)\n`);
  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
