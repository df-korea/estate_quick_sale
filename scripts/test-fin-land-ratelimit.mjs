#!/usr/bin/env node
/**
 * test-fin-land-ratelimit.mjs
 *
 * fin.land.naver.com article API의 rate limit 테스트
 *
 * 테스트 순서:
 *   Phase 1: 1.0초 간격 × 1000건
 *   Phase 2: 0.5초 간격 × 1000건
 *   Phase 3: 0.3초 간격 × 1000건
 *   Phase 4: 0.1초 간격 × 1000건
 *   Phase 5: 0초(연속) × 1000건
 *   Phase 6: 차단 발생 시 — 해제 시점 테스트 (1분/3분/5분/10분)
 *
 * Usage:
 *   node --env-file=.env scripts/test-fin-land-ratelimit.mjs
 */

import { pool } from './db.mjs';
import { chromium } from 'playwright';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== fin.land Rate Limit 테스트 ===\n');

  // 테스트용 단지 목록 가져오기 (매물 있는 것만)
  const { rows: complexes } = await pool.query(`
    SELECT hscp_no, complex_name FROM complexes
    WHERE is_active = true AND deal_count > 0
    ORDER BY random()
    LIMIT 6000
  `);
  console.log(`테스트 단지: ${complexes.length}개 확보\n`);

  // 브라우저 시작
  console.log('브라우저 시작...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('세션 워밍업...');
  await page.goto('https://fin.land.naver.com/complexes/22627', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  console.log('준비 완료.\n');

  // 단지 인덱스 (각 phase마다 다른 단지 사용)
  let cIdx = 0;

  // ── 공통 요청 함수 ──
  async function fetchArticle(hscpNo) {
    return await page.evaluate(async (complexNumber) => {
      const start = Date.now();
      try {
        const res = await fetch('/front-api/v1/complex/article/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            complexNumber: String(complexNumber),
            tradeTypes: ['A1'],
            page: 1,
            size: 20,
            orderType: 'RECENT',
          }),
        });
        const elapsed = Date.now() - start;

        if (res.status === 429) return { ok: false, error: 'RATE_LIMIT_429', elapsed, status: 429 };
        if (res.status === 403) return { ok: false, error: 'FORBIDDEN_403', elapsed, status: 403 };
        if (!res.ok) return { ok: false, error: `HTTP_${res.status}`, elapsed, status: res.status };

        const data = await res.json();
        if (!data.isSuccess) {
          if (data.detailCode === 'TOO_MANY_REQUESTS') {
            return { ok: false, error: 'TOO_MANY_REQUESTS', elapsed };
          }
          return { ok: false, error: data.detailCode || 'API_ERROR', elapsed };
        }
        return { ok: true, count: data.result?.totalCount || 0, elapsed };
      } catch (e) {
        return { ok: false, error: e.message, elapsed: Date.now() - start };
      }
    }, hscpNo);
  }

  // ── Phase 실행 함수 ──
  async function runPhase(name, delayMs, count) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📡 ${name}: ${delayMs}ms 간격 × ${count}건`);
    console.log(`${'─'.repeat(50)}`);

    let ok = 0, fail = 0, rateLimited = false;
    let firstBlockAt = null;
    const times = [];
    const startTime = Date.now();

    for (let i = 0; i < count; i++) {
      const c = complexes[cIdx % complexes.length];
      cIdx++;

      const r = await fetchArticle(c.hscp_no);
      times.push(r.elapsed);

      if (r.ok) {
        ok++;
      } else {
        fail++;
        if (r.error.includes('RATE_LIMIT') || r.error.includes('TOO_MANY') || r.status === 429) {
          if (!rateLimited) {
            rateLimited = true;
            firstBlockAt = i + 1;
            console.log(`  ⛔ [${i + 1}번째] 차단 발생! (${r.error}) — ${r.elapsed}ms`);
          }
        } else {
          console.log(`  ❌ [${i + 1}번째] 에러: ${r.error} — ${r.elapsed}ms`);
        }
      }

      if (i % 50 === 49) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [${i + 1}/${count}] ${ok}ok ${fail}fail (${elapsed}s)`);
      }

      // 차단 연속 5회 발생시 조기 종료
      if (fail >= 5 && rateLimited) {
        console.log(`  ⛔ 연속 차단 ${fail}회 — phase 조기 종료`);
        break;
      }

      if (delayMs > 0) await sleep(delayMs);
    }

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0);

    console.log(`\n  결과: ${ok}/${count} 성공, ${fail} 실패`);
    console.log(`  평균 응답: ${avgTime}ms, 총 소요: ${totalElapsed}s`);
    if (rateLimited) {
      console.log(`  🚫 차단 시점: ${firstBlockAt}번째 요청 (${delayMs}ms 간격)`);
    } else {
      console.log(`  ✅ 차단 없음!`);
    }

    return { ok, fail, rateLimited, firstBlockAt, delayMs, totalElapsed, avgTime };
  }

  // ── Phase 1~5 실행 ──
  const phases = [
    { name: 'Phase 1 (1초)', delay: 1000, count: 1000 },
    { name: 'Phase 2 (0.5초)', delay: 500, count: 1000 },
    { name: 'Phase 3 (0.3초)', delay: 300, count: 1000 },
    { name: 'Phase 4 (0.1초)', delay: 100, count: 1000 },
    { name: 'Phase 5 (0초, 연속)', delay: 0, count: 1000 },
  ];

  const phaseResults = [];

  for (const p of phases) {
    const result = await runPhase(p.name, p.delay, p.count);
    phaseResults.push(result);

    // 차단되면 phase간 30초 대기
    if (result.rateLimited) {
      console.log('\n  ⏳ 차단 감지 — phase간 30초 대기...');
      await sleep(30000);
    } else {
      // 정상이면 5초 대기
      await sleep(5000);
    }
  }

  // ── Phase 6: 차단 해제 시점 테스트 ──
  const anyBlocked = phaseResults.some(r => r.rateLimited);

  if (anyBlocked) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log('🔓 Phase 6: 차단 해제 시점 테스트');
    console.log(`${'═'.repeat(50)}`);

    // 먼저 확실히 차단 상태 만들기 (0초 간격으로 50건)
    console.log('\n차단 상태 확인을 위해 0초 간격 200건 시도...');
    const blockCheck = await runPhase('차단 유도', 0, 200);

    if (blockCheck.rateLimited) {
      const waitTimes = [
        { label: '30초 후', ms: 30000 },
        { label: '1분 후', ms: 30000 },   // 누적 1분
        { label: '2분 후', ms: 60000 },   // 누적 2분
        { label: '3분 후', ms: 60000 },   // 누적 3분
        { label: '5분 후', ms: 120000 },  // 누적 5분
        { label: '10분 후', ms: 300000 }, // 누적 10분
      ];

      for (const w of waitTimes) {
        console.log(`\n⏰ ${w.label} 대기 중... (${w.ms / 1000}초)`);
        await sleep(w.ms);

        const c = complexes[cIdx % complexes.length];
        cIdx++;
        const r = await fetchArticle(c.hscp_no);

        if (r.ok) {
          console.log(`  ✅ ${w.label}: 해제됨! (${r.count}건, ${r.elapsed}ms)`);

          // 해제 확인을 위해 연속 3건 테스트
          let confirmOk = 0;
          for (let j = 0; j < 3; j++) {
            await sleep(500);
            const c2 = complexes[cIdx % complexes.length];
            cIdx++;
            const r2 = await fetchArticle(c2.hscp_no);
            if (r2.ok) confirmOk++;
          }
          console.log(`  확인: 연속 3건 중 ${confirmOk}건 성공`);

          if (confirmOk >= 2) {
            console.log(`  🎉 차단 해제 확정: ${w.label}`);
            break;
          }
        } else {
          console.log(`  🚫 ${w.label}: 아직 차단 (${r.error}, ${r.elapsed}ms)`);
        }
      }
    } else {
      console.log('  차단이 재현되지 않음 — 해제 테스트 스킵');
    }
  }

  // ── 최종 리포트 ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log('📊 최종 리포트');
  console.log(`${'═'.repeat(50)}`);

  console.log('\n딜레이 | 성공/전체 | 차단여부 | 차단시점');
  console.log('─'.repeat(50));
  for (const r of phaseResults) {
    const status = r.rateLimited ? `⛔ ${r.firstBlockAt}번째` : '✅ 안됨';
    console.log(`${String(r.delayMs).padStart(6)}ms | ${r.ok}/${r.ok + r.fail} | ${status} | avg ${r.avgTime}ms`);
  }

  console.log('\n💡 권장사항:');
  const safePahse = phaseResults.find(r => !r.rateLimited);
  if (safePahse) {
    console.log(`  안전 딜레이: ${safePahse.delayMs}ms 이상`);
  }
  const blockedPhase = phaseResults.find(r => r.rateLimited);
  if (blockedPhase) {
    console.log(`  차단 시작: ${blockedPhase.delayMs}ms 간격, ${blockedPhase.firstBlockAt}번째 요청`);
  }

  await browser.close();
  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
