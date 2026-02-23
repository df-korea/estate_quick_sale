import { toPolylinePoints } from '../../utils/chart';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function SparkLine({ data, width = 60, height = 24, color = 'var(--blue-500)' }: Props) {
  if (data.length < 2) return null;

  const points = data.map((y, i) => ({ x: i, y }));
  const polyline = toPolylinePoints(points, width, height);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
