#!/bin/bash
# 5개 API 순차 수집 (하나 끝나면 다음 실행)
cd /home/ubuntu/estate_quick_sale

echo "[$(date)] === 순차 수집 시작 ==="

echo "[$(date)] 1/5 APT_RENT (2006~2025)"
node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs --type APT_RENT --from 2006 --to 2025 --concurrency 3
echo "[$(date)] APT_RENT 완료"

echo "[$(date)] 2/5 OFFI_TRADE (2006~2026)"
node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs --type OFFI_TRADE --from 2006 --to 2026 --concurrency 3
echo "[$(date)] OFFI_TRADE 완료"

echo "[$(date)] 3/5 OFFI_RENT (2006~2026)"
node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs --type OFFI_RENT --from 2006 --to 2026 --concurrency 3
echo "[$(date)] OFFI_RENT 완료"

echo "[$(date)] 4/5 PRESALE_TRADE (2006~2026)"
node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs --type PRESALE_TRADE --from 2006 --to 2026 --concurrency 3
echo "[$(date)] PRESALE_TRADE 완료"

echo "[$(date)] 5/5 APT_TRADE 보충 (2006~2026)"
node --env-file=.env scripts/rt-bulk/collect-api-bulk.mjs --type APT_TRADE --from 2006 --to 2026 --concurrency 3
echo "[$(date)] APT_TRADE 완료"

echo "[$(date)] === 전체 순차 수집 완료 ==="

# 최종 DB 통계
PGPASSWORD='lXbO1SabXn2dr2Yh/tdWX8G2UjIGOPUP' psql -h localhost -p 8081 -U estate_app -d estate_rt -c "
SELECT trade_type, count(*)::int as cnt, min(deal_year) as from_y, max(deal_year) as to_y
FROM real_transactions GROUP BY trade_type
UNION ALL
SELECT trade_type, count(*)::int, min(deal_year), max(deal_year)
FROM real_rent_transactions GROUP BY trade_type
ORDER BY 1;"
