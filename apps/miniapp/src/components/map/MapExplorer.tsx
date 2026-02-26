import { useState, useRef, useEffect } from 'react';
import type { DrillLevel, BargainMode } from '../../types';
import { useSidoHeatmap, useSigunguHeatmap, useSigunguComplexes } from '../../hooks/useMapData';
import SidoMap from './SidoMap';
import SigunguMap from './SigunguMap';
import KakaoComplexMap from './KakaoComplexMap';
import ComplexList from './ComplexList';
import MapLegend from './MapLegend';
import Breadcrumb from '../Breadcrumb';
import LoadingSpinner from '../LoadingSpinner';

const BARGAIN_MODES: { value: BargainMode; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'keyword', label: '키워드 급매' },
  { value: 'price', label: '가격 급매' },
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

  const { data: sidoHeatmap, loading: sidoLoading } = useSidoHeatmap(bargainMode);
  const { data: sigunguHeatmap, loading: sigunguLoading } = useSigunguHeatmap(selectedSido, bargainMode);
  const { data: complexes, loading: complexLoading } = useSigunguComplexes(selectedSigungu, selectedSido, bargainMode);

  function navigateTo(level: DrillLevel, sido: string | null, sigungu: string | null) {
    setDrillLevel(level);
    setSelectedSido(sido);
    setSelectedSigungu(sigungu);
    onDrillChange?.(level, sido, sigungu);
  }

  return (
    <div>
      {/* Bargain mode toggle */}
      {(drillLevel === 'sido' || drillLevel === 'sigungu') && (
        <div className="flex gap-6" style={{ padding: '8px 0', alignItems: 'center' }}>
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
          <HelpButton />
        </div>
      )}

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
          <div className="flex gap-6" style={{ padding: '8px 0', alignItems: 'center' }}>
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
          {complexLoading ? <LoadingSpinner /> : (
            <>
              <KakaoComplexMap complexes={complexes} sigunguName={selectedSigungu ?? ''} />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  {bargainMode === 'keyword' ? '키워드 급매 단지' : bargainMode === 'price' ? '가격 급매 단지' : '전체 단지'} ({complexes.length}개)
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

function HelpButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = () => {
    setOpen(v => !v);
  };

  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: 2 }}>
      <button
        onClick={handleToggle}
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
          background: open ? 'var(--gray-100)' : 'var(--white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>?</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          width: Math.min(280, window.innerWidth - 32),
          background: 'var(--white)',
          borderRadius: 'var(--radius-md, 12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          padding: '14px 16px',
          zIndex: 1000,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--gray-700)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>급매 판별 기준</div>
          <div style={{ marginBottom: 10 }}>
            <span style={{
              display: 'inline-block',
              background: 'var(--red-500, #f04452)',
              color: '#fff',
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 11,
              fontWeight: 700,
              marginRight: 6,
            }}>키워드</span>
            매물 설명에 아래 키워드 포함
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {['급매', '급처분', '급전', '급히', '마이너스피', '마피', '급급', '손절', '최저가', '급하게'].map(kw => (
                <span key={kw} style={{
                  padding: '2px 8px',
                  background: 'var(--red-50, #fff1f2)',
                  color: 'var(--red-500)',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                }}>{kw}</span>
              ))}
            </div>
          </div>
          <div>
            <span style={{
              display: 'inline-block',
              background: 'var(--orange-500, #f97316)',
              color: '#fff',
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 11,
              fontWeight: 700,
              marginRight: 6,
            }}>가격</span>
            알고리즘 분석 — 단지내 호가비교(40점), 실거래비교(35점), 인하횟수(20점), 누적인하율(5점). 합산 50점 이상
          </div>
        </div>
      )}
    </div>
  );
}
