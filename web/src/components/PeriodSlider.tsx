'use client';

import { useState, useRef, useCallback } from 'react';
import type { RtPeriod } from '@/types';

const STEPS: { value: RtPeriod; label: string }[] = [
  { value: '1w', label: '1주' },
  { value: '2w', label: '2주' },
  { value: '1m', label: '1개월' },
  { value: '3m', label: '3개월' },
  { value: '6m', label: '6개월' },
  { value: '1y', label: '1년' },
];

interface Props {
  value: RtPeriod;
  onChange: (period: RtPeriod) => void;
}

export default function PeriodSlider({ value, onChange }: Props) {
  const currentIdx = STEPS.findIndex(s => s.value === value);
  const [dragIdx, setDragIdx] = useState(currentIdx);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setDragIdx(idx);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(STEPS[idx].value);
    }, 300);
  }, [onChange]);

  return (
    <div style={{ padding: '8px 4px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 500 }}>기간</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-500)' }}>
          {STEPS[dragIdx]?.label}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={dragIdx}
        onChange={handleInput}
        style={{
          width: '100%',
          height: 4,
          accentColor: 'var(--blue-500)',
          cursor: 'pointer',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        {STEPS.map((s, i) => (
          <span key={s.value} style={{
            fontSize: 10,
            color: i === dragIdx ? 'var(--blue-500)' : 'var(--gray-400)',
            fontWeight: i === dragIdx ? 700 : 400,
          }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
