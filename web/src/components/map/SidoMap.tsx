'use client';

import { useMemo } from 'react';
import { feature } from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { SidoHeatmapItem } from '../../types';

interface SidoProps { name: string; code: string; name_eng: string }
import { bargainRatioColor } from '../../utils/mapCodes';
import topoData from '../../data/skorea-sido-topo.json';
import { useSvgPanZoom } from '../../hooks/useSvgPanZoom';

const WIDTH = 390;
const HEIGHT = 500;

/** TopoJSON 시도 이름 → DB 시도 이름 */
const TOPO_TO_DB: Record<string, string> = {
  '서울특별시': '서울시', '부산광역시': '부산시', '대구광역시': '대구시',
  '인천광역시': '인천시', '광주광역시': '광주시', '대전광역시': '대전시',
  '울산광역시': '울산시', '세종특별자치시': '세종시', '경기도': '경기도',
  '강원도': '강원도', '충청북도': '충청북도', '충청남도': '충청남도',
  '전라북도': '전북도', '전라남도': '전라남도', '경상북도': '경상북도',
  '경상남도': '경상남도', '제주특별자치도': '제주도',
};

const DB_TO_SHORT: Record<string, string> = {
  '서울시': '서울', '부산시': '부산', '대구시': '대구', '인천시': '인천',
  '광주시': '광주', '대전시': '대전', '울산시': '울산', '세종시': '세종',
  '경기도': '경기', '강원도': '강원', '충청북도': '충북', '충청남도': '충남',
  '전북도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
  '제주도': '제주',
};

/** 마커 위치 오프셋 (px) — 겹침 방지용 */
const MARKER_OFFSET: Record<string, [number, number]> = {
  '서울시':  [0, -16],   // 위로
  '경기도':  [0, 24],    // 아래로
  '인천시':  [-10, 0],   // 왼쪽
  '세종시':  [-14, -14], // 왼쪽위로
  '충청남도': [-12, 8],  // 왼쪽아래로
  '대전시':  [8, 10],    // 오른쪽아래로
  '광주시':  [-8, -14],  // 왼쪽위로
  '전라남도': [0, 12],   // 아래로
};

function bubbleRadius(count: number): number {
  if (count <= 0) return 10;
  return Math.min(20, 10 + Math.log10(count + 1) * 3);
}

// Pre-compute features and projection
const topo = topoData as unknown as Topology<{ skorea_provinces_2018_geo: GeometryCollection<SidoProps> }>;
const geoFeatures = feature(topo, topo.objects.skorea_provinces_2018_geo).features;

const projection = geoMercator()
  .center([127.8, 36.2])
  .scale(5000)
  .translate([WIDTH / 2, HEIGHT / 2]);

const pathGen = geoPath(projection);

interface Props {
  heatmap: SidoHeatmapItem[];
  onSelect: (sidoName: string) => void;
}

export default function SidoMap({ heatmap, onSelect }: Props) {
  const { svgRef, viewBoxStr, onTouchStart, onTouchMove, onTouchEnd, onWheel, scale } = useSvgPanZoom(WIDTH, HEIGHT);
  const inv = 1 / scale; // inverse scale: keeps elements at constant screen size

  const dataMap = useMemo(() => {
    const m = new Map<string, SidoHeatmapItem>();
    for (const item of heatmap) m.set(item.sido_name, item);
    return m;
  }, [heatmap]);

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
      {/* 지역 색칠 */}
      {geoFeatures.map((feat, i) => {
        const dbName = TOPO_TO_DB[feat.properties!.name] ?? feat.properties!.name;
        const item = dataMap.get(dbName);
        const fill = bargainRatioColor(item?.bargain_ratio ?? 0);
        const d = pathGen(feat);
        if (!d) return null;

        return (
          <path
            key={i}
            d={d}
            fill={fill}
            stroke="#fff"
            strokeWidth={0.5}
            onClick={() => onSelect(dbName)}
            style={{ cursor: 'pointer' }}
          />
        );
      })}

      {/* 버블 마커 */}
      <g pointerEvents="none">
        {geoFeatures.map((feat, i) => {
          const dbName = TOPO_TO_DB[feat.properties!.name] ?? feat.properties!.name;
          const shortName = DB_TO_SHORT[dbName] ?? dbName;
          const item = dataMap.get(dbName);
          const count = item?.bargain_count ?? 0;
          const r = bubbleRadius(count) * inv;
          const color = bargainRatioColor(item?.bargain_ratio ?? 0);

          const centroid = geoCentroid(feat);
          const projected = projection(centroid);
          if (!projected) return null;
          const offset = MARKER_OFFSET[dbName] ?? [0, 0];
          const cx = projected[0] + offset[0];
          const cy = projected[1] + offset[1];

          return (
            <g key={`m-${i}`} onClick={() => onSelect(dbName)} style={{ cursor: 'pointer' }} pointerEvents="auto">
              <circle cx={cx} cy={cy} r={r} fill="white" stroke={color} strokeWidth={2 * inv} />
              <text
                x={cx} y={cy - r - 3 * inv}
                textAnchor="middle"
                style={{ fontSize: 10 * inv, fontWeight: 800, fill: '#333' }}
              >
                {shortName}
              </text>
              {count > 0 && (
                <text
                  x={cx} y={cy + 1 * inv}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: 9 * inv, fontWeight: 800, fill: '#e02020' }}
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
