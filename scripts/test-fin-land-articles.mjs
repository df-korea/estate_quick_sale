#!/usr/bin/env node
/**
 * test-fin-land-articles.mjs
 *
 * Tests whether fin.land.naver.com article API can replace/speed up
 * the per-complex deep scan in poll-new-articles.mjs.
 *
 * Comparison:
 *   - OLD: m.land.naver.com/complex/getComplexArticleList (fetch, 2s delay)
 *   - NEW: fin.land.naver.com/front-api/v1/complex/article/list (Playwright, 0.5s delay)
 *
 * Tests:
 *   1. Speed: how fast can we fetch articles per complex?
 *   2. Data quality: what fields are available? Are they richer?
 *   3. Rate limiting: can we sustain 0.5s intervals at scale?
 *   4. Data mapping: can we map fin.land fields to our DB schema?
 *
 * Usage:
 *   node --env-file=.env scripts/test-fin-land-articles.mjs
 *   node --env-file=.env scripts/test-fin-land-articles.mjs --count 50
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── OLD API: m.land.naver.com ──

async function fetchOldAPI(hscpNo, tradTpCd = 'A1') {
  const url = `https://m.land.naver.com/complex/getComplexArticleList?hscpNo=${hscpNo}&tradTpCd=${tradTpCd}&order=prc&showR0=N&page=1`;
  const start = Date.now();

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      'Referer': 'https://m.land.naver.com/',
      'Accept': 'application/json',
    },
    redirect: 'follow',
  });

  const elapsed = Date.now() - start;

  if (res.status === 307 || res.status === 302 || res.status === 429) {
    return { success: false, error: `RATE_LIMIT_${res.status}`, elapsed, articles: [] };
  }
  if (!res.ok) {
    return { success: false, error: `HTTP_${res.status}`, elapsed, articles: [] };
  }

  const data = await res.json();
  const result = data.result;
  if (!result) return { success: true, elapsed, articles: [], totalCount: 0 };

  return {
    success: true,
    elapsed,
    articles: result.list || [],
    totalCount: parseInt(result.totAtclCnt) || 0,
    hasMore: (result.list || []).length === 20,
    sampleArticle: (result.list || [])[0] || null,
  };
}

// ── NEW API: fin.land.naver.com (via Playwright) ──

async function fetchNewAPI(page, complexNumber, tradeTypes = ['A1'], pageNum = 1, size = 50) {
  const start = Date.now();

  const result = await page.evaluate(async ({ complexNumber, tradeTypes, pageNum, size }) => {
    try {
      const res = await fetch('/front-api/v1/complex/article/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complexNumber: String(complexNumber),
          tradeTypes,
          page: pageNum,
          size,
          orderType: 'RECENT',
        }),
      });

      if (res.status === 429) {
        return { success: false, error: 'RATE_LIMIT_429', status: res.status };
      }

      const data = await res.json();

      if (!data.isSuccess) {
        return { success: false, error: data.detailCode || 'API_ERROR', message: data.message };
      }

      return {
        success: true,
        totalCount: data.result?.totalCount || 0,
        hasNextPage: data.result?.hasNextPage || false,
        articles: data.result?.list || [],
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, { complexNumber, tradeTypes, pageNum, size });

  result.elapsed = Date.now() - start;
  return result;
}

// ── Field Comparison ──

function compareFields(oldArt, newArt) {
  const comparison = {};

  // Old API fields
  if (oldArt) {
    comparison.old = {
      atclNo: oldArt.atclNo,
      atclNm: oldArt.atclNm,
      prcInfo: oldArt.prcInfo,
      spc1: oldArt.spc1,
      spc2: oldArt.spc2,
      flrInfo: oldArt.flrInfo,
      direction: oldArt.direction,
      atclFetrDesc: oldArt.atclFetrDesc,
      rltrNm: oldArt.rltrNm,
      cfmYmd: oldArt.cfmYmd,
      tagList: oldArt.tagList,
      repImgUrl: oldArt.repImgUrl,
      bildNm: oldArt.bildNm,
      sameAddrCnt: oldArt.sameAddrCnt,
      totalKeys: Object.keys(oldArt).length,
    };
  }

  // New API fields
  if (newArt) {
    const rep = newArt.representativeArticleInfo || newArt;
    comparison.new = {
      articleNumber: rep.articleNumber,
      complexName: rep.complexName,
      dongName: rep.dongName,
      dealPrice: rep.priceInfo?.dealPrice,
      warrantyPrice: rep.priceInfo?.warrantyPrice,
      rentPrice: rep.priceInfo?.rentPrice,
      managementFee: rep.priceInfo?.managementFeeAmount,
      priceChangeStatus: rep.priceInfo?.priceChangeStatus,
      supplySpace: rep.spaceInfo?.supplySpace,
      exclusiveSpace: rep.spaceInfo?.exclusiveSpace,
      direction: rep.articleDetail?.direction,
      directionStandard: rep.articleDetail?.directionStandard,
      floorInfo: rep.articleDetail?.floorInfo,
      targetFloor: rep.articleDetail?.floorDetailInfo?.targetFloor,
      totalFloor: rep.articleDetail?.floorDetailInfo?.totalFloor,
      description: rep.articleDetail?.articleFeatureDescription,
      verificationType: rep.verificationInfo?.verificationType,
      confirmDate: rep.verificationInfo?.articleConfirmDate,
      brokerageName: rep.brokerInfo?.brokerageName,
      coordinates: rep.address?.coordinates,
      city: rep.address?.city,
      division: rep.address?.division,
      sector: rep.address?.sector,
      imageCount: rep.articleMedia?.imageCount,
      isVrExposed: rep.articleMedia?.isVrExposed,
      buildingDate: rep.buildingInfo?.buildingConjunctionDate,
    };
  }

  return comparison;
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);
  const countIdx = args.indexOf('--count');
  const testCount = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 20;

  console.log('=== fin.land.naver.com Article API Test ===\n');

  // Pick test complexes with known articles
  const { rows: testComplexes } = await pool.query(`
    SELECT c.id, c.hscp_no, c.complex_name, c.deal_count, c.sido
    FROM complexes c
    WHERE c.is_active = true AND c.deal_count > 0
    ORDER BY random()
    LIMIT $1
  `, [testCount]);

  console.log(`Test complexes: ${testComplexes.length} (with deal_count > 0)\n`);

  // ── Test 1: Launch browser ──
  console.log('--- Phase 1: Setting up browser ---');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Warming up fin.land session...');
  await page.goto('https://fin.land.naver.com/complexes/22627', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  console.log('Browser ready.\n');

  // ── Test 2: Speed + Data Comparison ──
  console.log('--- Phase 2: Per-complex comparison ---');
  console.log(`Format: [complex] OLD(ms/count/status) vs NEW(ms/count/status)\n`);

  const results = {
    old: { totalTime: 0, totalArticles: 0, successes: 0, failures: 0, rateLimits: 0 },
    new: { totalTime: 0, totalArticles: 0, successes: 0, failures: 0, rateLimits: 0 },
    fieldComparisons: [],
    speedRatios: [],
  };

  for (let i = 0; i < testComplexes.length; i++) {
    const c = testComplexes[i];
    const label = `[${i + 1}/${testComplexes.length}] ${c.complex_name} (${c.hscp_no})`;

    // Fetch OLD API
    const oldResult = await fetchOldAPI(c.hscp_no);
    if (oldResult.success) {
      results.old.successes++;
      results.old.totalTime += oldResult.elapsed;
      results.old.totalArticles += oldResult.totalCount;
    } else if (oldResult.error.startsWith('RATE_LIMIT')) {
      results.old.rateLimits++;
      results.old.failures++;
    } else {
      results.old.failures++;
    }

    await sleep(500); // small gap between APIs

    // Fetch NEW API
    const newResult = await fetchNewAPI(page, c.hscp_no);
    if (newResult.success) {
      results.new.successes++;
      results.new.totalTime += newResult.elapsed;
      results.new.totalArticles += newResult.totalCount;
    } else if (newResult.error === 'RATE_LIMIT_429') {
      results.new.rateLimits++;
      results.new.failures++;
    } else {
      results.new.failures++;
    }

    // Log
    const oldStatus = oldResult.success ? `${oldResult.elapsed}ms/${oldResult.totalCount}건` : oldResult.error;
    const newStatus = newResult.success ? `${newResult.elapsed}ms/${newResult.totalCount}건` : newResult.error;
    console.log(`${label}: OLD=${oldStatus} | NEW=${newStatus}`);

    // Field comparison (first 3)
    if (i < 3 && oldResult.success && newResult.success && oldResult.sampleArticle && newResult.articles[0]) {
      results.fieldComparisons.push({
        complex: c.complex_name,
        comparison: compareFields(oldResult.sampleArticle, newResult.articles[0]),
      });
    }

    if (oldResult.success && newResult.success) {
      results.speedRatios.push(oldResult.elapsed / Math.max(1, newResult.elapsed));
    }

    // Delay between complexes: 2s for old API safety
    await sleep(2000);
  }

  // ── Test 3: Sustained speed test (NEW API only) ──
  console.log('\n--- Phase 3: Sustained speed test (NEW API, 0.5s intervals) ---');

  const sustainedResults = { total: 0, success: 0, rateLimits: 0, errors: 0, times: [] };
  const sustainedStart = Date.now();

  // Pick 50 random complexes for sustained test
  const { rows: sustainedComplexes } = await pool.query(`
    SELECT hscp_no, complex_name FROM complexes
    WHERE is_active = true AND deal_count > 0
    ORDER BY random()
    LIMIT 50
  `);

  for (let i = 0; i < sustainedComplexes.length; i++) {
    const c = sustainedComplexes[i];
    const r = await fetchNewAPI(page, c.hscp_no);
    sustainedResults.total++;

    if (r.success) {
      sustainedResults.success++;
      sustainedResults.times.push(r.elapsed);
    } else if (r.error === 'RATE_LIMIT_429') {
      sustainedResults.rateLimits++;
      console.log(`  [${i + 1}] ${c.complex_name}: RATE LIMITED!`);
    } else {
      sustainedResults.errors++;
      console.log(`  [${i + 1}] ${c.complex_name}: ERROR ${r.error}`);
    }

    if (i % 10 === 9) {
      const elapsed = ((Date.now() - sustainedStart) / 1000).toFixed(1);
      console.log(`  [${i + 1}/50] ${elapsed}s elapsed, ${sustainedResults.success} ok, ${sustainedResults.rateLimits} rate limits`);
    }

    await sleep(500);
  }

  const sustainedElapsed = ((Date.now() - sustainedStart) / 1000).toFixed(1);
  const avgTime = sustainedResults.times.length > 0
    ? (sustainedResults.times.reduce((a, b) => a + b, 0) / sustainedResults.times.length).toFixed(0)
    : 'N/A';

  // ── Test 4: Pagination test ──
  console.log('\n--- Phase 4: Pagination test (large complex) ---');

  // Find a complex with many articles
  const { rows: [bigComplex] } = await pool.query(`
    SELECT hscp_no, complex_name, deal_count FROM complexes
    WHERE is_active = true AND deal_count > 50
    ORDER BY deal_count DESC
    LIMIT 1
  `);

  if (bigComplex) {
    console.log(`Testing pagination on ${bigComplex.complex_name} (${bigComplex.deal_count} deals)...`);
    let pageNum = 1;
    let totalFetched = 0;
    const paginationStart = Date.now();

    while (pageNum <= 10) {
      const r = await fetchNewAPI(page, bigComplex.hscp_no, ['A1'], pageNum, 50);
      if (!r.success) {
        console.log(`  Page ${pageNum}: ERROR ${r.error}`);
        break;
      }
      totalFetched += r.articles.length;
      console.log(`  Page ${pageNum}: ${r.articles.length} articles (total: ${totalFetched}/${r.totalCount}), ${r.elapsed}ms`);

      if (!r.hasNextPage || r.articles.length === 0) break;
      pageNum++;
      await sleep(500);
    }

    const pagElapsed = ((Date.now() - paginationStart) / 1000).toFixed(1);
    console.log(`  Pagination done: ${totalFetched} articles in ${pagElapsed}s`);
  }

  // ── Close browser ──
  await browser.close();

  // ── Final Report ──
  console.log('\n' + '='.repeat(60));
  console.log('=== RESULTS ===');
  console.log('='.repeat(60));

  console.log('\n📊 Speed Comparison:');
  console.log(`  OLD API (m.land): ${results.old.successes} success, ${results.old.rateLimits} rate limits, avg ${results.old.successes > 0 ? (results.old.totalTime / results.old.successes).toFixed(0) : 'N/A'}ms`);
  console.log(`  NEW API (fin.land): ${results.new.successes} success, ${results.new.rateLimits} rate limits, avg ${results.new.successes > 0 ? (results.new.totalTime / results.new.successes).toFixed(0) : 'N/A'}ms`);

  if (results.speedRatios.length > 0) {
    const avgRatio = (results.speedRatios.reduce((a, b) => a + b, 0) / results.speedRatios.length).toFixed(2);
    console.log(`  Speed ratio (OLD/NEW): ${avgRatio}x`);
  }

  console.log('\n🔄 Sustained Test (50 complexes, 0.5s intervals):');
  console.log(`  ${sustainedResults.success}/${sustainedResults.total} success in ${sustainedElapsed}s`);
  console.log(`  Rate limits: ${sustainedResults.rateLimits}`);
  console.log(`  Avg response time: ${avgTime}ms`);

  console.log('\n📋 Data Quality (first complex comparison):');
  if (results.fieldComparisons.length > 0) {
    const fc = results.fieldComparisons[0];
    console.log(`  Complex: ${fc.complex}`);

    console.log('\n  OLD API fields:');
    if (fc.comparison.old) {
      for (const [k, v] of Object.entries(fc.comparison.old)) {
        const display = v === null || v === undefined ? '(null)' : typeof v === 'object' ? JSON.stringify(v) : String(v);
        console.log(`    ${k}: ${display.substring(0, 80)}`);
      }
    }

    console.log('\n  NEW API fields:');
    if (fc.comparison.new) {
      for (const [k, v] of Object.entries(fc.comparison.new)) {
        const display = v === null || v === undefined ? '(null)' : typeof v === 'object' ? JSON.stringify(v) : String(v);
        console.log(`    ${k}: ${display.substring(0, 80)}`);
      }
    }
  }

  console.log('\n🏆 Advantages of NEW API (fin.land):');
  console.log('  + Price already in won (no parsing needed)');
  console.log('  + Coordinates included per article');
  console.log('  + Structured direction/floor/space info');
  console.log('  + Management fee included');
  console.log('  + Building info (construction date)');
  console.log('  + Verification type (OWNER, etc.)');
  console.log('  + VR/image counts');
  console.log('  + Address breakdown (city/division/sector)');

  console.log('\n⚠️ Limitations of NEW API:');
  console.log('  - Requires Playwright browser (no plain fetch)');
  console.log('  - No area/tile-based search (complex-only)');
  console.log('  - POST request (slightly more complex)');

  console.log('\n💡 Recommendation:');
  if (sustainedResults.rateLimits === 0 && results.new.rateLimits === 0) {
    console.log('  ✅ fin.land API is HIGHLY suitable for deep scan replacement.');
    console.log('  - Replace m.land getComplexArticleList with fin.land article/list');
    console.log('  - Keep m.land articleList for tile-based new article detection');
    console.log('  - Expected speedup: ~4x (2s→0.5s delay + richer data)');
  } else {
    console.log('  ⚠️ fin.land API showed rate limiting. Use with caution.');
    console.log('  - May need longer delays or smaller batch sizes');
  }

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
