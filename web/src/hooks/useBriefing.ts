'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Briefing } from '../types';

export function useBriefing(initialData?: Briefing | null) {
  const [data, setData] = useState<Briefing | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const skipFirst = useRef(!!initialData);

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    apiFetch<Briefing>('/briefing')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
