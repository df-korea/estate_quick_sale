# 부동산 급매 알리미 - 개발 가이드

## 기술 스택
- **프론트엔드**: React + TypeScript + Vite (토스 미니앱 WebView)
- **UI**: 토스 디자인 토큰 기반 커스텀 CSS
- **백엔드**: Express API 서버 + PostgreSQL
- **DB**: Oracle Cloud VM PostgreSQL 17 (PGHOST 환경변수 참조, db=estate_quick_sale)
- **배포**: Vercel
- **데이터 수집**: 로컬 Node.js + Playwright (fin.land.naver.com API)

## 핵심 결정사항
- **fin.land.naver.com API 전면 사용** (m.land 대체) — rate limit 없음, 풍부한 필드
- Playwright headful 모드 필수 (fin.land는 브라우저 세션 필요)
- 가격은 원(won) 단위로 저장 (fin.land API 원본 그대로)
- 네이버가 클라우드 IP 차단 → 로컬 스크립트로 수집
- 토스 앱인토스 앱 아직 미생성 (추후 생성 예정)

## DB 스키마 (v2 — fin.land 기반)
- **complexes**: 단지 마스터 (city/division/sector 주소, 좌표, 준공일, prev_deal_count)
- **articles**: 매물 (42개 컬럼, 가격 원단위, fin.land 전필드 + raw_data jsonb)
- **price_history**: 호가 변동 (deal_price 원단위, source=api_history/scan_detected)
- **bargain_detections**: 급매 감지 로그
- **real_transactions**: 국토부 실거래 (1.3M rows, 별도 스키마)
- **collection_runs, users, watchlist, alert_history**

## 데이터 수집 (3-mode)

**매물 수집 (collect-finland.mjs):**
- `node --env-file=.env scripts/collect-finland.mjs` — **full**: 전수 UPSERT (기본, ~31분)
- `node --env-file=.env scripts/collect-finland.mjs --quick` — **quick**: count 비교→변화 단지만 deep scan (~20분)
- `node --env-file=.env scripts/collect-finland.mjs --incremental` — **incremental**: 전수 diff scan + 삭제/가격변동 감지 (~35분)
- `node --env-file=.env scripts/collect-finland.mjs --resume` — 이어서 수집 (full/incremental)
- `node --env-file=.env scripts/collect-finland.mjs --hscp 22627` — 단일 단지 테스트

**운영 스케줄:**
- 03:00 `--incremental` (전수 스캔 + 삭제 감지)
- 06:00~21:00 `--quick` (3시간 간격, 변화 단지만)

**기타 수집:**
- `node --env-file=.env scripts/enrich-complexes.mjs` — 단지 정보 보강 (좌표/주소/준공일)
- `node --env-file=.env scripts/enrich-complexes.mjs --missing-only` — 미보강 단지만
- `node --env-file=.env scripts/collect-real-transactions.mjs --incremental` — 실거래가

## 외부 서비스
- **Vercel**: https://vercel.com/backs-projects-87a24f27/estate-quick-sale
- **카카오 앱**: https://developers.kakao.com/console/app/1388597/config/platform-key

## 환경변수
- `.env` 파일 참조 (git에 커밋하지 않음)
- PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD (Oracle Cloud VM PostgreSQL)

---

## 참고 문서

**토스 앱인토스:**
- [기본 문서] https://developers-apps-in-toss.toss.im/llms.txt
- [예제 문서] https://developers-apps-in-toss.toss.im/tutorials/examples.md
- [TDS 스타일 가이드] https://tossmini-docs.toss.im/tds-mobile/llms-full.txt

**공식 문서:**
- [토스 앱인토스 개발자 문서](https://developers-apps-in-toss.toss.im/)
- [카카오 개발자 문서](https://developers.kakao.com/docs)
