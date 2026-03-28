const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const PROPERTY_ID = '526743225';
const KEY_FILE = __dirname + '/credentials.json';
const client = new BetaAnalyticsDataClient({ keyFilename: KEY_FILE });

async function run(title, req) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
  try {
    const [res] = await client.runReport(req);
    if (!res.rows?.length) { console.log('  (데이터 없음)'); return; }
    const dims = (res.dimensionHeaders || []).map(h => h.name);
    const mets = (res.metricHeaders || []).map(h => h.name);
    console.log(`  ${[...dims, ...mets].join('\t')}`);
    console.log(`  ${'-'.repeat(80)}`);
    for (const row of res.rows) {
      const d = (row.dimensionValues || []).map(v => v.value);
      const m = (row.metricValues || []).map(v => v.value);
      console.log(`  ${[...d, ...m].join('\t')}`);
    }
  } catch (e) { console.error(`  오류: ${e.message}`); }
}

const prop = `properties/${PROPERTY_ID}`;
const range = [{ startDate: '30daysAgo', endDate: 'today' }];

async function main() {
  // 1. 신규 사용자의 첫 유입 경로 (firstUserSource)
  await run('1. 신규 사용자 - 첫 유입 경로', {
    property: prop, dateRanges: range,
    dimensions: [{ name: 'firstUserSource' }, { name: 'firstUserMedium' }],
    metrics: [{ name: 'newUsers' }, { name: 'sessions' }, { name: 'bounceRate' }],
    dimensionFilter: {
      filter: { fieldName: 'newVsReturning', stringFilter: { matchType: 'EXACT', value: 'new' } },
    },
    orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
    limit: 15,
  });

  // 2. 신규 사용자가 처음 도착한 페이지 (어떤 페이지로 유입?)
  await run('2. 신규 사용자 - 첫 방문 페이지 (Landing Page)', {
    property: prop, dateRanges: range,
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'newUsers' }, { name: 'sessions' }, { name: 'bounceRate' }],
    dimensionFilter: {
      filter: { fieldName: 'newVsReturning', stringFilter: { matchType: 'EXACT', value: 'new' } },
    },
    orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
    limit: 20,
  });

  // 3. 구글 검색으로 들어온 신규 사용자의 Landing Page
  await run('3. 구글 검색 유입 신규 사용자 - Landing Page', {
    property: prop, dateRanges: range,
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'newUsers' }, { name: 'sessions' }, { name: 'averageSessionDuration' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { filter: { fieldName: 'newVsReturning', stringFilter: { matchType: 'EXACT', value: 'new' } } },
          { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT', value: 'organic' } } },
          { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'EXACT', value: 'google' } } },
        ],
      },
    },
    orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
    limit: 20,
  });

  // 4. 네이버 검색으로 들어온 신규 사용자의 Landing Page
  await run('4. 네이버 검색 유입 신규 사용자 - Landing Page', {
    property: prop, dateRanges: range,
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'newUsers' }, { name: 'sessions' }, { name: 'averageSessionDuration' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { filter: { fieldName: 'newVsReturning', stringFilter: { matchType: 'EXACT', value: 'new' } } },
          { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'naver' } } },
        ],
      },
    },
    orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
    limit: 20,
  });

  // 5. 페이지 referrer (sessionSource 상세)
  await run('5. 전체 유입 레퍼러 상세', {
    property: prop, dateRanges: range,
    dimensions: [{ name: 'pageReferrer' }],
    metrics: [{ name: 'sessions' }, { name: 'newUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  // 6. 일별 신규 유입 추이
  await run('6. 일별 신규 유입 추이 (소스별)', {
    property: prop, dateRanges: range,
    dimensions: [{ name: 'date' }, { name: 'firstUserSource' }],
    metrics: [{ name: 'newUsers' }],
    dimensionFilter: {
      filter: { fieldName: 'newVsReturning', stringFilter: { matchType: 'EXACT', value: 'new' } },
    },
    orderBys: [
      { dimension: { dimensionName: 'date', orderType: 'ALPHANUMERIC' } },
      { metric: { metricName: 'newUsers' }, desc: true },
    ],
    limit: 50,
  });

  console.log('\n\n분석 완료!\n');
}

main().catch(console.error);
