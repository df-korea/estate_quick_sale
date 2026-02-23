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
}

/* ── Article Detail (from /api/articles/:id) ── */
export interface ArticleDetail extends Article {
  complexes: {
    complex_name: string;
    property_type: string | null;
    hscp_no: string | null;
    total_households: number | null;
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
  deal_price: number;
  formatted_price: string;
  exclusive_space: number;
  target_floor: string | null;
  total_floor: string | null;
  direction: string | null;
  description: string | null;
  is_bargain: boolean;
  bargain_keyword: string | null;
  first_seen_at: string;
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
  bargain_count: number;
  total_count: number;
  bargain_ratio: number;
  avg_price: number | null;
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

export interface RealTransactionSummary {
  apt_nm: string;
  sgg_cd: string;
  umd_nm: string;
  exclu_use_ar: number;
  tx_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  latest_deal: number;
}

/* ── Drill-down State ── */
export type DrillLevel = 'sido' | 'sigungu' | 'complex';

export type TradeFilter = 'all' | 'A1' | 'B1' | 'B2';

export type BargainSort = 'newest' | 'price_asc' | 'price_desc';
