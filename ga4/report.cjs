const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const PROPERTY_ID = '526743225';
const KEY_FILE = __dirname + '/credentials.json';

const client = new BetaAnalyticsDataClient({ keyFilename: KEY_FILE });

async function runReport(title, request) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${title}`);
  console.log('='.repeat(60));

  try {
    const [response] = await client.runReport(request);

    if (!response.rows || response.rows.length === 0) {
      console.log('  (데이터 없음)');
      return;
    }

    // 헤더
    const dims = (response.dimensionHeaders || []).map(h => h.name);
    const mets = (response.metricHeaders || []).map(h => h.name);
    const headers = [...dims, ...mets];
    console.log(`\n  ${headers.join('\t')}`);
    console.log(`  ${'-'.repeat(headers.join('\t').length + 10)}`);

    // 데이터
    for (const row of response.rows) {
      const dimValues = (row.dimensionValues || []).map(v => v.value);
      const metValues = (row.metricValues || []).map(v => v.value);
      console.log(`  ${[...dimValues, ...metValues].join('\t')}`);
    }

    console.log(`\n  총 ${response.rowCount || response.rows.length}개 행`);
  } catch (err) {
    console.error(`  오류: ${err.message}`);
  }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\nGA4 분석 리포트 - ${today}`);
  console.log(`Property ID: ${PROPERTY_ID}`);

  // 1. 최근 30일 일별 사용자 수 & 페이지뷰
  await runReport('최근 30일 일별 트래픽', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date', orderType: 'ALPHANUMERIC' } }],
  });

  // 2. 인기 페이지 TOP 20
  await runReport('인기 페이지 TOP 20', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 20,
  });

  // 3. 트래픽 소스 (유입 경로)
  await runReport('유입 경로별 트래픽', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 15,
  });

  // 4. 기기별 사용자
  await runReport('기기 카테고리별 사용자', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
  });

  // 5. 신규 vs 재방문
  await runReport('신규 vs 재방문 사용자', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'newVsReturning' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
    ],
  });

  // 6. 시간대별 트래픽
  await runReport('시간대별 트래픽 (24시간)', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'hour' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    orderBys: [{ dimension: { dimensionName: 'hour', orderType: 'ALPHANUMERIC' } }],
  });

  // 7. 도시별 사용자
  await runReport('도시별 사용자 TOP 15', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'city' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit: 15,
  });

  // 8. 이벤트별 카운트
  await runReport('이벤트별 발생 횟수 TOP 15', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'eventName' }],
    metrics: [
      { name: 'eventCount' },
      { name: 'totalUsers' },
    ],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 15,
  });

  // 9. 방문 페이지별 이탈률
  await runReport('방문 페이지별 이탈률 (세션 10+ 기준)', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'landingPage' }],
    metrics: [
      { name: 'sessions' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  console.log('\n\n✅ 리포트 생성 완료!\n');
}

main().catch(console.error);
