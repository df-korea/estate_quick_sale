import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { SidoHeatmapItem, SigunguHeatmapItem, SigunguComplex, BargainMode } from '../types';

export function useSidoHeatmap(bargainType?: BargainMode) {
  const [data, setData] = useState<SidoHeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = bargainType && bargainType !== 'all' ? `?bargain_type=${bargainType}` : '';
    apiFetch<SidoHeatmapItem[]>(`/map/sido-heatmap${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [bargainType]);

  return { data, loading };
}

export function useSigunguHeatmap(sidoName: string | null, bargainType?: BargainMode) {
  const [data, setData] = useState<SigunguHeatmapItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sidoName) { setData([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ sido: sidoName });
    if (bargainType && bargainType !== 'all') qs.set('bargain_type', bargainType);
    apiFetch<SigunguHeatmapItem[]>(`/map/sigungu-heatmap?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sidoName, bargainType]);

  return { data, loading };
}

export function useSigunguComplexes(division: string | null, city?: string | null) {
  const [data, setData] = useState<SigunguComplex[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!division) { setData([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ division });
    if (city) qs.set('city', city);
    apiFetch<SigunguComplex[]>(`/map/sigungu-complexes?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [division, city]);

  return { data, loading };
}
