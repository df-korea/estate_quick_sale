#!/bin/bash
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

WORKERS=1
LOG_DIR="logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/fast-collect-${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

echo ""
echo "==========================================" | tee "$LOG_FILE"
echo "  🚀 고속 매물 수집 (워커 ${WORKERS}개)" | tee -a "$LOG_FILE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# DB 확인
if ! pg_isready -q 2>/dev/null; then
  echo "❌ PostgreSQL이 실행 중이 아닙니다." | tee -a "$LOG_FILE"
  read -p "아무 키나 누르면 종료..."
  exit 1
fi

# 네이버 차단 확인
echo "🔍 네이버 API 접근 확인 중..." | tee -a "$LOG_FILE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -L \
  -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15" \
  -H "Referer: https://m.land.naver.com/" \
  "https://m.land.naver.com/complex/getComplexArticleList?hscpNo=22627&tradTpCd=A1&order=prc&showR0=N&page=1")

if [ "$CODE" != "200" ]; then
  echo "⚠ 네이버 API 차단 상태 (HTTP $CODE)" | tee -a "$LOG_FILE"
  echo "  20분 후 자동 재시도합니다..." | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"

  # 5분씩 체크하며 대기
  for i in 1 2 3 4 5 6; do
    echo "  ⏳ 대기 중... (${i}/6, 5분 간격)" | tee -a "$LOG_FILE"
    sleep 300
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -L \
      -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15" \
      -H "Referer: https://m.land.naver.com/" \
      "https://m.land.naver.com/complex/getComplexArticleList?hscpNo=22627&tradTpCd=A1&order=prc&showR0=N&page=1")
    if [ "$CODE" = "200" ]; then
      echo "  ✅ 차단 해제됨!" | tee -a "$LOG_FILE"
      break
    fi
  done

  if [ "$CODE" != "200" ]; then
    echo "  ❌ 30분 대기 후에도 차단 중. 나중에 다시 실행해주세요." | tee -a "$LOG_FILE"
    read -p "아무 키나 누르면 종료..."
    exit 1
  fi
else
  echo "✅ 네이버 API 정상 접근 가능" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# 현황
TOTAL=$(psql -t estate_quick_sale -c "SELECT count(*) FROM complexes WHERE is_active=true AND deal_count > 0" 2>/dev/null | tr -d ' ')
EXISTING=$(psql -t estate_quick_sale -c "SELECT count(*) FROM articles" 2>/dev/null | tr -d ' ')
echo "📊 매물있는 단지: ${TOTAL}개 | 기존 수집 매물: ${EXISTING}건" | tee -a "$LOG_FILE"

# 예상 시간
PER_WORKER=$((TOTAL / WORKERS))
EST_HOUR=$(( PER_WORKER * 5 / 3600 ))  # 단지당 ~5초 (3초딜레이 + DB)
EST_MIN=$(( (PER_WORKER * 5 % 3600) / 60))
echo "⏱  예상 소요: ~${EST_HOUR}시간 ${EST_MIN}분 (워커 ${WORKERS}개)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 진행파일 정리 (이전 것이 있으면 이어하기)
for i in $(seq 1 $WORKERS); do
  PFILE="$LOG_DIR/fast-worker-${i}.json"
  if [ -f "$PFILE" ]; then
    DONE=$(python3 -c "import json; d=json.load(open('$PFILE')); print(d.get('stats',{}).get('done', False))" 2>/dev/null)
    PROC=$(python3 -c "import json; d=json.load(open('$PFILE')); print(d.get('stats',{}).get('processed', 0))" 2>/dev/null)
    if [ "$DONE" = "True" ]; then
      echo "  워커${i}: ✅ 완료됨 (스킵)" | tee -a "$LOG_FILE"
    else
      echo "  워커${i}: 📌 이어하기 (${PROC}개 처리됨)" | tee -a "$LOG_FILE"
    fi
  else
    echo "  워커${i}: 🆕 처음부터" | tee -a "$LOG_FILE"
  fi
done
echo "" | tee -a "$LOG_FILE"

# 워커 시작
PIDS=()
for i in $(seq 1 $WORKERS); do
  PFILE="$LOG_DIR/fast-worker-${i}.json"
  if [ -f "$PFILE" ]; then
    DONE=$(python3 -c "import json; d=json.load(open('$PFILE')); print(d.get('stats',{}).get('done', False))" 2>/dev/null)
    if [ "$DONE" = "True" ]; then continue; fi
  fi

  WLOG="$LOG_DIR/fast-worker-${i}-${TIMESTAMP}.log"
  node scripts/collect-articles-fast.mjs --worker $i --total-workers $WORKERS > "$WLOG" 2>&1 &
  PIDS+=($!)
  echo "  ▶ 워커${i} 시작 (PID $!) → $WLOG" | tee -a "$LOG_FILE"

  # 워커 간 시간차 (1.5초)
  sleep 1.5
done

if [ ${#PIDS[@]} -eq 0 ]; then
  echo "  모든 워커 이미 완료!" | tee -a "$LOG_FILE"
  read -p "아무 키나 누르면 종료..."
  exit 0
fi

echo "" | tee -a "$LOG_FILE"
echo "━━━ 진행 모니터링 (60초마다) ━━━" | tee -a "$LOG_FILE"

# 모니터링
while true; do
  ALL_DONE=true
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      ALL_DONE=false; break
    fi
  done
  if $ALL_DONE; then break; fi

  sleep 60
  echo "" | tee -a "$LOG_FILE"
  echo "--- $(date '+%H:%M:%S') ---" | tee -a "$LOG_FILE"

  TOTAL_ARTICLES=$(psql -t estate_quick_sale -c "SELECT count(*) FROM articles" 2>/dev/null | tr -d ' ')
  TOTAL_BARGAINS=$(psql -t estate_quick_sale -c "SELECT count(*) FROM articles WHERE is_bargain=true" 2>/dev/null | tr -d ' ')
  TOTAL_CX=$(psql -t estate_quick_sale -c "SELECT count(DISTINCT complex_id) FROM articles" 2>/dev/null | tr -d ' ')
  echo "  📊 매물: ${TOTAL_ARTICLES} | 급매: ${TOTAL_BARGAINS} | 수집단지: ${TOTAL_CX}/${TOTAL}" | tee -a "$LOG_FILE"

  for i in $(seq 1 $WORKERS); do
    PFILE="$LOG_DIR/fast-worker-${i}.json"
    if [ -f "$PFILE" ]; then
      python3 -c "
import json
d = json.load(open('$PFILE'))
s = d.get('stats', {})
done = '✅' if s.get('done') else '🔄'
print(f'  W${i}{done} {s.get(\"processed\",0):,}개 | 매물 {s.get(\"articles\",0):,}건 | 급매 {s.get(\"bargains\",0)}건 | 스킵 {s.get(\"skipped\",0)}건')
" 2>/dev/null | tee -a "$LOG_FILE"
    fi
  done
done

echo "" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "  🎉 수집 완료! $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"

psql -t estate_quick_sale -c "
  SELECT '  단지: ' || count(DISTINCT complex_id) || '/' || (SELECT count(*) FROM complexes WHERE is_active=true) FROM articles
  UNION ALL SELECT '  매물: ' || count(*) FROM articles
  UNION ALL SELECT '  급매: ' || count(*) FROM articles WHERE is_bargain = true;
" 2>/dev/null | tee -a "$LOG_FILE"

# 워커 진행파일 정리
for i in $(seq 1 $WORKERS); do rm -f "$LOG_DIR/fast-worker-${i}.json"; done

echo "" | tee -a "$LOG_FILE"
echo "📄 로그: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
read -p "아무 키나 누르면 종료..."
