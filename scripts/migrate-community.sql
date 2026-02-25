-- migrate-community.sql
-- 커뮤니티 게시판 테이블 추가
-- 실행: psql -d estate_quick_sale -f scripts/migrate-community.sql

BEGIN;

-- ============================================
-- community_posts (게시글)
-- ============================================

CREATE TABLE IF NOT EXISTS community_posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  nickname TEXT DEFAULT '익명',
  attached_article_id BIGINT REFERENCES articles(id) ON DELETE SET NULL,
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cp_created ON community_posts(created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_cp_popular ON community_posts(like_count DESC, created_at DESC) WHERE NOT is_deleted;

-- ============================================
-- community_comments (댓글/대댓글)
-- ============================================

CREATE TABLE IF NOT EXISTS community_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES community_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  nickname TEXT DEFAULT '익명',
  like_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_post ON community_comments(post_id, created_at);

-- ============================================
-- community_likes (좋아요 — device_id 기반)
-- ============================================

CREATE TABLE IF NOT EXISTS community_likes (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id BIGINT REFERENCES community_comments(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cl_post_device ON community_likes(post_id, device_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cl_comment_device ON community_likes(comment_id, device_id) WHERE comment_id IS NOT NULL;

-- updated_at trigger for posts
DROP TRIGGER IF EXISTS trg_community_posts_updated ON community_posts;
CREATE TRIGGER trg_community_posts_updated
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
