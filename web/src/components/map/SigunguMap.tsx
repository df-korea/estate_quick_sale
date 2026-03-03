'use client';

import { useMemo } from 'react';
import { feature } from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry } from 'geojson';
import type { SigunguHeatmapItem } from '../../types';

interface SggProps { name: string; code: string; name_eng: string; base_year: string }
import { bargainRatioColor } from '../../utils/mapCodes';
import topoData from '../../data/skorea-sigungu-topo.json';
import { useSvgPanZoom } from '../../hooks/useSvgPanZoom';

const WIDTH = 390;
const HEIGHT = 500;

/** DB 시도 이름 → TopoJSON 시도 코드 (sigungu code prefix) */
const DB_TO_TOPO_CODE: Record<string, string> = {
  '서울시': '11', '부산시': '21', '대구시': '22', '인천시': '23',
  '광주시': '24', '대전시': '25', '울산시': '26', '세종시': '29',
  '경기도': '31', '강원도': '32', '충청북도': '33', '충청남도': '34',
  '전북도': '35', '전라남도': '36', '경상북도': '37', '경상남도': '38',
  '제주도': '39',
};

/** 도(province) 코드 — 구를 시 단위로 통합하는 대상 */
const PROVINCE_CODES = new Set(['31','32','33','34','35','36','37','38','39']);

/** 시도별 지도 중심점/스케일 (TopoJSON geoBounds 기반 사전 계산) */
const SIDO_VIEW: Record<string, { center: [number, number]; scale: number }> = {
  '11': { center: [126.974, 37.565], scale: 54000 },
  '21': { center: [129.036, 35.184], scale: 42000 },
  '22': { center: [128.556, 35.811], scale: 55000 },
  '23': { center: [125.702, 37.456], scale: 10000 },
  '24': { center: [126.834, 35.155], scale: 60000 },
  '25': { center: [127.403, 36.342], scale: 70000 },
  '26': { center: [129.218, 35.527], scale: 46000 },
  '29': { center: [127.269, 36.570], scale: 69000 },
  '31': { center: [127.114, 37.588], scale: 15000 },
  '32': { center: [128.230, 37.821], scale: 10000 },
  '33': { center: [127.964, 36.635], scale: 16000 },
  '34': { center: [126.591, 36.522], scale: 10800 },
  '35': { center: [126.939, 35.728], scale: 11700 },
  '36': { center: [126.493, 34.728], scale: 8000 },
  '37': { center: [129.834, 36.558], scale: 5500 },
  '38': { center: [128.397, 35.222], scale: 13800 },
  '39': { center: [126.558, 33.563], scale: 25000 },
};

// Pre-compute all sigungu GeoJSON features
const topo = topoData as unknown as Topology<{ skorea_municipalities_2018_geo: GeometryCollection<SggProps> }>;
const allFeatures = feature(topo, topo.objects.skorea_municipalities_2018_geo).features;

function bubbleRadius(count: number): number {
  if (count <= 0) return 8;
  return Math.min(16, 8 + Math.log10(count + 1) * 2.5);
}

/** TopoJSON 이름에서 부모 시 추출: "수원시영통구" → "수원시" (도 소속만) */
function extractDisplayName(topoName: string, isProvince: boolean): string {
  if (!isProvince) return topoName;
  const m = topoName.match(/^(.+시).+구$/);
  return m ? m[1] : topoName;
}

interface Props {
  sidoName: string;
  heatmap: SigunguHeatmapItem[];
  onSelect: (sggName: string) => void;
}

export default function SigunguMap({ sidoName, heatmap, onSelect }: Props) {
  const { svgRef, viewBoxStr, onTouchStart, onTouchMove, onTouchEnd, onWheel, scale } = useSvgPanZoom(WIDTH, HEIGHT);
  const inv = 1 / scale;
  const sidoCode = DB_TO_TOPO_CODE[sidoName];
  const view = sidoCode ? SIDO_VIEW[sidoCode] : null;
  const isProvince = PROVINCE_CODES.has(sidoCode ?? '');

  const dataMap = useMemo(() => {
    const m = new Map<string, SigunguHeatmapItem>();
    for (const item of heatmap) m.set(item.sgg_name, item);
    return m;
  }, [heatmap]);

  const filtered = useMemo(
    () => sidoCode ? allFeatures.filter(f => (f.properties!.code).startsWith(sidoCode)) : [],
    [sidoCode]
  );

  /** 그룹별 피처 (부모 시 단위) — 버블 중복 제거용 */
  const bubbleGroups = useMemo(() => {
    const groups = new Map<string, Feature<Geometry, SggProps>[]>();
    for (const feat of filtered) {
      const displayName = extractDisplayName(feat.properties!.name, isProvince);
      if (!groups.has(displayName)) groups.set(displayName, []);
      groups.get(displayName)!.push(feat);
    }
    return groups;
  }, [filtered, isProvince]);

  const { proj, path } = useMemo(() => {
    if (!view) return { proj: null, path: null };
    const p = geoMercator()
      .center(view.center)
      .scale(view.scale)
      .translate([WIDTH / 2, HEIGHT / 2]);
    return { proj: p, path: geoPath(p) };
  }, [view]);

  if (!sidoCode || !view || !proj || !path) return null;

  const baseFontSize = 8;

  return (
    <svg
      ref={svgRef}
      viewBox={viewBoxStr}
      style={{ width: '100%', height: 'auto', touchAction: 'pan-y' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      {/* 시군구 지역 색칠 — 같은 부모 시는 동일 색상 */}
      {filtered.map((feat, i) => {
        const displayName = extractDisplayName(feat.properties!.name, isProvince);
        const item = dataMap.get(displayName);
        const fill = bargainRatioColor(item?.bargain_ratio ?? 0);
        const d = path(feat);
        if (!d) return null;

        return (
          <path
            key={i}
            d={d}
            fill={fill}
            stroke="#fff"
            strokeWidth={0.3}
            onClick={() => onSelect(displayName)}
            style={{ cursor: 'pointer' }}
          />
        );
      })}

      {/* 버블 마커 — 부모 시 당 1개 (하위 피처 평균 centroid) */}
      <g pointerEvents="none">
        {Array.from(bubbleGroups.entries()).map(([displayName, features]) => {
          const item = dataMap.get(displayName);
          const count = item?.bargain_count ?? 0;
          const r = bubbleRadius(count) * inv;
          const color = bargainRatioColor(item?.bargain_ratio ?? 0);

          // 하위 피처들의 평균 centroid
          const centroids = features.map(f => geoCentroid(f));
          const avgLon = centroids.reduce((s, c) => s + c[0], 0) / centroids.length;
          const avgLat = centroids.reduce((s, c) => s + c[1], 0) / centroids.length;
          const projected = proj([avgLon, avgLat]);
          if (!projected) return null;
          const [cx, cy] = projected;

          return (
            <g key={`m-${displayName}`} onClick={() => onSelect(displayName)} style={{ cursor: 'pointer' }} pointerEvents="auto">
              <circle cx={cx} cy={cy} r={r} fill="white" stroke={color} strokeWidth={1.5 * inv} />
              <text
                x={cx} y={cy - r - 2 * inv}
                textAnchor="middle"
                style={{ fontSize: baseFontSize * inv, fontWeight: 800, fill: '#333' }}
              >
                {displayName}
              </text>
              {count > 0 && (
                <text
                  x={cx} y={cy + 1 * inv}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: baseFontSize * 0.85 * inv, fontWeight: 800, fill: '#e02020' }}
                >
                  {count.toLocaleString()}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
