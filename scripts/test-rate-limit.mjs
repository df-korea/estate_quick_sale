#!/usr/bin/env node
/**
 * test-rate-limit.mjs  —  네이버 API Rate Limit 최적값 탐색
 *
 * Phase 1: 딜레이 하한선 찾기 (딜레이를 점진적으로 줄이며 차단 시점 확인)
 * Phase 2: 차단 해제 시간 측정 (30초마다 프로빙)
 * Phase 3: 배치 휴식 최적화 (최적 딜레이 고정 후 배치 설정 탐색)
 *
 * Usage:
 *   node --env-file=.env scripts/test-rate-limit.mjs
 *   node --env-file=.env scripts/test-rate-limit.mjs --start-delay 2.0
 *   node --env-file=.env scripts/test-rate-limit.mjs --step 0.2
 *   node --env-file=.env scripts/test-rate-limit.mjs --requests 30
 */

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

// ── Args ──

const { values: cliArgs } = parseArgs({
  options: {
    'start-delay': { type: 'string', default: '2.0' },
    'step':        { type: 'string', default: '0.2' },
    'requests':    { type: 'string', default: '30' },
  },
  strict: false,
});

const START_DELAY = parseFloat(cliArgs['start-delay']);
const DELAY_STEP  = parseFloat(cliArgs['step']);
const REQUESTS_PER_ROUND = parseInt(cliArgs['requests']);

// ── 고정 타일 (서울 강남 부근 — 항상 매물 있음) ──

const TEST_TILE = { lat: 37.48, lon: 127.04, step: 0.04 };

// ── User-Agent 로테이션 ──

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0.6167.171 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ts() { return new Date().toLocaleTimeString('ko-KR', { hour12: false }); }

function getHeaders() {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Referer': 'https://m.land.naver.com/',
    'Accept': 'application/json',
  };
}

// ── API 요청 (단일) ──

async function testRequest() {
  const { lat, lon, step } = TEST_TILE;
  const btm = lat, top = lat + step, lft = lon, rgt = lon + step;
  const centerLat = lat + step / 2, centerLon = lon + step / 2;
  const url = `https://m.land.naver.com/cluster/ajax/articleList?rletTpCd=APT:OPST&tradTpCd=A1&z=13&lat=${centerLat}&lon=${centerLon}&btm=${btm}&lft=${lft}&top=${top}&rgt=${rgt}&sort=dates&page=1`;

  const start = Date.now();
  try {
    const res = await fetch(url, { headers: getHeaders(), redirect: 'manual' });
    const elapsed = Date.now() - start;
    const blocked = res.status === 307 || res.status === 302 || res.status === 429;
    return { status: res.status, elapsed, blocked, time: new Date().toISOString() };
  } catch (e) {
    const elapsed = Date.now() - start;
    return { status: 0, elapsed, blocked: false, error: e.message, time: new Date().toISOString() };
  }
}

// ── 결과 저장 ──

const testLog = {
  startedAt: new Date().toISOString(),
  config: { startDelay: START_DELAY, step: DELAY_STEP, requestsPerRound: REQUESTS_PER_ROUND },
  phase1: [],   // { delay, requestCount, blockedAt, results[] }
  phase2: [],   // { blockNumber, duration, probeResults[] }
  phase3: [],   // { batchSize, batchRest, requestCount, blockedAt, results[] }
  summary: null,
};

function saveLog() {
  const dir = path.join(import.meta.dirname, '..', 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 13).replace(/(\d{8})(\d{4})/, '$1-$2');
  const filename = `rate-limit-test-${stamp}.json`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(testLog, null, 2));
  return filepath;
}

// ── Phase 1: 딜레이 하한선 찾기 ──

async function phase1() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Phase 1: 딜레이 하한선 찾기`);
  console.log(`  시작 딜레이: ${START_DELAY}초 | 감소 폭: ${DELAY_STEP}초 | 라운드당 ${REQUESTS_PER_ROUND}건`);
  console.log(`${'='.repeat(60)}\n`);

  let delay = START_DELAY;
  let lastSafeDelay = null;
  let blockCount = 0;

  while (delay >= 0.2) {
    const round = { delay, requestCount: 0, blockedAt: null, results: [] };
    console.log(`[${ts()}] Phase1 | delay=${delay.toFixed(1)}초 | 시작`);

    let blocked = false;

    for (let i = 1; i <= REQUESTS_PER_ROUND; i++) {
      const result = await testRequest();
      round.results.push(result);
      round.requestCount = i;

      if (result.blocked) {
        round.blockedAt = i;
        blocked = true;
        blockCount++;
        console.log(`[${ts()}] Phase1 | delay=${delay.toFixed(1)}s | 요청 #${i} | ❌ ${result.status} 차단! (${i}건 후)`);
        break;
      }

      const icon = result.status === 200 ? '✅' : '⚠️';
      console.log(`[${ts()}] Phase1 | delay=${delay.toFixed(1)}s | 요청 #${i}/${REQUESTS_PER_ROUND} | ${icon} ${result.status} (${result.elapsed}ms)`);

      // 랜덤 편차 ±15%
      const jitteredDelay = delay * 1000 * (0.85 + Math.random() * 0.3);
      await sleep(jitteredDelay);
    }

    testLog.phase1.push(round);
    saveLog();

    if (blocked) {
      console.log(`[${ts()}] Phase1 | delay=${delay.toFixed(1)}s → ❌ 차단 발생\n`);

      // Phase 2: 차단 해제 대기
      await phase2(blockCount);

      // 차단 발생 → 이전 딜레이가 최소 안전 딜레이
      // 한 번 더 줄여보지 않고, 차단된 딜레이에서 멈춤
      if (lastSafeDelay === null) {
        // 첫 딜레이부터 차단 → 더 높은 딜레이 필요
        console.log(`[${ts()}] Phase1 | ⚠ 시작 딜레이(${START_DELAY}초)에서도 차단! --start-delay를 높이세요.`);
        break;
      }
      // 차단 2회 시 탐색 종료
      if (blockCount >= 2) {
        console.log(`[${ts()}] Phase1 | 차단 ${blockCount}회 — 탐색 종료`);
        break;
      }
    } else {
      console.log(`[${ts()}] Phase1 | delay=${delay.toFixed(1)}s → ✅ ${REQUESTS_PER_ROUND}건 성공\n`);
      lastSafeDelay = delay;
      delay = parseFloat((delay - DELAY_STEP).toFixed(1));

      // 라운드 간 쿨다운 (차단 방지)
      const cooldown = 10000 + Math.random() * 5000;
      console.log(`[${ts()}] 다음 라운드 전 쿨다운 ${(cooldown / 1000).toFixed(0)}초...\n`);
      await sleep(cooldown);
    }
  }

  return lastSafeDelay;
}

// ── Phase 2: 차단 해제 시간 측정 ──

async function phase2(blockNumber) {
  console.log(`[${ts()}] Phase2 | 차단 해제 대기 시작 (${blockNumber}번째 차단)`);

  const probeInterval = 30000; // 30초마다 프로빙
  const maxWait = 30 * 60 * 1000; // 최대 30분
  const startTime = Date.now();
  const entry = { blockNumber, durationMs: 0, durationMin: 0, probeResults: [] };

  while (Date.now() - startTime < maxWait) {
    await sleep(probeInterval);
    const elapsed = Date.now() - startTime;
    const elapsedMin = (elapsed / 60000).toFixed(1);

    const result = await testRequest();
    entry.probeResults.push({ ...result, elapsedMs: elapsed });

    if (result.blocked) {
      console.log(`[${ts()}] Phase2 | 차단 해제 대기 | 경과 ${elapsedMin}분 | ❌ 아직 차단 (${result.status})`);
    } else {
      entry.durationMs = elapsed;
      entry.durationMin = parseFloat(elapsedMin);
      testLog.phase2.push(entry);
      saveLog();
      console.log(`[${ts()}] Phase2 | ✅ 차단 해제! | 소요 ${elapsedMin}분\n`);

      // 해제 후 안정화 대기
      const stabilize = 15000 + Math.random() * 10000;
      console.log(`[${ts()}] 해제 후 안정화 대기 ${(stabilize / 1000).toFixed(0)}초...\n`);
      await sleep(stabilize);
      return;
    }
  }

  // 30분 초과 — 타임아웃
  entry.durationMs = Date.now() - startTime;
  entry.durationMin = parseFloat((entry.durationMs / 60000).toFixed(1));
  entry.timedOut = true;
  testLog.phase2.push(entry);
  saveLog();
  console.log(`[${ts()}] Phase2 | ⛔ 30분 경과, 차단 미해제 — 타임아웃\n`);

  // 타임아웃이어도 잠시 추가 대기 후 계속
  await sleep(60000);
}

// ── Phase 3: 배치 휴식 최적화 ──

async function phase3(safeDelay) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Phase 3: 배치 휴식 최적화`);
  console.log(`  고정 딜레이: ${safeDelay}초 | 안전 마진 포함`);
  console.log(`${'='.repeat(60)}\n`);

  // 배치 휴식을 25초 → 20초 → 15초 → 10초 → 5초 → 0초 순으로 테스트
  const restValues = [25, 20, 15, 10, 5, 0];
  const batchSize = REQUESTS_PER_ROUND; // Phase 1과 동일
  let lastSafeRest = null;

  for (const restSec of restValues) {
    const round = { batchSize, batchRest: restSec, requestCount: 0, blockedAt: null, results: [] };
    console.log(`[${ts()}] Phase3 | batch=${batchSize}건 | 휴식=${restSec}초 | 시작`);

    // 배치 1회분 요청
    let blocked = false;
    for (let i = 1; i <= batchSize; i++) {
      const result = await testRequest();
      round.results.push(result);
      round.requestCount = i;

      if (result.blocked) {
        round.blockedAt = i;
        blocked = true;
        console.log(`[${ts()}] Phase3 | batch=${batchSize} | 휴식=${restSec}s | 요청 #${i} | ❌ ${result.status} 차단!`);
        break;
      }

      console.log(`[${ts()}] Phase3 | batch=${batchSize} | 휴식=${restSec}s | 요청 #${i}/${batchSize} | ✅ ${result.status} (${result.elapsed}ms)`);

      const jitteredDelay = safeDelay * 1000 * (0.85 + Math.random() * 0.3);
      await sleep(jitteredDelay);
    }

    // 배치 간 휴식
    if (!blocked) {
      console.log(`[${ts()}] Phase3 | 배치 휴식 ${restSec}초...`);
      await sleep(restSec * 1000);

      // 휴식 후 다시 요청해서 차단 안 되는지 확인
      const afterRest = await testRequest();
      round.results.push(afterRest);
      if (afterRest.blocked) {
        blocked = true;
        round.blockedAt = batchSize + 1;
        console.log(`[${ts()}] Phase3 | 휴식 후 차단! 휴식=${restSec}초 부족`);
      }
    }

    testLog.phase3.push(round);
    saveLog();

    if (blocked) {
      console.log(`[${ts()}] Phase3 | 휴식=${restSec}초 → ❌ 차단\n`);
      // 차단 해제 대기
      await waitForUnblock();
    } else {
      console.log(`[${ts()}] Phase3 | 휴식=${restSec}초 → ✅ 성공\n`);
      lastSafeRest = restSec;

      // 라운드 간 쿨다운
      const cooldown = 15000 + Math.random() * 10000;
      console.log(`[${ts()}] 다음 라운드 전 쿨다운 ${(cooldown / 1000).toFixed(0)}초...\n`);
      await sleep(cooldown);
    }
  }

  // 배치 크기 확장 테스트 (최적 휴식으로 고정)
  if (lastSafeRest !== null) {
    console.log(`\n--- 배치 크기 확장 테스트 (휴식=${lastSafeRest}초 고정) ---\n`);

    const batchSizes = [35, 40, 45, 50];
    let lastSafeBatch = batchSize;

    for (const bs of batchSizes) {
      const round = { batchSize: bs, batchRest: lastSafeRest, requestCount: 0, blockedAt: null, results: [] };
      console.log(`[${ts()}] Phase3 | batch=${bs}건 | 휴식=${lastSafeRest}초 | 시작`);

      let blocked = false;
      for (let i = 1; i <= bs; i++) {
        const result = await testRequest();
        round.results.push(result);
        round.requestCount = i;

        if (result.blocked) {
          round.blockedAt = i;
          blocked = true;
          console.log(`[${ts()}] Phase3 | batch=${bs} | 요청 #${i} | ❌ ${result.status} 차단!`);
          break;
        }

        console.log(`[${ts()}] Phase3 | batch=${bs} | 요청 #${i}/${bs} | ✅ ${result.status} (${result.elapsed}ms)`);

        const jitteredDelay = safeDelay * 1000 * (0.85 + Math.random() * 0.3);
        await sleep(jitteredDelay);
      }

      testLog.phase3.push(round);
      saveLog();

      if (blocked) {
        console.log(`[${ts()}] Phase3 | batch=${bs}건 → ❌ 차단\n`);
        await waitForUnblock();
        break; // 더 큰 배치는 시도하지 않음
      } else {
        console.log(`[${ts()}] Phase3 | batch=${bs}건 → ✅ 성공\n`);
        lastSafeBatch = bs;

        // 배치 휴식 + 쿨다운
        await sleep(lastSafeRest * 1000 + 10000 + Math.random() * 5000);
      }
    }

    return { safeRest: lastSafeRest, safeBatch: lastSafeBatch };
  }

  return { safeRest: lastSafeRest, safeBatch: batchSize };
}

// ── 간이 차단 해제 대기 (Phase 3용) ──

async function waitForUnblock() {
  console.log(`[${ts()}] 차단 해제 대기 중...`);
  const maxWait = 20 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await sleep(30000);
    const result = await testRequest();
    const elapsed = ((Date.now() - start) / 60000).toFixed(1);

    if (!result.blocked) {
      console.log(`[${ts()}] ✅ 차단 해제 (${elapsed}분)\n`);
      await sleep(15000);
      return;
    }
    console.log(`[${ts()}] 아직 차단 (${elapsed}분)`);
  }

  console.log(`[${ts()}] ⛔ 20분 타임아웃\n`);
  await sleep(60000);
}

// ── 최종 결과 출력 ──

function printSummary(safeDelay, phase3Result) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  네이버 Rate Limit 테스트 결과`);
  console.log(`${'='.repeat(60)}\n`);

  // 딜레이 테스트 요약
  console.log(`[딜레이 테스트]`);
  for (const round of testLog.phase1) {
    const icon = round.blockedAt ? '❌' : '✅';
    const detail = round.blockedAt
      ? `${round.blockedAt}건 후 차단`
      : `${round.requestCount}건 성공`;
    console.log(`  ${round.delay.toFixed(1)}초: ${icon} ${detail}`);
  }
  if (safeDelay !== null) {
    console.log(`  → 최소 안전 딜레이: ${safeDelay.toFixed(1)}초`);
  } else {
    console.log(`  → 안전한 딜레이를 찾지 못함 (--start-delay 높여 재시도)`);
  }

  // 차단 해제 테스트 요약
  console.log(`\n[차단 해제 테스트]`);
  if (testLog.phase2.length === 0) {
    console.log(`  차단 발생 없음 (테스트 불가)`);
  } else {
    for (const entry of testLog.phase2) {
      const status = entry.timedOut ? '⛔ 타임아웃' : `${entry.durationMin}분 후 해제`;
      console.log(`  ${entry.blockNumber}차 차단: ${status}`);
    }
    const resolved = testLog.phase2.filter(e => !e.timedOut);
    if (resolved.length > 0) {
      const durations = resolved.map(e => e.durationMin);
      const avg = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1);
      const min = Math.min(...durations).toFixed(1);
      const max = Math.max(...durations).toFixed(1);
      console.log(`  → 평균 해제 시간: ${avg}분 | 최소: ${min}분 | 최대: ${max}분`);

      if (resolved.length >= 2) {
        const increasing = durations.every((d, i) => i === 0 || d >= durations[i - 1]);
        console.log(`  → 패턴: ${increasing ? '차단 횟수 증가 시 해제 시간도 증가' : '해제 시간에 일관된 패턴 없음'}`);
      }
    }
  }

  // 배치 휴식 테스트 요약
  console.log(`\n[배치 휴식 테스트]`);
  if (testLog.phase3.length === 0) {
    console.log(`  Phase 3 미실행`);
  } else {
    for (const round of testLog.phase3) {
      const icon = round.blockedAt ? '❌' : '✅';
      const detail = round.blockedAt
        ? `${round.blockedAt}건 후 차단`
        : `${round.requestCount}건 성공`;
      console.log(`  ${round.batchRest}초 / ${round.batchSize}건: ${icon} ${detail}`);
    }
    if (phase3Result) {
      if (phase3Result.safeRest !== null) {
        console.log(`  → 최소 안전 배치 휴식: ${phase3Result.safeRest}초`);
      }
      console.log(`  → 최대 안전 배치 크기: ${phase3Result.safeBatch}건`);
    }
  }

  // 최종 권장 설정
  console.log(`\n[최종 권장 설정]`);
  if (safeDelay !== null) {
    const recommendedDelay = parseFloat((safeDelay + DELAY_STEP).toFixed(1)); // 안전 마진
    const recommendedRest = phase3Result?.safeRest ?? 25;
    const recommendedBatch = phase3Result?.safeBatch ?? REQUESTS_PER_ROUND;

    // 현재 설정과 비교
    const currentDelay = 2.0;
    const currentBatch = 30;
    const currentRest = 25;

    console.log(`  REQUEST_DELAY: ${recommendedDelay}초 (현재: ${currentDelay}초)`);
    console.log(`  BATCH_SIZE: ${recommendedBatch}건 (현재: ${currentBatch}건)`);
    console.log(`  BATCH_REST: ${recommendedRest}초 (현재: ${currentRest}초)`);

    // 예상 소요 시간 계산 (타일 ~300개 기준)
    const tiles = 300;
    const currentTime = tiles * (currentDelay + 0.3) + Math.floor(tiles / currentBatch) * currentRest;
    const newTime = tiles * (recommendedDelay + 0.3) + Math.floor(tiles / recommendedBatch) * recommendedRest;
    console.log(`  예상 ${tiles}타일 소요: ~${(newTime / 60).toFixed(0)}분 (현재 ~${(currentTime / 60).toFixed(0)}분)`);

    testLog.summary = {
      safeDelay,
      recommendedDelay,
      recommendedBatch,
      recommendedRest,
      estimatedTimeMin: parseFloat((newTime / 60).toFixed(1)),
      currentTimeMin: parseFloat((currentTime / 60).toFixed(1)),
    };
  } else {
    console.log(`  안전한 설정을 찾지 못했습니다.`);
    testLog.summary = { error: 'No safe delay found' };
  }
}

// ── 메인 ──

async function main() {
  console.log(`\n🔬 네이버 Rate Limit 테스트`);
  console.log(`   설정: 시작 딜레이=${START_DELAY}초, 감소 폭=${DELAY_STEP}초, 라운드당=${REQUESTS_PER_ROUND}건`);
  console.log(`   타일: lat=${TEST_TILE.lat} lon=${TEST_TILE.lon} (강남 부근)`);
  console.log(`   시작: ${new Date().toLocaleString('ko-KR')}\n`);

  // 초기 연결 테스트
  console.log(`[${ts()}] 초기 연결 테스트...`);
  const init = await testRequest();
  if (init.blocked) {
    console.log(`[${ts()}] ⚠ 이미 차단 상태! 해제 대기 후 시작합니다.`);
    await waitForUnblock();
  } else if (init.error) {
    console.log(`[${ts()}] ⛔ 네트워크 오류: ${init.error}`);
    process.exit(1);
  } else {
    console.log(`[${ts()}] ✅ 연결 정상 (${init.status}, ${init.elapsed}ms)\n`);
  }

  // Phase 1
  const safeDelay = await phase1();

  // Phase 3 (Phase 2는 Phase 1 중 차단 시 자동 실행)
  let phase3Result = null;
  if (safeDelay !== null) {
    // 안전 마진 추가한 딜레이로 Phase 3 실행
    const testDelay = parseFloat((safeDelay + DELAY_STEP).toFixed(1));
    phase3Result = await phase3(testDelay);
  }

  // 결과 출력 및 저장
  printSummary(safeDelay, phase3Result);

  testLog.completedAt = new Date().toISOString();
  const logPath = saveLog();
  console.log(`\n📁 로그 저장: ${logPath}`);

  const totalElapsed = ((new Date() - new Date(testLog.startedAt)) / 60000).toFixed(1);
  console.log(`⏱ 총 소요: ${totalElapsed}분\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
