'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { BargainArticle, BargainSort, BargainMode, RegionBargainGroup, WeeklyFeaturedItem } from '../types';

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

export function useRegionalTopBargains(
  sido: string | null, sigungu: string | null, limit = 10,
  propertyType?: string, priceMin?: number | null, priceMax?: number | null,
  sort?: string, bargainType?: string,
  minHouseholds?: number | null, minArea?: number | null, maxArea?: number | null, maxBuildYear?: number | null
) {
  const [data, setData] = useState<BargainArticle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sido) { setData([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ sido, limit: String(limit) });
    if (sigungu) qs.set('sigungu', sigungu);
    if (propertyType && propertyType !== 'all') qs.set('property_type', propertyType);
    if (priceMin) qs.set('price_min', String(priceMin));
    if (priceMax) qs.set('price_max', String(priceMax));
    if (sort && sort !== 'score_desc') qs.set('sort', sort);
    if (bargainType && bargainType !== 'price') qs.set('bargain_type', bargainType);
    if (minHouseholds) qs.set('min_households', String(minHouseholds));
    if (minArea) qs.set('min_area', String(minArea));
    if (maxArea) qs.set('max_area', String(maxArea));
    if (maxBuildYear) qs.set('max_build_year', String(maxBuildYear));
    apiFetch<BargainArticle[]>(`/bargains/regional-top?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sido, sigungu, limit, propertyType, priceMin, priceMax, sort, bargainType, minHouseholds, minArea, maxArea, maxBuildYear]);

  return { data, loading };
}

export function useWeeklyFeaturedBargains(sido: string | null) {
  const [data, setData] = useState<WeeklyFeaturedItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sido) { setData([]); return; }
    setLoading(true);
    apiFetch<WeeklyFeaturedItem[]>(`/bargains/weekly-featured?sido=${encodeURIComponent(sido)}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sido]);

  return { data, loading };
}

interface RegionalDivision {
  division: string;
  bargain_count: number;
}

export function useRegionalTopDivisions(sido: string | null, propertyType?: string) {
  const [data, setData] = useState<RegionalDivision[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sido) { setData([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ sido });
    if (propertyType && propertyType !== 'all') qs.set('property_type', propertyType);
    apiFetch<RegionalDivision[]>(`/bargains/regional-top-divisions?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sido, propertyType]);

  return { data, loading };
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
