-- estate_quick_sale 로컬 PostgreSQL 스키마
-- Usage: psql estate_quick_sale < scripts/init-db.sql

-- ============================================
-- 1. 테이블 생성
-- ============================================

-- 단지 마스터
CREATE TABLE IF NOT EXISTS complexes (
  id BIGSERIAL PRIMARY KEY,
  hscp_no TEXT UNIQUE NOT NULL,
  complex_name TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'APT',
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  total_dong INTEGER,
  total_households INTEGER,
  use_approval_date TEXT,
  deal_count INTEGER DEFAULT 0,
  lease_count INTEGER DEFAULT 0,
  rent_count INTEGER DEFAULT 0,
  min_area DOUBLE PRECISION,
  max_area DOUBLE PRECISION,
  min_deal_price TEXT,
  max_deal_price TEXT,
  tier INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 매물/호가
CREATE TABLE IF NOT EXISTS articles (
  id BIGSERIAL PRIMARY KEY,
  atcl_no TEXT NOT NULL,
  complex_id BIGINT REFERENCES complexes(id),
  hscp_no TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  article_status TEXT DEFAULT 'active',
  price_text TEXT,
  price_amount BIGINT,
  warrant_price_text TEXT,
  warrant_price_amount BIGINT,
  rent_price_text TEXT,
  rent_price_amount BIGINT,
  area_supply DOUBLE PRECISION,
  area_exclusive DOUBLE PRECISION,
  area_type TEXT,
  building_name TEXT,
  floor_info TEXT,
  floor_current INTEGER,
  floor_total INTEGER,
  direction TEXT,
  confirm_date TEXT,
  description TEXT,
  tag_list TEXT[],
  rep_image_url TEXT,
  realtor_name TEXT,
  cp_name TEXT,
  same_addr_cnt INTEGER,
  is_bargain BOOLEAN DEFAULT FALSE,
  bargain_keyword TEXT,
  bargain_keyword_source TEXT,
  raw_data JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(atcl_no, trade_type)
);

-- 호가 변동 이력
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT REFERENCES articles(id),
  price_amount BIGINT,
  price_text TEXT,
  warrant_price_amount BIGINT,
  rent_price_amount BIGINT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 급매 감지 이력
CREATE TABLE IF NOT EXISTS bargain_detections (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT REFERENCES articles(id),
  complex_id BIGINT REFERENCES complexes(id),
  keyword TEXT,
  keyword_source TEXT,
  price_amount BIGINT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 수집 실행 로그
CREATE TABLE IF NOT EXISTS collection_runs (
  id BIGSERIAL PRIMARY KEY,
  run_type TEXT DEFAULT 'collect',
  status TEXT DEFAULT 'running',
  total_complexes INTEGER DEFAULT 0,
  processed_complexes INTEGER DEFAULT 0,
  new_articles INTEGER DEFAULT 0,
  updated_articles INTEGER DEFAULT 0,
  new_bargains INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 사용자 (추후 사용)
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  toss_user_id TEXT UNIQUE,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 관심단지 (추후 사용)
CREATE TABLE IF NOT EXISTS watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  complex_id BIGINT REFERENCES complexes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, complex_id)
);

-- 알림 이력 (추후 사용)
CREATE TABLE IF NOT EXISTS alert_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  article_id BIGINT REFERENCES articles(id),
  alert_type TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 아파트 매매 실거래가 (국토교통부 API)
CREATE TABLE IF NOT EXISTS real_transactions (
  id BIGSERIAL PRIMARY KEY,
  sgg_cd TEXT NOT NULL,
  umd_nm TEXT NOT NULL,
  jibun TEXT,
  apt_nm TEXT NOT NULL,
  apt_dong TEXT,
  exclu_use_ar DOUBLE PRECISION,
  floor INTEGER,
  build_year INTEGER,
  deal_year INTEGER NOT NULL,
  deal_month INTEGER NOT NULL,
  deal_day INTEGER,
  deal_amount BIGINT NOT NULL,
  deal_amount_text TEXT,
  dealing_gbn TEXT,
  buyer_gbn TEXT,
  sler_gbn TEXT,
  estate_agent_sgg_nm TEXT,
  cdeal_type TEXT,
  cdeal_day TEXT,
  land_leasehold_gbn TEXT,
  rgst_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sgg_cd, apt_nm, exclu_use_ar, deal_year, deal_month, deal_day, floor, deal_amount)
);

-- ============================================
-- 2. 인덱스
-- ============================================

CREATE INDEX IF NOT EXISTS idx_complexes_property_type ON complexes(property_type);
CREATE INDEX IF NOT EXISTS idx_complexes_is_active ON complexes(is_active);
CREATE INDEX IF NOT EXISTS idx_complexes_name ON complexes(complex_name);

CREATE INDEX IF NOT EXISTS idx_articles_complex_id ON articles(complex_id);
CREATE INDEX IF NOT EXISTS idx_articles_hscp_no ON articles(hscp_no);
CREATE INDEX IF NOT EXISTS idx_articles_trade_type ON articles(trade_type);
CREATE INDEX IF NOT EXISTS idx_articles_is_bargain ON articles(is_bargain);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(article_status);
CREATE INDEX IF NOT EXISTS idx_articles_price ON articles(price_amount);
CREATE INDEX IF NOT EXISTS idx_articles_first_seen ON articles(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_articles_bargain_active ON articles(is_bargain, article_status);
CREATE INDEX IF NOT EXISTS idx_articles_tag_list ON articles USING GIN(tag_list);

CREATE INDEX IF NOT EXISTS idx_rt_sgg_cd ON real_transactions(sgg_cd);
CREATE INDEX IF NOT EXISTS idx_rt_apt_nm ON real_transactions(apt_nm);
CREATE INDEX IF NOT EXISTS idx_rt_deal_date ON real_transactions(deal_year, deal_month);
CREATE INDEX IF NOT EXISTS idx_rt_deal_amount ON real_transactions(deal_amount);
CREATE INDEX IF NOT EXISTS idx_rt_exclu_use_ar ON real_transactions(exclu_use_ar);
CREATE INDEX IF NOT EXISTS idx_rt_umd_nm ON real_transactions(umd_nm);

CREATE INDEX IF NOT EXISTS idx_price_history_article ON price_history(article_id);
CREATE INDEX IF NOT EXISTS idx_bargain_detections_article ON bargain_detections(article_id);
CREATE INDEX IF NOT EXISTS idx_collection_runs_started ON collection_runs(started_at);

-- ============================================
-- 3. updated_at 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_complexes_updated BEFORE UPDATE ON complexes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 4. 매물 제거 감지 지원
-- ============================================

ALTER TABLE articles ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE collection_runs ADD COLUMN IF NOT EXISTS removed_articles INTEGER DEFAULT 0;
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS last_collected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_articles_complex_trade_status
  ON articles(complex_id, trade_type, article_status);

-- ============================================
-- 완료
-- ============================================
SELECT 'Schema initialized successfully!' AS status;
