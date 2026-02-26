# 부동산 급매 알리미 - 개발 가이드

## 기술 스택
- **프론트엔드**: React + TypeScript + Vite (토스 미니앱 WebView)
- **UI**: 토스 디자인 토큰 기반 커스텀 CSS
- **백엔드**: Express API 서버 + PostgreSQL
- **DB**: Oracle Cloud VM PostgreSQL 17 (168.107.44.148:8081, user=estate_app, db=estate_quick_sale)
- **배포**: Vercel
- **데이터 수집**: 로컬 Node.js + Playwright (fin.land.naver.com API)

## 핵심 결정사항
- **fin.land.naver.com API 전면 사용** (m.land 대체) — rate limit 없음, 풍부한 필드
- Playwright headful 모드 필수 (fin.land는 브라우저 세션 필요)
- 가격은 원(won) 단위로 저장 (fin.land API 원본 그대로)
- 네이버가 클라우드 IP 차단 → 로컬 스크립트로 수집
- 토스 앱인토스 앱 등록 완료 (appName: `estate-quick-sale`)

## DB 스키마 (v2 — fin.land 기반)
- **complexes**: 단지 마스터 (city/division/sector 주소, 좌표, 준공일, prev_deal_count)
- **articles**: 매물 (42개 컬럼, 가격 원단위, fin.land 전필드 + raw_data jsonb)
- **price_history**: 호가 변동 (deal_price 원단위, source=api_history/scan_detected)
- **bargain_detections**: 급매 감지 로그
- **real_transactions**: 국토부 실거래 (2.3M rows, 별도 스키마)
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

## 빌드 & 배포

**Vercel 배포 (API + 프론트 정적파일):**
```bash
git push origin main  # Vercel 자동 배포 (main 브랜치)
```

**AIT 빌드 (토스 미니앱 번들):**
```bash
cd apps/miniapp
npx granite build     # .ait 파일 생성 (estate-quick-sale.ait)
```
- `granite.config.ts`에서 appName, brand, web 설정 관리
- 빌드 결과물은 `dist/` → `.ait` 패키징
- `web.commands.build`의 결과물 경로가 `outdir`(기본 dist)과 일치해야 함

**AIT 배포 (앱인토스 콘솔 업로드):**
```bash
cd apps/miniapp
npx ait deploy                    # API 키 등록된 경우
npx ait deploy --api-key {키}     # API 키 직접 전달
```
- 배포 완료 시 테스트 스킴 출력: `intoss-private://estate-quick-sale?_deploymentId=...`
- 토스앱에서 QR 코드 또는 스킴으로 테스트

**AIT API 키 관리:**
```bash
npx ait token add          # 워크스페이스 API 키 등록 (1회)
npx ait token remove       # 등록된 토큰 삭제
```

**AIT 출시 프로세스:**
1. `npx granite build` → `.ait` 생성
2. `npx ait deploy` → 콘솔 업로드 + 테스트 스킴 발급
3. 토스앱에서 QR 테스트 (최소 1회 필수)
4. 콘솔에서 "검토 요청" (영업일 최대 3일)
5. 승인 후 "출시하기" → 전체 사용자 반영

**CORS 설정 (토스 미니앱 운영 시):**
- 실서비스: `https://estate-quick-sale.apps.tossmini.com`
- QR 테스트: `https://estate-quick-sale.private-apps.tossmini.com`

## 외부 서비스
- **Vercel**: https://vercel.com/backs-projects-87a24f27/estate-quick-sale
- **카카오 앱**: https://developers.kakao.com/console/app/1388597/config/platform-key
- **앱인토스 콘솔**: https://developers-apps-in-toss.toss.im/ (워크스페이스 → estate-quick-sale)

## 환경변수
- `.env` 파일 참조 (git에 커밋하지 않음)
- PGHOST=168.107.44.148, PGPORT=8081, PGUSER=estate_app (Oracle Cloud VM PostgreSQL)
- 로컬 수집 스크립트 + Vercel API 모두 Oracle VM에 직접 연결
- `scripts/db.mjs`와 `api/_lib/db.js` 모두 원격 시 SSL 자동 활성화

---

## 참고 문서

**토스 앱인토스:**
- [기본 문서] https://developers-apps-in-toss.toss.im/llms.txt
- [예제 문서] https://developers-apps-in-toss.toss.im/tutorials/examples.md
- [TDS 스타일 가이드] https://tossmini-docs.toss.im/tds-mobile/llms-full.txt

**공식 문서:**
- [토스 앱인토스 개발자 문서](https://developers-apps-in-toss.toss.im/)
- [카카오 개발자 문서](https://developers.kakao.com/docs)
