import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { SidoHeatmapItem, SigunguHeatmapItem, SigunguComplex } from '../types';

export function useSidoHeatmap() {
  const [data, setData] = useState<SidoHeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<SidoHeatmapItem[]>('/map/sido-heatmap')
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

export function useSigunguHeatmap(sidoName: string | null) {
  const [data, setData] = useState<SigunguHeatmapItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sidoName) { setData([]); return; }
    setLoading(true);
    apiFetch<SigunguHeatmapItem[]>(`/map/sigungu-heatmap?sido=${encodeURIComponent(sidoName)}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sidoName]);

  return { data, loading };
}

export function useSigunguComplexes(division: string | null) {
  const [data, setData] = useState<SigunguComplex[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!division) { setData([]); return; }
    setLoading(true);
    apiFetch<SigunguComplex[]>(`/map/sigungu-complexes?division=${encodeURIComponent(division)}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [division]);

  return { data, loading };
}
