/* ── Article (매물) ── */
export interface Article {
  id: number;
  article_no: string;
  complex_id: number;
  trade_type: string; // A1=매매, B1=전세, B2=월세
  deal_price: number; // 원 단위
  warranty_price: number | null;
  rent_price: number | null;
  formatted_price: string;
  exclusive_space: number;
  supply_space: number | null;
  target_floor: string | null;
  total_floor: string | null;
  direction: string | null;
  description: string | null;
  dong_name: string | null;
  image_url: string | null;
  brokerage_name: string | null;
  bargain_keyword: string | null;
  bargain_type: 'keyword' | 'price' | 'both' | null;
  bargain_score: number;
  is_bargain: boolean;
  first_seen_at: string;
  management_fee: number | null;
  verification_type: string | null;
  price_change_status: string | null;
  image_count: number | null;
  article_status: string;
}

/* ── Article with complex info (from /api/bargains, /api/bargains/filtered) ── */
export interface BargainArticle extends Article {
  complex_name: string;
  property_type: string | null;
  hscp_no: string | null;
  price_change_count: number;
  initial_price: number | null;
  score_factors: { complex: number; tx: number; drops: number; magnitude: number } | null;
}

/* ── Article Detail (from /api/articles/:id) ── */
export interface ArticleDetail extends Article {
  complexes: {
    complex_name: string;
    property_type: string | null;
    hscp_no: string | null;
    total_households: number | null;
    sgg_cd: string | null;
    rt_apt_nm: string | null;
  };
  price_change_count: number;
  initial_price: number | null;
}

/* ── Complex (단지) ── */
export interface Complex {
  id: number;
  hscp_no: string;
  complex_name: string;
  property_type: string | null;
  total_households: number | null;
  deal_count: number;
  lease_count: number;
  rent_count: number;
  city: string | null;
  division: string | null;
  sector: string | null;
  lat: number | null;
  lon: number | null;
  building_date: string | null;
  sgg_cd: string | null;
  rt_apt_nm: string | null;
}

/* ── Complex Search Result ── */
export interface ComplexSearchResult {
  id: number;
  hscp_no: string;
  complex_name: string;
  property_type: string | null;
  total_households: number | null;
  deal_count: number;
  lease_count: number;
  rent_count: number;
}

/* ── Complex Article (from /api/complexes/:id/articles) ── */
export interface ComplexArticle {
  id: number;
  article_no: string;
  trade_type: string;
  deal_price: number;
  warranty_price: number | null;
  rent_price: number | null;
  formatted_price: string;
  exclusive_space: number;
  space_name: string | null;
  dong_name: string | null;
  target_floor: string | null;
  total_floor: string | null;
  direction: string | null;
  description: string | null;
  is_bargain: boolean;
  bargain_keyword: string | null;
  bargain_score: number;
  score_factors: { complex: number; tx: number; drops: number; magnitude: number } | null;
  first_seen_at: string;
  price_change_count: number;
}

/* ── Price History ── */
export interface PriceHistoryEntry {
  id: number;
  deal_price: number;
  formatted_price: string;
  source: string;
  modified_date: string | null;
  recorded_at: string;
}

/* ── Assessment ── */
export interface Assessment {
  score: number;
  factors: { name: string; value: number }[];
  discount_vs_complex: number | null;
  discount_vs_transaction: number | null;
  complex_avg_price: number | null;
  complex_listing_count: number;
  tx_avg_price: number | null;
  tx_count: number;
  days_on_market: number;
  price_change_count: number;
  is_lowest_in_complex: boolean;
}

/* ── Map Data ── */
export interface SidoHeatmapItem {
  sido_name: string;
  total_articles: number;
  bargain_count: number;
  bargain_ratio: number;
  complex_count: number;
}

export interface SigunguHeatmapItem {
  sgg_name: string;
  total_articles: number;
  bargain_count: number;
  bargain_ratio: number;
  complex_count: number;
}

export interface SigunguComplex {
  complex_id: number;
  complex_name: string;
  lat: number | null;
  lon: number | null;
  total_articles: number;
  bargain_count: number;
  bargain_ratio: number;
  avg_price: number | null;
}

/* ── Briefing ── */
export interface Briefing {
  summary: {
    total_bargains: number;
    total_articles: number;
    new_today: number;
    new_bargains_today: number;
    price_changes_today: number;
    removed_today: number;
  };
  new_bargains: {
    id: number;
    deal_price: number;
    formatted_price: string;
    exclusive_space: number;
    complex_name: string;
    bargain_keyword: string | null;
    first_seen_at: string;
  }[];
  price_drops: {
    article_id: number;
    complex_name: string;
    exclusive_space: number;
    new_price: number;
    formatted_price: string;
    prev_price: number;
    change_pct: number;
    recorded_at: string;
  }[];
  hot_complexes: {
    complex_id: number;
    complex_name: string;
    recent_bargains: number;
  }[];
}

/* ── Analysis ── */
export interface AnalysisOverview {
  total_bargains: number;
  total_articles: number;
  bargain_ratio: number;
  new_today: number;
  price_changes_today: number;
}

export interface LeaderboardItem {
  complex_id: number;
  complex_name: string;
  city: string | null;
  division: string | null;
  sector: string | null;
  bargain_count: number;
  total_count: number;
  bargain_ratio: number;
  avg_price: number | null;
  avg_bargain_score: number | null;
}

export interface PriceChangeItem {
  article_id: number;
  complex_name: string;
  exclusive_space: number;
  new_price: number;
  new_price_text: string;
  prev_price: number;
  change_pct: number;
  recorded_at: string;
}

/* ── Top Price Drop ── */
export interface TopPriceDropItem {
  article_id: number;
  complex_name: string;
  complex_id: number;
  hscp_no: string | null;
  exclusive_space: number;
  formatted_price: string;
  target_floor: string | null;
  total_floor: string | null;
  bargain_score: number;
  bargain_keyword: string | null;
  initial_price: number;
  current_price: number;
  drop_amount: number;
  drop_pct: number;
  drop_count: number;
}

/* ── Watchlist ── */
export interface WatchlistComplex {
  complex_id: number;
  complex_name: string;
  total_articles: number;
  bargain_count: number;
  new_today: number;
  avg_price: number | null;
  min_price: number | null;
}

/* ── Stats ── */
export interface Stats {
  complexCount: number;
  articleCount: number;
  bargainCount: number;
  removedCount: number;
  realTransactionCount: number;
  lastCollectionAt: string | null;
  recentRuns: {
    id: number;
    mode: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    articles_upserted: number | null;
    articles_removed: number | null;
    errors: number | null;
  }[];
}

/* ── Real Transaction ── */
export interface PriceTrendItem {
  month: string;
  tx_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  avg_price_per_pyeong: number | null;
}

/* ── Drill-down State ── */
export type DrillLevel = 'sido' | 'sigungu' | 'complex';

export type TradeFilter = 'all' | 'A1' | 'B1' | 'B2';

export type BargainSort = 'newest' | 'price_asc' | 'price_desc' | 'score_desc';

export type BargainMode = 'all' | 'keyword' | 'price';

/* ── Region Bargain Group ── */
export interface RegionBargainArticle {
  id: number;
  article_no: string;
  complex_id: number;
  trade_type: string;
  deal_price: number;
  formatted_price: string;
  warranty_price: number | null;
  rent_price: number | null;
  exclusive_space: number;
  target_floor: string | null;
  total_floor: string | null;
  direction: string | null;
  description: string | null;
  bargain_keyword: string | null;
  bargain_type: string | null;
  bargain_score: number;
  first_seen_at: string;
  complex_name: string;
  division: string;
  hscp_no: string | null;
}

export interface RegionBargainGroup {
  division: string;
  articles: RegionBargainArticle[];
  count: number;
}

/* ── Complex Pyeong Type (from /api/complexes/:id/pyeong-types) ── */
export interface ComplexPyeongType {
  space_name: string;
  exclusive_space: number;
  pyeong: number;
  article_count: number;
}

/* ── Complex Dong (from /api/complexes/:id/dongs) ── */
export interface ComplexDong {
  dong_name: string;
  article_count: number;
}

/* ── Market (실거래가 — complex_id FK 기반) ── */
export interface MarketAreaType {
  area_bucket: number;
  pyeong: number;
  tx_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

export interface MarketTrendItem {
  month: string;
  tx_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

export interface MarketTransaction {
  deal_year: number;
  deal_month: number;
  deal_day: number | null;
  deal_amount: number;
  floor: number | null;
  pyeong_name: string;
  is_cancel: boolean;
}

export interface MarketFloorAnalysis {
  floor: number;
  tx_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

export interface MarketStats {
  total_count: number;
  area_type_count: number;
  earliest: number | null;
  latest: number | null;
}

/* ── Dong Rankings ── */
export interface DongRankingItem {
  city: string;
  division: string;
  sector: string;
  region_name: string;
  bargain_count: number;
  avg_bargain_score: number;
  avg_price: number | null;
}

export interface DongArticle {
  id: number;
  article_no: string;
  deal_price: number;
  formatted_price: string;
  exclusive_space: number;
  target_floor: string | null;
  total_floor: string | null;
  bargain_keyword: string | null;
  bargain_score: number;
  first_seen_at: string;
  bargain_type: string | null;
  complex_name: string;
  complex_id: number;
  hscp_no: string | null;
}
