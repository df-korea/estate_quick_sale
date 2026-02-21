#!/bin/bash
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

LOG_DIR="logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/real-tx-${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

echo "" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "  국토부 아파트 매매 실거래가 수집" | tee -a "$LOG_FILE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "  로그: $LOG_FILE" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# DB 확인
if ! pg_isready -q 2>/dev/null; then
  echo "❌ PostgreSQL이 실행 중이 아닙니다." | tee -a "$LOG_FILE"
  echo "   brew services start postgresql@17" | tee -a "$LOG_FILE"
  read -p "아무 키나 누르면 종료..."
  exit 1
fi
echo "✅ PostgreSQL 연결 확인" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 이어하기 여부
RESUME_FLAG=""
PROGRESS_FILE="$LOG_DIR/real-tx-progress.json"
if [ -f "$PROGRESS_FILE" ]; then
  COMPLETED=$(python3 -c "import json; d=json.load(open('$PROGRESS_FILE')); print(len(d.get('completed',[])))" 2>/dev/null || echo "0")
  if [ "$COMPLETED" -gt 0 ]; then
    echo "📌 이전 중단 지점에서 이어서 수집 (${COMPLETED}건 완료)" | tee -a "$LOG_FILE"
    RESUME_FLAG="--resume"
  fi
fi

echo "" | tee -a "$LOG_FILE"
node scripts/collect-real-transactions.mjs --months 12 $RESUME_FLAG 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "📄 전체 로그: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
read -p "아무 키나 누르면 종료..."
