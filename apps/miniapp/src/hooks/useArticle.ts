import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface ArticleDetail {
  id: number;
  atcl_no: string;
  complex_id: number;
  hscp_no: string;
  trade_type: string;
  price_text: string | null;
  price_amount: number | null;
  warrant_price_text: string | null;
  warrant_price_amount: number | null;
  rent_price_text: string | null;
  rent_price_amount: number | null;
  area_supply: number | null;
  area_exclusive: number | null;
  building_name: string | null;
  floor_info: string | null;
  floor_current: number | null;
  floor_total: number | null;
  direction: string | null;
  description: string | null;
  tag_list: string[] | null;
  rep_image_url: string | null;
  realtor_name: string | null;
  cp_name: string | null;
  same_addr_cnt: number | null;
  confirm_date: string | null;
  is_bargain: boolean;
  bargain_keyword: string | null;
  bargain_keyword_source: string | null;
  first_seen_at: string;
  last_seen_at: string;
  complexes: {
    complex_name: string;
    property_type: string;
    hscp_no: string;
    total_households: number | null;
  };
}

export interface PriceHistoryItem {
  id: number;
  price_amount: number | null;
  price_text: string | null;
  recorded_at: string;
}

export function useArticle(articleId: number | null) {
  return useQuery({
    queryKey: ['article', articleId],
    queryFn: () => apiFetch<ArticleDetail>(`/articles/${articleId}`),
    enabled: !!articleId,
  });
}

export function usePriceHistory(articleId: number | null) {
  return useQuery({
    queryKey: ['priceHistory', articleId],
    queryFn: () => apiFetch<PriceHistoryItem[]>(`/articles/${articleId}/price-history`),
    enabled: !!articleId,
  });
}
