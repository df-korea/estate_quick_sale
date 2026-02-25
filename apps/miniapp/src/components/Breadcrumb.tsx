import { fullNameToShort } from '../utils/mapCodes';

interface Props {
  selectedSido: string | null;
  selectedSigungu: string | null;
  onReset: () => void;
  onSidoClick: () => void;
  onSigunguClick?: () => void;
}

export default function Breadcrumb({ selectedSido, selectedSigungu, onReset, onSidoClick, onSigunguClick }: Props) {
  return (
    <div className="flex items-center gap-4 text-sm" style={{ padding: 'var(--space-8) 0' }}>
      <button onClick={onReset} style={{ color: selectedSido ? 'var(--blue-500)' : 'var(--gray-900)', fontWeight: 600 }}>
        전국
      </button>
      {selectedSido && (
        <>
          <span style={{ color: 'var(--gray-400)' }}>&gt;</span>
          <button onClick={onSidoClick} style={{ color: selectedSigungu ? 'var(--blue-500)' : 'var(--gray-900)', fontWeight: 600 }}>
            {fullNameToShort(selectedSido)}
          </button>
        </>
      )}
      {selectedSigungu && (
        <>
          <span style={{ color: 'var(--gray-400)' }}>&gt;</span>
          <button onClick={onSigunguClick ?? onSidoClick} style={{ color: 'var(--blue-500)', fontWeight: 600 }}>
            {selectedSigungu}
          </button>
        </>
      )}
    </div>
  );
}
