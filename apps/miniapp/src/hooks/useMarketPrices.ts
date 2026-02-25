import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type {
  MarketStats,
  MarketAreaType,
  MarketTrendItem,
  MarketTransaction,
  MarketFloorAnalysis,
} from '../types';

export function useMarketStats(complexId: string | undefined) {
  const [data, setData] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setData(null); setLoading(false); return; }
    setLoading(true);
    apiFetch<MarketStats>(`/complexes/${complexId}/market/stats`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [complexId]);

  return { data, loading };
}

export function useMarketAreaTypes(complexId: string | undefined) {
  const [data, setData] = useState<MarketAreaType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setData([]); setLoading(false); return; }
    setLoading(true);
    apiFetch<MarketAreaType[]>(`/complexes/${complexId}/market/area-types`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [complexId]);

  return { data, loading };
}

export function useMarketTrend(complexId: string | undefined, areaBucket?: number | null, months = 36) {
  const [data, setData] = useState<MarketTrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setData([]); setLoading(false); return; }
    const qs = new URLSearchParams({ months: String(months) });
    if (areaBucket != null) qs.set('areaBucket', String(areaBucket));
    setLoading(true);
    apiFetch<MarketTrendItem[]>(`/complexes/${complexId}/market/trend?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [complexId, areaBucket, months]);

  return { data, loading };
}

export function useMarketTransactions(complexId: string | undefined, areaBucket?: number | null, limit = 50) {
  const [data, setData] = useState<MarketTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setData([]); setLoading(false); return; }
    const qs = new URLSearchParams({ limit: String(limit) });
    if (areaBucket != null) qs.set('areaBucket', String(areaBucket));
    setLoading(true);
    apiFetch<MarketTransaction[]>(`/complexes/${complexId}/market/transactions?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [complexId, areaBucket, limit]);

  return { data, loading };
}

export function useMarketFloorAnalysis(complexId: string | undefined, areaBucket?: number | null) {
  const [data, setData] = useState<MarketFloorAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setData([]); setLoading(false); return; }
    const qs = new URLSearchParams();
    if (areaBucket != null) qs.set('areaBucket', String(areaBucket));
    setLoading(true);
    apiFetch<MarketFloorAnalysis[]>(`/complexes/${complexId}/market/floor-analysis?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [complexId, areaBucket]);

  return { data, loading };
}
