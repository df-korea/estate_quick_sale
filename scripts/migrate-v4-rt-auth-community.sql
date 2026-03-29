-- ============================================
-- Migration v4: 실거래 탭 + 카카오 로그인 + 게시판 개편
-- 2026-03-29
-- ============================================

-- 1. users 테이블 확장 (카카오 + 익명 인증)
ALTER TABLE users ADD COLUMN IF NOT EXISTS kakao_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'toss';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id) WHERE kakao_id IS NOT NULL;

-- 2. community_posts 확장 (익명 글쓰기)
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS anonymous_nickname VARCHAR(50);

-- 3. 실거래 변동률 쿼리 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_rt_complex_year_month_amount
  ON real_transactions(complex_id, deal_year, deal_month, deal_amount)
  WHERE complex_id IS NOT NULL;
