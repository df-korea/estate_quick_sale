import type { PriceHistoryEntry } from '../types';
import { formatWon } from '../utils/format';

interface Props {
  history: PriceHistoryEntry[];
}

export default function PriceTimeline({ history }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 'var(--space-16)' }}>
      <div className="card-body">
        <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>가격 이력</h4>
        <div>
          {history.map((entry, i) => {
            const prevPrice = i > 0 ? history[i - 1].deal_price : null;
            const diff = prevPrice ? entry.deal_price - prevPrice : null;
            const isDown = diff != null && diff < 0;

            return (
              <div key={entry.id} className="flex items-center gap-12" style={{ padding: 'var(--space-8) 0', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {/* Timeline dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === history.length - 1 ? 'var(--blue-500)' : 'var(--gray-300)',
                  }} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span style={{ fontWeight: 600 }}>{formatWon(entry.deal_price)}</span>
                    {diff != null && (
                      <span className="text-sm" style={{ color: isDown ? 'var(--blue-500)' : 'var(--red-500)' }}>
                        {isDown ? '' : '+'}{formatWon(Math.abs(diff))}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray">
                    {new Date(entry.recorded_at).toLocaleDateString('ko-KR')}
                    {entry.source === 'api_history' && ' (네이버)'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
