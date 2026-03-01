import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { SidoHeatmapItem, SigunguHeatmapItem, SigunguComplex, BargainMode, PropertyType } from '../types';

export function useSidoHeatmap(bargainType?: BargainMode, propertyType?: PropertyType) {
  const [data, setData] = useState<SidoHeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (bargainType && bargainType !== 'all') qs.set('bargain_type', bargainType);
    if (propertyType && propertyType !== 'all') qs.set('property_type', propertyType);
    const qsStr = qs.toString();
    apiFetch<SidoHeatmapItem[]>(`/map/sido-heatmap${qsStr ? `?${qsStr}` : ''}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [bargainType, propertyType]);

  return { data, loading };
}

export function useSigunguHeatmap(sidoName: string | null, bargainType?: BargainMode, propertyType?: PropertyType) {
  const [data, setData] = useState<SigunguHeatmapItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sidoName) { setData([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ sido: sidoName });
    if (bargainType && bargainType !== 'all') qs.set('bargain_type', bargainType);
    if (propertyType && propertyType !== 'all') qs.set('property_type', propertyType);
    apiFetch<SigunguHeatmapItem[]>(`/map/sigungu-heatmap?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sidoName, bargainType, propertyType]);

  return { data, loading };
}

export function useSigunguComplexes(division: string | null, city?: string | null, bargainType?: BargainMode, propertyType?: PropertyType) {
  const [data, setData] = useState<SigunguComplex[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!division) { setData([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ division });
    if (city) qs.set('city', city);
    if (bargainType && bargainType !== 'all') qs.set('bargain_type', bargainType);
    if (propertyType && propertyType !== 'all') qs.set('property_type', propertyType);
    apiFetch<SigunguComplex[]>(`/map/sigungu-complexes?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [division, city, bargainType, propertyType]);

  return { data, loading };
}
