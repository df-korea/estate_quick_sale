'use client';

import { useRouter } from 'next/navigation';
import type { TopPriceDropItem } from '../types';
import { formatWon, formatArea } from '../utils/format';

interface Props {
  item: TopPriceDropItem;
  rank: number;
}

export default function TopPriceDropRow({ item, rank }: Props) {
  const nav = useRouter();

  return (
    <div className="flex items-center gap-12 press-effect"
      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}
      onClick={() => nav.push(`/article/${item.article_id}`)}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: rank <= 3 ? 'var(--blue-500)' : 'var(--gray-300)',
        color: 'white', fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{rank}</span>
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>
          {item.complex_name} {formatArea(item.exclusive_space)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
          {formatWon(item.initial_price)} → {formatWon(item.current_price)}
          {item.target_floor && ` · ${item.target_floor}/${item.total_floor}층`}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 13,
          color: 'var(--blue-500)',
          background: 'var(--blue-50)',
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          {formatWon(item.drop_amount)} 하락
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
          {item.drop_count}회 · -{item.drop_pct}%
        </div>
      </div>
    </div>
  );
}
