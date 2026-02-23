import { useParams, useNavigate } from 'react-router-dom';
import { useArticle, usePriceHistory } from '../hooks/useArticle';
import { useAssessment } from '../hooks/useAssessment';
import { formatWon, formatArea, relativeDate, tradeTypeLabel, daysOnMarket } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';
import BargainBadge from '../components/BargainBadge';
import BargainScoreBadge from '../components/BargainScoreBadge';
import PriceAssessment from '../components/PriceAssessment';
import PriceTimeline from '../components/PriceTimeline';

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: article, loading } = useArticle(id);
  const { data: history } = usePriceHistory(id);
  const { data: assessment } = useAssessment(id);

  if (loading) return <div className="page"><LoadingSpinner /></div>;
  if (!article) return <div className="page"><div className="page-content">매물을 찾을 수 없습니다</div></div>;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => nav(-1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>{article.complexes.complex_name}</h1>
        <div style={{ width: 20 }} />
      </div>

      <div className="page-content">
        {/* Top badges + score */}
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-12)' }}>
          <div className="flex items-center gap-6">
            <span className={`badge ${article.trade_type === 'A1' ? 'badge--blue' : article.trade_type === 'B1' ? 'badge--green' : 'badge--orange'}`}>
              {tradeTypeLabel(article.trade_type)}
            </span>
            <BargainBadge keyword={article.bargain_keyword} />
          </div>
          {assessment && <BargainScoreBadge score={assessment.score} size="lg" />}
        </div>

        {/* Price */}
        <div style={{ marginBottom: 'var(--space-16)' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-2xl)', color: 'var(--blue-600)' }}>
            {formatWon(article.deal_price)}
          </div>
          {article.trade_type === 'B2' && article.rent_price && (
            <div className="text-sm text-gray">
              보증금 {formatWon(article.warranty_price)} / 월세 {formatWon(article.rent_price)}
            </div>
          )}
          {article.initial_price && article.initial_price !== article.deal_price && (
            <div className="text-sm text-gray">
              최초 호가 {formatWon(article.initial_price)} (인하 {article.price_change_count}회)
            </div>
          )}
        </div>

        {/* Info grid */}
        <div className="card" style={{ marginBottom: 'var(--space-16)' }}>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-10)' }}>
              <InfoRow label="면적" value={formatArea(article.exclusive_space)} />
              <InfoRow label="층" value={article.target_floor ? `${article.target_floor}/${article.total_floor}층` : '-'} />
              <InfoRow label="방향" value={article.direction ?? '-'} />
              <InfoRow label="등록" value={`${relativeDate(article.first_seen_at)} (${daysOnMarket(article.first_seen_at)}일)`} />
              {article.management_fee != null && <InfoRow label="관리비" value={`${Math.round(article.management_fee / 10000)}만원`} />}
              <InfoRow label="확인" value={article.verification_type ?? '-'} />
              {article.dong_name && <InfoRow label="동" value={article.dong_name} />}
              {article.brokerage_name && <InfoRow label="중개사" value={article.brokerage_name} />}
            </div>
          </div>
        </div>

        {/* Description */}
        {article.description && (
          <div className="card" style={{ marginBottom: 'var(--space-16)' }}>
            <div className="card-body">
              <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-8)' }}>매물 설명</h4>
              <p className="text-sm" style={{ color: 'var(--gray-700)', lineHeight: 1.6 }}>{article.description}</p>
            </div>
          </div>
        )}

        {/* Assessment */}
        {assessment && <PriceAssessment assessment={assessment} />}

        {/* Price Timeline */}
        <PriceTimeline history={history} />

        {/* Link to complex */}
        <button onClick={() => nav(`/complex/${article.complex_id}`)} style={{
          width: '100%',
          padding: 'var(--space-12)',
          background: 'var(--gray-100)',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          color: 'var(--gray-700)',
        }}>
          {article.complexes.complex_name} 단지 상세 보기
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray">{label}</div>
      <div className="text-sm" style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}
