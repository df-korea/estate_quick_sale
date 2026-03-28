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
      return response;
    }

    const dims = (response.dimensionHeaders || []).map(h => h.name);
    const mets = (response.metricHeaders || []).map(h => h.name);
    console.log(`\n  ${[...dims, ...mets].join('\t')}`);
    console.log(`  ${'-'.repeat(80)}`);

    for (const row of response.rows) {
      const dimValues = (row.dimensionValues || []).map(v => v.value);
      const metValues = (row.metricValues || []).map(v => v.value);
      console.log(`  ${[...dimValues, ...metValues].join('\t')}`);
    }
    return response;
  } catch (err) {
    console.error(`  오류: ${err.message}`);
  }
}

async function main() {
  // 1. 일별 신규 vs 재방문 비율 추이
  await runReport('일별 신규 vs 재방문 사용자 추이', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'date' },
      { name: 'newVsReturning' },
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date', orderType: 'ALPHANUMERIC' } }],
  });

  // 2. 재방문 사용자의 세션 수 분포 (1회, 2회, 3회...)
  await runReport('사용자당 세션 수 분포', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionCount' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
    ],
    orderBys: [{ dimension: { dimensionName: 'sessionCount', orderType: 'NUMERIC' } }],
    limit: 30,
  });

  // 3. 재방문 사용자가 주로 보는 페이지
  await runReport('재방문 사용자가 보는 페이지 TOP 15', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    dimensionFilter: {
      filter: {
        fieldName: 'newVsReturning',
        stringFilter: { matchType: 'EXACT', value: 'returning' },
      },
    },
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 15,
  });

  // 4. 주간별 사용자 (cohort 느낌)
  await runReport('주차별 신규/재방문 사용자', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'week' },
      { name: 'newVsReturning' },
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ dimension: { dimensionName: 'week', orderType: 'ALPHANUMERIC' } }],
  });

  // 5. 재방문 사용자의 유입 경로
  await runReport('재방문 사용자 유입 경로', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'newVsReturning',
        stringFilter: { matchType: 'EXACT', value: 'returning' },
      },
    },
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  // 6. 사용자 참여도 (engagement)
  await runReport('참여 세션 비율 (일별)', {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date', orderType: 'ALPHANUMERIC' } }],
  });

  console.log('\n\n✅ 리텐션 분석 완료!\n');
}

main().catch(console.error);
