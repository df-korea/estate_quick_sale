-- init-db-v2.sql
-- fin.land 기반 DB 스키마 v2 (전면 교체)
-- complexes를 포함한 전체 테이블 재설계. real_transactions만 유지.
--
-- 실행: psql -d estate_quick_sale -f scripts/init-db-v2.sql

BEGIN;

-- ============================================
-- 0. 기존 complexes 데이터 백업
-- ============================================

CREATE TEMP TABLE _complexes_backup AS
SELECT hscp_no, complex_name, property_type, lat, lon,
       total_dong, total_households,
       deal_count, COALESCE(prev_deal_count, 0) AS prev_deal_count,
       lease_count, rent_count,
       is_active, created_at
FROM complexes;

-- ============================================
-- 1. 모든 테이블 삭제 (real_transactions 유지)
-- ============================================

DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS bargain_detections CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS collection_runs CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS complex_regions CASCADE;
DROP TABLE IF EXISTS complex_districts CASCADE;
DROP TABLE IF EXISTS complexes CASCADE;

-- ============================================
-- 2. complexes — fin.land 기반 새 스키마
-- ============================================

CREATE TABLE complexes (
  id BIGSERIAL PRIMARY KEY,
  hscp_no TEXT NOT NULL UNIQUE,
  complex_name TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'APT',

  -- 주소
  city TEXT,                          -- 시/도 (서울특별시)
  division TEXT,                      -- 구/시 (송파구)
  sector TEXT,                        -- 동/읍 (잠실동)
  address TEXT,                       -- 전체 주소

  -- 좌표
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,

  -- 세대/동
  total_dong INT,
  total_households INT,

  -- 건물 정보
  building_date TEXT,                 -- 준공일 YYYYMM
  approval_elapsed_year INT,          -- 경과 연수

  -- 매물 카운트 (수집 시 갱신)
  deal_count INT DEFAULT 0,
  prev_deal_count INT DEFAULT 0,
  lease_count INT DEFAULT 0,
  rent_count INT DEFAULT 0,

  -- 상태
  is_active BOOLEAN DEFAULT TRUE,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_collected_at TIMESTAMPTZ
);

CREATE INDEX idx_complexes_name ON complexes(complex_name);
CREATE INDEX idx_complexes_property_type ON complexes(property_type);
CREATE INDEX idx_complexes_is_active ON complexes(is_active);
CREATE INDEX idx_complexes_city ON complexes(city);
CREATE INDEX idx_complexes_division ON complexes(division);
CREATE INDEX idx_complexes_lat_lon ON complexes(lat, lon);

-- 기존 데이터 복원
INSERT INTO complexes (hscp_no, complex_name, property_type, lat, lon,
                       total_dong, total_households,
                       deal_count, prev_deal_count, lease_count, rent_count,
                       is_active, created_at)
SELECT hscp_no, complex_name, property_type, lat, lon,
       total_dong, total_households,
       deal_count, prev_deal_count, lease_count, rent_count,
       is_active, created_at
FROM _complexes_backup;

DROP TABLE _complexes_backup;

-- ============================================
-- 3. articles — fin.land 전 필드
-- ============================================

CREATE TABLE articles (
  id BIGSERIAL PRIMARY KEY,
  article_no TEXT NOT NULL UNIQUE,
  complex_id BIGINT NOT NULL REFERENCES complexes(id),
  trade_type TEXT NOT NULL DEFAULT 'A1',

  -- 가격 (원 단위)
  deal_price BIGINT,
  warranty_price BIGINT,
  rent_price BIGINT,
  formatted_price TEXT,
  management_fee BIGINT,
  price_change_status TEXT,          -- SAME / UP / DOWN

  -- 면적
  supply_space NUMERIC(10,2),
  exclusive_space NUMERIC(10,2),
  contract_space NUMERIC(10,2),
  space_name TEXT,                   -- 평형명 (예: "84A")

  -- 층수
  target_floor TEXT,                 -- "저"/"중"/"고"/숫자
  total_floor TEXT,

  -- 방향
  direction TEXT,                    -- ES/SS/WS/EN 코드
  direction_standard TEXT,           -- 기준 (현관/거실)

  -- 매물 정보
  dong_name TEXT,
  description TEXT,
  article_status TEXT DEFAULT 'active',

  -- 검증
  verification_type TEXT,            -- OWNER/DOC
  exposure_start_date TEXT,

  -- 중개사
  cp_id TEXT,
  brokerage_name TEXT,
  broker_name TEXT,

  -- 미디어
  image_url TEXT,
  image_count INT DEFAULT 0,
  is_vr_exposed BOOLEAN DEFAULT FALSE,

  -- 주소 (매물 기준)
  city TEXT,
  division TEXT,
  sector TEXT,

  -- 건물
  building_date TEXT,
  approval_elapsed_year INT,

  -- 중복 매물
  group_article_count INT DEFAULT 0,
  group_realtor_count INT DEFAULT 0,
  group_direct_trade_count INT DEFAULT 0,

  -- 급매 감지
  is_bargain BOOLEAN DEFAULT FALSE,
  bargain_keyword TEXT,

  -- 타임스탬프
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,

  -- 원본
  raw_data JSONB
);

CREATE INDEX idx_articles_complex ON articles(complex_id);
CREATE INDEX idx_articles_status ON articles(article_status);
CREATE INDEX idx_articles_bargain ON articles(is_bargain) WHERE is_bargain = TRUE;
CREATE INDEX idx_articles_trade ON articles(trade_type);
CREATE INDEX idx_articles_first_seen ON articles(first_seen_at DESC);
CREATE INDEX idx_articles_deal_price ON articles(deal_price) WHERE deal_price > 0;
CREATE INDEX idx_articles_city_division ON articles(city, division);

-- ============================================
-- 4. price_history
-- ============================================

CREATE TABLE price_history (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  deal_price BIGINT,
  formatted_price TEXT,
  source TEXT DEFAULT 'collection',
  modified_date TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ph_article ON price_history(article_id);
CREATE INDEX idx_ph_recorded ON price_history(recorded_at DESC);

-- ============================================
-- 5. bargain_detections
-- ============================================

CREATE TABLE bargain_detections (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT REFERENCES articles(id) ON DELETE CASCADE,
  complex_id BIGINT REFERENCES complexes(id),
  detection_type TEXT NOT NULL,
  keyword TEXT,
  deal_price BIGINT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bd_article ON bargain_detections(article_id);
CREATE INDEX idx_bd_complex ON bargain_detections(complex_id);
CREATE INDEX idx_bd_detected ON bargain_detections(detected_at DESC);

-- ============================================
-- 6. collection_runs
-- ============================================

CREATE TABLE collection_runs (
  id BIGSERIAL PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'full',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  complexes_scanned INT DEFAULT 0,
  articles_found INT DEFAULT 0,
  articles_new INT DEFAULT 0,
  articles_updated INT DEFAULT 0,
  articles_removed INT DEFAULT 0,
  bargains_detected INT DEFAULT 0,
  errors INT DEFAULT 0,
  status TEXT DEFAULT 'running',
  notes TEXT
);

-- ============================================
-- 7. users / watchlist / alert_history
-- ============================================

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  toss_user_id TEXT UNIQUE,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  complex_id BIGINT NOT NULL REFERENCES complexes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, complex_id)
);

CREATE TABLE alert_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  article_id BIGINT REFERENCES articles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. real_transactions에 complex_id FK 추가
-- ============================================

-- NOTE: real_transactions 테이블은 별도 생성/관리 (여기서는 ALTER만)
-- ALTER TABLE real_transactions ADD COLUMN IF NOT EXISTS complex_id BIGINT;
-- CREATE INDEX IF NOT EXISTS idx_rt_complex_id ON real_transactions(complex_id);
-- CREATE INDEX IF NOT EXISTS idx_rt_complex_area_date
--   ON real_transactions(complex_id, exclu_use_ar, deal_year, deal_month)
--   WHERE complex_id IS NOT NULL;

-- ============================================
-- 9. updated_at 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_complexes_updated ON complexes;
CREATE TRIGGER trg_complexes_updated
  BEFORE UPDATE ON complexes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
