import { useState } from 'react';
import type { DrillLevel } from '../../types';
import { useSidoHeatmap, useSigunguHeatmap, useSigunguComplexes } from '../../hooks/useMapData';
import SidoMap from './SidoMap';
import SigunguMap from './SigunguMap';
import KakaoComplexMap from './KakaoComplexMap';
import ComplexList from './ComplexList';
import MapLegend from './MapLegend';
import Breadcrumb from '../Breadcrumb';
import LoadingSpinner from '../LoadingSpinner';

interface Props {
  onDrillChange?: (level: DrillLevel, sido: string | null, sigungu: string | null) => void;
}

export default function MapExplorer({ onDrillChange }: Props) {
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('sido');
  const [selectedSido, setSelectedSido] = useState<string | null>(null);
  const [selectedSigungu, setSelectedSigungu] = useState<string | null>(null);

  const { data: sidoHeatmap, loading: sidoLoading } = useSidoHeatmap();
  const { data: sigunguHeatmap, loading: sigunguLoading } = useSigunguHeatmap(selectedSido);
  const { data: complexes, loading: complexLoading } = useSigunguComplexes(selectedSigungu);

  function navigateTo(level: DrillLevel, sido: string | null, sigungu: string | null) {
    setDrillLevel(level);
    setSelectedSido(sido);
    setSelectedSigungu(sigungu);
    onDrillChange?.(level, sido, sigungu);
  }

  return (
    <div>
      <Breadcrumb
        selectedSido={drillLevel !== 'sido' ? selectedSido : null}
        selectedSigungu={drillLevel === 'complex' ? selectedSigungu : null}
        onReset={() => navigateTo('sido', null, null)}
        onSidoClick={() => navigateTo('sigungu', selectedSido, null)}
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
        complexLoading ? <LoadingSpinner /> : (
          <>
            <KakaoComplexMap complexes={complexes} sigunguName={selectedSigungu ?? ''} />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                전체 단지 ({complexes.length}개)
              </div>
              <ComplexList complexes={complexes} />
            </div>
          </>
        )
      )}

      {(drillLevel === 'sido' || drillLevel === 'sigungu') && <MapLegend />}
    </div>
  );
}
