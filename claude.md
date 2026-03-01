# 부동산 급매 레이더 - 개발 가이드

## 아키텍처 (2채널: 토스 앱 + 웹)

```
토스 앱 유저 → .ait (apps/miniapp/) → estate-rader.com/api → DB
웹 브라우저  → Next.js (web/)       → estate-rader.com/api → DB
                                          ↑ 같은 서버 (port 3001)
```

- **토스 미니앱**: `apps/miniapp/` — React + Vite + Granite, `.ait`로 빌드/배포 (변경 금지)
- **웹 프론트**: `web/` — Next.js 16 App Router, SSR + 동적 OG 태그
- **API 핸들러**: `api/` — 토스/웹 양쪽에서 공유 (JSON 스키마 변경 금지)
- **서버**: Next.js가 port 3001에서 프론트 + API 모두 서빙 (PM2 `estate-web`)
- **DB**: PostgreSQL 17 (localhost:8081, user=estate_app)
- **도메인**: `estate-rader.com` via Cloudflare Tunnel → 127.0.0.1:3001

## 절대 규칙

- `apps/miniapp/` 코드 변경 금지 (토스 앱 전용, 별도 빌드 체계)
- `api/` 응답 JSON 스키마 변경 금지 (토스 앱 호환 깨짐)
- `scripts/` 디렉토리 변경 금지 (수집 스크립트)
- DB 스키마 변경 금지
- `.env` 환경변수 구조 유지

## 빌드 & 배포

### 웹 (Next.js)
```bash
cd web && npm run build        # next build --webpack
pm2 restart estate-web         # 또는 pm2 start ecosystem.config.cjs
```

### 토스 미니앱 (.ait)
```bash
cd apps/miniapp
npx granite build
npx ait deploy --api-key "$TOSS_AIT_API_KEY"
```
- 배포 후 `intoss-private://...` 스킴으로 토스앱에서 테스트
- 토스 콘솔에서 "검토 요청" → 승인 후 "출시하기"

### 동시 배포 시 순서
1. `api/` 변경 → `cd web && npm run build && pm2 restart estate-web`
2. 웹 확인 후 → `cd apps/miniapp && npx granite build && npx ait deploy --api-key "$TOSS_AIT_API_KEY"`
3. API 변경이 없으면 각각 독립 배포 가능

## 주요 파일

| 용도 | 경로 |
|------|------|
| API 라우트 핸들러 (공유) | `api/_lib/routes.js` (~1600줄) |
| DB 풀 | `api/_lib/db.js` |
| 캐시 (인메모리 TTL) | `api/_lib/cache.js` |
| CORS | `api/_lib/cors.js` |
| Next.js 설정 | `web/next.config.ts` (webpack `@api` alias) |
| API 어댑터 | `web/src/lib/handler-adapter.ts` |
| SSR 쿼리 | `web/src/lib/queries.ts` |
| 웹 인증 | `web/src/components/AuthProvider.tsx` (Context) |
| PM2 설정 | `ecosystem.config.cjs` |
| 환경변수 | `.env` (web/.env는 심볼릭 링크) |

## API 라우트 구조 (web/)

- `web/src/app/api/[...path]/route.ts` → `api/_lib/routes.js`의 `route()` 위임
- `web/src/app/api/auth/{login,logout,me}/route.ts` → 개별 핸들러
- `web/src/app/api/toss/disconnect/route.ts` → 개별 핸들러
- webpack `@api` alias로 `../api/` 밖의 파일 import

## 캐시 (api/_lib/cache.js)

인메모리 `Map`, PM2 재시작 시 초기화. 토스/웹 동일 캐시 공유 (같은 프로세스).

| 대상 | 캐시 키 | TTL |
|------|---------|-----|
| 브리핑 | `briefing` | 5분 |
| 급매 건수 | `bargains:count` | 5분 |
| 지역별 급매 | `bargains:by-region:{limit}` | 5분 |
| 시도 히트맵 | `map:sido:{모드}` | 10분 |
| 시군구 히트맵 | `map:sigungu:{시도}:{모드}` | 5분 |
| 단지 목록 | `map:complexes:{시군구}:{시}:{모드}` | 5분 |
| 수집 통계 | `stats` | 10분 |
| 구별 히트맵 | `analysis:district-heatmap` | 10분 |
| 급매 리더보드 | `analysis:leaderboard:{모드}:{limit}` | 5분 |
| 누적 가격인하 TOP | `analysis:top-drops:{limit}` | 5분 |
| 최근 가격변동 | `analysis:price-changes:{limit}` | 5분 |
| 분석 개요 | `analysis:overview` | 5분 |
| 지역별 급매 랭킹 | `analysis:dong-rankings:{모드}:{limit}` | 5분 |

## 급매 점수 (bargain_score, 0~100)

`scripts/detect-price-bargains.mjs`에서 산정, 50점 이상이면 급매.

| 요소 | 최대 | 계산 |
|------|------|------|
| 단지 내 비교 | 40점 | 동일평형(±3㎡) 평균 호가 대비 할인율 × 200 |
| 실거래가 비교 | 35점 | 6개월 실거래 평균 대비 할인율 / 0.15 × 35 |
| 가격 인하 횟수 | 20점 | 인하 1회 = 4점 |
| 누적 인하율 | 5점 | 초기가 대비 하락률, 5%당 1점 |

급매 유형: `keyword`(설명에 급매 키워드), `price`(50점↑), `both`(둘 다)

## 데이터 수집

```bash
node --env-file=.env scripts/collect-finland.mjs --incremental  # 전수 스캔
node --env-file=.env scripts/collect-finland.mjs --quick         # 변화 단지만
node --env-file=.env scripts/detect-price-bargains.mjs           # 급매 점수 갱신
node --env-file=.env scripts/collect-real-transactions.mjs --incremental  # 실거래가
```

스케줄: 03:00 `--incremental`, 06:00~21:00 `--quick` (3시간 간격)

## 환경변수 (.env)

- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` — DB 접속
- `KAKAO_JAVASCRIPT_KEY` — 카카오맵 SDK
- `TOSS_AIT_API_KEY` — 토스 AIT 배포용
- `TOSS_MTLS_PRIVATE_KEY`, `TOSS_MTLS_PUBLIC_CERT` — 토스 mTLS 인증
- `TOSS_LOGIN_DECRYPT_KEY` — 토스 로그인 복호화

## 외부 서비스

- 카카오 앱: https://developers.kakao.com/console/app/1388597
- 앱인토스 콘솔: https://developers-apps-in-toss.toss.im/
- Cloudflare Tunnel: `estate-rader` (ID: b865013e-7551-4a74-9a53-391297d1e4f2)
