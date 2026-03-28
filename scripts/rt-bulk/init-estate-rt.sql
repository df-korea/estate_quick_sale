-- estate_rt 데이터베이스 DDL
-- 실행: psql -h localhost -p 8081 -U estate_app -d estate_rt -f scripts/rt-bulk/init-estate-rt.sql

BEGIN;

-- ============================================
-- 1. 매매 테이블 (아파트/오피스텔/분양권)
-- ============================================
CREATE TABLE IF NOT EXISTS real_transactions (
  id              BIGSERIAL PRIMARY KEY,
  trade_type      TEXT NOT NULL,           -- APT_TRADE, OFFI_TRADE, PRESALE_TRADE
  sgg_cd          TEXT,                    -- 시군구코드 (역매핑)
  sido_nm         TEXT,                    -- 시도명
  sgg_nm          TEXT,                    -- 시군구명
  umd_nm          TEXT,                    -- 읍면동명
  jibun           TEXT,                    -- 번지
  bonbun          TEXT,                    -- 본번
  bubun           TEXT,                    -- 부번
  apt_nm          TEXT NOT NULL,           -- 단지명
  exclu_use_ar    DOUBLE PRECISION,        -- 전용면적(㎡)
  contract_ym     TEXT,                    -- 계약년월 (YYYYMM)
  contract_day    TEXT,                    -- 계약일
  deal_amount     BIGINT NOT NULL,         -- 거래금액(만원)
  dong            TEXT,                    -- 동
  floor           INTEGER,                 -- 층
  buyer_gbn       TEXT,                    -- 매수자
  sler_gbn        TEXT,                    -- 매도자
  build_year      INTEGER,                 -- 건축년도
  road_nm         TEXT,                    -- 도로명
  cdeal_day       TEXT,                    -- 해제사유발생일
  dealing_gbn     TEXT,                    -- 거래유형
  estate_agent_sgg_nm TEXT,                -- 중개사소재지
  rgst_date       TEXT,                    -- 등기일자
  deal_year       INTEGER,                 -- 파싱: contract_ym 앞 4자리
  deal_month      INTEGER,                 -- 파싱: contract_ym 뒤 2자리
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE real_transactions
  ADD CONSTRAINT uq_rt_sale UNIQUE
  (trade_type, sgg_cd, apt_nm, exclu_use_ar, deal_year, deal_month, contract_day, floor, deal_amount);

-- ============================================
-- 2. 전월세 테이블 (아파트/오피스텔)
-- ============================================
CREATE TABLE IF NOT EXISTS real_rent_transactions (
  id              BIGSERIAL PRIMARY KEY,
  trade_type      TEXT NOT NULL,           -- APT_RENT, OFFI_RENT
  sgg_cd          TEXT,
  sido_nm         TEXT,
  sgg_nm          TEXT,
  umd_nm          TEXT,
  jibun           TEXT,
  bonbun          TEXT,
  bubun           TEXT,
  apt_nm          TEXT NOT NULL,           -- 단지명
  exclu_use_ar    DOUBLE PRECISION,        -- 전용면적(㎡)
  contract_ym     TEXT,                    -- 계약년월
  contract_day    TEXT,                    -- 계약일
  deposit         BIGINT,                  -- 보증금(만원)
  monthly_rent    BIGINT,                  -- 월세(만원), 0=전세
  dong            TEXT,
  floor           INTEGER,
  build_year      INTEGER,
  road_nm         TEXT,
  contract_type   TEXT,                    -- 계약구분 (신규/갱신)
  contract_period TEXT,                    -- 계약기간
  renewal_right_used TEXT,                 -- 갱신요구권사용
  previous_deposit TEXT,                   -- 종전보증금
  previous_monthly_rent TEXT,              -- 종전월세
  cdeal_day       TEXT,                    -- 해제사유발생일
  dealing_gbn     TEXT,                    -- 거래유형
  estate_agent_sgg_nm TEXT,                -- 중개사소재지
  deal_year       INTEGER,
  deal_month      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE real_rent_transactions
  ADD CONSTRAINT uq_rt_rent UNIQUE
  (trade_type, sgg_cd, apt_nm, exclu_use_ar, deal_year, deal_month, contract_day, floor, deposit, monthly_rent);

-- ============================================
-- 3. 다운로드 진행 추적
-- ============================================
CREATE TABLE IF NOT EXISTS download_progress (
  id              BIGSERIAL PRIMARY KEY,
  task_key        TEXT NOT NULL UNIQUE,    -- e.g. 'APT_TRADE|200601'
  trade_type      TEXT NOT NULL,
  year_month      TEXT NOT NULL,           -- YYYYMM
  status          TEXT DEFAULT 'pending',  -- pending/downloading/downloaded/importing/imported/error
  csv_path        TEXT,
  csv_size        BIGINT DEFAULT 0,
  row_count       INTEGER DEFAULT 0,
  error_msg       TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 인덱스
-- ============================================

-- 매매
CREATE INDEX idx_rt_trade_type ON real_transactions(trade_type);
CREATE INDEX idx_rt_sgg_cd ON real_transactions(sgg_cd);
CREATE INDEX idx_rt_apt_nm ON real_transactions(apt_nm);
CREATE INDEX idx_rt_deal_date ON real_transactions(deal_year, deal_month);
CREATE INDEX idx_rt_deal_amount ON real_transactions(deal_amount);
CREATE INDEX idx_rt_exclu_use_ar ON real_transactions(exclu_use_ar);
CREATE INDEX idx_rt_composite ON real_transactions(trade_type, sgg_cd, deal_year, deal_month);

-- 전월세
CREATE INDEX idx_rrt_trade_type ON real_rent_transactions(trade_type);
CREATE INDEX idx_rrt_sgg_cd ON real_rent_transactions(sgg_cd);
CREATE INDEX idx_rrt_apt_nm ON real_rent_transactions(apt_nm);
CREATE INDEX idx_rrt_deal_date ON real_rent_transactions(deal_year, deal_month);
CREATE INDEX idx_rrt_deposit ON real_rent_transactions(deposit);
CREATE INDEX idx_rrt_composite ON real_rent_transactions(trade_type, sgg_cd, deal_year, deal_month);

COMMIT;
