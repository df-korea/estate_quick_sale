'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { RtSidoChangeRate, RtSigunguChangeRate, RtComplexChangeRate, RtWeeklyItem, RtPeriod, PropertyType } from '../types';

// 시도: KB 가격지수 (weeks = N주 전 대비)
export function useRtSidoChangeRate(weeks: number = 1) {
  const [data, setData] = useState<RtSidoChangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<RtSidoChangeRate[]>(`/real-transactions/change-rate/sido?weeks=${weeks}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [weeks]);

  return { data, loading };
}

// 시군구: KB 가격지수 (weeks = N주 전 대비)
export function useRtSigunguChangeRate(sido: string | null, weeks: number = 1) {
  const [data, setData] = useState<RtSigunguChangeRate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sido) { setData([]); return; }
    setLoading(true);
    apiFetch<RtSigunguChangeRate[]>(`/real-transactions/change-rate/sigungu?sido=${encodeURIComponent(sido)}&weeks=${weeks}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sido, weeks]);

  return { data, loading };
}

// 단지: 실거래 평당가 중위값 (period + propertyType 적용)
export function useRtComplexChangeRate(division: string | null, city?: string | null, period: RtPeriod = '1m', propertyType?: PropertyType) {
  const [data, setData] = useState<RtComplexChangeRate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!division) { setData([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ division, period });
    if (city) qs.set('city', city);
    if (propertyType && propertyType !== 'all') qs.set('property_type', propertyType);
    apiFetch<RtComplexChangeRate[]>(`/real-transactions/change-rate/complex?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [division, city, period, propertyType]);

  return { data, loading };
}

export function useRtWeekly(sido: string | null) {
  const [data, setData] = useState<RtWeeklyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (sido) qs.set('sido', sido);
    apiFetch<RtWeeklyItem[]>(`/real-transactions/weekly?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sido]);

  return { data, loading };
}
