'use client';

interface Props {
  score: number;
  size?: 'sm' | 'lg';
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--red-500)';
  if (score >= 50) return 'var(--orange-500)';
  if (score >= 30) return 'var(--blue-500)';
  return 'var(--gray-400)';
}

export default function BargainScoreBadge({ score, size = 'sm' }: Props) {
  const isLg = size === 'lg';
  const dim = isLg ? 56 : 32;
  const r = isLg ? 24 : 12;
  const stroke = isLg ? 4 : 3;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = scoreColor(score);

  return (
    <div style={{ position: 'relative', width: dim, height: dim, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="var(--gray-200)" strokeWidth={stroke} />
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span style={{
        position: 'absolute',
        fontSize: isLg ? 'var(--text-md)' : 'var(--text-xs)',
        fontWeight: 'var(--weight-bold)' as never,
        color,
      }}>
        {score}
      </span>
    </div>
  );
}
