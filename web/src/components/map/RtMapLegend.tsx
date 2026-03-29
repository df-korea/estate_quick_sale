'use client';

const LEVELS = [
  { label: '+0.5%+', color: '#e02020' },
  { label: '+0.2~0.5%', color: '#ff6b6b' },
  { label: '0%', color: '#e8e8e8' },
  { label: '-0.2~0.5%', color: '#74b9ff' },
  { label: '-0.5%-', color: '#0984e3' },
];

export default function RtMapLegend() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: 6,
      padding: '6px 0', overflowX: 'auto',
    }}>
      {LEVELS.map(l => (
        <div key={l.label} style={{
          display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: 2,
            background: l.color, border: '0.5px solid rgba(0,0,0,0.1)',
          }} />
          <span style={{ fontSize: 10, color: 'var(--gray-500)' }}>{l.label}</span>
        </div>
      ))}
    </div>
  );
}
