#!/bin/bash
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

BATCH=50
LOG_DIR="logs"
STATE_FILE="$LOG_DIR/collect-state.txt"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/collect-only-${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

echo "" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "  매물 수집 (단지 발굴 완료 후 사용)" | tee -a "$LOG_FILE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "  로그: $LOG_FILE" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if ! pg_isready -q 2>/dev/null; then
  echo "❌ PostgreSQL이 실행 중이 아닙니다." | tee -a "$LOG_FILE"
  echo "   brew services start postgresql@17" | tee -a "$LOG_FILE"
  read -p "아무 키나 누르면 종료..."
  exit 1
fi
echo "✅ PostgreSQL 연결 확인" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 이전 상태에서 이어하기
if [ -f "$STATE_FILE" ]; then
  OFFSET=$(cat "$STATE_FILE")
  echo "📌 이전 중단 지점에서 이어서 수집 (offset=${OFFSET})" | tee -a "$LOG_FILE"
else
  OFFSET=0
fi
echo "" | tee -a "$LOG_FILE"

while true; do
  echo "--- $(date '+%H:%M:%S') 배치: offset=${OFFSET}, batch=${BATCH} ---" | tee -a "$LOG_FILE"

  echo "$OFFSET" > "$STATE_FILE"

  OUTPUT=$(node scripts/collect-articles.mjs --offset $OFFSET --batch $BATCH 2>&1)
  echo "$OUTPUT" | tee -a "$LOG_FILE"

  if echo "$OUTPUT" | grep -q "No complexes to process"; then
    echo "" | tee -a "$LOG_FILE"
    echo "✅ 모든 단지 수집 완료!" | tee -a "$LOG_FILE"
    rm -f "$STATE_FILE"
    break
  fi

  OFFSET=$((OFFSET + BATCH))
  echo "$OFFSET" > "$STATE_FILE"

  echo "" | tee -a "$LOG_FILE"
  echo "⏳ 다음 배치 전 60초 쿨다운..." | tee -a "$LOG_FILE"
  sleep 60
done

echo "" | tee -a "$LOG_FILE"
echo "📄 전체 로그: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
read -p "아무 키나 누르면 종료..."
