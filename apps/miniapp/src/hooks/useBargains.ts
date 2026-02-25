import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { BargainArticle, BargainSort, BargainMode, RegionBargainGroup } from '../types';

export function useBargains(limit = 50, bargainType?: BargainMode) {
  const [data, setData] = useState<BargainArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: String(limit) });
    if (bargainType && bargainType !== 'all') qs.set('bargain_type', bargainType);
    try {
      setData(await apiFetch<BargainArticle[]>(`/bargains?${qs}`));
    } catch { /* ignore */ }
    setLoading(false);
  }, [limit, bargainType]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

interface BargainCounts {
  count: number;
  keyword_count: number;
  price_count: number;
  both_count: number;
}

export function useBargainCount() {
  const [counts, setCounts] = useState<BargainCounts | null>(null);

  useEffect(() => {
    apiFetch<BargainCounts>('/bargains/count').then(setCounts).catch(() => {});
  }, []);

  return counts;
}

interface FilteredParams {
  sort?: BargainSort;
  district?: string;
  city?: string;
  bargainType?: BargainMode;
  limit?: number;
}

export function useFilteredBargains(params: FilteredParams) {
  const [data, setData] = useState<BargainArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (params.sort) qs.set('sort', params.sort);
    if (params.district) qs.set('district', params.district);
    if (params.city) qs.set('city', params.city);
    if (params.bargainType && params.bargainType !== 'all') qs.set('bargain_type', params.bargainType);
    if (params.limit) qs.set('limit', String(params.limit));
    try {
      setData(await apiFetch<BargainArticle[]>(`/bargains/filtered?${qs}`));
    } catch { /* ignore */ }
    setLoading(false);
  }, [params.sort, params.district, params.city, params.bargainType, params.limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useRegionBargains(limit = 5) {
  const [data, setData] = useState<RegionBargainGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<RegionBargainGroup[]>(`/bargains/by-region?limit=${limit}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading };
}
