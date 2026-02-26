import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useComplex, useComplexArticles, useComplexPyeongTypes, useComplexDongs } from '../hooks/useComplex';
import { useMarketStats, useMarketAreaTypes, useMarketTrend, useMarketTransactions, useMarketFloorAnalysis } from '../hooks/useMarketPrices';
import { useWatchlist } from '../hooks/useWatchlist';
import { formatPrice, formatTradePrice, formatArea, relativeDate } from '../utils/format';
import { extent, linearScale } from '../utils/chart';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import BargainBadge from '../components/BargainBadge';
import type { MarketTrendItem, MarketTransaction, MarketFloorAnalysis } from '../types';

type Tab = 'articles' | 'market';

export default function ComplexDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: complex, loading } = useComplex(id);
  const [activeTab, setActiveTab] = useState<Tab>('articles');
  const [tradeFilter, setTradeFilter] = useState('A1'); // all, A1, B1, B2, bargain
  const effectiveTradeType = tradeFilter === 'bargain' ? 'A1' : tradeFilter;
  const effectiveBargainOnly = tradeFilter === 'bargain';
  const [articleSort, setArticleSort] = useState('price_asc');
  const [selectedSpaceName, setSelectedSpaceName] = useState<string | undefined>(undefined);
  const [selectedDongName, setSelectedDongName] = useState<string | undefined>(undefined);
  const [scoreTooltipId, setScoreTooltipId] = useState<number | null>(null);
  const { data: articles, loading: articlesLoading } = useComplexArticles(id, effectiveTradeType, articleSort, effectiveBargainOnly, selectedSpaceName, selectedDongName);
  const { data: pyeongTypes } = useComplexPyeongTypes(id);
  const { data: dongs } = useComplexDongs(id);
  const { has, add, remove } = useWatchlist();

  const isWatched = id ? has(Number(id)) : false;

  const dropdownStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border)',
    fontSize: 13,
    color: 'var(--gray-700)',
    background: 'var(--white)',
    flex: 1,
    minWidth: 0,
  };

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
            {/* Row 1: 거래유형 + 정렬 */}
            <div className="flex items-center gap-8" style={{ marginBottom: 'var(--space-8)' }}>
              <select
                value={tradeFilter}
                onChange={e => setTradeFilter(e.target.value)}
                style={dropdownStyle}
              >
                <option value="all">전체</option>
                <option value="A1">매매</option>
                <option value="B1">전세</option>
                <option value="B2">월세</option>
                <option value="bargain">급매만</option>
              </select>
              <select
                value={articleSort}
                onChange={e => setArticleSort(e.target.value)}
                style={dropdownStyle}
              >
                <option value="price_asc">낮은가격순</option>
                <option value="price_desc">높은가격순</option>
                <option value="newest">최신순</option>
              </select>
            </div>
            {/* Row 2: 평형 + 동 */}
            <div className="flex items-center gap-8" style={{ marginBottom: 'var(--space-12)' }}>
              {pyeongTypes.length > 1 && (
                <select
                  value={selectedSpaceName ?? ''}
                  onChange={e => setSelectedSpaceName(e.target.value || undefined)}
                  style={dropdownStyle}
                >
                  <option value="">전체면적</option>
                  {pyeongTypes.map(pt => (
                    <option key={pt.space_name} value={pt.space_name}>
                      {pt.pyeong}평 {pt.space_name} ({pt.article_count})
                    </option>
                  ))}
                </select>
              )}
              {dongs.length > 1 && (
                <select
                  value={selectedDongName ?? ''}
                  onChange={e => setSelectedDongName(e.target.value || undefined)}
                  style={dropdownStyle}
                >
                  <option value="">전체동</option>
                  {dongs.map(d => (
                    <option key={d.dong_name} value={d.dong_name}>
                      {d.dong_name} ({d.article_count})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {articlesLoading ? <LoadingSpinner /> : articles.length === 0 ? (
              <EmptyState message="매물이 없습니다" />
            ) : (
              articles.map(a => (
                <div key={a.id} className="card" style={{ marginBottom: 'var(--space-8)', cursor: 'pointer' }}
                  onClick={() => nav(`/article/${a.id}`)}>
                  <div className="card-body" style={{ padding: 'var(--space-10) var(--space-16)' }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontWeight: 600 }}>{formatTradePrice(a.trade_type, a.deal_price, a.warranty_price, a.rent_price)}</span>
                      <div className="flex items-center gap-4">
                        <BargainBadge keyword={a.bargain_keyword} />
                        {a.bargain_score > 0 && (
                          <span className="badge badge--gray" style={{ cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setScoreTooltipId(scoreTooltipId === a.id ? null : a.id); }}>
                            {a.bargain_score}점
                          </span>
                        )}
                        {a.price_change_count > 0 && (
                          <span className="badge badge--gray">인하 {a.price_change_count}회</span>
                        )}
                      </div>
                    </div>
                    {scoreTooltipId === a.id && a.score_factors && (
                      <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-8)', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                        <div className="text-xs" style={{ fontWeight: 600, marginBottom: 4 }}>급매 점수 구성</div>
                        {a.score_factors.complex > 0 && <div className="flex items-center justify-between"><span>단지 내 비교</span><span style={{ fontWeight: 600, color: 'var(--blue-500)' }}>+{a.score_factors.complex}</span></div>}
                        {a.score_factors.tx > 0 && <div className="flex items-center justify-between"><span>실거래 비교</span><span style={{ fontWeight: 600, color: 'var(--blue-500)' }}>+{a.score_factors.tx}</span></div>}
                        {a.score_factors.drops > 0 && <div className="flex items-center justify-between"><span>인하 이력</span><span style={{ fontWeight: 600, color: 'var(--blue-500)' }}>+{a.score_factors.drops}</span></div>}
                        {a.score_factors.magnitude > 0 && <div className="flex items-center justify-between"><span>누적 인하율</span><span style={{ fontWeight: 600, color: 'var(--blue-500)' }}>+{a.score_factors.magnitude}</span></div>}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray" style={{ marginTop: 'var(--space-4)' }}>
                      <span>
                        {formatArea(a.exclusive_space)}
                        {a.space_name && ` ${a.space_name}`}
                        {a.target_floor && ` · ${a.target_floor}/${a.total_floor}층`}
                        {a.dong_name && ` · ${a.dong_name}`}
                        {a.direction && ` · ${a.direction}`}
                      </span>
                      <span style={{ flexShrink: 0 }}>{relativeDate(a.first_seen_at)}</span>
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
          <MarketTab complexId={id!} />
        )}
      </div>
    </div>
  );
}

function MarketTab({ complexId }: { complexId: string }) {
  const { data: stats, loading: statsLoading } = useMarketStats(complexId);
  const { data: areaTypes } = useMarketAreaTypes(complexId);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [trendMonths, setTrendMonths] = useState(36);
  const [txLimit, setTxLimit] = useState(20);
  const { data: trend, loading: trendLoading } = useMarketTrend(complexId, selectedArea, trendMonths);
  const { data: transactions, loading: txLoading } = useMarketTransactions(complexId, selectedArea, txLimit);
  const { data: floorData } = useMarketFloorAnalysis(complexId, selectedArea);

  if (statsLoading) return <LoadingSpinner />;
  if (!stats || stats.total_count === 0) return <EmptyState message="실거래 데이터가 없습니다" />;

  // Compute key metrics from trend
  const allTrend = trend.filter(t => t.tx_count > 0);
  const latestAvg = allTrend.length > 0 ? allTrend[allTrend.length - 1].avg_price : null;
  const overallMax = allTrend.length > 0 ? Math.max(...allTrend.map(t => Number(t.max_price))) : null;
  const overallMin = allTrend.length > 0 ? Math.min(...allTrend.map(t => Number(t.min_price))) : null;

  return (
    <div>
      {/* A. Area type selector */}
      {areaTypes.length > 0 && (
        <div className="flex gap-6 scroll-x" style={{ marginBottom: 'var(--space-16)', paddingBottom: 2 }}>
          <button
            className={`chip ${selectedArea == null ? 'chip--active' : ''}`}
            onClick={() => setSelectedArea(null)}
          >전체</button>
          {areaTypes.map(at => (
            <button
              key={at.area_bucket}
              className={`chip ${selectedArea === at.area_bucket ? 'chip--active' : ''}`}
              onClick={() => setSelectedArea(selectedArea === at.area_bucket ? null : at.area_bucket)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {at.pyeong}평 ({at.area_bucket}㎡) {at.tx_count}건
            </button>
          ))}
        </div>
      )}

      {/* B. Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-8)', marginBottom: 'var(--space-16)' }}>
        <MetricCard label="평균 실거래가" value={latestAvg ? formatPrice(latestAvg) : '-'} color="var(--blue-600)" />
        <MetricCard label="최고가" value={overallMax ? formatPrice(overallMax) : '-'} color="var(--gray-700)" />
        <MetricCard label="최저가" value={overallMin ? formatPrice(overallMin) : '-'} color="var(--gray-700)" />
      </div>

      {/* C. Price trend chart */}
      <div className="card" style={{ marginBottom: 'var(--space-16)' }}>
        <div className="card-body">
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-8)' }}>
            <h4 style={{ fontWeight: 700, fontSize: 14 }}>실거래가 추이</h4>
            <div className="flex gap-4">
              {[12, 24, 36].map(m => (
                <button key={m} className={`chip ${trendMonths === m ? 'chip--active' : ''}`}
                  onClick={() => setTrendMonths(m)} style={{ fontSize: 11, padding: '2px 8px' }}>
                  {m}개월
                </button>
              ))}
            </div>
          </div>
          {trendLoading ? <LoadingSpinner /> : trend.length < 2 ? (
            <EmptyState message="차트 데이터 부족" />
          ) : (
            <div style={{ overflow: 'auto' }}>
              <PriceTrendChart data={trend} transactions={transactions} width={Math.max(320, trend.length * 28)} height={220} />
            </div>
          )}
          <div className="flex gap-12 text-xs text-gray" style={{ marginTop: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 16, height: 2, background: 'var(--blue-500)', verticalAlign: 'middle', marginRight: 4 }} />평균</span>
            <span><span style={{ display: 'inline-block', width: 16, height: 2, background: 'var(--gray-300)', verticalAlign: 'middle', marginRight: 4, borderTop: '1px dashed var(--gray-400)' }} />최고/최저</span>
            <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--blue-500)', opacity: 0.45, verticalAlign: 'middle', marginRight: 4 }} />개별 거래</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(59,130,246,0.2)', verticalAlign: 'middle', marginRight: 4 }} />거래량</span>
          </div>
        </div>
      </div>

      {/* D. Transaction table */}
      <div className="card" style={{ marginBottom: 'var(--space-16)' }}>
        <div className="card-body">
          <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-8)', fontSize: 14 }}>최근 실거래 내역</h4>
          {txLoading ? <LoadingSpinner /> : transactions.length === 0 ? (
            <EmptyState message="거래 내역이 없습니다" />
          ) : (
            <>
              <div style={{ fontSize: 'var(--text-sm)' }}>
                <div className="flex items-center text-xs text-gray" style={{ padding: 'var(--space-6) 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flex: 1 }}>날짜</span>
                  <span style={{ width: 90, textAlign: 'right' }}>금액</span>
                  <span style={{ width: 40, textAlign: 'right' }}>층</span>
                  <span style={{ width: 40, textAlign: 'right' }}>비고</span>
                </div>
                {transactions.map((tx, i) => (
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
                    <span style={{ width: 90, textAlign: 'right', fontWeight: 600 }}>{formatPrice(tx.deal_amount)}</span>
                    <span style={{ width: 40, textAlign: 'right' }}>{tx.floor ?? '-'}</span>
                    <span style={{ width: 40, textAlign: 'right' }}>
                      {tx.is_cancel && <span style={{ color: 'var(--red-500)', fontSize: 10, fontWeight: 700 }}>해제</span>}
                    </span>
                  </div>
                ))}
              </div>
              {txLimit === 20 && transactions.length >= 20 && (
                <button onClick={() => setTxLimit(50)} className="press-effect" style={{
                  width: '100%', padding: 10, marginTop: 8,
                  background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)',
                  fontWeight: 600, fontSize: 13, color: 'var(--gray-700)',
                }}>더보기</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* E. Floor analysis scatter */}
      {floorData.length > 1 && (
        <div className="card">
          <div className="card-body">
            <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-8)', fontSize: 14 }}>층별 시세 분석</h4>
            <FloorScatterChart data={floorData} width={320} height={200} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div className="card-body" style={{ padding: 'var(--space-10) var(--space-8)' }}>
        <div className="text-xs text-gray">{label}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function PriceTrendChart({ data, transactions, width, height }: { data: MarketTrendItem[]; transactions?: MarketTransaction[]; width: number; height: number }) {
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
      {/* Y grid + labels */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const val = (yMin - yPad) + yStep * i;
        const y = pad.top + scaleY(val);
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--gray-200)" strokeDasharray="2" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--gray-500)">
              {formatPrice(val)}
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

      {/* Max/min dashed lines */}
      <polyline points={toPoints(maxValues)} fill="none" stroke="var(--gray-300)" strokeWidth={1} strokeDasharray="4 2" />
      <polyline points={toPoints(minValues)} fill="none" stroke="var(--gray-300)" strokeWidth={1} strokeDasharray="4 2" />

      {/* Average solid line */}
      <polyline points={toPoints(avgValues)} fill="none" stroke="var(--blue-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Scatter dots for individual transactions */}
      {transactions && transactions.length > 0 && (() => {
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

      {/* X axis labels */}
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

function FloorScatterChart({ data, width, height }: { data: MarketFloorAnalysis[]; width: number; height: number }) {
  const pad = { top: 10, right: 10, bottom: 30, left: 50 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const prices = data.map(d => Number(d.avg_price));
  const floors = data.map(d => d.floor);
  const txCounts = data.map(d => d.tx_count);

  const [pMin, pMax] = extent(prices);
  const [fMin, fMax] = extent(floors);
  const maxTx = Math.max(...txCounts, 1);

  const scaleX = linearScale([pMin - (pMax - pMin) * 0.05, pMax + (pMax - pMin) * 0.05], [0, cw]);
  const scaleY = linearScale([fMin - 1, fMax + 1], [ch, 0]);

  const overallAvg = prices.reduce((a, b) => a + b, 0) / prices.length;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {/* Average price line */}
      <line x1={pad.left + scaleX(overallAvg)} y1={pad.top} x2={pad.left + scaleX(overallAvg)} y2={pad.top + ch}
        stroke="var(--blue-300)" strokeDasharray="4 2" strokeWidth={1} />
      <text x={pad.left + scaleX(overallAvg)} y={pad.top - 2} textAnchor="middle" fontSize={9} fill="var(--blue-500)">
        평균 {formatPrice(overallAvg)}
      </text>

      {/* Scatter dots */}
      {data.map((d, i) => {
        const cx = pad.left + scaleX(Number(d.avg_price));
        const cy = pad.top + scaleY(d.floor);
        const r = Math.max(4, Math.min(12, (d.tx_count / maxTx) * 12));
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="var(--blue-500)" opacity={0.5} />
            <text x={cx} y={cy - r - 2} textAnchor="middle" fontSize={8} fill="var(--gray-600)">
              {d.floor}층
            </text>
          </g>
        );
      })}

      {/* Y axis label */}
      <text x={8} y={pad.top + ch / 2} textAnchor="middle" fontSize={9} fill="var(--gray-500)"
        transform={`rotate(-90 8 ${pad.top + ch / 2})`}>층수</text>
    </svg>
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
