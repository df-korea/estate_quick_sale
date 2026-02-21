#!/bin/bash
# ==============================================
# 매물만 수집 (단지 발굴 이미 완료 후 사용)
# 사용법: ./scripts/run-collect-only.sh [시작offset]
# 예: ./scripts/run-collect-only.sh 200  # 200번째 단지부터
# ==============================================

cd "$(dirname "$0")/.."

BATCH=50
OFFSET=${1:-0}

echo ""
echo "=========================================="
echo "  매물 수집 시작 (offset=${OFFSET}, batch=${BATCH})"
echo "=========================================="
echo ""

while true; do
  echo "--- 배치: offset=${OFFSET} ---"

  OUTPUT=$(node scripts/collect-articles.mjs --offset $OFFSET --batch $BATCH 2>&1)
  echo "$OUTPUT"

  if echo "$OUTPUT" | grep -q "No complexes to process"; then
    echo ""
    echo "✅ 모든 단지 수집 완료!"
    break
  fi

  OFFSET=$((OFFSET + BATCH))

  echo ""
  echo "⏳ 다음 배치 전 60초 쿨다운..."
  sleep 60
done
