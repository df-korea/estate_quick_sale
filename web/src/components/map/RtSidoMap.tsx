'use client';

import { useMemo } from 'react';
import { feature } from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { RtSidoChangeRate } from '../../types';
import { changeRateColor, changeRateTextColor } from '../../utils/mapCodes';
import topoData from '../../data/skorea-sido-topo.json';
import { useSvgPanZoom } from '../../hooks/useSvgPanZoom';

interface SidoProps { name: string; code: string; name_eng: string }

const WIDTH = 390;
const HEIGHT = 500;

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

const MARKER_OFFSET: Record<string, [number, number]> = {
  '서울시':  [0, -16],
  '경기도':  [0, 24],
  '인천시':  [-10, 0],
  '세종시':  [-14, -14],
  '충청남도': [-12, 8],
  '대전시':  [8, 10],
  '광주시':  [-8, -14],
  '전라남도': [0, 12],
};

const topo = topoData as unknown as Topology<{ skorea_provinces_2018_geo: GeometryCollection<SidoProps> }>;
const geoFeatures = feature(topo, topo.objects.skorea_provinces_2018_geo).features;
const projection = geoMercator().center([127.8, 36.2]).scale(5000).translate([WIDTH / 2, HEIGHT / 2]);
const pathGen = geoPath(projection);

function formatRate(rate: number | string): string {
  const r = Number(rate);
  const rounded = Math.round(r * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}%`;
  if (rounded < 0) return `${rounded.toFixed(1)}%`;
  return '0%';
}

interface Props {
  data: RtSidoChangeRate[];
  onSelect: (sidoName: string) => void;
}

export default function RtSidoMap({ data, onSelect }: Props) {
  const { svgRef, viewBoxStr, onTouchStart, onTouchMove, onTouchEnd, onWheel, scale } = useSvgPanZoom(WIDTH, HEIGHT);
  const inv = 1 / scale;

  const dataMap = useMemo(() => {
    const m = new Map<string, RtSidoChangeRate>();
    for (const item of data) m.set(item.sido_name, item);
    return m;
  }, [data]);

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
      {geoFeatures.map((feat, i) => {
        const dbName = TOPO_TO_DB[feat.properties!.name] ?? feat.properties!.name;
        const item = dataMap.get(dbName);
        const fill = changeRateColor(Number(item?.change_rate ?? 0));
        const d = pathGen(feat);
        if (!d) return null;
        return (
          <path key={i} d={d} fill={fill} stroke="#fff" strokeWidth={0.5}
            onClick={() => onSelect(dbName)} style={{ cursor: 'pointer' }} />
        );
      })}

      <g pointerEvents="none">
        {geoFeatures.map((feat, i) => {
          const dbName = TOPO_TO_DB[feat.properties!.name] ?? feat.properties!.name;
          const shortName = DB_TO_SHORT[dbName] ?? dbName;
          const item = dataMap.get(dbName);
          const rate = Number(item?.change_rate ?? 0);
          const r = 14 * inv;

          const centroid = geoCentroid(feat);
          const projected = projection(centroid);
          if (!projected) return null;
          const offset = MARKER_OFFSET[dbName] ?? [0, 0];
          const cx = projected[0] + offset[0];
          const cy = projected[1] + offset[1];

          return (
            <g key={`m-${i}`} onClick={() => onSelect(dbName)} style={{ cursor: 'pointer' }} pointerEvents="auto">
              <circle cx={cx} cy={cy} r={r} fill="white" stroke={changeRateColor(rate)} strokeWidth={2 * inv} />
              <text x={cx} y={cy - r - 3 * inv} textAnchor="middle"
                style={{ fontSize: 10 * inv, fontWeight: 800, fill: '#333' }}>
                {shortName}
              </text>
              <text x={cx} y={cy + 1 * inv} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: 9 * inv, fontWeight: 800, fill: changeRateTextColor(rate) }}>
                {formatRate(rate)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
