import { useNavigate } from 'react-router-dom';
import type { LeaderboardItem } from '../types';
import { formatWon, abbreviateCity } from '../utils/format';

interface Props {
  item: LeaderboardItem;
  rank: number;
}

export default function LeaderboardRow({ item, rank }: Props) {
  const nav = useNavigate();
  const regionParts = [abbreviateCity(item.city), item.division, item.sector].filter(Boolean);
  const regionText = regionParts.length > 0 ? regionParts.join(' ') : null;

  return (
    <div className="flex items-center gap-12 press-effect"
      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}
      onClick={() => nav(`/complex/${item.complex_id}`)}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: rank <= 3 ? 'var(--red-500)' : 'var(--gray-300)',
        color: 'white', fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {rank}
      </span>
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>{item.complex_name}</div>
        {regionText && (
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{regionText}</div>
        )}
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
          급매 {item.bargain_count}건
          {item.avg_bargain_score ? ` · 평균 ${item.avg_bargain_score}점` : ''}
          {item.avg_price ? ` · ${formatWon(item.avg_price)}` : ''}
        </div>
      </div>
      <span className="badge badge--red" style={{ flexShrink: 0 }}>{item.bargain_ratio}%</span>
    </div>
  );
}
