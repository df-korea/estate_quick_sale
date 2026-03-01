'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { Assessment } from '../types';

interface ScoreFactors {
  complex: number;
  tx: number;
  drops: number;
  magnitude: number;
}

interface Props {
  articleId: number;
  bargainScore: number;
  scoreFactors?: ScoreFactors | null;
  children: React.ReactNode;
}

export default function ScoreBreakdownPopover({ articleId, bargainScore, scoreFactors, children }: Props) {
  const [open, setOpen] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (scoreFactors) return; // already have inline factors
    setLoading(true);
    apiFetch<Assessment>(`/articles/${articleId}/assessment`)
      .then(setAssessment)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, articleId, scoreFactors]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const factors = scoreFactors
    ? [
        { name: '단지 대비', value: scoreFactors.complex },
        { name: '실거래 대비', value: scoreFactors.tx },
        { name: '인하 횟수', value: scoreFactors.drops },
        { name: '인하율', value: scoreFactors.magnitude },
      ].filter(f => f.value > 0)
    : assessment?.factors;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <div onClick={e => { e.stopPropagation(); setOpen(v => !v); }} style={{ cursor: 'pointer' }}>
        {children}
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: 'var(--white)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          padding: '12px 16px',
          minWidth: 180,
          zIndex: 500,
        }} onClick={e => e.stopPropagation()}>
          <div className="text-xs text-gray" style={{ marginBottom: 8 }}>
            급매점수 {bargainScore}점
          </div>
          {loading && <div className="text-xs text-gray">로딩중...</div>}
          {factors && factors.length > 0 && factors.map((f, i) => (
            <div key={i} className="flex items-center justify-between" style={{ padding: '3px 0' }}>
              <span className="text-sm">{f.name}</span>
              <span className="text-sm" style={{ fontWeight: 600, color: 'var(--blue-500)' }}>+{f.value}</span>
            </div>
          ))}
          {factors && factors.length === 0 && (
            <div className="text-xs text-gray">점수 구성 없음</div>
          )}
        </div>
      )}
    </div>
  );
}
