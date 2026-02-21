# 네이버 부동산 API 수집 전략

## 사용 중인 API 엔드포인트

### 1. cluster/ajax/complexList (단지 목록)
```
GET https://m.land.naver.com/cluster/ajax/complexList
  ?rletTpCd={APT|OPST}
  &tradTpCd=A1
  &z=13
  &lat={centerLat}&lon={centerLon}
  &btm={btm}&lft={lft}&top={top}&rgt={rgt}
  &showR0=N
```
- **용도**: 전국 단지 발굴, deal_count 갱신
- **사용 스크립트**: `discover-complexes.mjs`, `collect-articles.mjs --smart`
- **응답 주요 필드**: `hscpNo`, `hscpNm`, `dealCnt`, `lat`, `lon`, `totHsehCnt`

### 2. cluster/ajax/articleList (지역별 매물 목록)
```
GET https://m.land.naver.com/cluster/ajax/articleList
  ?rletTpCd=APT:OPST
  &tradTpCd=A1
  &z=13
  &lat={centerLat}&lon={centerLon}
  &btm={btm}&lft={lft}&top={top}&rgt={rgt}
  &sort=dates
  &page=1
```
- **용도**: 신규 매물 빠른 감지 (최신순 정렬)
- **사용 스크립트**: `poll-new-articles.mjs`
- **응답 주요 필드**: `atclNo`, `atclNm`, `prc`, `hanPrc`, `spc1`, `spc2`, `flrInfo`, `atclCfmYmd`, `lat`, `lng`
- **주의**: `hscpNo` 미포함 → `atclNm`(단지명)으로 complexes 매핑 필요
- **sort 옵션**: `dates`(최신순), `rank`(추천), `lowPrc`(저가순), `highSpc`(면적순)
- **제약**: `z=11` 이하(너무 넓은 범위)면 빈 응답. `z=12~13` 권장

### 3. complex/getComplexArticleList (단지별 매물 상세)
```
GET https://m.land.naver.com/complex/getComplexArticleList
  ?hscpNo={단지번호}
  &tradTpCd=A1
  &order=prc
  &showR0=N
  &page=1
```
- **용도**: 단지별 매물 전체 수집 (deep scan)
- **사용 스크립트**: `collect-articles.mjs`, `poll-new-articles.mjs` (2단계)
- **응답 주요 필드**: `atclNo`, `prcInfo`, `spc1`, `spc2`, `flrInfo`, `atclFetrDesc`, `tagList`, `bildNm`, `rltrNm`, `cfmYmd`
- **order 옵션**: `prc`(가격순), `date_`(최신순), `point_`(추천순), `spc_`(면적순)
- **페이지당**: 20건, `totAtclCnt`로 전체 수 확인

---

## 수집 스크립트 및 전략

### 일상 운영 (권장)

```
[5~10분마다]  node scripts/poll-new-articles.mjs
              → 격자 타일별 최신순 조회로 신규 매물 감지 + deep scan
              → ~15분, ~300 API

[하루 1회]    node scripts/collect-articles.mjs --smart
              → deal_count 차등 스캔으로 삭제 매물 정리 + 데이터 정합성
              → ~6시간, ~5,000 API

[주 1회]      node scripts/discover-complexes.mjs
              → 신규 단지 발굴 (신축 입주 등)
```

### 스크립트별 상세

| 스크립트 | 모드 | API 호출 | 소요 시간 | 용도 |
|---------|------|---------|----------|------|
| `poll-new-articles.mjs` | 기본 | ~600 | ~15분 (평시) | 신규 매물 빠른 감지 |
| `poll-new-articles.mjs --scan-only` | 스캔만 | ~300 | ~15분 | 감지만 (deep scan 안함) |
| `poll-new-articles.mjs --region 서울` | 지역 | ~300 | ~10분 | 특정 지역만 |
| `collect-articles.mjs --smart` | 차등 | ~5,000 | ~6시간 | 변동 단지 deep scan + 삭제 매물 정리 |
| `collect-articles.mjs` | 전체 | ~28,000 | ~25시간 | 전수조사 (초기 적재용) |
| `collect-articles.mjs --resume` | 이어하기 | - | - | 중단점부터 재시작 |
| `collect-articles.mjs --hscp 22627` | 단일 | ~3 | ~10초 | 단일 단지 테스트 |
| `discover-complexes.mjs` | 전체 | ~700 | ~35분 | 전국 단지 발굴 |

---

## Rate Limit 대응

### 딜레이 설정
| 항목 | poll-new-articles | collect-articles |
|------|-------------------|------------------|
| 기본 딜레이 | 3초 | 4초 |
| 최대 딜레이 | 10초 | 12초 |
| 배치 크기 | 25건 | 20건 |
| 배치 휴식 | 35~50초 | 40~55초 |
| 랜덤 범위 | ×0.85~1.15 | ×0.85~1.15 |

### 서킷브레이커 (307/429 대응)
```
연속 3회 차단 → 45초 대기
연속 5회 차단 → 5분 휴식
연속 10회 차단 → 10분 휴식
```

### User-Agent 로테이션
- 8개 모바일 브라우저 UA 랜덤 순환
- iPhone Safari, Android Chrome, iPhone Chrome 조합

### 핵심 규칙
- **고정 딜레이 사용 금지** (봇 탐지됨)
- 1.2초 고정 → ~1,000건 후 307 차단 (실측)
- random(3~8초)가 안전 범위
- 요청 사이 최소 2초 이상 유지

---

## 격자 (Grid) 설정

z=13 기준 타일 크기로 전국 9개 권역 커버:

| 권역 | 위도 범위 | 경도 범위 | step | 예상 타일 수 |
|------|----------|----------|------|------------|
| 서울/경기/인천 | 37.20~37.75 | 126.60~127.40 | 0.04 | ~280 |
| 부산/울산/경남 | 34.90~35.60 | 128.70~129.40 | 0.05 | ~98 |
| 대구/경북 | 35.70~36.20 | 128.40~129.10 | 0.05 | ~70 |
| 대전/세종/충남 | 36.20~36.65 | 126.70~127.50 | 0.05 | ~72 |
| 충북 | 36.50~37.00 | 127.30~127.90 | 0.05 | ~60 |
| 광주/전남 | 34.70~35.25 | 126.60~127.10 | 0.05 | ~55 |
| 전북 | 35.60~36.10 | 126.80~127.30 | 0.05 | ~50 |
| 강원 | 37.30~37.95 | 127.60~129.10 | 0.06 | ~143 |
| 제주 | 33.20~33.55 | 126.15~126.95 | 0.05 | ~49 |

**전국 합계: ~877 타일**

---

## 성능 실측 (2026-02-22)

### poll-new-articles.mjs (서울/경기/인천, 2일 갭)
```
타일: 280개, 변동 231개 (83%)
신규 매물: 10,965건, 2,716개 단지
API 호출: 642건
307 차단: 0건
소요: 59분
```

### 기존 대비 개선
```
                 API 호출    소요 시간    절감률
전체 스캔        28,000      25시간       -
poll (2일 갭)    642         59분         97.7%
poll (평시 예상) ~300        ~15분        98.9%
```

---

## 알려진 제약사항

1. **네이버 클라우드 IP 차단**: Supabase Edge Functions, Vercel 등에서 호출 불가. 반드시 로컬에서 실행
2. **articleList에 hscpNo 미포함**: 단지명(atclNm)으로 complexes 테이블 매핑. 동명 단지 ~650개 존재 (전체 10,295개 중)
3. **complexes.lat/lon 미입력 상태**: discover-complexes.mjs에서 저장하는 로직 있으나 현재 전부 NULL
4. **z=11 이하 빈 응답**: articleList는 z=12~13에서만 정상 동작
5. **차단 지속 시간**: 경미 10~30분, 심각 최대 24시간
