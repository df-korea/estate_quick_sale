import { useNavigate } from 'react-router-dom';
import { formatWon, relativeDate } from '../utils/format';

interface AttachedArticle {
  id: number;
  deal_price: number;
  formatted_price: string;
  exclusive_space: number;
  trade_type: string;
  complex_name: string;
  target_floor?: string;
  total_floor?: string;
  bargain_score?: number;
  bargain_keyword?: string;
  space_name?: string;
  direction?: string;
  description?: string;
  dong_name?: string;
  score_factors?: { complex?: number; tx?: number; drops?: number; magnitude?: number };
  first_seen_at?: string;
  complex_id?: number;
}

interface Props {
  article: AttachedArticle;
  clickable?: boolean;
}

export default function ArticlePreviewCard({ article, clickable = true }: Props) {
  const nav = useNavigate();

  return (
    <div
      className={clickable ? 'press-effect' : ''}
      onClick={clickable ? () => nav(`/article/${article.id}`) : undefined}
      style={{
        padding: '12px 14px',
        background: 'var(--gray-50)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--gray-200)',
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-center justify-between">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>{article.complex_name}</div>
          <div className="flex items-center gap-6 text-xs text-gray" style={{ marginTop: 3 }}>
            <span>{article.exclusive_space}㎡</span>
            {article.space_name && <span>{article.space_name}</span>}
            {article.direction && <span>{article.direction}</span>}
            {article.dong_name && <span>{article.dong_name}</span>}
            {article.target_floor && <span>{article.target_floor}/{article.total_floor}층</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--blue-600)' }}>
            {formatWon(article.deal_price)}
          </div>
          {article.bargain_score != null && article.bargain_score > 0 && (
            <div className="text-xs" style={{ color: 'var(--orange-500)', marginTop: 2 }}>
              급매 {article.bargain_score}점
            </div>
          )}
        </div>
      </div>
      {article.description && (
        <p className="text-xs text-gray truncate" style={{ marginTop: 4 }}>{article.description}</p>
      )}
      <div className="flex items-center gap-6 text-xs" style={{ marginTop: 4 }}>
        {article.bargain_keyword && (
          <span style={{
            padding: '1px 6px', background: 'var(--red-50, #fff1f2)', color: 'var(--red-500)',
            borderRadius: 4, fontWeight: 600, fontSize: 10,
          }}>{article.bargain_keyword}</span>
        )}
        {article.score_factors && (
          <span style={{ color: 'var(--gray-400)', fontSize: 10 }}>
            {[
              article.score_factors.complex && `단지${article.score_factors.complex}`,
              article.score_factors.tx && `실거래${article.score_factors.tx}`,
              article.score_factors.drops && `인하${article.score_factors.drops}`,
            ].filter(Boolean).join(' · ')}
          </span>
        )}
        {article.first_seen_at && (
          <span style={{ color: 'var(--gray-400)', fontSize: 10, marginLeft: 'auto' }}>
            {relativeDate(article.first_seen_at)}
          </span>
        )}
      </div>
    </div>
  );
}
