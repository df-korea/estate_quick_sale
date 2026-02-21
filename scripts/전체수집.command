#!/bin/bash
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

# ============================================
# 설정
# ============================================
BATCH=50
LOG_DIR="logs"
STATE_FILE="$LOG_DIR/collect-state.txt"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/collect-${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

# 로그 함수: 화면 + 파일 동시 출력
log() {
  echo "$@" | tee -a "$LOG_FILE"
}

echo "" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "  부동산 급매 알리미 - 전체 수집" | tee -a "$LOG_FILE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "  로그: $LOG_FILE" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# DB 연결 확인
if ! pg_isready -q 2>/dev/null; then
  log "❌ PostgreSQL이 실행 중이 아닙니다."
  log "   brew services start postgresql@17"
  read -p "아무 키나 누르면 종료..."
  exit 1
fi
log "✅ PostgreSQL 연결 확인"
log ""

# ============================================
# Step 1: 단지 발굴 (이어하기 지원)
# ============================================

# discover 진행파일이 있으면 이어하기
DISCOVER_PROGRESS="$LOG_DIR/discover-progress.json"
if [ -f "$DISCOVER_PROGRESS" ]; then
  COMPLETED=$(python3 -c "import json; d=json.load(open('$DISCOVER_PROGRESS')); print(len(d.get('completed',[])))" 2>/dev/null || echo "0")
  if [ "$COMPLETED" -gt 0 ] && [ "$COMPLETED" -lt 18 ]; then
    log "[Step 1/2] 단지 발굴 이어하기 (${COMPLETED}/18 완료)"
    log ""
    node scripts/discover-complexes.mjs --resume 2>&1 | tee -a "$LOG_FILE"
  elif [ "$COMPLETED" -ge 18 ]; then
    log "[Step 1/2] 단지 발굴 이미 완료 (${COMPLETED}/18), 건너뜀"
  else
    log "[Step 1/2] 전국 APT + 오피스텔 단지 발굴 시작..."
    log ""
    node scripts/discover-complexes.mjs 2>&1 | tee -a "$LOG_FILE"
  fi
else
  log "[Step 1/2] 전국 APT + 오피스텔 단지 발굴 시작..."
  log "  예상 소요: 약 1.5~2시간"
  log ""
  node scripts/discover-complexes.mjs 2>&1 | tee -a "$LOG_FILE"
fi

if [ $? -ne 0 ]; then
  log ""
  log "❌ 단지 발굴 중 오류 발생. 다시 실행하면 이어서 진행합니다."
  read -p "아무 키나 누르면 종료..."
  exit 1
fi

log ""
log "[대기] 30초 쿨다운..."
sleep 30

# ============================================
# Step 2: 매물 수집 (이어하기 지원)
# ============================================

# 이전 상태 파일에서 offset 복원
if [ -f "$STATE_FILE" ]; then
  OFFSET=$(cat "$STATE_FILE")
  log "[Step 2/2] 매물 수집 이어하기 (offset=${OFFSET}부터)"
else
  OFFSET=0
  log "[Step 2/2] 매물 수집 시작 (${BATCH}개 단지씩)"
fi
log ""

while true; do
  log "--- $(date '+%H:%M:%S') 배치: offset=${OFFSET}, batch=${BATCH} ---"

  # offset 상태 저장 (실행 전에 저장 → 실패해도 같은 offset에서 재시작)
  echo "$OFFSET" > "$STATE_FILE"

  OUTPUT=$(node scripts/collect-articles.mjs --offset $OFFSET --batch $BATCH 2>&1)
  echo "$OUTPUT" | tee -a "$LOG_FILE"

  if echo "$OUTPUT" | grep -q "No complexes to process"; then
    log ""
    log "✅ 모든 단지 매물 수집 완료!"
    # 상태파일 삭제 (완료)
    rm -f "$STATE_FILE"
    break
  fi

  # 성공하면 다음 offset으로
  OFFSET=$((OFFSET + BATCH))
  echo "$OFFSET" > "$STATE_FILE"

  log ""
  log "⏳ 다음 배치 전 60초 쿨다운..."
  sleep 60
done

# ============================================
# 완료 요약
# ============================================
log ""
log "=========================================="
log "  수집 완료! $(date '+%Y-%m-%d %H:%M:%S')"
log "=========================================="

# DB 요약
SUMMARY=$(psql -t estate_quick_sale -c "
  SELECT 'complexes: ' || count(*) FROM complexes
  UNION ALL SELECT 'articles: ' || count(*) FROM articles
  UNION ALL SELECT 'bargains: ' || count(*) FROM articles WHERE is_bargain = true;
" 2>/dev/null)
log "$SUMMARY"
log ""
log "📄 전체 로그: $LOG_FILE"
log ""
read -p "아무 키나 누르면 종료..."
