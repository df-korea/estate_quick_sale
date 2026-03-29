'use client';

import { useMemo } from 'react';
import { feature } from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry } from 'geojson';
import type { RtSigunguChangeRate } from '../../types';
import { changeRateColor, changeRateTextColor } from '../../utils/mapCodes';
import topoData from '../../data/skorea-sigungu-topo.json';
import { useSvgPanZoom } from '../../hooks/useSvgPanZoom';

interface SggProps { name: string; code: string; name_eng: string; base_year: string }

const WIDTH = 390;
const HEIGHT = 500;

const DB_TO_TOPO_CODE: Record<string, string> = {
  '서울시': '11', '부산시': '21', '대구시': '22', '인천시': '23',
  '광주시': '24', '대전시': '25', '울산시': '26', '세종시': '29',
  '경기도': '31', '강원도': '32', '충청북도': '33', '충청남도': '34',
  '전북도': '35', '전라남도': '36', '경상북도': '37', '경상남도': '38',
  '제주도': '39',
};

const PROVINCE_CODES = new Set(['31','32','33','34','35','36','37','38','39']);

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

const topo = topoData as unknown as Topology<{ skorea_municipalities_2018_geo: GeometryCollection<SggProps> }>;
const allFeatures = feature(topo, topo.objects.skorea_municipalities_2018_geo).features;

function extractDisplayName(topoName: string, isProvince: boolean): string {
  if (!isProvince) return topoName;
  const m = topoName.match(/^(.+시).+구$/);
  return m ? m[1] : topoName;
}

function formatRate(rate: number | string): string {
  const r = Number(rate);
  const rounded = Math.round(r * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}%`;
  if (rounded < 0) return `${rounded.toFixed(1)}%`;
  return '0%';
}

interface Props {
  sidoName: string;
  data: RtSigunguChangeRate[];
  onSelect: (sggName: string) => void;
}

export default function RtSigunguMap({ sidoName, data, onSelect }: Props) {
  const { svgRef, viewBoxStr, onTouchStart, onTouchMove, onTouchEnd, onWheel, scale } = useSvgPanZoom(WIDTH, HEIGHT);
  const inv = 1 / scale;
  const sidoCode = DB_TO_TOPO_CODE[sidoName];
  const view = sidoCode ? SIDO_VIEW[sidoCode] : null;
  const isProvince = PROVINCE_CODES.has(sidoCode ?? '');

  const dataMap = useMemo(() => {
    const m = new Map<string, RtSigunguChangeRate>();
    for (const item of data) m.set(item.sgg_name, item);
    return m;
  }, [data]);

  const filtered = useMemo(
    () => sidoCode ? allFeatures.filter(f => (f.properties!.code).startsWith(sidoCode)) : [],
    [sidoCode]
  );

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
    const p = geoMercator().center(view.center).scale(view.scale).translate([WIDTH / 2, HEIGHT / 2]);
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
      {filtered.map((feat, i) => {
        const displayName = extractDisplayName(feat.properties!.name, isProvince);
        const item = dataMap.get(displayName);
        const fill = changeRateColor(Number(item?.change_rate ?? 0));
        const d = path(feat);
        if (!d) return null;
        return (
          <path key={i} d={d} fill={fill} stroke="#fff" strokeWidth={0.3}
            onClick={() => onSelect(displayName)} style={{ cursor: 'pointer' }} />
        );
      })}

      <g pointerEvents="none">
        {Array.from(bubbleGroups.entries()).map(([displayName, features]) => {
          const item = dataMap.get(displayName);
          const rate = Number(item?.change_rate ?? 0);
          const r = 12 * inv;

          const centroids = features.map(f => geoCentroid(f));
          const avgLon = centroids.reduce((s, c) => s + c[0], 0) / centroids.length;
          const avgLat = centroids.reduce((s, c) => s + c[1], 0) / centroids.length;
          const projected = proj([avgLon, avgLat]);
          if (!projected) return null;
          const [cx, cy] = projected;

          return (
            <g key={`m-${displayName}`} onClick={() => onSelect(displayName)} style={{ cursor: 'pointer' }} pointerEvents="auto">
              <circle cx={cx} cy={cy} r={r} fill="white" stroke={changeRateColor(rate)} strokeWidth={1.5 * inv} />
              <text x={cx} y={cy - r - 2 * inv} textAnchor="middle"
                style={{ fontSize: baseFontSize * inv, fontWeight: 800, fill: '#333' }}>
                {displayName}
              </text>
              <text x={cx} y={cy + 1 * inv} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: baseFontSize * 0.85 * inv, fontWeight: 800, fill: changeRateTextColor(rate) }}>
                {formatRate(rate)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
