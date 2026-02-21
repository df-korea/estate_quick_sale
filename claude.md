# 부동산 급매 알리미 - 개발 가이드

## 기술 스택
- **프론트엔드**: React + TypeScript + Vite (토스 미니앱 WebView)
- **UI**: 토스 디자인 토큰 기반 커스텀 CSS
- **백엔드**: Supabase (PostgreSQL + Edge Functions)
- **프로덕션 DB**: Supabase PostgreSQL
- **배포**: Vercel
- **데이터 수집**: 로컬 Node.js 스크립트 (네이버가 클라우드 IP 차단)

## 핵심 결정사항
- 국토교통부 실거래 API 사용하지 않음 (PRD의 Tier 3 제외)
- 네이버 부동산 비공식 API만 사용 (인증 불필요, User-Agent/Referer 헤더만 필요)
- **네이버가 Supabase Edge Function IP를 차단** → 로컬 스크립트로 수집
- 토스 앱인토스 앱 아직 미생성 (추후 생성 예정)
- 오라클 DB 사용하지 않음

## 프로젝트 구조
```
estate_quick_sale/
├── apps/miniapp/          # React + Vite 프론트엔드
├── scripts/               # 로컬 데이터 수집 스크립트
│   ├── discover-complexes.mjs  # 서울 전역 단지 발굴
│   └── collect-articles.mjs    # 매물 수집 + 급매 감지
├── vercel.json            # Vercel 배포 설정
├── PRD.md
└── claude.md
```

## 외부 서비스
- **Vercel 프로젝트**: https://vercel.com/backs-projects-87a24f27/estate-quick-sale
- **Supabase 프로젝트**: bwdopkjlbvvcmuuhjnxa (zoopzoop, ap-northeast-2)
- **카카오 앱**: https://developers.kakao.com/console/app/1388597/config/platform-key

## 환경변수
- API 키는 `.env` 파일 참조 (git에 커밋하지 않음)
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (프론트엔드)
- 카카오 플랫폼 키 (REST, JavaScript, Native App)
- 토스 앱 키 (추후 설정)

## 데이터 수집
- `node scripts/discover-complexes.mjs` - 전국 APT+OPST 단지 발굴
- `node scripts/collect-articles.mjs` - 전체 매물 수집 (하루 1회, ~25시간)
- `node scripts/collect-articles.mjs --resume` - 중단점부터 이어서 수집
- `node scripts/collect-articles.mjs --hscp 22627` - 단일 단지 테스트
- `node scripts/collect-articles.mjs --smart` - deal_count 차등 스캔 (~6시간, 변동 단지만 deep scan)
- `node scripts/poll-new-articles.mjs` - 신규 매물 빠른 감지 + deep scan (~15분, 평시 기준)
- `node scripts/poll-new-articles.mjs --scan-only` - 감지만 (deep scan 안함)
- `node scripts/poll-new-articles.mjs --region 서울` - 특정 지역만 폴링
- `node scripts/collect-real-transactions.mjs --incremental` - 실거래가 증분 수집 (최근 2개월)
- 네이버 rate limit: 4초 딜레이, 20건마다 40~55초 배치 휴식, 307 시 서킷브레이커

## Supabase DB 테이블
- complexes: 단지 마스터 (APT/OPST)
- articles: 매물 (38+ 필드 + raw_data jsonb)
- price_history: 호가 변동
- bargain_detections: 급매 감지
- users, watchlist, alert_history, collection_runs

---

## 참고 문서

**토스 앱인토스:**
- [기본 문서] https://developers-apps-in-toss.toss.im/llms.txt
- [예제 문서] https://developers-apps-in-toss.toss.im/tutorials/examples.md
- [TDS 스타일 가이드] https://tossmini-docs.toss.im/tds-mobile/llms-full.txt

**공식 문서:**
- [토스 앱인토스 개발자 문서](https://developers-apps-in-toss.toss.im/)
- [Supabase 문서](https://supabase.com/docs)
- [카카오 개발자 문서](https://developers.kakao.com/docs)
