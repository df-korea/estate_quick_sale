import { useNavigate } from 'react-router-dom';
import type { BargainArticle } from '../types';
import { formatWon, relativeDate, tradeTypeLabel } from '../utils/format';
import BargainBadge from './BargainBadge';

interface Props {
  item: BargainArticle;
}

export default function BargainCard({ item }: Props) {
  const nav = useNavigate();

  return (
    <div className="card press-effect" style={{ marginBottom: 8, cursor: 'pointer' }}
      onClick={() => nav(`/article/${item.id}`)}>
      <div className="card-body" style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-6" style={{ marginBottom: 4 }}>
          <span className={`badge ${item.trade_type === 'A1' ? 'badge--blue' : item.trade_type === 'B1' ? 'badge--green' : 'badge--orange'}`}>
            {tradeTypeLabel(item.trade_type)}
          </span>
          <BargainBadge keyword={item.bargain_keyword} />
          {item.price_change_count > 0 && (
            <span className="badge badge--gray">인하 {item.price_change_count}회</span>
          )}
        </div>

        <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }} className="truncate">
            {item.complex_name}
          </span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--blue-600)', whiteSpace: 'nowrap', marginLeft: 8 }}>
            {formatWon(item.deal_price)}
          </span>
        </div>

        <div className="flex items-center gap-8 text-sm text-gray">
          <span>{item.exclusive_space}㎡</span>
          {item.target_floor && <span>{item.target_floor}층</span>}
          {item.direction && <span>{item.direction}</span>}
          <span style={{ marginLeft: 'auto' }}>{relativeDate(item.first_seen_at)}</span>
        </div>

        {item.description && (
          <p className="text-sm text-gray truncate" style={{ marginTop: 4, lineHeight: 1.4 }}>
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}
