import { fullNameToShort } from '../utils/mapCodes';

interface Props {
  selectedSido: string | null;
  selectedSigungu: string | null;
  onReset: () => void;
  onSidoClick: () => void;
  onSigunguClick?: () => void;
}

const currentStyle: React.CSSProperties = {
  fontWeight: 700,
  color: 'var(--gray-900)',
  background: 'var(--gray-100)',
  padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--blue-500)',
  fontWeight: 600,
};

export default function Breadcrumb({ selectedSido, selectedSigungu, onReset, onSidoClick, onSigunguClick }: Props) {
  const isCurrent = (level: 'sido' | 'sigungu' | 'complex') => {
    if (!selectedSido) return level === 'sido';
    if (!selectedSigungu) return level === 'sigungu';
    return level === 'complex';
  };

  return (
    <div className="flex items-center gap-4 text-sm" style={{ padding: 'var(--space-8) 0' }}>
      <button onClick={onReset} style={isCurrent('sido') ? currentStyle : linkStyle}>
        전국
      </button>
      {selectedSido && (
        <>
          <span style={{ color: 'var(--gray-400)' }}>&gt;</span>
          <button onClick={onSidoClick} style={isCurrent('sigungu') ? currentStyle : linkStyle}>
            {fullNameToShort(selectedSido)}
          </button>
        </>
      )}
      {selectedSigungu && (
        <>
          <span style={{ color: 'var(--gray-400)' }}>&gt;</span>
          <button onClick={onSigunguClick ?? onSidoClick} style={currentStyle}>
            {selectedSigungu}
          </button>
        </>
      )}
    </div>
  );
}
