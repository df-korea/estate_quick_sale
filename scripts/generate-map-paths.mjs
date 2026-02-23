#!/usr/bin/env node
/**
 * One-time script: Download TopoJSON from southkorea-maps GitHub repo,
 * convert to SVG paths using d3-geo, and output TypeScript files.
 *
 * Usage: node scripts/generate-map-paths.mjs
 * Dependencies: topojson-client, d3-geo (devDeps)
 *
 * Outputs:
 *   apps/miniapp/src/data/sido-paths.ts
 *   apps/miniapp/src/data/sigungu-paths.ts
 */

import { writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as topojson from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'apps', 'miniapp', 'src', 'data');

const SIDO_URL = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-topo-simple.json';
const SGG_URL = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo-simple.json';

// ── KOSTAT statistical code → SGG admin code mapping ──
// Both province-level and municipality-level use the same KOSTAT statistical codes
const KOSTAT_TO_SGG = {
  '11': { name: '서울', sggSidoCode: '11' },
  '21': { name: '부산', sggSidoCode: '26' },
  '22': { name: '대구', sggSidoCode: '27' },
  '23': { name: '인천', sggSidoCode: '28' },
  '24': { name: '광주', sggSidoCode: '29' },
  '25': { name: '대전', sggSidoCode: '30' },
  '26': { name: '울산', sggSidoCode: '31' },
  '29': { name: '세종', sggSidoCode: '36' },
  '31': { name: '경기', sggSidoCode: '41' },
  '32': { name: '강원', sggSidoCode: '51' },
  '33': { name: '충북', sggSidoCode: '43' },
  '34': { name: '충남', sggSidoCode: '44' },
  '35': { name: '전북', sggSidoCode: '52' },
  '36': { name: '전남', sggSidoCode: '46' },
  '37': { name: '경북', sggSidoCode: '47' },
  '38': { name: '경남', sggSidoCode: '48' },
  '39': { name: '제주', sggSidoCode: '50' },
};

// ── Load sgg-codes.json ──
const sggCodes = JSON.parse(readFileSync(join(__dirname, 'data', 'sgg-codes.json'), 'utf-8'));

// Build lookup: "sido_localName" → sgg_cd
const sggLookup = new Map();
for (const entry of sggCodes) {
  const localName = entry.name === entry.sido ? entry.name : entry.name.replace(`${entry.sido} `, '');
  sggLookup.set(`${entry.sido}_${localName}`, entry.code);
}

// Build reverse lookup: sido → [{ localName, code }]
const sidoEntries = new Map();
for (const entry of sggCodes) {
  const localName = entry.name === entry.sido ? entry.name : entry.name.replace(`${entry.sido} `, '');
  if (!sidoEntries.has(entry.sido)) sidoEntries.set(entry.sido, []);
  sidoEntries.get(entry.sido).push({ localName, code: entry.code });
}

function findSggCd(kostatName, sidoName) {
  // Strategy 1: Direct match
  const key = `${sidoName}_${kostatName}`;
  if (sggLookup.has(key)) return sggLookup.get(key);

  // Strategy 2: Remove "시" in city-district names
  // "수원시장안구" → "수원장안구", "청주시상당구" → "청주상당구"
  if (kostatName.endsWith('구') || kostatName.endsWith('군')) {
    const noSi = kostatName.replace(/시/, '');
    const key2 = `${sidoName}_${noSi}`;
    if (sggLookup.has(key2)) return sggLookup.get(key2);
  }

  // Strategy 3: Remove "시" suffix for matching
  // "세종시" → "세종"
  if (kostatName.endsWith('시')) {
    const noSiSuffix = kostatName.replace(/시$/, '');
    const key3 = `${sidoName}_${noSiSuffix}`;
    if (sggLookup.has(key3)) return sggLookup.get(key3);
  }

  // Strategy 4: Match by ends-with within sido
  const entries = sidoEntries.get(sidoName) || [];
  const endsWith = entries.filter(e => e.localName.endsWith(kostatName));
  if (endsWith.length === 1) return endsWith[0].code;

  // Strategy 5: Match sgg entry that contains the kostat name (or vice versa)
  const contains = entries.filter(e =>
    e.localName.includes(kostatName) || kostatName.includes(e.localName)
  );
  if (contains.length === 1) return contains[0].code;

  // Strategy 6: Normalize both sides (remove 시) then match
  if (kostatName.endsWith('구') || kostatName.endsWith('군')) {
    const kostatNorm = kostatName.replace(/시/g, '');
    const match = entries.find(e => e.localName === kostatNorm);
    if (match) return match.code;
  }

  return null;
}

// Round all decimal numbers in SVG path string to integers
function roundPath(d) {
  return d.replace(/(\d+)\.\d+/g, '$1');
}

async function fetchJson(url) {
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function main() {
  console.log('=== SVG Map Path Generator ===\n');

  console.log('1. Downloading TopoJSON data...');
  const [sidoTopo, sggTopo] = await Promise.all([
    fetchJson(SIDO_URL),
    fetchJson(SGG_URL),
  ]);

  console.log('\n2. Converting to GeoJSON...');
  const sidoObjKey = Object.keys(sidoTopo.objects)[0];
  const sggObjKey = Object.keys(sggTopo.objects)[0];

  const sidoGeo = topojson.feature(sidoTopo, sidoTopo.objects[sidoObjKey]);
  const sggGeo = topojson.feature(sggTopo, sggTopo.objects[sggObjKey]);
  console.log(`   Sido: ${sidoGeo.features.length}, Sigungu: ${sggGeo.features.length}`);

  console.log('\n3. Creating Mercator projection...');
  const WIDTH = 800;
  const HEIGHT = 1000;
  const projection = geoMercator().fitSize([WIDTH, HEIGHT], sidoGeo);
  const pathGen = geoPath(projection);
  const viewBox = `0 0 ${WIDTH} ${HEIGHT}`;

  // ── Generate sido paths ──
  console.log('\n4. Generating sido SVG paths...');
  const sidoResults = [];
  for (const feature of sidoGeo.features) {
    const kostatCode = feature.properties.code;
    const mapping = KOSTAT_TO_SGG[kostatCode];
    if (!mapping) { console.log(`   WARNING: Unknown sido code ${kostatCode}`); continue; }
    const d = pathGen(feature);
    if (!d) continue;
    const centroid = projection(geoCentroid(feature));
    sidoResults.push({
      code: mapping.sggSidoCode,
      name: mapping.name,
      path: roundPath(d),
      cx: Math.round(centroid[0]),
      cy: Math.round(centroid[1]),
    });
  }
  console.log(`   Generated ${sidoResults.length} sido paths.`);

  // ── Generate sigungu paths ──
  console.log('\n5. Generating sigungu SVG paths...');
  const sggResults = [];
  let matched = 0, unmatched = 0;
  const unmatchedList = [];

  for (const feature of sggGeo.features) {
    const kostatCode = feature.properties.code;
    const kostatPrefix = kostatCode.substring(0, 2);
    const mapping = KOSTAT_TO_SGG[kostatPrefix];

    if (!mapping) {
      console.log(`   WARNING: Unknown prefix ${kostatPrefix} for ${feature.properties.name}`);
      continue;
    }

    const sidoName = mapping.name;
    const sggSidoCode = mapping.sggSidoCode;
    const name = feature.properties.name;

    const d = pathGen(feature);
    if (!d) continue;

    const centroid = projection(geoCentroid(feature));
    const sggCd = findSggCd(name, sidoName);

    if (sggCd) {
      matched++;
    } else {
      unmatched++;
      unmatchedList.push(`${sidoName} ${name} (kostat:${kostatCode})`);
    }

    sggResults.push({
      code: sggCd || kostatCode,
      name,
      sidoCode: sggSidoCode,
      path: roundPath(d),
      cx: Math.round(centroid[0]),
      cy: Math.round(centroid[1]),
    });
  }
  console.log(`   Generated ${sggResults.length} sigungu paths.`);
  console.log(`   Matched: ${matched}, Unmatched: ${unmatched}`);
  if (unmatchedList.length > 0) {
    console.log(`   Unmatched:`);
    unmatchedList.forEach(u => console.log(`     - ${u}`));
  }

  // ── Compute per-sido viewBoxes ──
  console.log('\n6. Computing per-sido viewBoxes...');
  const sigunguViewBoxes = {};
  const sidoGroups = new Map();
  for (const sgg of sggResults) {
    if (!sidoGroups.has(sgg.sidoCode)) sidoGroups.set(sgg.sidoCode, []);
    sidoGroups.get(sgg.sidoCode).push(sgg);
  }

  for (const [sidoCode, items] of sidoGroups) {
    const cxs = items.map(i => i.cx);
    const cys = items.map(i => i.cy);
    const minX = Math.min(...cxs);
    const maxX = Math.max(...cxs);
    const minY = Math.min(...cys);
    const maxY = Math.max(...cys);
    const rangeX = (maxX - minX) || 100;
    const rangeY = (maxY - minY) || 100;
    const padX = rangeX * 0.3;
    const padY = rangeY * 0.3;
    sigunguViewBoxes[sidoCode] = `${Math.round(minX - padX)} ${Math.round(minY - padY)} ${Math.round(rangeX + padX * 2)} ${Math.round(rangeY + padY * 2)}`;
  }

  // ── Extract projection parameters for frontend geo-projection ──
  const projCenter = projection.center();
  const projScale = projection.scale();
  const projTranslate = projection.translate();
  console.log(`\n   Projection: center=[${projCenter}], scale=${projScale}, translate=[${projTranslate}]`);

  // ── Write sido-paths.ts ──
  console.log('\n7. Writing sido-paths.ts...');
  const sidoTs = `// Auto-generated by scripts/generate-map-paths.mjs — DO NOT EDIT
export interface SidoPath {
  code: string;
  name: string;
  path: string;
  cx: number;
  cy: number;
}

export const sidoViewBox = '${viewBox}';

export const projectionParams = {
  center: [${projCenter[0]}, ${projCenter[1]}] as [number, number],
  scale: ${projScale},
  translate: [${projTranslate[0]}, ${projTranslate[1]}] as [number, number],
};

export const sidoPaths: SidoPath[] = ${JSON.stringify(sidoResults, null, 2)};
`;
  writeFileSync(join(OUT_DIR, 'sido-paths.ts'), sidoTs);
  console.log(`   Wrote ${sidoResults.length} sido entries.`);

  // ── Write sigungu-paths.ts ──
  console.log('\n8. Writing sigungu-paths.ts...');
  const sggTs = `// Auto-generated by scripts/generate-map-paths.mjs — DO NOT EDIT
export interface SigunguPath {
  code: string;
  name: string;
  sidoCode: string;
  path: string;
  cx: number;
  cy: number;
}

export const sigunguViewBoxes: Record<string, string> = ${JSON.stringify(sigunguViewBoxes, null, 2)};

export const sigunguPaths: SigunguPath[] = ${JSON.stringify(sggResults, null, 2)};
`;
  writeFileSync(join(OUT_DIR, 'sigungu-paths.ts'), sggTs);
  console.log(`   Wrote ${sggResults.length} sigungu entries.`);

  console.log('\n=== Done! ===');
}

main().catch(e => { console.error(e); process.exit(1); });
