import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useArticle, usePriceHistory } from '../hooks/useArticle';
import { useAssessment } from '../hooks/useAssessment';
import { usePriceTrend, useIndividualTransactions } from '../hooks/useMarketData';
import { formatWon, formatTradePrice, formatArea, relativeDate, tradeTypeLabel, daysOnMarket } from '../utils/format';
import { extent, linearScale } from '../utils/chart';
import LoadingSpinner from '../components/LoadingSpinner';
import BargainBadge from '../components/BargainBadge';
import BargainScoreBadge from '../components/BargainScoreBadge';
import PriceAssessment from '../components/PriceAssessment';
import PriceTimeline from '../components/PriceTimeline';
import InlineBannerAd from '../components/InlineBannerAd';

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
            <BargainBadge keyword={article.bargain_keyword} bargainType={article.bargain_type} />
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
            complexId={article.complex_id}
          />
        )}

        {/* Action buttons */}
        <div className="flex gap-8" style={{ marginTop: 'var(--space-16)' }}>
          <a
            href={`https://new.land.naver.com/complexes/${article.complexes.hscp_no}?articleNo=${article.article_no}`}
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

        {/* Ad at bottom of article detail */}
        <InlineBannerAd />
      </div>
    </div>
  );
}

const TIMEFRAMES = [
  { label: '1년', months: 12 },
  { label: '3년', months: 36 },
  { label: '5년', months: 60 },
  { label: '최대', months: 120 },
] as const;

function RealTransactionSection({ complexName, exclusiveSpace, sggCd, complexId }: { complexName: string; exclusiveSpace: number; sggCd?: string | null; complexId?: number }) {
  const [months, setMonths] = useState(12);
  const { data: trend, loading: trendLoading } = usePriceTrend({ aptNm: complexName, excluUseAr: exclusiveSpace, sggCd: sggCd || undefined, months, complexId });
  const { data: individualTxs, loading: txLoading } = useIndividualTransactions({ aptNm: complexName, excluUseAr: exclusiveSpace, sggCd: sggCd || undefined, months, complexId });

  const loading = trendLoading || txLoading;
  if (loading) return <div style={{ marginBottom: 'var(--space-16)' }}><LoadingSpinner /></div>;
  if (trend.length === 0 && individualTxs.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--space-16)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-12)' }}>
        <h4 style={{ fontWeight: 700 }}>실거래가 추이</h4>
        <div className="flex gap-4">
          {TIMEFRAMES.map(tf => (
            <button key={tf.months} onClick={() => setMonths(tf.months)}
              className={`chip ${months === tf.months ? 'chip--active' : ''}`}
              style={{ fontSize: 11, padding: '2px 8px' }}>
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {trend.length >= 2 && (
        <div className="card" style={{ marginBottom: 'var(--space-12)' }}>
          <div className="card-body" style={{ overflow: 'auto' }}>
            <ArticlePriceTrendChart data={trend} transactions={individualTxs} width={Math.max(300, trend.length * 28)} height={200} />
            <div className="flex gap-12 justify-center" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Legend color="var(--blue-500)" label="평균" />
              <Legend color="var(--gray-300)" label="최고/최저" dashed />
              <Legend color="var(--blue-500)" label="개별 거래" dot />
              <Legend color="rgba(59,130,246,0.2)" label="거래량" bar />
            </div>
          </div>
        </div>
      )}

      {/* Daily transaction table */}
      {individualTxs.length > 0 && <TransactionTable transactions={individualTxs} />}
    </div>
  );
}

function ArticlePriceTrendChart({ data, transactions, width, height }: { data: import('../types').PriceTrendItem[]; transactions: import('../types').IndividualTransaction[]; width: number; height: number }) {
  const pad = { top: 10, right: 10, bottom: 40, left: 55 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const avgValues = data.map(d => Number(d.avg_price));
  const maxValues = data.map(d => Number(d.max_price));
  const minValues = data.map(d => Number(d.min_price));
  const allValues = [...avgValues, ...maxValues, ...minValues].filter(v => v > 0);
  if (allValues.length === 0) return null;

  const [yMin, yMax] = extent(allValues);
  const yPad = (yMax - yMin) * 0.05 || 100;
  const scaleX = linearScale([0, data.length - 1], [0, cw]);
  const scaleY = linearScale([yMin - yPad, yMax + yPad], [ch, 0]);

  const maxTxCount = Math.max(...data.map(d => d.tx_count), 1);
  const barWidth = Math.max(4, cw / data.length * 0.6);

  const toPoints = (vals: number[]) => vals.map((v, i) => `${pad.left + scaleX(i)},${pad.top + scaleY(v)}`).join(' ');

  const yTicks = 4;
  const yStep = (yMax + yPad - (yMin - yPad)) / yTicks || 1;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const val = (yMin - yPad) + yStep * i;
        const y = pad.top + scaleY(val);
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--gray-200)" strokeDasharray="2" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--gray-500)">
              {formatManwon(val)}
            </text>
          </g>
        );
      })}

      {/* Volume bars */}
      {data.map((d, i) => {
        const x = pad.left + scaleX(i);
        const barH = (d.tx_count / maxTxCount) * ch * 0.3;
        return (
          <rect key={`bar-${i}`} x={x - barWidth / 2} y={pad.top + ch - barH}
            width={barWidth} height={barH} fill="rgba(59,130,246,0.2)" rx={1} />
        );
      })}

      <polyline points={toPoints(maxValues)} fill="none" stroke="var(--gray-300)" strokeWidth={1} strokeDasharray="4 2" />
      <polyline points={toPoints(minValues)} fill="none" stroke="var(--gray-300)" strokeWidth={1} strokeDasharray="4 2" />
      <polyline points={toPoints(avgValues)} fill="none" stroke="var(--blue-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Scatter dots for individual transactions */}
      {transactions.length > 0 && (() => {
        const monthIndex = new Map<string, number>();
        data.forEach((d, i) => monthIndex.set(d.month, i));
        return transactions
          .filter(tx => !tx.is_cancel && tx.deal_amount > 0)
          .map((tx, i) => {
            const monthKey = `${tx.deal_year}-${String(tx.deal_month).padStart(2, '0')}`;
            const idx = monthIndex.get(monthKey);
            if (idx === undefined) return null;
            const dayOffset = (tx.deal_day || 15) / 30;
            const xPos = pad.left + scaleX(idx + dayOffset - 0.5);
            const yPos = pad.top + scaleY(tx.deal_amount);
            return (
              <circle key={`dot-${i}`} cx={xPos} cy={yPos} r={3.5}
                fill="var(--blue-500)" opacity={0.45} stroke="white" strokeWidth={0.5} />
            );
          });
      })()}

      {data.map((d, i) => {
        if (data.length > 6 && i % Math.ceil(data.length / 6) !== 0 && i !== data.length - 1) return null;
        const x = pad.left + scaleX(i);
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize={9} fill="var(--gray-500)">
            {d.month.slice(-5)}
          </text>
        );
      })}
    </svg>
  );
}

function Legend({ color, label, dashed, dot, bar }: { color: string; label: string; dashed?: boolean; dot?: boolean; bar?: boolean }) {
  return (
    <div className="flex items-center gap-4" style={{ fontSize: 11, color: 'var(--gray-500)' }}>
      {dot ? (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, opacity: 0.45 }} />
      ) : bar ? (
        <div style={{ width: 8, height: 8, background: color }} />
      ) : (
        <div style={{ width: 10, height: dashed ? 0 : 3, borderRadius: 2, background: dashed ? 'transparent' : color, borderTop: dashed ? `2px dashed ${color}` : 'none' }} />
      )}
      {label}
    </div>
  );
}

function TransactionTable({ transactions }: { transactions: import('../types').IndividualTransaction[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayLimit = 20;
  const displayed = showAll ? transactions : transactions.slice(0, displayLimit);
  const hasMore = transactions.length > displayLimit;

  return (
    <div className="card">
      <div className="card-body">
        <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-8)', fontSize: 'var(--text-sm)' }}>실거래 내역</h4>
        <div style={{ fontSize: 'var(--text-sm)' }}>
          <div className="flex items-center text-xs text-gray" style={{ padding: 'var(--space-6) 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1 }}>날짜</span>
            <span style={{ width: 80, textAlign: 'right' }}>금액</span>
            <span style={{ width: 35, textAlign: 'right' }}>층</span>
            <span style={{ width: 35, textAlign: 'right' }}>비고</span>
          </div>
          {displayed.map((tx, i) => (
            <div key={i} className="flex items-center" style={{
              padding: 'var(--space-6) 0',
              borderBottom: '1px solid var(--border)',
              textDecoration: tx.is_cancel ? 'line-through' : 'none',
              opacity: tx.is_cancel ? 0.5 : 1,
            }}>
              <span style={{ flex: 1, color: 'var(--gray-600)' }}>
                {tx.deal_year}.{String(tx.deal_month).padStart(2, '0')}
                {tx.deal_day ? `.${String(tx.deal_day).padStart(2, '0')}` : ''}
              </span>
              <span style={{ width: 80, textAlign: 'right', fontWeight: 600 }}>{formatManwon(tx.deal_amount)}</span>
              <span style={{ width: 35, textAlign: 'right' }}>{tx.floor ?? '-'}</span>
              <span style={{ width: 35, textAlign: 'right' }}>
                {tx.is_cancel && <span style={{ color: 'var(--red-500)', fontSize: 10, fontWeight: 700 }}>해제</span>}
              </span>
            </div>
          ))}
        </div>
        {hasMore && !showAll && (
          <button onClick={() => setShowAll(true)} className="press-effect" style={{
            width: '100%', padding: 10, marginTop: 8,
            background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)',
            fontWeight: 600, fontSize: 13, color: 'var(--gray-700)',
          }}>실거래가 더보기 ({transactions.length - displayLimit}건)</button>
        )}
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
