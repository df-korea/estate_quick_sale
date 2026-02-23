import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Complex, ComplexSearchResult, ComplexArticle } from '../types';

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

export function useComplexArticles(complexId: string | undefined, tradeType = 'A1') {
  const [data, setData] = useState<ComplexArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!complexId) return;
    setLoading(true);
    try {
      setData(await apiFetch<ComplexArticle[]>(`/complexes/${complexId}/articles?tradeType=${tradeType}`));
    } catch { /* ignore */ }
    setLoading(false);
  }, [complexId, tradeType]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}
