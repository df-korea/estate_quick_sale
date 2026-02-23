const LEVELS = [
  { label: '15%+', color: '#e02020' },
  { label: '10%+', color: '#f04452' },
  { label: '7%+', color: '#ff6666' },
  { label: '5%+', color: '#ffa726' },
  { label: '3%+', color: '#ffc107' },
  { label: '1%+', color: '#90c2ff' },
  { label: '0%', color: '#e5e8eb' },
];

export default function MapLegend() {
  return (
    <div className="flex items-center gap-6 scroll-x" style={{ padding: 'var(--space-6) 0' }}>
      <span className="text-xs text-gray" style={{ flexShrink: 0 }}>급매 비율:</span>
      {LEVELS.map(l => (
        <div key={l.label} className="flex items-center gap-4" style={{ flexShrink: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
          <span className="text-xs text-gray">{l.label}</span>
        </div>
      ))}
    </div>
  );
}
