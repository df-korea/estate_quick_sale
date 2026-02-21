#!/bin/bash
# ==============================================
# 부동산 급매 알리미 - 전체 수집 실행
# 사용법: ./scripts/run-full-collection.sh
# ==============================================

cd "$(dirname "$0")/.."

echo ""
echo "=========================================="
echo "  부동산 급매 알리미 - 전체 수집 시작"
echo "=========================================="
echo ""

# Step 1: 서울 전역 단지 발굴
echo "[Step 1/3] 서울 전역 APT + 오피스텔 단지 발굴 중..."
echo "  예상 소요: 약 30~50분 (그리드 ~280셀 × 2타입)"
echo ""
node scripts/discover-complexes.mjs
if [ $? -ne 0 ]; then
  echo "❌ 단지 발굴 실패. 10분 후 재시도하세요."
  exit 1
fi

echo ""
echo "[Step 2/3] 30초 대기 후 매물 수집 시작..."
sleep 30

# Step 2: 전체 매물 수집 (배치 단위)
BATCH=50
OFFSET=0

echo "[Step 2/3] 전체 단지 매물 수집 시작 (배치 ${BATCH}개씩)"
echo "  예상 소요: 수 시간 (단지 수에 따라 다름)"
echo ""

while true; do
  echo ""
  echo "--- 배치 시작: offset=${OFFSET}, batch=${BATCH} ---"

  OUTPUT=$(node scripts/collect-articles.mjs --offset $OFFSET --batch $BATCH 2>&1)
  echo "$OUTPUT"

  # "No complexes to process" 메시지면 종료
  if echo "$OUTPUT" | grep -q "No complexes to process"; then
    echo ""
    echo "✅ 모든 단지 수집 완료!"
    break
  fi

  OFFSET=$((OFFSET + BATCH))

  # 배치 간 60초 쿨다운 (rate limit 방지)
  echo ""
  echo "⏳ 다음 배치 전 60초 쿨다운..."
  sleep 60
done

echo ""
echo "=========================================="
echo "[Step 3/3] 수집 결과 확인"
echo "=========================================="
echo ""
echo "브라우저에서 확인:"
echo "  https://supabase.com/dashboard/project/bwdopkjlbvvcmuuhjnxa/editor"
echo ""
echo "또는 프론트엔드 실행:"
echo "  cd apps/miniapp && npm run dev"
echo ""
