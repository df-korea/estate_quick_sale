import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiPost } from '../lib/api';
import type { Complex, ComplexSearchResult, ComplexArticle, ComplexPyeongType, ComplexDong } from '../types';

export interface PopularComplex {
  id: number;
  complex_name: string;
  property_type: string | null;
  total_households: number | null;
  deal_count: number;
  lease_count: number;
  rent_count: number;
  view_count: number;
}

export function usePopularComplexes() {
  const [data, setData] = useState<PopularComplex[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PopularComplex[]>('/complexes/popular')
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

export function trackComplexView(complexId: string | number) {
  apiPost(`/complexes/${complexId}/view`, {}).catch(() => {});
}

export function useComplexSearch(query: string) {
  const [results, setResults] = useState<ComplexSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      apiFetch<ComplexSearchResult[]>(`/complexes/search?q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}

export function useComplex(id: string | undefined) {
  const [data, setData] = useState<Complex | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<Complex>(`/complexes/${id}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

export function useComplexArticles(
  complexId: string | undefined,
  tradeType = 'A1',
  sort = 'price_asc',
  bargainOnly = false,
  spaceName?: string,
  dongName?: string,
  bargainType?: string,
) {
  const [data, setData] = useState<ComplexArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!complexId) return;
    setLoading(true);
    const qs = new URLSearchParams({ tradeType, sort });
    if (bargainOnly) qs.set('bargainOnly', 'true');
    if (bargainType) qs.set('bargainType', bargainType);
    if (spaceName) qs.set('spaceName', spaceName);
    if (dongName) qs.set('dongName', dongName);
    try {
      setData(await apiFetch<ComplexArticle[]>(`/complexes/${complexId}/articles?${qs}`));
    } catch { /* ignore */ }
    setLoading(false);
  }, [complexId, tradeType, sort, bargainOnly, bargainType, spaceName, dongName]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useComplexPyeongTypes(complexId: string | undefined) {
  const [data, setData] = useState<ComplexPyeongType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setData([]); setLoading(false); return; }
    apiFetch<ComplexPyeongType[]>(`/complexes/${complexId}/pyeong-types`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [complexId]);

  return { data, loading };
}

export function useComplexDongs(complexId: string | undefined) {
  const [data, setData] = useState<ComplexDong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setData([]); setLoading(false); return; }
    apiFetch<ComplexDong[]>(`/complexes/${complexId}/dongs`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [complexId]);

  return { data, loading };
}
