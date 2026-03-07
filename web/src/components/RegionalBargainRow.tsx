'use client';

import { useRouter } from 'next/navigation';
import { formatWon, formatAreaFull, relativeDate } from '@/utils/format';
import ScoreBreakdownPopover from '@/components/ScoreBreakdownPopover';
import BargainBadge from '@/components/BargainBadge';

interface RegionalBargainItem {
  id: number;
  deal_price: number;
  formatted_price?: string | null;
  exclusive_space: number;
  supply_space?: number | null;
  target_floor?: string | null;
  total_floor?: string | null;
  bargain_score: number;
  bargain_keyword?: string | null;
  bargain_type?: string | null;
  dong_name?: string | null;
  direction?: string | null;
  description?: string | null;
  space_name?: string | null;
  first_seen_at?: string;
  complex_name: string;
  complex_id: number;
  division?: string | null;
}

export default function RegionalBargainRow({ item, rank }: { item: RegionalBargainItem; rank: number }) {
  const nav = useRouter();
  return (
    <div
      className="press-effect"
      onClick={() => nav.push(`/article/${item.id}`)}
      style={{
        padding: 'var(--space-12) var(--space-16)',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
      }}
    >
      {/* Row 1: Rank + ComplexName + Area + Price */}
      <div className="flex items-center gap-10">
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: rank <= 3 ? 'var(--red-500)' : 'var(--gray-300)',
          color: 'white', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between">
            <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>
              {item.complex_name}{' '}
              <span className="text-xs text-gray">
                {formatAreaFull(item.exclusive_space, item.supply_space)}
                {item.space_name && ` ${item.space_name}`}
              </span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--blue-600)', flexShrink: 0, marginLeft: 8 }}>
              {item.formatted_price || formatWon(item.deal_price)}
            </span>
          </div>
          {/* Row 2: Badges + Score + Floor + Dong + Direction + Date */}
          <div className="flex items-center gap-6 text-xs text-gray" style={{ marginTop: 2, flexWrap: 'wrap' }}>
            <BargainBadge keyword={item.bargain_keyword} bargainType={item.bargain_type as any} />
            <ScoreBreakdownPopover articleId={item.id} bargainScore={item.bargain_score}>
              <span style={{
                background: 'var(--orange-50)',
                color: 'var(--orange-500)',
                padding: '1px 6px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 10,
              }}>점수 {item.bargain_score}</span>
            </ScoreBreakdownPopover>
            {item.target_floor && <span>{item.target_floor}/{item.total_floor}층</span>}
            {item.dong_name && <span>{item.dong_name}</span>}
            {item.direction && <span>{item.direction}</span>}
            {item.first_seen_at && <span>{relativeDate(item.first_seen_at)}</span>}
            {item.division && <span>{item.division}</span>}
          </div>
          {/* Row 3: Description */}
          {item.description && (
            <p className="text-xs text-gray truncate" style={{ marginTop: 2 }}>{item.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
