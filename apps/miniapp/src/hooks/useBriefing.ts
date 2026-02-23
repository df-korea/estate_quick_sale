import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Briefing } from '../types';

export function useBriefing() {
  const [data, setData] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Briefing>('/briefing')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
