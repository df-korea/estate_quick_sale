# Estate Quick Sale - CLAUDE.md

## GA4 분석 (ga4/ 디렉토리)

GA4 Data API v1을 사용한 웹 트래픽 분석 도구.

- **Property ID**: 526743225 (`.env`의 `GA4_PROPERTY_ID`)
- **인증**: `ga4/credentials.json` (GCP 서비스 계정 키)
- **패키지**: `@google-analytics/data`, `chartjs-node-canvas`, `pdfkit`

### 스크립트

| 명령어 | 설명 |
|--------|------|
| `node ga4/report.cjs` | 콘솔 출력 - 일별 트래픽, 인기 페이지, 유입 경로, 기기, 도시, 이벤트 등 |
| `node ga4/retention.cjs` | 콘솔 출력 - 신규/재방문 분석, 참여도, 주차별 추이 |
| `node ga4/acquisition.cjs` | 콘솔 출력 - 신규 유입 경로, Landing Page, 레퍼러 분석 |
| `node ga4/pdf-report.cjs` | **PDF 리포트 생성** → `ga4/report.pdf` (한국어, 차트 10개 + 테이블 + 인사이트) |

### GA4 API 사용 패턴

```js
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const client = new BetaAnalyticsDataClient({ keyFilename: 'ga4/credentials.json' });
const [response] = await client.runReport({
  property: 'properties/526743225',
  dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
  dimensions: [{ name: 'date' }],
  metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
});
```

### 검색어(키워드) 확인

GA4에서는 검색어를 볼 수 없음 (암호화됨). 아래 도구 사용:
- **구글**: Google Search Console (search.google.com/search-console)
- **네이버**: 네이버 서치어드바이저 (searchadvisor.naver.com)

### 한글 폰트

PDF 한글 렌더링용 `ga4/NotoSansKR-Regular.ttf`, `ga4/NotoSansKR-Bold.ttf` 포함.

### 사용법 (CDP 모드 — 필수)

이 서버에서는 snap Chromium의 샌드박스 제한으로 agent-browser 내장 데몬이 작동하지 않음.
**반드시 Chromium을 CDP 모드로 먼저 실행한 뒤 `--cdp 9222`로 연결해야 함.**

```bash
# 1단계: Chromium CDP 모드로 실행 (백그라운드)
chromium-browser --headless=new --no-sandbox --remote-debugging-port=9222 \
  --disable-gpu --ozone-platform=headless &>/dev/null &
sleep 5

# 2단계: agent-browser로 CDP 연결하여 사용
agent-browser --cdp 9222 open https://example.com
agent-browser --cdp 9222 snapshot           # 접근성 트리 (AI 분석용)
agent-browser --cdp 9222 snapshot -i        # 인터랙티브 요소만
agent-browser --cdp 9222 click @e2          # @ref 클릭
agent-browser --cdp 9222 fill @e3 "입력값"
agent-browser --cdp 9222 screenshot page.png
agent-browser --cdp 9222 screenshot --full  # 전체 페이지
agent-browser --cdp 9222 get text @e1
agent-browser --cdp 9222 get url
agent-browser --cdp 9222 eval "document.title"

# 종료
agent-browser --cdp 9222 close
pkill -9 chromium 2>/dev/null
```