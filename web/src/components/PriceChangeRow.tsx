'use client';

import { useRouter } from 'next/navigation';
import type { PriceChangeItem } from '../types';
import { formatWon, formatPercent, relativeDate } from '../utils/format';

interface Props {
  item: PriceChangeItem;
}

export default function PriceChangeRow({ item }: Props) {
  const nav = useRouter();
  const isDown = Number(item.change_pct) < 0;

  return (
    <div className="flex items-center gap-12 press-effect"
      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}
      onClick={() => nav.push(`/article/${item.article_id}`)}>
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>
          {item.complex_name} {item.exclusive_space}㎡
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
          {formatWon(item.prev_price)} → {formatWon(item.new_price)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: isDown ? 'var(--blue-500)' : 'var(--red-500)' }}>
          {formatPercent(item.change_pct)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{relativeDate(item.recorded_at)}</div>
      </div>
    </div>
  );
}
