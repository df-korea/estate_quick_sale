-- ============================================
-- watchlist v2 마이그레이션
-- 평형/주거타입 컬럼 추가 + 알림 설정 테이블
-- 실행: psql -h localhost -p 8081 -U estate_app -d estate_bargain -f scripts/migrate-watchlist-v2.sql
-- ============================================

BEGIN;

-- 1. watchlist 테이블에 평형/주거타입 컬럼 추가
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS pyeong_type TEXT;
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'all';

-- 2. 기존 unique constraint 교체 (같은 단지를 평형별로 다르게 등록 가능)
ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_complex_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_user_complex_pyeong
  ON watchlist(user_id, complex_id, COALESCE(pyeong_type, '__ALL__'));

-- 3. 알림 설정 테이블
CREATE TABLE IF NOT EXISTS notification_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  notify_keyword_bargain BOOLEAN DEFAULT TRUE,
  notify_price_bargain BOOLEAN DEFAULT TRUE,
  notify_new_article BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. alert_history 확장
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS complex_id BIGINT;
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS bargain_type TEXT;
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS message_result JSONB;

-- 5. alert_history 중복 방지 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS alert_history_user_article_type
  ON alert_history(user_id, article_id, alert_type);

COMMIT;
