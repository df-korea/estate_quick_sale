import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface ComplexSearchResult {
  id: number;
  hscp_no: string;
  complex_name: string;
  property_type: string;
  total_households: number | null;
  deal_count: number;
  lease_count: number;
  rent_count: number;
}

export function useComplexSearch(query: string) {
  return useQuery({
    queryKey: ['complexSearch', query],
    queryFn: () => apiFetch<ComplexSearchResult[]>(`/complexes/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });
}

export function useComplexArticles(complexId: number | null, tradeType = 'A1') {
  return useQuery({
    queryKey: ['complexArticles', complexId, tradeType],
    queryFn: () => apiFetch<any[]>(`/complexes/${complexId}/articles?tradeType=${tradeType}`),
    enabled: !!complexId,
  });
}
