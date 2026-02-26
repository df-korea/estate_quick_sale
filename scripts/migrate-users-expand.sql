-- 사용자 테이블 확장 마이그레이션
-- 실행: psql -h 168.107.44.148 -p 8081 -U estate_app -d estate_quick_sale -f scripts/migrate-users-expand.sql

BEGIN;

-- 1. 관련 데이터 전부 삭제 (FK 순서)
DELETE FROM community_likes;
DELETE FROM community_comments;
DELETE FROM community_posts;
DELETE FROM watchlist;
DELETE FROM alert_history;
DELETE FROM users;

-- 2. 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS toss_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS toss_birthday VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS toss_gender VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS toss_ci TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS toss_di TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

COMMIT;
