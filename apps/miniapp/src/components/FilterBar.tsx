import type { TradeFilter, BargainSort } from '../types';

interface Props {
  tradeFilter: TradeFilter;
  onTradeFilterChange: (f: TradeFilter) => void;
  sort: BargainSort;
  onSortChange: (s: BargainSort) => void;
}

const TRADE_OPTIONS: { value: TradeFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'A1', label: '매매' },
  { value: 'B1', label: '전세' },
  { value: 'B2', label: '월세' },
];

const SORT_OPTIONS: { value: BargainSort; label: string }[] = [
  { value: 'newest', label: '최신순' },
  { value: 'price_asc', label: '낮은가격순' },
  { value: 'price_desc', label: '높은가격순' },
];

export default function FilterBar({ tradeFilter, onTradeFilterChange, sort, onSortChange }: Props) {
  return (
    <div className="flex items-center justify-between" style={{ padding: 'var(--space-8) 0', gap: 'var(--space-8)' }}>
      <div className="flex gap-6 scroll-x">
        {TRADE_OPTIONS.map(opt => (
          <button key={opt.value}
            className={`chip ${tradeFilter === opt.value ? 'chip--active' : ''}`}
            onClick={() => onTradeFilterChange(opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>
      <select
        value={sort}
        onChange={e => onSortChange(e.target.value as BargainSort)}
        style={{
          background: 'var(--gray-100)',
          border: 'none',
          borderRadius: 'var(--radius-full)',
          padding: 'var(--space-6) var(--space-12)',
          fontSize: 'var(--text-sm)',
          color: 'var(--gray-700)',
          flexShrink: 0,
        }}
      >
        {SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
