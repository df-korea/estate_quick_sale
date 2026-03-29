/**
 * KB 부동산 매매가격지수 수집 스크립트
 * - 매주 금요일 크론으로 실행 (KB 발표일)
 * - 시도 + 전체 시군구 가격지수 + 변동률 수집
 * - DB: kb_price_index 테이블에 저장
 *
 * 사용법: node scripts/kb-price-index-collect.mjs
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '8081'),
  database: 'estate_quick_sale',
  user: process.env.PGUSER || 'estate_app',
  password: process.env.PGPASSWORD || '',
});

const KB_API_BASE = 'https://data-api.kbland.kr/bfmstat/weekMnthlyHuseTrnd/priceIndex';

// 시도 지역코드 목록
const SIDO_CODES = [
  '1100000000', '2600000000', '2700000000', '2800000000',
  '2900000000', '3000000000', '3100000000', '3600000000',
  '4100000000', '4300000000', '4400000000', '4600000000',
  '4700000000', '4800000000', '5000000000', '5100000000',
  '5200000000',
];

function buildUrl(regionCode = '') {
  const params = new URLSearchParams({
    '기간': '2',
    '매매전세코드': '01',        // 매매
    '매물종별구분': '01',        // 아파트
    '월간주간구분코드': '02',    // 주간
    '지역코드': regionCode,
    '조회시작일자': '',
    '조회종료일자': '',
    'type': 'false',
    '메뉴코드': '1',
  });
  return `${KB_API_BASE}?${params}`;
}

async function fetchKbData(regionCode = '') {
  const url = buildUrl(regionCode);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KB API error: ${res.status}`);
  const json = await res.json();

  if (json.dataHeader?.resultCode !== '10000') {
    throw new Error(`KB API error: ${json.dataHeader?.message}`);
  }

  return json.dataBody.data;
}

async function upsertIndex(client, record) {
  await client.query(`
    INSERT INTO kb_price_index (region_code, region_name, parent_code, date, price_index, change_rate, deal_type)
    VALUES ($1, $2, $3, $4, $5, $6, '01')
    ON CONFLICT (region_code, date, deal_type) DO UPDATE SET
      price_index = EXCLUDED.price_index,
      change_rate = EXCLUDED.change_rate,
      created_at = NOW()
  `, [record.region_code, record.region_name, record.parent_code, record.date, record.price_index, record.change_rate]);
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('[KB 가격지수] 수집 시작...');

    // 1. 시도 레벨 데이터 수집
    console.log('\n[1/2] 시도 레벨 수집...');
    const sidoData = await fetchKbData('');
    const dates = sidoData['날짜리스트'];
    const latestDate = dates[dates.length - 1];
    console.log(`  업데이트일자: ${sidoData['업데이트일자']}, 최신 조사일: ${latestDate}`);

    let sidoCount = 0;
    for (const region of sidoData['데이터리스트']) {
      const code = region['지역코드'];
      const name = region['지역명'];
      const vals = region['dataList'];

      // 마지막 값 = 변동률, 그 직전 = 최신 가격지수
      const changeRate = vals[vals.length - 1];
      const priceIndex = vals[vals.length - 2];

      // 그룹 코드(강북14개구 등) 제외, 시도급만
      if (code.length !== 10) continue;

      await upsertIndex(client, {
        region_code: code,
        region_name: name,
        parent_code: null,
        date: latestDate,
        price_index: priceIndex,
        change_rate: changeRate,
      });
      sidoCount++;

      // 히스토리도 저장 (최근 10주)
      for (let i = Math.max(0, dates.length - 10); i < dates.length; i++) {
        await upsertIndex(client, {
          region_code: code,
          region_name: name,
          parent_code: null,
          date: dates[i],
          price_index: vals[i],
          change_rate: (i > 0 && vals[i-1] && isFinite(vals[i-1]) && vals[i-1] !== 0) ? parseFloat(((vals[i] - vals[i-1]) / vals[i-1] * 100).toFixed(4)) : 0,
        });
      }
    }
    console.log(`  시도 ${sidoCount}개 저장 완료`);

    // 2. 시군구 레벨 데이터 수집
    console.log('\n[2/2] 시군구 레벨 수집...');
    let sggCount = 0;

    for (const sidoCode of SIDO_CODES) {
      const sggData = await fetchKbData(sidoCode);
      const sggDates = sggData['날짜리스트'];
      const sidoName = sggData['데이터리스트']?.[0]?.['지역명'] || sidoCode;

      for (const region of sggData['데이터리스트']) {
        const code = region['지역코드'];
        const name = region['지역명'];
        const vals = region['dataList'];

        const changeRate = vals[vals.length - 1];
        const priceIndex = vals[vals.length - 2];
        const sggLatestDate = sggDates[sggDates.length - 1];

        await upsertIndex(client, {
          region_code: code,
          region_name: name,
          parent_code: sidoCode,
          date: sggLatestDate,
          price_index: priceIndex,
          change_rate: changeRate,
        });
        sggCount++;

        // 히스토리 최근 10주
        for (let i = Math.max(0, sggDates.length - 10); i < sggDates.length; i++) {
          await upsertIndex(client, {
            region_code: code,
            region_name: name,
            parent_code: sidoCode,
            date: sggDates[i],
            price_index: vals[i],
            change_rate: (i > 0 && vals[i-1] && isFinite(vals[i-1]) && vals[i-1] !== 0) ? parseFloat(((vals[i] - vals[i-1]) / vals[i-1] * 100).toFixed(4)) : 0,
          });
        }
      }

      // Rate limit: 500ms between requests
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(`  시군구 ${sggCount}개 저장 완료`);

    console.log(`\n[KB 가격지수] 수집 완료! 시도 ${sidoCount} + 시군구 ${sggCount} = ${sidoCount + sggCount}건`);

  } catch (err) {
    console.error('[KB 가격지수] 에러:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
