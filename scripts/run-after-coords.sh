#!/bin/bash
# 좌표 수집 완료 대기 → rate limit 테스트 자동 실행

echo "⏳ 좌표 수집 완료 대기 중..."

# populate-complex-coords 프로세스가 끝날 때까지 대기
while pgrep -f "populate-complex-coords" > /dev/null 2>&1; do
  sleep 30
done

echo "✅ 좌표 수집 완료! 10초 후 rate limit 테스트 시작..."
sleep 10

echo "🚀 rate limit 테스트 실행"
node --env-file=.env scripts/test-fin-land-ratelimit.mjs
