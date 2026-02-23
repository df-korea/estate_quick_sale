import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useComplex, useComplexArticles } from '../hooks/useComplex';
import { usePriceTrend } from '../hooks/useMarketData';
import { useWatchlist } from '../hooks/useWatchlist';
import { formatWon, formatArea, relativeDate, tradeTypeLabel } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import BargainBadge from '../components/BargainBadge';
import LineChart from '../components/charts/LineChart';

type Tab = 'articles' | 'market';

export default function ComplexDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: complex, loading } = useComplex(id);
  const [activeTab, setActiveTab] = useState<Tab>('articles');
  const [tradeType, setTradeType] = useState('A1');
  const { data: articles, loading: articlesLoading } = useComplexArticles(id, tradeType);
  const { has, add, remove } = useWatchlist();

  const isWatched = id ? has(Number(id)) : false;

  if (loading) return <div className="page"><LoadingSpinner /></div>;
  if (!complex) return <div className="page"><div className="page-content">단지를 찾을 수 없습니다</div></div>;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => nav(-1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="truncate" style={{ flex: 1, textAlign: 'center' }}>{complex.complex_name}</h1>
        <button onClick={() => isWatched ? remove(complex.id) : add(complex.id)}>
          <svg width="22" height="22" viewBox="0 0 24 24"
            fill={isWatched ? 'var(--red-500)' : 'none'}
            stroke={isWatched ? 'var(--red-500)' : 'var(--gray-400)'}
            strokeWidth="2">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      <div className="page-content">
        {/* Complex Info */}
        <div className="card" style={{ marginBottom: 'var(--space-16)' }}>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-10)' }}>
              {complex.property_type && <InfoRow label="유형" value={complex.property_type} />}
              {complex.total_households && <InfoRow label="세대수" value={`${complex.total_households}세대`} />}
              {complex.building_date && <InfoRow label="준공일" value={complex.building_date} />}
              {complex.city && <InfoRow label="주소" value={`${complex.city} ${complex.division || ''} ${complex.sector || ''}`} />}
              <InfoRow label="매매" value={`${complex.deal_count}건`} />
              <InfoRow label="전세" value={`${complex.lease_count}건`} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '2px solid var(--border)', marginBottom: 'var(--space-16)' }}>
          {(['articles', 'market'] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1,
              padding: 'var(--space-10)',
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? 'var(--blue-500)' : 'var(--gray-500)',
              borderBottom: activeTab === tab ? '2px solid var(--blue-500)' : '2px solid transparent',
              marginBottom: -2,
            }}>
              {tab === 'articles' ? '매물' : '시세'}
            </button>
          ))}
        </div>

        {/* Articles Tab */}
        {activeTab === 'articles' && (
          <>
            <div className="flex gap-6" style={{ marginBottom: 'var(--space-12)' }}>
              {['A1', 'B1', 'B2'].map(t => (
                <button key={t} className={`chip ${tradeType === t ? 'chip--active' : ''}`}
                  onClick={() => setTradeType(t)}>
                  {tradeTypeLabel(t)}
                </button>
              ))}
            </div>

            {articlesLoading ? <LoadingSpinner /> : articles.length === 0 ? (
              <EmptyState message="매물이 없습니다" />
            ) : (
              articles.map(a => (
                <div key={a.id} className="card" style={{ marginBottom: 'var(--space-8)', cursor: 'pointer' }}
                  onClick={() => nav(`/article/${a.id}`)}>
                  <div className="card-body" style={{ padding: 'var(--space-10) var(--space-16)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <BargainBadge keyword={a.bargain_keyword} />
                        <span style={{ fontWeight: 600 }}>{formatWon(a.deal_price)}</span>
                      </div>
                      <span className="text-sm text-gray">{relativeDate(a.first_seen_at)}</span>
                    </div>
                    <div className="text-sm text-gray" style={{ marginTop: 'var(--space-4)' }}>
                      {formatArea(a.exclusive_space)}
                      {a.target_floor && ` · ${a.target_floor}/${a.total_floor}층`}
                      {a.direction && ` · ${a.direction}`}
                    </div>
                    {a.description && <p className="text-xs text-gray truncate" style={{ marginTop: 2 }}>{a.description}</p>}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Market Tab */}
        {activeTab === 'market' && (
          <MarketTab complexName={complex.complex_name} />
        )}
      </div>
    </div>
  );
}

function MarketTab({ complexName }: { complexName: string }) {
  const { data: trend, loading } = usePriceTrend({ aptNm: complexName, months: 12 });

  if (loading) return <LoadingSpinner />;
  if (trend.length === 0) return <EmptyState message="실거래 데이터가 없습니다" />;

  return (
    <div>
      <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>실거래가 추이 (12개월)</h4>
      <div className="card" style={{ marginBottom: 'var(--space-16)' }}>
        <div className="card-body" style={{ overflow: 'auto' }}>
          <LineChart
            labels={trend.map(t => t.month)}
            series={[{
              label: '평균',
              data: trend.map(t => Number(t.avg_price)),
              color: 'var(--blue-500)',
            }]}
            width={Math.max(300, trend.length * 50)}
            height={180}
          />
        </div>
      </div>

      {/* Transaction table */}
      <div className="card">
        <div className="card-body">
          <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-8)' }}>월별 거래</h4>
          <div style={{ fontSize: 'var(--text-sm)' }}>
            <div className="flex items-center text-xs text-gray" style={{ padding: 'var(--space-6) 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1 }}>월</span>
              <span style={{ width: 40, textAlign: 'right' }}>건수</span>
              <span style={{ width: 80, textAlign: 'right' }}>평균</span>
              <span style={{ width: 80, textAlign: 'right' }}>최고</span>
            </div>
            {trend.slice().reverse().map(t => (
              <div key={t.month} className="flex items-center" style={{ padding: 'var(--space-6) 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, color: 'var(--gray-600)' }}>{t.month}</span>
                <span style={{ width: 40, textAlign: 'right' }}>{t.tx_count}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{formatPrice(t.avg_price)}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{formatPrice(t.max_price)}</span>
              </div>
            ))}
          </div>
        </div>
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

/** 만원 → 억 format for real_transactions (deal_amount is in 만원) */
function formatPrice(manwon: number | null | undefined): string {
  if (manwon == null) return '-';
  const num = Number(manwon);
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const rem = num % 10000;
    return rem > 0 ? `${eok}억${rem.toLocaleString()}` : `${eok}억`;
  }
  return `${num.toLocaleString()}만`;
}
