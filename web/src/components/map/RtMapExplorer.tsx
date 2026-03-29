'use client';

import { useState, useRef, useCallback } from 'react';
import type { DrillLevel, PropertyType, RtPeriod } from '../../types';
import { useRtSidoChangeRate, useRtSigunguChangeRate, useRtComplexChangeRate } from '../../hooks/useRtMapData';
import RtSidoMap from './RtSidoMap';
import RtSigunguMap from './RtSigunguMap';
import RtKakaoComplexMap from './RtKakaoComplexMap';
import RtMapLegend from './RtMapLegend';
import Breadcrumb from '../Breadcrumb';
import PeriodSlider from '../PeriodSlider';
import LoadingSpinner from '../LoadingSpinner';

// KB 기간 슬라이더 스텝 (아실 스타일 드래그)
const KB_STEPS = [
  { weeks: 1, label: '1주' },
  { weeks: 2, label: '2주' },
  { weeks: 4, label: '1개월' },
  { weeks: 6, label: '6주' },
  { weeks: 8, label: '2개월' },
];

export default function RtMapExplorer() {
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('sido');
  const [selectedSido, setSelectedSido] = useState<string | null>(null);
  const [selectedSigungu, setSelectedSigungu] = useState<string | null>(null);
  const [kbStepIdx, setKbStepIdx] = useState(0);
  const [kbWeeks, setKbWeeks] = useState(1);
  const kbDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [period, setPeriod] = useState<RtPeriod>('1m');
  const [propertyType, setPropertyType] = useState<PropertyType>('all');

  const handleKbSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setKbStepIdx(idx);
    if (kbDebounceRef.current) clearTimeout(kbDebounceRef.current);
    kbDebounceRef.current = setTimeout(() => {
      setKbWeeks(KB_STEPS[idx].weeks);
    }, 300);
  }, []);

  const { data: sidoData, loading: sidoLoading } = useRtSidoChangeRate(kbWeeks);
  const { data: sigunguData, loading: sigunguLoading } = useRtSigunguChangeRate(selectedSido, kbWeeks);
  const { data: complexData, loading: complexLoading } = useRtComplexChangeRate(selectedSigungu, selectedSido, period, propertyType);

  function navigateTo(level: DrillLevel, sido: string | null, sigungu: string | null) {
    setDrillLevel(level);
    setSelectedSido(sido);
    setSelectedSigungu(sigungu);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 4px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>
          {drillLevel === 'complex' ? '단지별 실거래 변동' : 'KB 매매가격지수'}
        </div>
        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
          {drillLevel === 'complex' ? '평당가 중위값 기준' : '출처: KB부동산'}
        </span>
      </div>

      {/* KB 기간 슬라이더: 시도/시군구 레벨 (아실 스타일 드래그) */}
      {drillLevel !== 'complex' && (
        <div style={{ padding: '4px 4px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 500 }}>비교 기간</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-500)' }}>
              {KB_STEPS[kbStepIdx].label} 변동
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={KB_STEPS.length - 1}
            step={1}
            value={kbStepIdx}
            onChange={handleKbSlider}
            style={{ width: '100%', height: 4, accentColor: 'var(--blue-500)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            {KB_STEPS.map((s, i) => (
              <span key={s.weeks} style={{
                fontSize: 10,
                color: i === kbStepIdx ? 'var(--blue-500)' : 'var(--gray-400)',
                fontWeight: i === kbStepIdx ? 700 : 400,
              }}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 단지 레벨: 기간 슬라이더 + 매물 타입 */}
      {drillLevel === 'complex' && (
        <>
          <PeriodSlider value={period} onChange={setPeriod} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {(['all', 'APT', 'OPST'] as const).map(pt => (
              <button key={pt}
                className={`chip ${propertyType === pt ? 'chip--active' : ''}`}
                onClick={() => setPropertyType(pt)}
                style={{ fontSize: 11 }}
              >
                {pt === 'all' ? '전체' : pt === 'APT' ? '아파트' : '오피스텔'}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Back button */}
      {drillLevel !== 'sido' && (
        <button
          onClick={() => {
            if (drillLevel === 'complex') navigateTo('sigungu', selectedSido, null);
            else navigateTo('sido', null, null);
          }}
          className="press-effect"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 14px', background: 'var(--gray-100)', borderRadius: 'var(--radius-full)',
            fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          뒤로
        </button>
      )}

      <Breadcrumb
        selectedSido={drillLevel !== 'sido' ? selectedSido : null}
        selectedSigungu={drillLevel === 'complex' ? selectedSigungu : null}
        onReset={() => navigateTo('sido', null, null)}
        onSidoClick={() => navigateTo('sigungu', selectedSido, null)}
        onSigunguClick={() => navigateTo('sigungu', selectedSido, null)}
      />

      {/* Sido Map */}
      {drillLevel === 'sido' && (
        sidoLoading ? <LoadingSpinner /> : (
          <RtSidoMap data={sidoData} onSelect={(sidoName) => navigateTo('sigungu', sidoName, null)} />
        )
      )}

      {/* Sigungu Map */}
      {drillLevel === 'sigungu' && selectedSido && (
        sigunguLoading ? <LoadingSpinner /> : (
          <RtSigunguMap sidoName={selectedSido} data={sigunguData} onSelect={(sggName) => navigateTo('complex', selectedSido, sggName)} />
        )
      )}

      {/* Complex level */}
      {drillLevel === 'complex' && (
        complexLoading ? <LoadingSpinner /> : (
          <RtKakaoComplexMap complexes={complexData} sigunguName={selectedSigungu ?? ''} />
        )
      )}

      {(drillLevel === 'sido' || drillLevel === 'sigungu') && <RtMapLegend />}
    </div>
  );
}
