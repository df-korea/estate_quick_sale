#!/bin/bash
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

echo ""
echo "=========================================="
echo "  부동산 급매 알리미 - 개발 서버"
echo "=========================================="
echo ""

# DB 연결 확인
if ! pg_isready -q 2>/dev/null; then
  echo "❌ PostgreSQL이 실행 중이 아닙니다. 시작합니다..."
  brew services start postgresql@17
  sleep 2
fi

echo "✅ PostgreSQL 연결 확인"

# API 서버 시작 (백그라운드)
echo "🚀 API 서버 시작 (port 3001)..."
node apps/api/server.mjs &
API_PID=$!
sleep 1

# Vite 개발 서버 시작
echo "🌐 프론트엔드 시작 (port 5173)..."
echo ""
echo "  브라우저에서 http://localhost:5173 접속"
echo "  종료: Ctrl+C"
echo ""

cd apps/miniapp && npx vite --host

# Vite 종료 시 API 서버도 종료
kill $API_PID 2>/dev/null
echo ""
echo "서버 종료됨."
