interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  items: BarItem[];
}

export default function BarChart({ items }: Props) {
  const maxVal = Math.max(...items.map(i => i.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-8">
          <span className="text-sm" style={{ width: 60, flexShrink: 0, textAlign: 'right', color: 'var(--gray-600)' }}>
            {item.label}
          </span>
          <div style={{ flex: 1, height: 20, background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <div style={{
              width: `${(item.value / maxVal) * 100}%`,
              height: '100%',
              background: item.color || 'var(--blue-400)',
              borderRadius: 'var(--radius-sm)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span className="text-sm text-bold" style={{ width: 48, flexShrink: 0, textAlign: 'right' }}>
            {item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
