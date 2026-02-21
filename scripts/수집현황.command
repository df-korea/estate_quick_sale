#!/bin/bash
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

clear
echo ""
echo "==========================================
  📊 매물 수집 현황 모니터링
  $(date '+%Y-%m-%d %H:%M:%S')
=========================================="
echo ""

# DB 확인
if ! pg_isready -q 2>/dev/null; then
  echo "❌ PostgreSQL이 실행 중이 아닙니다."
  read -p "아무 키나 누르면 종료..."
  exit 1
fi

# 수집기 프로세스 확인
PID=$(pgrep -f "collect-articles-fast" | head -1)
if [ -n "$PID" ]; then
  ELAPSED=$(ps -p $PID -o etime= 2>/dev/null | tr -d ' ')
  echo "  🟢 수집기 실행 중 (PID: $PID, 경과: $ELAPSED)"
else
  echo "  🔴 수집기가 실행 중이 아닙니다."
fi

echo ""
echo "━━━ DB 현황 ━━━"
psql -t estate_quick_sale -c "
  SELECT '  총 단지:       ' || count(*) || '개' FROM complexes WHERE is_active=true;
" 2>/dev/null
psql -t estate_quick_sale -c "
  SELECT '  매물있는 단지:  ' || count(*) || '개' FROM complexes WHERE is_active=true AND deal_count > 0;
" 2>/dev/null
psql -t estate_quick_sale -c "
  SELECT '  수집완료 단지:  ' || count(DISTINCT complex_id) || '개' FROM articles;
" 2>/dev/null
psql -t estate_quick_sale -c "
  SELECT '  총 매물:        ' || count(*) || '건' FROM articles;
" 2>/dev/null
psql -t estate_quick_sale -c "
  SELECT '  급매:           ' || count(*) || '건' FROM articles WHERE is_bargain=true;
" 2>/dev/null
psql -t estate_quick_sale -c "
  SELECT '  실거래가:       ' || count(*) || '건' FROM real_transactions;
" 2>/dev/null

echo ""
echo "━━━ 최근 수집 로그 ━━━"
LOG=$(ls -t logs/fast-v3-*.log logs/fast-single-*.log logs/fast-batch-*.log 2>/dev/null | head -1)
if [ -n "$LOG" ]; then
  echo "  (${LOG})"
  echo ""
  tail -8 "$LOG" 2>/dev/null | sed 's/^/  /'
else
  echo "  로그 파일 없음"
fi

# 30초마다 자동 갱신 루프
echo ""
echo ""
echo "━━━ 30초마다 자동 갱신 (Ctrl+C로 종료) ━━━"
echo ""

while true; do
  sleep 30
  echo "--- $(date '+%H:%M:%S') ---"

  # 프로세스 확인
  PID=$(pgrep -f "collect-articles-fast" | head -1)
  if [ -z "$PID" ]; then
    echo "  🔴 수집기 종료됨!"
    break
  fi

  ARTICLES=$(psql -t estate_quick_sale -c "SELECT count(*) FROM articles" 2>/dev/null | tr -d ' ')
  BARGAINS=$(psql -t estate_quick_sale -c "SELECT count(*) FROM articles WHERE is_bargain=true" 2>/dev/null | tr -d ' ')
  CX_DONE=$(psql -t estate_quick_sale -c "SELECT count(DISTINCT complex_id) FROM articles" 2>/dev/null | tr -d ' ')
  echo "  매물: ${ARTICLES} | 급매: ${BARGAINS} | 수집단지: ${CX_DONE}/7900"

  # 최신 로그 1줄
  LOG=$(ls -t logs/fast-v3-*.log logs/fast-single-*.log logs/fast-batch-*.log 2>/dev/null | head -1)
  if [ -n "$LOG" ]; then
    tail -1 "$LOG" 2>/dev/null | sed 's/^/  /'
  fi
done

echo ""
echo "==========================================
  수집 완료 또는 종료
=========================================="
psql -t estate_quick_sale -c "
  SELECT '  단지: ' || count(DISTINCT complex_id) || '/7900' FROM articles
  UNION ALL SELECT '  매물: ' || count(*) FROM articles
  UNION ALL SELECT '  급매: ' || count(*) FROM articles WHERE is_bargain = true;
" 2>/dev/null

echo ""
read -p "아무 키나 누르면 종료..."
