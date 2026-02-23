import { extent, linearScale } from '../../utils/chart';

interface Series {
  label: string;
  data: number[];
  color: string;
}

interface Props {
  labels: string[];
  series: Series[];
  width?: number;
  height?: number;
}

export default function LineChart({ labels, series, width = 300, height = 180 }: Props) {
  const pad = { top: 10, right: 10, bottom: 30, left: 50 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  if (labels.length < 2 || series.length === 0) return null;

  const allValues = series.flatMap(s => s.data).filter(v => v != null);
  const [yMin, yMax] = extent(allValues);
  const scaleX = linearScale([0, labels.length - 1], [0, cw]);
  const scaleY = linearScale([yMin, yMax], [ch, 0]);

  const yTicks = 4;
  const yStep = (yMax - yMin) / yTicks || 1;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {/* Y axis labels */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const val = yMin + yStep * i;
        const y = pad.top + scaleY(val);
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--gray-200)" strokeDasharray="2" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--gray-500)">
              {val >= 10000 ? `${Math.round(val / 10000)}만` : Math.round(val)}
            </text>
          </g>
        );
      })}

      {/* X axis labels (show ~5) */}
      {labels.map((label, i) => {
        if (labels.length > 6 && i % Math.ceil(labels.length / 5) !== 0 && i !== labels.length - 1) return null;
        const x = pad.left + scaleX(i);
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize={9} fill="var(--gray-500)">
            {label.length > 5 ? label.slice(-5) : label}
          </text>
        );
      })}

      {/* Series lines */}
      {series.map((s, si) => {
        const points = s.data.map((v, i) => `${pad.left + scaleX(i)},${pad.top + scaleY(v)}`).join(' ');
        return <polyline key={si} points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
}
