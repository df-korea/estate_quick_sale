#!/usr/bin/env node
/**
 * populate-complex-sgg.mjs
 *
 * complexes 테이블의 city/division → sgg_cd 매핑 + real_transactions에서 rt_apt_nm 매칭.
 *
 * Usage:
 *   node --env-file=.env scripts/populate-complex-sgg.mjs            # 전체 실행
 *   node --env-file=.env scripts/populate-complex-sgg.mjs --dry-run  # 변경 없이 확인
 *   node --env-file=.env scripts/populate-complex-sgg.mjs --force    # 기존 값 덮어쓰기
 */

import { readFileSync } from 'fs';
import { pool } from './db.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

// ── sgg-codes.json 로드 ──
const sggCodes = JSON.parse(readFileSync(new URL('./data/sgg-codes.json', import.meta.url), 'utf8'));

// ── 시도 정규화 맵 ──
const SIDO_NORMALIZE = {
  '서울특별시': '서울', '서울시': '서울',
  '부산광역시': '부산', '부산시': '부산',
  '대구광역시': '대구', '대구시': '대구',
  '인천광역시': '인천', '인천시': '인천',
  '광주광역시': '광주', '광주시': '광주',
  '대전광역시': '대전', '대전시': '대전',
  '울산광역시': '울산', '울산시': '울산',
  '세종특별자치시': '세종', '세종시': '세종',
  '경기도': '경기',
  '강원도': '강원', '강원특별자치도': '강원',
  '충청북도': '충북', '충북도': '충북',
  '충청남도': '충남', '충남도': '충남',
  '전라북도': '전북', '전북특별자치도': '전북', '전북도': '전북',
  '전라남도': '전남', '전남도': '전남',
  '경상북도': '경북', '경북도': '경북',
  '경상남도': '경남', '경남도': '경남',
  '제주특별자치도': '제주', '제주도': '제주',
};

// ── "{sido} {division}" → code 맵 (e.g. "강원 강릉시" → "51150") ──
const nameToCode = {};
for (const entry of sggCodes) {
  nameToCode[entry.name] = entry.code;
}

function normalizeSido(city) {
  if (!city) return null;
  return SIDO_NORMALIZE[city] || city;
}

// 행정구역 통합/변경으로 인한 특수 매핑
const DIVISION_OVERRIDE = {
  // 부천시 구 통합 (2016) — 원미구/소사구/오정구 → 부천시
  '부천시 원미구': '부천시', '부천시 소사구': '부천시', '부천시 오정구': '부천시',
  // 화성시 행정구 신설 (2024) — 동탄구/만세구/병점구/효행구 → 화성시
  '화성시 동탄구': '화성시', '화성시 만세구': '화성시', '화성시 병점구': '화성시', '화성시 효행구': '화성시',
};

/**
 * division(시군구명)을 sgg-codes.json의 name 형식으로 변환.
 * 예: sido="강원", division="강릉시" → "강원 강릉시"
 * 다구도시: sido="경기", division="수원시 영통구" → "경기 수원영통구"
 */
function buildSggKey(sido, division) {
  if (!sido || !division) return null;
  // 세종은 특수 케이스
  if (sido === '세종') return '세종';
  // 행정구역 통합/변경 특수 매핑
  const override = DIVISION_OVERRIDE[division];
  if (override) division = override;
  // 다구 도시: "수원시 영통구" → "수원영통구"
  const multiGu = division.match(/^(.+시)\s+(.+구)$/);
  if (multiGu) {
    const cityPart = multiGu[1].replace('시', '');
    const guPart = multiGu[2];
    return `${sido} ${cityPart}${guPart}`;
  }
  return `${sido} ${division}`;
}

/**
 * 아파트명 정규화: 괄호 내용 제거, 공백 trim
 * e.g. "강림스위트빌(A동)" → "강림스위트빌"
 */
function normalizeAptName(name) {
  return name.replace(/\([^)]*\)/g, '').trim();
}

/**
 * Strategy 6: 토큰 기반 Jaccard 유사도 매칭
 * - 공백/쉼표/중점 제거, "차" → "단지" 정규화
 * - 한글 블록 + 숫자 단위로 토큰 분리
 * - Jaccard >= 0.7 → 매칭 후보
 */
function tokenNormalize(name) {
  return name
    .replace(/\([^)]*\)/g, '')  // 괄호 제거
    .replace(/[\s,·.]/g, '')    // 공백, 쉼표, 중점 제거
    .replace(/(\d+)차/g, '$1단지');  // 차 → 단지
}

function tokenize(normalized) {
  const tokens = new Set();
  // 한글 블록과 숫자(+단위) 블록으로 분리
  const parts = normalized.match(/[가-힣]+|\d+[가-힣]*/g) || [];
  for (const p of parts) {
    if (p.length >= 2 || /\d/.test(p)) tokens.add(p);
  }
  return tokens;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function main() {
  console.log(`=== populate-complex-sgg [${DRY_RUN ? 'DRY-RUN' : 'LIVE'}${FORCE ? ' FORCE' : ''}] ===\n`);
  const startTime = Date.now();

  // 1) sgg_cd 매핑
  console.log('Step 1: sgg_cd 매핑...');
  const whereClause = FORCE ? '' : 'AND sgg_cd IS NULL';
  const { rows: complexes } = await pool.query(`
    SELECT id, city, division FROM complexes WHERE is_active = true ${whereClause}
  `);
  console.log(`  대상: ${complexes.length}건`);

  let sggMatched = 0;
  let sggFailed = 0;
  const failedSggKeys = new Set();

  for (const c of complexes) {
    const sido = normalizeSido(c.city);
    const key = buildSggKey(sido, c.division);
    const code = key ? nameToCode[key] : null;

    if (code) {
      if (!DRY_RUN) {
        await pool.query('UPDATE complexes SET sgg_cd = $1 WHERE id = $2', [code, c.id]);
      }
      sggMatched++;
    } else {
      sggFailed++;
      if (key) failedSggKeys.add(key);
    }
  }

  console.log(`  → 매핑 성공: ${sggMatched}건, 실패: ${sggFailed}건`);
  if (failedSggKeys.size > 0 && failedSggKeys.size <= 20) {
    console.log(`  → 실패 키: ${[...failedSggKeys].join(', ')}`);
  }

  // 2) rt_apt_nm 매핑 (5-strategy batch matching)
  console.log('\nStep 2: rt_apt_nm 매핑...');
  const rtWhereClause = FORCE ? 'AND sgg_cd IS NOT NULL' : 'AND sgg_cd IS NOT NULL AND rt_apt_nm IS NULL';
  const { rows: targets } = await pool.query(`
    SELECT c.id, c.complex_name, c.sgg_cd, c.sector
    FROM complexes c
    WHERE c.is_active = true ${rtWhereClause}
  `);
  console.log(`  대상: ${targets.length}건`);

  if (targets.length === 0) {
    console.log('  → 매핑 대상 없음');
  } else {
    // Pre-load article areas for all target complexes
    const targetIds = targets.map(t => t.id);
    const { rows: artAreas } = await pool.query(`
      SELECT complex_id, min(exclusive_space) AS min_area, max(exclusive_space) AS max_area
      FROM articles
      WHERE complex_id = ANY($1) AND article_status = 'active' AND exclusive_space > 0
      GROUP BY complex_id
    `, [targetIds]);
    const complexAreaMap = new Map(artAreas.map(r => [r.complex_id, { min: parseFloat(r.min_area), max: parseFloat(r.max_area) }]));

    // Group targets by sgg_cd
    const bySgg = new Map();
    for (const t of targets) {
      if (!bySgg.has(t.sgg_cd)) bySgg.set(t.sgg_cd, []);
      bySgg.get(t.sgg_cd).push(t);
    }

    let rtExact = 0, rtLike = 0, rtLikeNoSuffix = 0, rtDongLike = 0, rtDongArea = 0, rtToken = 0, rtFailed = 0;
    let sggIdx = 0;

    for (const [sggCd, sggTargets] of bySgg) {
      sggIdx++;
      if (sggIdx % 50 === 0) {
        console.log(`  처리중: ${sggIdx}/${bySgg.size} sgg_cd...`);
      }

      // Pre-load all apt_nm + counts for this sgg_cd
      const { rows: aptRows } = await pool.query(`
        SELECT apt_nm, count(*)::int AS cnt
        FROM real_transactions
        WHERE sgg_cd = $1
        GROUP BY apt_nm
      `, [sggCd]);

      const aptCountMap = new Map(aptRows.map(r => [r.apt_nm, r.cnt]));
      // Pre-compute normalized versions for LIKE matching
      const aptNamesNorm = aptRows.map(r => ({
        orig: r.apt_nm,
        norm: normalizeAptName(r.apt_nm),
        cnt: r.cnt,
      }));

      // Pre-load dong-level data: umd_nm → [{apt_nm, cnt}]
      const { rows: dongRows } = await pool.query(`
        SELECT umd_nm, apt_nm, count(*)::int AS cnt
        FROM real_transactions
        WHERE sgg_cd = $1
        GROUP BY umd_nm, apt_nm
      `, [sggCd]);

      const dongAptMap = new Map();
      for (const r of dongRows) {
        if (!dongAptMap.has(r.umd_nm)) dongAptMap.set(r.umd_nm, []);
        dongAptMap.get(r.umd_nm).push({ apt_nm: r.apt_nm, cnt: r.cnt });
      }

      // Pre-load area ranges per apt_nm for strategy 5
      const { rows: areaRows } = await pool.query(`
        SELECT apt_nm, min(exclu_use_ar) AS min_area, max(exclu_use_ar) AS max_area
        FROM real_transactions
        WHERE sgg_cd = $1
        GROUP BY apt_nm
      `, [sggCd]);
      const txAreaMap = new Map(areaRows.map(r => [r.apt_nm, { min: parseFloat(r.min_area), max: parseFloat(r.max_area) }]));

      const updates = [];

      for (const c of sggTargets) {
        const name = c.complex_name;
        const nameNorm = normalizeAptName(name);
        let matched = null;
        let strategy = null;

        // Strategy 1: exact match (apt_nm = complex_name)
        if (aptCountMap.has(name)) {
          matched = name;
          strategy = 'exact';
        }

        // Strategy 2: LIKE containment match (complex_name ⊂ apt_nm OR apt_nm ⊂ complex_name)
        // Require shorter string to be >= 30% of longer to avoid "한신" matching "대신공원한신휴플러스"
        if (!matched && nameNorm.length >= 2) {
          const candidates = [];
          for (const entry of aptNamesNorm) {
            if (entry.norm.length < 2) continue;
            const shorter = Math.min(nameNorm.length, entry.norm.length);
            const longer = Math.max(nameNorm.length, entry.norm.length);
            if (shorter / longer < 0.3) continue;
            if (entry.norm.includes(nameNorm) || nameNorm.includes(entry.norm)) {
              candidates.push(entry);
            }
          }
          if (candidates.length > 0) {
            candidates.sort((a, b) => b.cnt - a.cnt);
            matched = candidates[0].orig;
            strategy = 'like';
          }
        }

        // Strategy 3: 차수 제거 후 LIKE match ("넥서스빌2차" → "넥서스빌")
        if (!matched) {
          const nameNoOrdinal = nameNorm.replace(/\d+차$/, '');
          if (nameNoOrdinal !== nameNorm && nameNoOrdinal.length >= 2) {
            const candidates = [];
            for (const entry of aptNamesNorm) {
              if (entry.norm.length < 2) continue;
              const shorter = Math.min(nameNoOrdinal.length, entry.norm.length);
              const longer = Math.max(nameNoOrdinal.length, entry.norm.length);
              if (shorter / longer < 0.3) continue;
              if (entry.norm.includes(nameNoOrdinal) || nameNoOrdinal.includes(entry.norm)) {
                candidates.push(entry);
              }
            }
            if (candidates.length > 0) {
              candidates.sort((a, b) => b.cnt - a.cnt);
              matched = candidates[0].orig;
              strategy = 'like_nosuffix';
            }
          }
        }

        // Strategy 4: dong + LIKE match (sgg_cd + umd_nm 필터 후 containment)
        if (!matched && c.sector) {
          const dongName = c.sector.replace(/\d+가$/, '');
          const dongCandidates = dongAptMap.get(dongName) || [];
          const dongNorm = dongCandidates.map(d => ({ ...d, norm: normalizeAptName(d.apt_nm) }));

          let candidates = [];
          for (const entry of dongNorm) {
            if (entry.norm.length < 2) continue;
            const shorter = Math.min(nameNorm.length, entry.norm.length);
            const longer = Math.max(nameNorm.length, entry.norm.length);
            if (shorter / longer < 0.3) continue;
            if (entry.norm.includes(nameNorm) || nameNorm.includes(entry.norm)) {
              candidates.push(entry);
            }
          }
          // Also try without ordinal suffix
          if (candidates.length === 0) {
            const nameNoOrdinal = nameNorm.replace(/\d+차$/, '');
            if (nameNoOrdinal !== nameNorm && nameNoOrdinal.length >= 2) {
              for (const entry of dongNorm) {
                if (entry.norm.length < 2) continue;
                const shorter2 = Math.min(nameNoOrdinal.length, entry.norm.length);
                const longer2 = Math.max(nameNoOrdinal.length, entry.norm.length);
                if (shorter2 / longer2 < 0.3) continue;
                if (entry.norm.includes(nameNoOrdinal) || nameNoOrdinal.includes(entry.norm)) {
                  candidates.push(entry);
                }
              }
            }
          }
          if (candidates.length > 0) {
            candidates.sort((a, b) => b.cnt - a.cnt);
            matched = candidates[0].apt_nm;
            strategy = 'dong_like';
          }
        }

        // Strategy 5: dong + area-based most frequent (이름 무관, 같은 동에서 면적 겹치는 단지)
        if (!matched && c.sector) {
          const artArea = complexAreaMap.get(c.id);
          if (artArea) {
            const dongName = c.sector.replace(/\d+가$/, '');
            const dongCandidates = dongAptMap.get(dongName) || [];
            const candidates = [];
            for (const cand of dongCandidates) {
              const txArea = txAreaMap.get(cand.apt_nm);
              if (txArea) {
                const overlapOk =
                  txArea.min <= artArea.max * 1.2 &&
                  txArea.max >= artArea.min * 0.8;
                if (overlapOk) {
                  candidates.push(cand);
                }
              }
            }
            if (candidates.length === 1) {
              matched = candidates[0].apt_nm;
              strategy = 'dong_area';
            }
          }
        }

        // Strategy 6: 정규화 토큰 Jaccard 매칭
        if (!matched && nameNorm.length >= 3) {
          const nameTokenNorm = tokenNormalize(name);
          const nameTokens = tokenize(nameTokenNorm);
          if (nameTokens.size >= 2) {
            let bestSim = 0;
            let bestCandidate = null;
            for (const entry of aptNamesNorm) {
              if (entry.norm.length < 3) continue;
              const entryTokenNorm = tokenNormalize(entry.orig);
              const entryTokens = tokenize(entryTokenNorm);
              if (entryTokens.size < 2) continue;
              const sim = jaccardSimilarity(nameTokens, entryTokens);
              if (sim >= 0.7 && sim > bestSim) {
                bestSim = sim;
                bestCandidate = entry;
              }
            }
            if (bestCandidate) {
              matched = bestCandidate.orig;
              strategy = 'token';
            }
          }
        }

        if (matched) {
          updates.push({ id: c.id, apt_nm: matched });
          switch (strategy) {
            case 'exact': rtExact++; break;
            case 'like': rtLike++; break;
            case 'like_nosuffix': rtLikeNoSuffix++; break;
            case 'dong_like': rtDongLike++; break;
            case 'dong_area': rtDongArea++; break;
            case 'token': rtToken++; break;
          }
        } else {
          rtFailed++;
        }
      }

      // Batch UPDATE for this sgg_cd
      if (!DRY_RUN && updates.length > 0) {
        const ids = updates.map(u => u.id);
        const names = updates.map(u => u.apt_nm);
        await pool.query(`
          UPDATE complexes SET rt_apt_nm = t.apt_nm
          FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS apt_nm) t
          WHERE complexes.id = t.id
        `, [ids, names]);
      }
    }

    const totalMatched = rtExact + rtLike + rtLikeNoSuffix + rtDongLike + rtDongArea + rtToken;
    console.log(`  → exact: ${rtExact}, like: ${rtLike}, like_nosuffix: ${rtLikeNoSuffix}, dong_like: ${rtDongLike}, dong_area: ${rtDongArea}, token: ${rtToken}`);
    console.log(`  → 총 매칭: ${totalMatched}/${targets.length}건 (${((totalMatched / targets.length) * 100).toFixed(1)}%), 실패: ${rtFailed}`);
  }

  // 3) Summary
  const { rows: [summary] } = await pool.query(`
    SELECT
      count(*) FILTER (WHERE sgg_cd IS NOT NULL)::int AS has_sgg,
      count(*) FILTER (WHERE rt_apt_nm IS NOT NULL)::int AS has_rt,
      count(*)::int AS total
    FROM complexes WHERE is_active = true
  `);
  console.log(`\nSummary: sgg_cd=${summary.has_sgg}/${summary.total}, rt_apt_nm=${summary.has_rt}/${summary.total}`);

  // 4) real_transactions.complex_id 일괄 반영
  console.log('\nStep 3: real_transactions.complex_id 일괄 반영...');
  if (!DRY_RUN) {
    const { rowCount } = await pool.query(`
      UPDATE real_transactions rt
      SET complex_id = c.id
      FROM complexes c
      WHERE c.sgg_cd = rt.sgg_cd AND c.rt_apt_nm = rt.apt_nm AND c.is_active = true
        AND rt.complex_id IS NULL
    `);
    console.log(`  → ${rowCount}건 반영`);
  } else {
    const { rows: [est] } = await pool.query(`
      SELECT count(*)::int AS cnt
      FROM real_transactions rt
      JOIN complexes c ON c.sgg_cd = rt.sgg_cd AND c.rt_apt_nm = rt.apt_nm AND c.is_active = true
      WHERE rt.complex_id IS NULL
    `);
    console.log(`  → (dry-run) ${est.cnt}건 반영 예정`);
  }

  // complex_id 매칭률 확인
  const { rows: [rtSummary] } = await pool.query(`
    SELECT count(*)::int AS total,
      count(complex_id)::int AS matched,
      round(count(complex_id)::numeric / count(*)::numeric * 100, 1) AS pct
    FROM real_transactions
  `);
  console.log(`  real_transactions: ${rtSummary.matched}/${rtSummary.total} (${rtSummary.pct}%)`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n완료 (${elapsed}초)`);
  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
