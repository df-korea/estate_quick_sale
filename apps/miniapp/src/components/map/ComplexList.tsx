import { useNavigate } from 'react-router-dom';
import type { SigunguComplex } from '../../types';
import { formatWon } from '../../utils/format';

interface Props {
  complexes: SigunguComplex[];
}

export default function ComplexList({ complexes }: Props) {
  const nav = useNavigate();

  if (complexes.length === 0) return null;

  return (
    <div>
      {complexes.map(c => (
        <div key={c.complex_id}
          className="flex items-center justify-between"
          style={{ padding: 'var(--space-10) 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
          onClick={() => nav(`/complex/${c.complex_id}`)}>
          <div style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 600 }}>{c.complex_name}</div>
            <div className="text-sm text-gray">
              매물 {c.total_articles}건
              {c.avg_price ? ` · 평균 ${formatWon(c.avg_price)}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
            {c.bargain_count > 0 && (
              <span className="badge badge--red">급매 {c.bargain_count}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
