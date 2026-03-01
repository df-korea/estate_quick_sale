'use client';

import { useMemo } from 'react';
import { feature } from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
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

interface Props {
  sidoName: string;
  heatmap: SigunguHeatmapItem[];
  onSelect: (sggName: string) => void;
}

export default function SigunguMap({ sidoName, heatmap, onSelect }: Props) {
  const { svgRef, viewBoxStr, onTouchStart, onTouchMove, onTouchEnd, scale } = useSvgPanZoom(WIDTH, HEIGHT);
  const inv = 1 / scale;
  const sidoCode = DB_TO_TOPO_CODE[sidoName];
  const view = sidoCode ? SIDO_VIEW[sidoCode] : null;

  const dataMap = useMemo(() => {
    const m = new Map<string, SigunguHeatmapItem>();
    for (const item of heatmap) m.set(item.sgg_name, item);
    return m;
  }, [heatmap]);

  const filtered = useMemo(
    () => sidoCode ? allFeatures.filter(f => (f.properties!.code).startsWith(sidoCode)) : [],
    [sidoCode]
  );

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
    >
      {/* 시군구 지역 색칠 */}
      {filtered.map((feat, i) => {
        const name = feat.properties!.name;
        const item = dataMap.get(name);
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
            onClick={() => onSelect(name)}
            style={{ cursor: 'pointer' }}
          />
        );
      })}

      {/* 버블 마커 */}
      <g pointerEvents="none">
        {filtered.map((feat, i) => {
          const name = feat.properties!.name;
          const item = dataMap.get(name);
          const count = item?.bargain_count ?? 0;
          const r = bubbleRadius(count) * inv;
          const color = bargainRatioColor(item?.bargain_ratio ?? 0);

          const centroid = geoCentroid(feat);
          const projected = proj(centroid);
          if (!projected) return null;
          const [cx, cy] = projected;

          return (
            <g key={`m-${i}`} onClick={() => onSelect(name)} style={{ cursor: 'pointer' }} pointerEvents="auto">
              <circle cx={cx} cy={cy} r={r} fill="white" stroke={color} strokeWidth={1.5 * inv} />
              <text
                x={cx} y={cy - r - 2 * inv}
                textAnchor="middle"
                style={{ fontSize: baseFontSize * inv, fontWeight: 800, fill: '#333' }}
              >
                {name}
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
