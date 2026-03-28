#!/bin/bash
# estate_rt 벌크 수집 크론
# 매일 새벽 1시(KST) 실행, API 한도까지 수집 후 자동 중단
# 다음 날 이어서 수집 (이미 수집된 개월 스킵)
#
# 크론: 0 16 * * * (UTC 16시 = KST 새벽 1시)

cd /home/ubuntu/estate_quick_sale

LOG="logs/rt-bulk-cron-$(date +%Y%m%d).log"

echo "[$(TZ=Asia/Seoul date)] === estate_rt 벌크 수집 크론 시작 ===" >> "$LOG"

# 5개 타입 순차 수집 (1개 프로세스만, 수집완료 개월 스킵)
node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs \
  --from 2006 --to 2026 --concurrency 3 >> "$LOG" 2>&1

echo "[$(TZ=Asia/Seoul date)] === 크론 완료 ===" >> "$LOG"

# 완료 현황 요약
PGPASSWORD='lXbO1SabXn2dr2Yh/tdWX8G2UjIGOPUP' psql -h localhost -p 8081 -U estate_app -d estate_rt -c "
SELECT trade_type, count(*)::int as cnt,
  count(DISTINCT deal_year*100+deal_month)::int as months,
  min(deal_year)||'~'||max(deal_year) as range
FROM real_transactions GROUP BY trade_type
UNION ALL
SELECT trade_type, count(*)::int,
  count(DISTINCT deal_year*100+deal_month)::int,
  min(deal_year)||'~'||max(deal_year)
FROM real_rent_transactions GROUP BY trade_type
ORDER BY 1;" >> "$LOG" 2>&1
