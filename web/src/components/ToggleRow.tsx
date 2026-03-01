'use client';

interface Props {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export default function ToggleRow({ label, desc, checked, onChange }: Props) {
  return (
    <div className="flex items-center justify-between" style={{ padding: 'var(--space-8) 0', borderBottom: '1px solid var(--gray-100)' }}>
      <div>
        <div className="text-sm" style={{ fontWeight: 500 }}>{label}</div>
        <div className="text-xs text-gray">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, padding: 2,
          background: checked ? 'var(--blue-500)' : 'var(--gray-300)',
          transition: 'background 0.2s',
          display: 'flex', alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: 'white',
          transition: 'transform 0.2s',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </button>
    </div>
  );
}
