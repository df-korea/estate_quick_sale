'use client';

import { useMemo } from 'react';
import { PRICE_OPTIONS } from '@/utils/constants';

// Steps: 0 = no min, 1..N = PRICE_OPTIONS, N+1 = no max
const STEPS = PRICE_OPTIONS.length + 2; // 0..12

function stepToValue(step: number): number | null {
  if (step <= 0) return null;
  if (step > PRICE_OPTIONS.length) return null;
  return PRICE_OPTIONS[step - 1].value;
}

function valueToStep(val: number | null, isMax: boolean): number {
  if (val == null) return isMax ? STEPS - 1 : 0;
  const idx = PRICE_OPTIONS.findIndex(p => p.value === val);
  return idx >= 0 ? idx + 1 : (isMax ? STEPS - 1 : 0);
}

function stepLabel(step: number): string {
  if (step <= 0) return '제한없음';
  if (step > PRICE_OPTIONS.length) return '제한없음';
  return PRICE_OPTIONS[step - 1].label;
}

interface Props {
  min: number | null;
  max: number | null;
  onMinChange: (v: number | null) => void;
  onMaxChange: (v: number | null) => void;
}

export default function DualRangeSlider({ min, max, onMinChange, onMaxChange }: Props) {
  const minStep = valueToStep(min, false);
  const maxStep = valueToStep(max, true);
  const maxIdx = STEPS - 1;

  const leftPct = useMemo(() => (minStep / maxIdx) * 100, [minStep, maxIdx]);
  const rightPct = useMemo(() => (maxStep / maxIdx) * 100, [maxStep, maxIdx]);

  const rangeLabel = useMemo(() => {
    if (min == null && max == null) return '전체 가격';
    if (min == null) return `~ ${stepLabel(maxStep)}`;
    if (max == null) return `${stepLabel(minStep)} ~`;
    return `${stepLabel(minStep)} ~ ${stepLabel(maxStep)}`;
  }, [min, max, minStep, maxStep]);

  return (
    <div style={{ padding: '4px 0 12px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="text-sm" style={{ fontWeight: 600, color: 'var(--blue-600)' }}>{rangeLabel}</span>
        {(min != null || max != null) && (
          <button
            onClick={() => { onMinChange(null); onMaxChange(null); }}
            className="text-xs"
            style={{ color: 'var(--gray-400)', padding: '2px 6px' }}
          >초기화</button>
        )}
      </div>
      <div className="dual-range-wrapper">
        <div className="dual-range-track" />
        <div
          className="dual-range-active"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />
        <input
          type="range"
          className="dual-range-input"
          min={0} max={maxIdx} value={minStep}
          onChange={e => {
            const v = Number(e.target.value);
            if (v < maxStep) onMinChange(stepToValue(v));
          }}
        />
        <input
          type="range"
          className="dual-range-input"
          min={0} max={maxIdx} value={maxStep}
          onChange={e => {
            const v = Number(e.target.value);
            if (v > minStep) onMaxChange(stepToValue(v));
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray" style={{ marginTop: 2 }}>
        <span>5천만</span>
        <span>50억</span>
      </div>
    </div>
  );
}
