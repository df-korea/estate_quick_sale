-- Auth migration: add columns to users table for Toss login
ALTER TABLE users ADD COLUMN IF NOT EXISTS toss_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add user_id to community tables for auth-based ownership
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);

-- Add user_id to community_likes (alongside existing device_id for migration)
ALTER TABLE community_likes ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);

-- Index for user lookup on community tables
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user_id ON community_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_user_id ON community_likes(user_id);

-- Unique constraint for user_id-based likes (one like per user per post/comment)
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_likes_user_post ON community_likes(user_id, post_id) WHERE user_id IS NOT NULL AND post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_likes_user_comment ON community_likes(user_id, comment_id) WHERE user_id IS NOT NULL AND comment_id IS NOT NULL;
