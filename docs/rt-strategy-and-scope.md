# estate-rader 전략 & 구현 범위

> **포지션**: "매일 아침 여는 부동산 알리미" — 급매 + 실거래 속보
> **핵심 전략**: 데이터 분석 싸움(아실) 피하고, "속도 + 알림 + 습관" 싸움에서 이기기

---

## 1. 포지셔닝

### 우리가 아닌 것

- 아실처럼 60개 분석 페이지를 가진 종합 플랫폼
- 부동산지인처럼 3D 빅데이터 시각화 도구
- 호갱노노처럼 학군/생활인프라 백과사전

### 우리가 되어야 할 것

| 역할 | 설명 |
|------|------|
| **부동산 속보 알리미** | "오늘 뭐 나왔지?" 를 매일 확인하는 곳 |
| **급매 레이더** | 급매 뜨면 가장 먼저 알려주는 곳 |
| **실거래 트래커** | 내 관심 지역 실거래가 변동을 한눈에 |
| **행동 촉진자** | 정보 → 판단 → 행동(중개사/대출)까지 연결 |

### 경쟁 포지션 맵

```
[분석 깊이]
    ↑
    │  부동산지인     아실
    │       ●          ●
    │
    │  리치고
    │    ●
    │
    │            호갱노노
    │               ●
    │
    │  실까              ★ estate-rader
    │   ●               (급매+실거래 속보)
    │
    │  오늘집값
    │    ●
    └──────────────────────────→ [속도/즉시성]
```

estate-rader = **속도는 실까/오늘집값 수준 + 급매라는 고유 축** 으로 차별화

---

## 2. 탭 구조 (4탭)

### 변경 전

```
홈 | 검색 | 게시판 | 설정
```

### 변경 후

```
급매 | 실거래 | 검색 | 게시판
```

| 탭 | 경로 | 설명 | 비고 |
|-----|------|------|------|
| **급매** | `/` | 기존 홈. 급매 지도 + 오늘의 추천 급매 | 기능 변경 없음, 라벨만 변경 |
| **실거래** | `/real-transactions` | 실거래 변동률 지도 + 이번주 실거래 | **신규** |
| **검색** | `/search` | 기존 검색 필터 | 변경 없음 |
| **게시판** | `/community` | 커뮤니티 (익명+회원 혼합) | **대폭 개편** |

**설정 페이지 이동**: 탭바에서 제거 → 각 탭 우상단 프로필/설정 아이콘으로 접근 (`/settings` 경로 유지)

---

## 3. 핵심 사용자 시나리오

### 시나리오 A: 매일 아침 루틴

```
1. 출근길에 estate-rader 접속
2. [급매 탭] 오늘의 급매 TOP10 확인
3. [실거래 탭] 관심 지역 이번주 실거래 변동 확인 — 지도에서 한눈에
4. 관심 단지 탭 → 상세 → 중개사 연결
```

### 시나리오 B: 실거래 변동 탐색

```
1. [실거래 탭] 전국 지도에서 "서울 +2.1%" 확인
2. 서울 클릭 → 강남구 +3.5%, 노원구 -1.2% 등 시군구별 비교
3. 강남구 클릭 → 카카오맵에 단지별 변동률 오버레이
4. 래미안원베일리 +5,000만 마커 클릭 → 단지 상세
```

### 시나리오 C: 게시판 참여

```
1. [게시판 탭] 둘러보기 (비로그인도 읽기 가능)
2. 댓글 달고 싶으면 → 카카오 로그인 또는 익명 닉네임 입력
3. 급매/실거래 관련 의견 공유, 지역 정보 교류
```

---

## 4. 현재 인프라 현황

### 이미 있는 것 (활용 가능)

| 항목 | 상태 | 비고 |
|------|------|------|
| 실거래 데이터 수집 | ✅ 완료 | data.go.kr 5개 API (매매+전월세+분양권) |
| 실거래 분석 API 10개 | ✅ 완료 | /real-transactions/* |
| 단지별 실거래 API 5개 | ✅ 완료 | /complexes/:id/market/* |
| 급매 감지 시스템 | ✅ 완료 | 키워드+가격 기반, 스코어링 |
| 급매 지도 (3단계 드릴다운) | ✅ 완료 | d3-geo TopoJSON + KakaoMap |
| 관심단지 기능 | ✅ 완료 | watchlist 테이블 |
| 알림 기록 | ✅ 완료 | alert_history 테이블 |
| 250개 시군구 코드 | ✅ 완료 | sgg-codes.json |
| 게시판 기본 CRUD | ✅ 완료 | community_posts/comments/likes 테이블 |
| Toss 로그인 | ✅ 완료 | JWT + Toss SDK OAuth |

### 구현 필요

| 항목 | 우선순위 | Phase |
|------|---------|-------|
| 탭 구조 변경 (4탭 재배치) | P0 | 0 |
| 실거래 변동률 지도 (3단계) | P0 | 0 |
| 실거래 변동률 API (시도/시군구/단지) | P0 | 0 |
| 이번주 실거래 카드 리스트 | P0 | 0 |
| 기간 선택 슬라이더 | P0 | 0 |
| 게시판 익명 글쓰기 | P0 | 1 |
| 카카오 로그인 | P0 | 1 |
| 이메일/비밀번호 회원가입 | P1 | 1 |
| 급매 vs 실거래 비교 | P1 | 2 |
| 실시간 알림 (Push/텔레그램) | P2 | 3 |

---

## 5. Phase 0: 실거래 탭 + 탭 재배치

> 급매와 동급의 1급 기능으로 실거래를 올린다

### 5-0. 탭 구조 변경

**TabBar.tsx 수정**:

```typescript
const ALL_TABS = [
  { path: '/', label: '급매', icon: '...(화염/번개 아이콘)' },
  { path: '/real-transactions', label: '실거래', icon: '...(차트 아이콘)' },
  { path: '/search', label: '검색', icon: '...(돋보기)' },
  { path: '/community', label: '게시판', icon: '...(말풍선)' },
];
```

**설정 접근**: 각 탭 헤더 우상단에 **햄버거 메뉴(☰)** 아이콘
- 클릭 시 슬라이드 메뉴 또는 `/settings` 페이지로 이동
- 메뉴 항목: 설정, 관심단지, 알림설정, 로그인/프로필

### 5-1. 실거래 변동률 API

#### 5-1-1. 시도별 변동률

```
GET /api/real-transactions/change-rate/sido
  ?period=1w|2w|1m|3m|6m|1y  (기본: 1w)
  &property_type=APT|OPST|all
```

**로직**:
- 기간 내 실거래 평균가 vs 직전 동일 기간 평균가
- 예: period=1w → 이번주 평균 vs 지난주 평균
- 거래 건수도 함께 반환

**응답**:
```json
[
  {
    "sido_name": "서울시",
    "sido_code": "11",
    "avg_price_current": 95000,
    "avg_price_prev": 93000,
    "change_rate": 2.15,
    "change_amount": 2000,
    "tx_count_current": 245,
    "tx_count_prev": 230
  }
]
```

#### 5-1-2. 시군구별 변동률

```
GET /api/real-transactions/change-rate/sigungu
  ?sido=11                    (시도 코드, 필수)
  &period=1w|2w|1m|3m|6m|1y
  &property_type=APT|OPST|all
```

**응답**:
```json
[
  {
    "sgg_name": "강남구",
    "sgg_cd": "11680",
    "avg_price_current": 185000,
    "avg_price_prev": 179000,
    "change_rate": 3.35,
    "change_amount": 6000,
    "tx_count_current": 42,
    "tx_count_prev": 38
  }
]
```

#### 5-1-3. 단지별 변동률

```
GET /api/real-transactions/change-rate/complex
  ?sgg_cd=11680               (시군구 코드, 필수)
  &period=1w|2w|1m|3m|6m|1y
  &property_type=APT|OPST|all
  &limit=100
```

**응답**:
```json
[
  {
    "complex_id": 12345,
    "complex_name": "래미안원베일리",
    "lat": 37.5123,
    "lon": 127.0456,
    "avg_price_current": 280000,
    "avg_price_prev": 275000,
    "change_rate": 1.82,
    "change_amount": 5000,
    "tx_count_current": 5,
    "tx_count_prev": 3,
    "latest_deal_date": "2026-03-27",
    "latest_deal_amount": 285000,
    "exclusive_area_range": "84~115㎡"
  }
]
```

### 5-2. 실거래 탭 페이지 UI

경로: `/real-transactions`

#### 전체 레이아웃

```
┌─────────────────────────────────┐
│ 실거래 변동         ⚙️(설정)    │ ← 헤더
├─────────────────────────────────┤
│ [1주] ───────────●─── [1년]    │ ← 기간 슬라이더 (드래그)
│              1개월 ◀ 기본값     │
├─────────────────────────────────┤
│                                 │
│     ┌──────────────────┐        │
│     │   전국 지도 (d3)  │        │ ← 시도 변동률 맵
│     │                  │        │
│     │  서울 +2.1%      │        │
│     │  경기 -0.5%      │        │
│     │  부산 +1.3%      │        │
│     └──────────────────┘        │
│                                 │
├─────────────────────────────────┤
│ 이번주 실거래          전체보기 → │ ← 카드 섹션
│                                 │
│ [서울] [경기] [인천] ... 시도탭  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 래미안원베일리 84㎡  28.5억  │ │
│ │ ▲ 5,000만 (전거래 대비)     │ │
│ │ 신고가 🔴  3/27 거래        │ │
│ ├─────────────────────────────┤ │
│ │ XX아파트 59㎡  8.2억        │ │
│ │ ▼ 3,000만 (전거래 대비)     │ │
│ │ 3/26 거래                   │ │
│ └─────────────────────────────┘ │
│                                 │
│ [급매] [실거래] [검색] [게시판]  │ ← 탭바
└─────────────────────────────────┘
```

#### 지도 드릴다운 (3단계)

**Level 1 — 시도 (전국)**:
- 기존 급매 지도와 동일한 d3-geo TopoJSON 사용
- 각 시도에 **변동률 뱃지** 표시 (상승=빨강, 하락=파랑, 보합=회색)
- 뱃지: `+2.1%` 또는 `-0.5%` 또는 `0.0%`
- 색상 채움: 변동률에 따른 그라데이션 (빨강↔파랑)
  - +3% 이상: 진한 빨강 (#e02020)
  - +1~3%: 연한 빨강 (#ff6b6b)
  - -1~+1%: 회색 (#e8e8e8)
  - -1~-3%: 연한 파랑 (#74b9ff)
  - -3% 이하: 진한 파랑 (#0984e3)
- 클릭 → Level 2 진입

**Level 2 — 시군구 (시/도)**:
- 시도 내 시군구 TopoJSON 맵
- 각 시군구에 변동률 뱃지 + 색상 채움
- 뒤로가기 → Level 1
- 클릭 → Level 3 진입

**Level 3 — 단지 (시군구, 카카오맵)**:
- KakaoMap에 단지별 CustomOverlay 마커
- 마커 내용: `단지명 +5,000만` 또는 `단지명 -2,000만`
- 마커 색상: 상승=빨강, 하락=파랑, 거래없음=회색
- 마커 크기: 거래 건수에 비례 (1건=20px, 5건+=32px)
- 클릭 → 단지 정보 팝업 (최근 거래 요약 + "상세보기" 버튼)
- 뒤로가기 → Level 2

#### 기간 선택 슬라이더

아실 스타일 드래그 슬라이더:

```
┌─────────────────────────────────┐
│  기간:  1주  2주  1개월  3개월  6개월  1년  │
│         ─────●──────────────────  │
│              ↑ 현재: 2주          │
└─────────────────────────────────┘
```

- **구현**: `<input type="range">` 스타일링 또는 커스텀 슬라이더
- **스텝**: 6단계 (1w, 2w, 1m, 3m, 6m, 1y)
- **기본값**: 1m (1개월)
- 슬라이더 변경 시 지도 데이터 자동 갱신 (debounce 300ms)
- 현재 선택 기간을 슬라이더 아래 텍스트로 표시
- **드래그 드롭 인터랙션**: 슬라이더를 드래그하면서 실시간으로 지도 색상 변화 확인 가능 (아실 스타일)

#### "이번주 실거래" 카드 섹션

급매 탭의 "주간 추천 급매"와 동일한 패턴:

```
GET /api/real-transactions/weekly
  ?sido=11           (시도 코드, optional)
  &sort=newest|high_price|new_high  (정렬)
  &limit=20
```

**로직**:
- 최근 7일 이내 거래 (deal_year/month/day 기준)
- 거래취소 제외 (cdeal_type != 'O')
- 각 거래에 전 거래 대비 ±금액 포함

**카드 UI**:
```
┌─────────────────────────────┐
│ 래미안원베일리               │
│ 서초구 반포동 · 2,444세대    │
│                             │
│ 28억 5,000만  84㎡ (34평)   │
│ ▲ 5,000만 (전거래 대비)     │
│                             │
│ 🔴 신고가  ·  12층  ·  3/27 │
└─────────────────────────────┘
```

- 시도 탭 (드래그 가능): 전체 → 서울 → 경기 → ... (가나다순)
- 카드 클릭 → `/complex/[id]` 단지 상세 페이지

---

## 6. Phase 1: 게시판 대폭 개편 + 인증 확장

> 커뮤니티를 열어 유저 참여와 리텐션을 높인다

### 6-1. 인증 시스템 확장

#### 6-1-1. 인증 방식 (3가지)

| 방식 | 설명 | 기능 범위 |
|------|------|----------|
| **익명** | 닉네임만 입력 (세션 기반) | 글쓰기, 댓글 (수정/삭제 세션 내만) |
| **카카오 로그인** | OAuth2 소셜 로그인 | 글쓰기, 댓글, 좋아요, 프로필, 관심단지 |
| **토스 로그인** | 기존 AIT 연동 (앱 전용) | 모든 기능 + 본인인증 |

#### 6-1-2. 카카오 로그인 구현

```
POST /api/auth/kakao/login
  Body: { code: "authorization_code" }
```

**OAuth2 플로우**:
```
1. 프론트: window.location = 'https://kauth.kakao.com/oauth/authorize?...'
2. 카카오 → 콜백: /auth/kakao/callback?code=xxx
3. 백엔드: code → access_token 교환
4. 백엔드: access_token → 사용자 정보 조회
5. 백엔드: users 테이블 UPSERT + JWT 발급
```

**users 테이블 확장**:
```sql
ALTER TABLE users ADD COLUMN kakao_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'toss';
  -- 'toss', 'kakao', 'anonymous'
ALTER TABLE users ADD COLUMN email VARCHAR(255);
ALTER TABLE users ADD COLUMN profile_image VARCHAR(512);
```

#### 6-1-3. 익명 사용자 처리

```
POST /api/auth/anonymous
  Body: { nickname: "부동산초보" }
```

**로직**:
- 닉네임 중복 허용 (뒤에 #1234 랜덤 태그 부여)
- 세션 기반 JWT 발급 (만료: 24시간)
- 익명 사용자의 글/댓글에는 "익명" 뱃지 표시
- 동일 세션 내에서만 수정/삭제 가능

### 6-2. 게시판 기능 개편

#### 6-2-1. 게시판 구조

```
┌─────────────────────────────────┐
│ 게시판                    ✏️ 글쓰기│
├─────────────────────────────────┤
│ 자유게시판                       │ ← 단일 카테고리
├─────────────────────────────────┤
│ 정렬: [최신순▼]  [인기순]        │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 강남 래미안 급매 진짜인가요?  │ │
│ │ 부동산초보 · 익명 · 2시간 전 │ │
│ │ 👁 124  ❤️ 8  💬 12         │ │
│ ├─────────────────────────────┤ │
│ │ 잠실엘스 실거래 신고가 떴네요 │ │
│ │ 잠실러버 · 카카오 · 1시간 전 │ │
│ │ 📎 래미안원베일리 84㎡        │ │
│ │ 👁 89  ❤️ 15  💬 7          │ │
│ └─────────────────────────────┘ │
│                                 │
│ [급매] [실거래] [검색] [게시판]  │
└─────────────────────────────────┘
```

#### 6-2-2. 글쓰기 플로우

```
비로그인 상태에서 "글쓰기" 클릭:
┌─────────────────────────────────┐
│ 글을 쓰려면 로그인이 필요해요    │
│                                 │
│ [카카오로 시작하기]  (노랑 버튼)  │
│ [익명으로 쓰기]      (회색 버튼)  │
│                                 │
│ 이미 토스 계정이 있나요?         │
│ [토스 앱에서 로그인]             │
└─────────────────────────────────┘
```

- 익명 선택 시: 닉네임 입력 모달 → 작성 페이지
- 카카오 선택 시: 카카오 OAuth → 작성 페이지
- 작성 완료 후 게시판으로 리다이렉트

#### 6-2-3. 게시판 API 변경

기존 API에 추가:

```
POST /community/posts         → is_anonymous 필드 추가
GET  /community/posts         → 기존과 동일
```

**community_posts 테이블 확장**:
```sql
ALTER TABLE community_posts ADD COLUMN is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE community_posts ADD COLUMN anonymous_nickname VARCHAR(50);
```

#### 6-2-4. 댓글 시스템

- 기존 댓글 기능 유지 + 대댓글 (parent_id 이미 구현됨)
- 익명 사용자도 댓글 가능 (닉네임 입력 필요)
- 작성자 표시: `닉네임 · 카카오` 또는 `닉네임 · 익명`

---

## 7. Phase 2: 급매 + 실거래 연결

> 급매가 "진짜 싼 건지" 판단 근거를 준다

### 7-1. 급매 할인율 계산 API

```
GET /api/bargains/with-rt
  ?cityCode=11&divisionCode=680
  &sort=discount_rate_desc
```

**로직**:
- 각 급매 매물의 complex_id + exclusive_space로
- real_transactions에서 동일 단지+면적(±2㎡) 최근 거래 조회
- 할인율 = (최근실거래 - 급매호가) / 최근실거래 × 100

**응답 추가 필드**:
```json
{
  "article_no": "2512345",
  "deal_price": 85000,
  "complex_name": "XX아파트",
  "exclusive_space": 84.12,

  "rt_comparison": {
    "latest_deal_amount": 92000,
    "latest_deal_date": "2025-03-15",
    "discount_rate": 7.6,
    "deal_count_1y": 12,
    "avg_deal_amount_1y": 89500,
    "min_deal_amount_1y": 83000,
    "max_deal_amount_1y": 95000
  }
}
```

### 7-2. 단지 상세 페이지 보강

`/complex/[id]` 페이지에 추가:
- "이 단지 급매 vs 최근 실거래" 비교 차트 (가로 바 차트)
- 최근 실거래 목록 (이미 API 있음, 프론트만 추가)

---

## 8. Phase 3: 알림 시스템

> "매일 오게" 만드는 핵심 장치

### 8-1. 관심단지 실거래 알림

**트리거 조건**:
- 관심단지(watchlist)에 새 실거래가 등록됨
- 관심단지에 새 급매가 감지됨
- 관심지역에 신고가 발생

**알림 채널** (구현 난이도순):
1. **웹 푸시** (Service Worker) — 가장 쉬움
2. **텔레그램 봇** — 오픈 채널로 마케팅도 겸함
3. **카카오 알림톡** — 비용 발생, 후순위

### 8-2. 텔레그램 채널 자동 발행

```
매일 오전 9시 크론:
1. 전일 실거래 집계
2. 당일 급매 TOP10 생성
3. 텔레그램 채널에 자동 포스팅
```

---

## 9. Phase 4: 콘텐츠 자동 생성

> 트래픽을 만드는 엔진

### 9-1. 일일 리포트 자동 생성 페이지

```
/report/daily/2026-03-28
```

**자동 생성 콘텐츠**:
- 지역별 거래 건수 요약
- 신고가/최저가 TOP5
- 급매 할인율 TOP10
- 전일 대비 급매 변동 (신규/해제)

### 9-2. SEO 자동 페이지

```
/지역/[시군구]/실거래        → "강남구 아파트 실거래가"
/지역/[시군구]/급매          → "강남구 아파트 급매"
/단지/[단지명]/실거래        → "래미안원베일리 실거래가"
```

각 페이지는 SSR로 generateMetadata() 포함 → 네이버/구글 검색 유입

---

## 10. 기술 구현 노트

### 실거래 변동률 SQL 패턴

```sql
-- 시도별 변동률 (period = 1w 예시)
WITH current_period AS (
  SELECT sgg_cd,
         AVG(deal_amount) as avg_price,
         COUNT(*) as tx_count
  FROM real_transactions
  WHERE deal_date >= CURRENT_DATE - INTERVAL '7 days'
    AND cdeal_type IS DISTINCT FROM 'O'
  GROUP BY LEFT(sgg_cd, 2)  -- 시도 코드 앞 2자리
),
prev_period AS (
  SELECT sgg_cd,
         AVG(deal_amount) as avg_price,
         COUNT(*) as tx_count
  FROM real_transactions
  WHERE deal_date >= CURRENT_DATE - INTERVAL '14 days'
    AND deal_date < CURRENT_DATE - INTERVAL '7 days'
    AND cdeal_type IS DISTINCT FROM 'O'
  GROUP BY LEFT(sgg_cd, 2)
)
SELECT
  sido_name,
  c.avg_price as avg_price_current,
  p.avg_price as avg_price_prev,
  ROUND((c.avg_price - p.avg_price) / p.avg_price * 100, 2) as change_rate
FROM current_period c
JOIN prev_period p USING (sgg_cd);
```

### 지도 컴포넌트 재활용

| 기존 급매 지도 | 실거래 지도 | 재활용 |
|-------------|-----------|--------|
| SidoMap.tsx | RtSidoMap.tsx | TopoJSON + d3-geo 구조 복사, 뱃지 내용만 변경 |
| SigunguMap.tsx | RtSigunguMap.tsx | 동일 구조, 색상/뱃지 변경 |
| KakaoComplexMap.tsx | RtKakaoComplexMap.tsx | CustomOverlay 마커 내용 변경 |
| MapExplorer.tsx | RtMapExplorer.tsx | 드릴다운 로직 복사 |

### 캐시 전략

| 데이터 | TTL | 키 패턴 |
|--------|-----|---------|
| 시도 변동률 | 30분 | `rt:change:sido:{period}:{pt}` |
| 시군구 변동률 | 15분 | `rt:change:sgg:{sido}:{period}:{pt}` |
| 단지 변동률 | 10분 | `rt:change:complex:{sgg}:{period}:{pt}` |
| 이번주 실거래 | 10분 | `rt:weekly:{sido}` |

---

## 11. 한 줄 요약

> **아실이 "부동산 백과사전"이면, estate-rader는 "부동산 속보 알리미".**
> **급매 탭 + 실거래 탭 = 양대 축. 게시판으로 커뮤니티. 카카오/익명 로그인으로 진입 장벽 제거.**
> **지도 변동률 시각화로 "오늘 어디가 올랐지?" 를 한눈에 → 매일 습관 → 프리미엄 알림 → 수익화.**
