import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { BargainArticle, BargainSort } from '../types';

export function useBargains(limit = 50) {
  const [data, setData] = useState<BargainArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<BargainArticle[]>(`/bargains?limit=${limit}`));
    } catch { /* ignore */ }
    setLoading(false);
  }, [limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useBargainCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ count: number }>('/bargains/count').then(r => setCount(r.count)).catch(() => {});
  }, []);

  return count;
}

interface FilteredParams {
  sort?: BargainSort;
  district?: string;
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
    if (params.limit) qs.set('limit', String(params.limit));
    try {
      setData(await apiFetch<BargainArticle[]>(`/bargains/filtered?${qs}`));
    } catch { /* ignore */ }
    setLoading(false);
  }, [params.sort, params.district, params.limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}
