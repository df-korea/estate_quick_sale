import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useArticle, usePriceHistory } from '../hooks/useArticle';
import { useAssessment } from '../hooks/useAssessment';
import { usePriceTrend } from '../hooks/useMarketData';
import { formatWon, formatTradePrice, formatArea, relativeDate, tradeTypeLabel, daysOnMarket } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';
import BargainBadge from '../components/BargainBadge';
import BargainScoreBadge from '../components/BargainScoreBadge';
import PriceAssessment from '../components/PriceAssessment';
import PriceTimeline from '../components/PriceTimeline';
import LineChart from '../components/charts/LineChart';

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: article, loading } = useArticle(id);
  const { data: history } = usePriceHistory(id);
  const { data: assessment } = useAssessment(id);
  const assessmentRef = useRef<HTMLDivElement>(null);

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
          {assessment && (
            <div onClick={() => assessmentRef.current?.scrollIntoView({ behavior: 'smooth' })} style={{ cursor: 'pointer' }}>
              <BargainScoreBadge score={assessment.score} size="lg" />
            </div>
          )}
        </div>

        {/* Price */}
        <div style={{ marginBottom: 'var(--space-16)' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-2xl)', color: 'var(--blue-600)' }}>
            {formatTradePrice(article.trade_type, article.deal_price, article.warranty_price, article.rent_price)}
          </div>
          {(article.trade_type === 'B2' || article.trade_type === 'B3') && article.rent_price != null && (
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
        <div ref={assessmentRef}>
          {assessment && <PriceAssessment assessment={assessment} />}
        </div>

        {/* Price Timeline */}
        <PriceTimeline history={history} />

        {/* Real Transaction Trend */}
        {article.trade_type === 'A1' && (
          <RealTransactionSection
            complexName={article.complexes.rt_apt_nm || article.complexes.complex_name}
            exclusiveSpace={article.exclusive_space}
            sggCd={article.complexes.sgg_cd}
          />
        )}

        {/* Action buttons */}
        <div className="flex gap-8" style={{ marginTop: 'var(--space-16)' }}>
          <a
            href={`https://fin.land.naver.com/complexes/${article.complexes.hscp_no}?articleNo=${article.article_no}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              padding: 'var(--space-12)',
              background: 'var(--green-500)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              color: 'var(--white)',
              textAlign: 'center',
            }}
          >
            네이버 부동산에서 보기
          </a>
          <button onClick={() => nav(`/complex/${article.complex_id}`)} style={{
            flex: 1,
            padding: 'var(--space-12)',
            background: 'var(--gray-100)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            color: 'var(--gray-700)',
          }}>
            단지 상세 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function RealTransactionSection({ complexName, exclusiveSpace, sggCd }: { complexName: string; exclusiveSpace: number; sggCd?: string | null }) {
  const { data: trend, loading } = usePriceTrend({ aptNm: complexName, excluUseAr: exclusiveSpace, sggCd: sggCd || undefined, months: 24 });

  if (loading) return <div style={{ marginBottom: 'var(--space-16)' }}><LoadingSpinner /></div>;
  if (trend.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--space-16)' }}>
      <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>실거래가 추이 (24개월)</h4>
      <div className="card" style={{ marginBottom: 'var(--space-12)' }}>
        <div className="card-body" style={{ overflow: 'auto' }}>
          <LineChart
            labels={trend.map(t => t.month)}
            series={[
              { label: '평균', data: trend.map(t => Number(t.avg_price)), color: 'var(--blue-500)' },
              { label: '최고', data: trend.map(t => Number(t.max_price)), color: 'var(--red-400)' },
              { label: '최저', data: trend.map(t => Number(t.min_price)), color: 'var(--green-400)' },
            ]}
            width={Math.max(300, trend.length * 40)}
            height={180}
          />
          <div className="flex gap-12 justify-center" style={{ marginTop: 8 }}>
            <Legend color="var(--blue-500)" label="평균" />
            <Legend color="var(--red-400)" label="최고" />
            <Legend color="var(--green-400)" label="최저" />
          </div>
        </div>
      </div>

      {/* Recent transaction table */}
      <div className="card">
        <div className="card-body">
          <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-8)', fontSize: 'var(--text-sm)' }}>월별 실거래</h4>
          <div style={{ fontSize: 'var(--text-sm)' }}>
            <div className="flex items-center text-xs text-gray" style={{ padding: 'var(--space-6) 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1 }}>월</span>
              <span style={{ width: 40, textAlign: 'right' }}>건수</span>
              <span style={{ width: 80, textAlign: 'right' }}>평균</span>
              <span style={{ width: 80, textAlign: 'right' }}>최고</span>
            </div>
            {trend.slice().reverse().slice(0, 12).map(t => (
              <div key={t.month} className="flex items-center" style={{ padding: 'var(--space-6) 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, color: 'var(--gray-600)' }}>{t.month}</span>
                <span style={{ width: 40, textAlign: 'right' }}>{t.tx_count}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{formatManwon(t.avg_price)}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{formatManwon(t.max_price)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-4" style={{ fontSize: 11, color: 'var(--gray-500)' }}>
      <div style={{ width: 10, height: 3, borderRadius: 2, background: color }} />
      {label}
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

function formatManwon(manwon: number | null | undefined): string {
  if (manwon == null) return '-';
  const num = Number(manwon);
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const rem = num % 10000;
    return rem > 0 ? `${eok}억${rem.toLocaleString()}` : `${eok}억`;
  }
  return `${num.toLocaleString()}만`;
}
