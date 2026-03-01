import { useState } from 'react';
import type { DrillLevel, BargainMode, PropertyType } from '../../types';
import { useSidoHeatmap, useSigunguHeatmap, useSigunguComplexes } from '../../hooks/useMapData';
import SidoMap from './SidoMap';
import SigunguMap from './SigunguMap';
import KakaoComplexMap from './KakaoComplexMap';
import ComplexList from './ComplexList';
import MapLegend from './MapLegend';
import Breadcrumb from '../Breadcrumb';
import LoadingSpinner from '../LoadingSpinner';
import AlgorithmModal from '../AlgorithmModal';

const BARGAIN_MODES: { value: BargainMode; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'keyword', label: '키워드 급매' },
  { value: 'price', label: '가격 급매' },
];

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'APT', label: '아파트' },
  { value: 'OPST', label: '오피스텔' },
];

interface Props {
  onDrillChange?: (level: DrillLevel, sido: string | null, sigungu: string | null) => void;
  onBargainModeChange?: (mode: BargainMode) => void;
}

export default function MapExplorer({ onDrillChange, onBargainModeChange }: Props) {
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('sido');
  const [selectedSido, setSelectedSido] = useState<string | null>(null);
  const [selectedSigungu, setSelectedSigungu] = useState<string | null>(null);
  const [bargainMode, setBargainMode] = useState<BargainMode>('all');
  const [propertyType, setPropertyType] = useState<PropertyType>('all');
  const [showAlgoModal, setShowAlgoModal] = useState(false);

  const { data: sidoHeatmap, loading: sidoLoading } = useSidoHeatmap(bargainMode, propertyType);
  const { data: sigunguHeatmap, loading: sigunguLoading } = useSigunguHeatmap(selectedSido, bargainMode, propertyType);
  const { data: complexes, loading: complexLoading } = useSigunguComplexes(selectedSigungu, selectedSido, bargainMode, propertyType);

  function navigateTo(level: DrillLevel, sido: string | null, sigungu: string | null) {
    setDrillLevel(level);
    setSelectedSido(sido);
    setSelectedSigungu(sigungu);
    onDrillChange?.(level, sido, sigungu);
  }

  return (
    <div>
      {/* Bargain mode + property type filter */}
      {(drillLevel === 'sido' || drillLevel === 'sigungu') && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div className="flex gap-6" style={{ alignItems: 'center' }}>
            {BARGAIN_MODES.map(m => (
              <button
                key={m.value}
                className={`chip ${bargainMode === m.value ? 'chip--active' : ''}`}
                onClick={() => {
                  setBargainMode(m.value);
                  onBargainModeChange?.(m.value);
                }}
              >
                {m.label}
              </button>
            ))}
            <button
              onClick={() => setShowAlgoModal(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: 'var(--gray-500)',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
                margin: '-7px',
              }}
              aria-label="급매 기준 도움말"
            >
              <span style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '1.5px solid var(--gray-300)',
                background: 'var(--white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>?</span>
            </button>
          </div>
          <select
            value={propertyType}
            onChange={e => setPropertyType(e.target.value as PropertyType)}
            style={{
              background: 'var(--gray-100)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-700)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {PROPERTY_TYPES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      <AlgorithmModal open={showAlgoModal} onClose={() => setShowAlgoModal(false)} />

      {drillLevel !== 'sido' && (
        <button
          onClick={() => {
            if (drillLevel === 'complex') navigateTo('sigungu', selectedSido, null);
            else navigateTo('sido', null, null);
          }}
          className="press-effect"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px',
            background: 'var(--gray-100)',
            borderRadius: 'var(--radius-full)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--gray-700)',
            marginBottom: 4,
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

      {/* Sido → click goes directly to sigungu */}
      {drillLevel === 'sido' && (
        sidoLoading ? <LoadingSpinner /> : (
          <SidoMap
            heatmap={sidoHeatmap}
            onSelect={(sidoName) => navigateTo('sigungu', sidoName, null)}
          />
        )
      )}

      {/* Sigungu → click goes directly to complex */}
      {drillLevel === 'sigungu' && selectedSido && (
        sigunguLoading ? <LoadingSpinner /> : (
          <SigunguMap
            sidoName={selectedSido}
            heatmap={sigunguHeatmap}
            onSelect={(sggName) => navigateTo('complex', selectedSido, sggName)}
          />
        )
      )}

      {/* Complex level: Kakao Map + List */}
      {drillLevel === 'complex' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <div className="flex gap-6" style={{ alignItems: 'center' }}>
              {BARGAIN_MODES.map(m => (
                <button
                  key={m.value}
                  className={`chip ${bargainMode === m.value ? 'chip--active' : ''}`}
                  onClick={() => {
                    setBargainMode(m.value);
                    onBargainModeChange?.(m.value);
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <select
              value={propertyType}
              onChange={e => setPropertyType(e.target.value as PropertyType)}
              style={{
                background: 'var(--gray-100)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '6px 12px',
                fontSize: 'var(--text-sm)',
                color: 'var(--gray-700)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {PROPERTY_TYPES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {complexLoading ? <LoadingSpinner /> : (
            <>
              <KakaoComplexMap complexes={complexes} sigunguName={selectedSigungu ?? ''} />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  {bargainMode === 'keyword'
                    ? `키워드 급매 단지 ${complexes.length}개 / 키워드 급매 매물 ${complexes.reduce((s, c) => s + (c.keyword_count || 0), 0)}건`
                    : bargainMode === 'price'
                    ? `가격 급매 단지 ${complexes.length}개 / 가격 급매 매물 ${complexes.reduce((s, c) => s + (c.price_count || 0), 0)}건`
                    : `전체 단지 ${complexes.length}개 / 급매 매물 ${complexes.reduce((s, c) => s + c.bargain_count, 0)}건`}
                </div>
                <ComplexList complexes={complexes} />
              </div>
            </>
          )}
        </>
      )}

      {(drillLevel === 'sido' || drillLevel === 'sigungu') && <MapLegend />}
    </div>
  );
}
