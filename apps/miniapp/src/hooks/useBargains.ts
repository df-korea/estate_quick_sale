import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface BargainArticle {
  id: number;
  atcl_no: string;
  complex_id: number;
  trade_type: string;
  price_text: string | null;
  price_amount: number | null;
  warrant_price_text: string | null;
  rent_price_text: string | null;
  area_exclusive: number | null;
  floor_info: string | null;
  direction: string | null;
  description: string | null;
  building_name: string | null;
  rep_image_url: string | null;
  realtor_name: string | null;
  bargain_keyword: string | null;
  first_seen_at: string;
  tag_list: string[] | null;
  // Joined from complexes
  complex_name: string;
  property_type: string;
  hscp_no: string;
}

export function useBargains(limit = 50) {
  return useQuery({
    queryKey: ['bargains', limit],
    queryFn: () => apiFetch<BargainArticle[]>(`/bargains?limit=${limit}`),
    staleTime: 60_000,
  });
}

export function useBargainCount() {
  return useQuery({
    queryKey: ['bargainCount'],
    queryFn: async () => {
      const data = await apiFetch<{ count: number }>('/bargains/count');
      return data.count;
    },
    staleTime: 60_000,
  });
}
