# 부동산 급매 알리미 - 진행 현황

> 최종 업데이트: 2026-02-19

---

## 전체 진행률

| 단계 | 상태 | 비고 |
|------|------|------|
| Supabase DB 스키마 | ✅ 완료 | 8개 테이블, 인덱스, RLS, 트리거 |
| Edge Functions 배포 | ⚠️ 부분완료 | 배포됨, 단 네이버가 클라우드 IP 차단 |
| 로컬 수집 스크립트 | ✅ 완료 | discover + collect, 전국 커버, 매매만 |
| 초기 데이터 수집 | 🔄 진행중 | 시드 3/10 단지 완료 (1,734건) |
| 전국 단지 발굴 | ❌ 미시작 | `전체수집.command` 더블클릭으로 실행 |
| 프론트엔드 구현 | ✅ 완료 | 5개 화면, 빌드 성공 (456KB) |
| Vercel 배포 설정 | ✅ 완료 | vercel.json, GitHub 자동배포 연결 |
| Vercel 배포 | ❌ 미완료 | git commit + push 필요 |
| pg_cron 스케줄링 | ⚠️ 보류 | 네이버 클라우드 IP 차단으로 불가 |

---

## 데이터 수집 현황

### 수집 완료 단지 (3/10 시드)

| 단지명 | hscpNo | 매매 | 전세 | 월세 | 합계 | 급매 |
|--------|--------|------|------|------|------|------|
| 헬리오시티 | 111515 | 890 | 160 | 0 | **1,050** | **138** |
| 잠실리센츠 | 22746 | 226 | 57 | 125 | **408** | **28** |
| 잠실엘스 | 22627 | 140 | 71 | 65 | **276** | **14** |
| **합계** | | **1,256** | **288** | **190** | **1,734** | **180** |

### 전국 수집 대상 권역 (9개)

| 권역 | 격자 단위 | 예상 단지 |
|------|-----------|-----------|
| 서울/경기/인천 | 0.04도 | ~2,500+ |
| 부산/울산/경남 | 0.05도 | ~800+ |
| 대구/경북 | 0.05도 | ~400+ |
| 대전/세종/충남 | 0.05도 | ~400+ |
| 충북 | 0.05도 | ~200+ |
| 광주/전남 | 0.05도 | ~300+ |
| 전북 | 0.05도 | ~200+ |
| 강원 | 0.06도 | ~200+ |
| 제주 | 0.05도 | ~100+ |

---

## 수집 스크립트 사용법

### macOS에서 더블클릭 실행 (.command)

| 파일 | 설명 | 소요시간 |
|------|------|----------|
| `scripts/전체수집.command` | 단지 발굴 + 매물 수집 | 수시간~하루 |
| `scripts/매물수집만.command` | 매물만 수집 (발굴 완료 후) | 수시간 |

### CLI 직접 실행

```bash
# 전국 단지 발굴
node scripts/discover-complexes.mjs

# 특정 권역만
node scripts/discover-complexes.mjs --region "서울"

# APT만
node scripts/discover-complexes.mjs --type APT

# 매물 수집 (전체)
node scripts/collect-articles.mjs --offset 0 --batch 50

# 특정 단지만
node scripts/collect-articles.mjs --hscp 22627
```

### 수집 설정

- **거래유형**: 매매(A1)만 수집
- **딜레이**: 단지발굴 2~5초, 매물수집 3~8초 (랜덤)
- **UA 로테이션**: 5개 모바일 브라우저 순환
- **에러 백오프**: 307/429 시 3초→6초→9초 지수 백오프
- **배치 크기**: 50개 단지씩 순차 처리

---

## 네이버 API Rate Limit 분석

### 차단 원인
- 1.2초 고정 딜레이로 대량 요청 → ~1,000건 이후 HTTP 307 차단
- 고정 간격 + 단일 User-Agent = 봇으로 탐지됨

### 권장 수집 속도 (리서치 결과)

| 전략 | 딜레이 | 안정성 | 시간/1000요청 |
|------|--------|--------|-------------|
| 안전 (권장) | random(5~15초) | 높음 | ~2.8시간 |
| 보통 | random(3~8초) | 중간 | ~1.5시간 |
| 공격적 (위험) | random(1~3초) | 낮음 | ~0.6시간 |

### 적용 완료
- `scripts/collect-articles.mjs`: random(3~8초) + UA 로테이션 + 307 백오프
- `scripts/discover-complexes.mjs`: random(2~5초) + UA 로테이션

---

## 기술 아키텍처

### Supabase (bwdopkjlbvvcmuuhjnxa, 서울 리전)

**테이블 8개:**
- `complexes` - 단지 마스터 (APT/OPST 구분, tier 1/2)
- `articles` - 매물 (38+ 필드 + raw_data jsonb 원본 보존)
- `price_history` - 호가 변동 이력
- `bargain_detections` - 급매 감지 기록
- `users` - 사용자 (토스 로그인용)
- `watchlist` - 관심단지
- `alert_history` - 알림 이력
- `collection_runs` - 수집 실행 로그

**확장:**
- `pg_cron` - 스케줄링 (활성화됨)
- `pg_net` - HTTP 호출 (활성화됨)

**RLS 정책:**
- 매물/단지: public read + anon write (수집 스크립트용)
- 사용자 데이터: auth 필수

### Edge Functions (3개 배포)
- `discover-complexes` - 서울 그리드 탐색
- `collect-articles` - 매물 수집기
- `collect-all-complexes` - 오케스트레이터
- ⚠️ **네이버가 Supabase IP (Deno Deploy) 차단** → 로컬 스크립트로 대체

### 프론트엔드 (apps/miniapp/)
- Vite + React 19 + TypeScript
- react-router-dom, @tanstack/react-query, @supabase/supabase-js, zustand, recharts
- 빌드 크기: 456KB (gzip 134KB)

**화면 5개:**
1. `HomePage` - 급매 피드 (거래유형 필터, 최신순)
2. `ArticleDetailPage` - 매물 상세 (가격, 급매뱃지, 태그, 중개사, 네이버 링크)
3. `ComplexDetailPage` - 단지 상세 (단지 정보 + 매매 매물 리스트)
4. `SearchPage` - 단지 검색 (ilike, 세대수/매물수 표시)
5. `SettingsPage` - 데이터 현황, 수집 이력, 알림 설정(stub)

---

## 다음 할 일

### 즉시
1. **전국 단지 발굴 + 매물 수집** - `전체수집.command` 더블클릭
2. **Git commit + push** → Vercel 자동 배포

### 단기 (이번 주)
3. 프론트엔드 로컬 테스트 → UI 개선
4. Vercel 환경변수 설정 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

### 중기
5. 토스 앱인토스 앱 생성 및 연동
6. 수집 자동화 방안 (cron job / 한국 VPS / proxy)
7. 알림 기능 구현

---

## 프로젝트 구조

```
estate_quick_sale/
├── apps/miniapp/               # React 프론트엔드
│   ├── src/
│   │   ├── pages/              # 5개 화면
│   │   ├── components/         # BargainCard, TabBar 등
│   │   ├── hooks/              # useBargains, useArticle 등
│   │   ├── lib/supabase.ts     # Supabase 클라이언트
│   │   └── styles/global.css   # 토스 디자인 토큰 기반
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── discover-complexes.mjs  # 전국 단지 발굴
│   ├── collect-articles.mjs    # 매물 수집 + 급매 감지 (매매만)
│   ├── 전체수집.command         # macOS 더블클릭 - 전체 수집
│   ├── 매물수집만.command       # macOS 더블클릭 - 매물만 수집
│   ├── run-full-collection.sh  # 전체 수집 (CLI)
│   └── run-collect-only.sh     # 매물만 수집 (CLI)
├── vercel.json                 # Vercel 배포 설정
├── claude.md                   # 개발 가이드
├── PROGRESS.md                 # 이 파일
└── .env                        # 환경변수 (git 제외)
```
