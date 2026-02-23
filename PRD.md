# 부동산 급매 알리미 - PRD (Product Requirements Document)

> 토스 미니앱 | 작성일: 2026-02-19 | 버전: 1.0

---

## 1. 제품 개요

### 한 줄 요약
아파트 매물 중 **중개사가 "급매"로 표시한 매물을 자동 감지**하고, 푸시 알림으로 알려주는 토스 미니앱.

### 풀고자 하는 문제
- 투자자/실수요자가 매일 네이버 부동산을 2~3회 수동 확인하며 급매 매물을 찾아 헤맴
- 호갱노노, 아실, 네이버부동산 모두 **급매 매물만 모아서 알림으로 보내주는 기능이 없음**

### 핵심 가치
```
잠실르엘 84m² 18층 → 중개사가 "급매" 표시 → 즉시 푸시 알림!
```

### 타겟 유저
- 부동산 투자자: 급매 기회 모니터링
- 실수요자: 관심 단지 최저가 추적
- 공통 행동: 네이버 부동산을 하루 2~3회 이상 확인

---

## 2. 경쟁 분석

| 서비스 | 제공 | 미제공 |
|--------|------|--------|
| **호갱노노** | 실거래가 조회, 시세 추이 | 급매 매물 필터링, 알림 |
| **아실** | 실거래가, 호가, 동/호수 거래이력 | 급매 자동 감지, 푸시 알림 |
| **네이버부동산** | 매물 리스트, 호가, 단지 정보 | 급매만 모아보기, 알림 |

**차별점**: 중개사가 "급매"로 등록한 매물만 자동으로 모아서 알려주는 유일한 서비스.

---

## 3. 데이터 소스 (실측 검증 완료)

### 3-1. fin.land.naver.com API (호가 데이터) — 현행

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `fin.land.naver.com/front-api/v1/complex/article/list` (POST) |
| 인증 | Playwright 브라우저 세션 필요 (headful 모드) |
| 응답 | JSON, 커서 기반 페이지네이션, 페이지당 최대 30건 |
| Rate limit | **없음** (평균 120ms/req) |
| 제약 | 클라우드 IP 차단 → 가정용 IP(로컬 맥)에서만 수집 가능 |

**실측 검증 (2026-02-23):**
- 서울+수도권 10,295개 단지, 17,541 API 요청, 31분 소요
- 42개 필드 수집 (가격 원단위, 면적, 층수, 방향, 검증타입, 이미지 등)
- 가격변동 이력(priceChangeHistories) 포함

**매물당 수집 가능 데이터 (42개 필드):**

| 분류 | 필드 | 설명 |
|------|------|------|
| 가격 | `dealPrice`, `formattedDealPrice` | 호가 원단위 + 포맷 (예: "29억") |
| 면적 | `supplySpace`, `exclusiveSpace`, `contractSpace` | 공급/전용/계약 면적 (m²) |
| 위치 | `dongName`, `targetFloor`, `totalFloor`, `direction` | 동, 층, 방향 |
| 설명 | `articleFeatureDescription` | 중개사 작성 설명 |
| 사진 | `representativeImageUrl`, `imageCount` | 대표 이미지 + 사진 수 |
| 검증 | `verificationType`, `exposureStartDate` | 소유자확인/서류확인, 노출시작일 |
| 중개사 | `brokerageName`, `brokerName`, `cpId` | 중개사무소, 중개사명 |
| 건물 | `buildingConjunctionDate`, `approvalElapsedYear` | 준공일, 경과연수 |
| 그룹 | `groupArticleCount`, `groupRealtorCount` | 그룹 매물 수, 중개사 수 |
| 가격변동 | `priceChangeStatus`, `priceChangeHistories` | 변동상태(UP/DOWN/SAME), 이력 |

### 3-2. 국토교통부 실거래가 API (거래 데이터)

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev` |
| 인증 | ServiceKey 필요 (data.go.kr 회원가입 후 무료 발급, 자동승인) |
| 비용 | **무료** |
| 일일 제한 | 10,000건/일 |
| 데이터 지연 | 거래 후 5~7일 |

**제공 데이터:** 거래금액, 전용면적, 층, 계약년월일, 아파트명, 법정동, 건축년도, 매도자/매수자 구분

### 3-3. 단지 정보 API

| 엔드포인트 | 용도 |
|-----------|------|
| `fin.land.naver.com/front-api/v1/complex?complexNumber={id}` | 단지 상세 (좌표, 주소, 준공일, 세대수) |

**단지 정보:** 단지명, city/division/sector 주소, 좌표(lat/lon), 총동수, 총세대수, 준공일, 매물수

---

## 4. 데이터 수집 전략

### 4-1. 수집 규모 (실측, 2026-02-23)

| 항목 | 수치 |
|------|------|
| 수집 대상 단지 수 | 10,295개 (서울+수도권, is_active) |
| 단지당 평균 매물 수 | ~2건 (빈 단지 포함) |
| 전체 매물 수 | ~10,000건 (활성 매물) |
| 전수 스캔 API 요청 | ~17,500건 |
| 전수 스캔 소요 시간 | ~31분 |
| API 응답 속도 | 평균 120ms/req (rate limit 없음) |

### 4-2. 3-Mode 수집 전략 (현행)

**핵심 제약:** fin.land API에 "최근 변경" 엔드포인트가 없음 → totalCount 비교 또는 전수 스캔으로만 변화 감지 가능.

```
┌─ --quick (3시간 간격, ~20분) ───────────────────────┐
│ Phase 1: 모든 단지 size=1 count 체크 (~15분)           │
│   DB deal_count와 비교 → 변화 단지 식별                 │
│   배치 20건씩 page.evaluate (IPC 최소화)               │
│ Phase 2: 변화 단지 + 24h 미스캔 단지만 deep scan (~5분) │
│   전체 페이지네이션 + UPSERT + 삭제/가격변동 감지        │
│ 요청: ~9,000~10,000건                                │
└──────────────────────────────────────────────────────┘

┌─ --full (기본, 초기 로드/데이터 복구용, ~31분) ────────┐
│ 전수 UPSERT (diff 없음, 삭제 감지 안함)                 │
│ 요청: ~17,500건                                       │
└──────────────────────────────────────────────────────┘

┌─ --incremental (1일 1회 03:00, ~35분) ─────────────┐
│ 전수 diff scan                                       │
│   DB pre-fetch → API 전체 페이지네이션                  │
│   UPSERT + 가격 비교 → price_history 기록              │
│   DB에 있지만 API에 없는 매물 → removed 처리            │
│ 요청: ~17,500건                                       │
└──────────────────────────────────────────────────────┘

┌─ 실거래가 (1일 1회) ───────────────────────────────┐
│ collect-real-transactions.mjs --incremental          │
│ 국토부 API → real_transactions 테이블                  │
└──────────────────────────────────────────────────────┘
```

### 4-3. 운영 스케줄

| 시각 | 모드 | 설명 |
|------|------|------|
| 03:00 | `--incremental` | 전수 스캔 + 삭제/가격변동 완전 감지 (~35분) |
| 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 | `--quick` | count 비교 → 변화 단지만 deep scan (~20분) |

- lock 파일로 중복 실행 방지 (1시간 자동 만료)
- incremental 실행 시간대(03:00~04:00)에는 quick 스킵

### 4-4. 변경 감지 매커니즘

| 변경 유형 | quick | incremental | 감지 방법 |
|-----------|-------|-------------|-----------|
| 신규 매물 | ✓ (변화 단지) | ✓ (전체) | UPSERT → xmax=0 |
| 삭제 매물 | ✓ (변화 단지) | ✓ (전체) | seenArticleNos에 없으면 removed |
| 가격 변동 | ✓ (변화 단지) | ✓ (전체) | DB deal_price vs API dealPrice 비교 → price_history |
| 급매 전환 | ✓ (변화 단지) | ✓ (전체) | 키워드 감지 + bargain_detections |

### 4-5. Edge Case 대응

- **동시 추가+삭제 (totalCount 불변)**: daily incremental이 감지. quick에서도 24시간 미스캔 단지를 강제 deep scan으로 보완.
- **브라우저 세션 만료**: 에러 발생 시 재시작
- **삭제 후 재등장 매물**: UPSERT 시 `article_status='active'`, `removed_at=NULL`로 복원

---

## 5. 급매 판별 방식

### 5-1. 핵심 철학: 중개사에게 판단을 맡긴다

급매 여부는 **부동산 중개사가 직접 판별**한다. 중개사가 매물 제목이나 설명에 "급매"라고 표기하면, 그것이 급매다.

**이유:**
- 시세 대비 할인율 자동 계산은 기준시세 산출이 부정확할 수 있음
- 부동산 중개사는 해당 단지의 시세를 가장 잘 알고 있음
- 네이버 부동산에 이미 중개사들이 급매 표기를 하는 관행이 있음
- 알고리즘 복잡도를 줄여 MVP 출시 속도를 높임

### 5-2. 급매 키워드 감지 로직

```
검색 대상 필드:
1. articleFeatureDescription (매물 설명) - "급매", "급처분", "급히", "급전" 등

판별 로직:
IF 키워드 MATCH IN articleFeatureDescription
  → is_bargain = true, bargain_keyword 저장
  → bargain_detections 테이블에 기록
  → 사용자에게 알림 발송
ELSE
  → 일반 매물
```

### 5-3. 키워드 목록

| 키워드 | 우선순위 | 설명 |
|--------|----------|------|
| **급매** | 1순위 | 가장 일반적인 급매 표시 |
| **급처분** | 1순위 | 급하게 처분 |
| **급전** | 2순위 | 급전 필요로 인한 매도 |
| **급히** | 2순위 | 급하게 매도 |
| **마이너스피** | 3순위 | 시세 이하 매물 |
| **마피** | 3순위 | 마이너스피 줄임말 |
| **급급** | 3순위 | 매우 급한 매도 |
| **손절** | 3순위 | 손해 감수 매도 |
| **최저가** | 3순위 | 단지 내 최저가 강조 |
| **급하게** | 3순위 | 급하게 매도 |

### 5-4. 정렬 기준 (급매 피드 내)

급매로 분류된 매물들의 정렬:
1. **신선도** (first_seen_at 기준, 최신 매물 우선)
2. **같은 날짜면** 호가 낮은 순

---

## 6. 시스템 아키텍처

```
┌─ 토스 앱 ──────────────────────────────────────┐
│  급매 레이더 미니앱 (React + TDS + WebView)       │
│  Bedrock SDK (로그인, 알림, 네비게이션)            │
└────────────────────┬───────────────────────────┘
                     │ HTTPS
┌────────────────────▼───────────────────────────┐
│  Oracle VM (한국 클라우드)                        │
│                                                 │
│  PostgreSQL DB (168.107.44.148:8081)             │
│  ├ complexes (10,295단지) ├ users                │
│  ├ articles (매물/호가)    ├ watchlist (관심단지)  │
│  ├ price_history (변동)    ├ alert_history (알림) │
│  ├ real_transactions (1.3M)├ bargain_detections  │
│  └ collection_runs                               │
│                                                 │
│  Express API 서버 (:3001)                        │
│  ├ /api/bargains          ├ /api/real-transactions│
│  ├ /api/articles          ├ /api/stats           │
│  └ /api/complexes                                │
└───────────────────────────────────────────────┘
                     ▲ DB 원격 접속 (PGHOST)
┌────────────────────┴───────────────────────────┐
│  로컬 맥 (수집 전용, Playwright headful)          │
│                                                 │
│  collect-finland.mjs (fin.land API, 3-mode)      │
│  ├ --quick         (3시간 간격, count→deep scan) │
│  ├ --incremental   (1일 1회, 전수 diff scan)     │
│  └ --full          (초기 로드/복구용)             │
│                                                 │
│  enrich-complexes.mjs (단지 정보 보강)            │
│  collect-real-transactions.mjs (실거래가, 1일 1회)│
│                                                 │
│  lock 파일로 중복 실행 방지                        │
└───────┬──────────────────────┬────────────────┘
        ▼                      ▼
  fin.land.naver.com API   국토부 실거래 API
  (Playwright, rate limit 없음)  (공식, 무료)
```

**제약사항:** 네이버가 클라우드/데이터센터 IP (Oracle Cloud, AWS, Supabase, Vercel 등)를 차단하므로, 수집 스크립트는 **반드시 가정용 IP(로컬 맥)에서 Playwright headful 모드로 실행**해야 함. 서버에서는 DB + API 서비스만 운영.

### 기술 스택

| 레이어 | 선택 | 이유 |
|--------|------|------|
| Frontend | React + TypeScript + Vite | 토스 WebView 미니앱, TDS 호환 |
| UI | TDS Mobile | 토스 앱과 일관된 UX, 필수 사항 |
| State | Zustand + TanStack Query | 경량 + 서버 상태 캐싱 |
| Chart | Recharts | 실거래가 추이 차트 |
| API 서버 | Express (Node.js) on Oracle VM | 한국 IP 필수 (네이버 차단 대응) |
| DB | PostgreSQL 17 (Oracle VM, 168.107.44.148:8081) | 시계열 + 관계형 |
| 수집 | Node.js + Playwright (로컬 맥, headful) | 가정용 IP + 브라우저 세션 필수 |
| Auth | 토스 로그인 (OAuth 2.0) + Supabase Auth | 토스 앱 연동 필수 |
| Push | 토스 스마트 발송 API | 세그먼트 기반 타겟팅 |

---

## 7. DB 스키마 (v2 — fin.land 기반)

```sql
-- 아파트 단지 (10,295개)
complexes (
  id, hscp_no(UNIQUE), complex_name, property_type,
  city, division, sector, address,
  lat, lon, total_dong, total_households,
  building_date, approval_elapsed_year,
  deal_count, prev_deal_count, lease_count, rent_count,
  is_active, last_collected_at, created_at, updated_at
)

-- 매물 (42개 컬럼, 가격 원단위)
articles (
  id, article_no(UNIQUE), complex_id, trade_type,
  deal_price(BIGINT 원), warranty_price, rent_price,
  formatted_price, management_fee, price_change_status,
  supply_space, exclusive_space, contract_space, space_name,
  target_floor, total_floor, direction, direction_standard,
  dong_name, description, article_status(active/removed),
  verification_type, exposure_start_date,
  cp_id, brokerage_name, broker_name,
  image_url, image_count, is_vr_exposed,
  city, division, sector, building_date, approval_elapsed_year,
  group_article_count, group_realtor_count, group_direct_trade_count,
  is_bargain, bargain_keyword,
  first_seen_at, last_seen_at, removed_at, raw_data(JSONB)
)

-- 호가 변동 이력
price_history (
  id, article_id, deal_price(BIGINT 원), formatted_price,
  source(api_history/scan_detected), modified_date, recorded_at
)

-- 실거래가 (국토부, 1.3M rows)
real_transactions (
  id, complex_id, deal_amount(만원), exclusive_area,
  floor, deal_year, deal_month, deal_day,
  apt_name, dong_name, building_year, ...
)

-- 급매 감지 로그
bargain_detections (
  id, article_id, complex_id,
  detection_type, keyword, deal_price,
  detected_at
)

-- 수집 실행 기록
collection_runs (
  id, run_type(full/quick/incremental/single),
  started_at, finished_at,
  complexes_scanned, articles_found, articles_new,
  articles_updated, articles_removed, bargains_detected,
  errors, status, notes
)

-- 사용자 / 관심단지 / 알림
users ( id, toss_user_id, nickname, created_at )
watchlist ( id, user_id, complex_id, created_at )
alert_history ( id, user_id, article_id, alert_type, sent_at )
```

---
