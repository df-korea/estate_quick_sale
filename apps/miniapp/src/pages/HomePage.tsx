import { useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DrillLevel, BargainMode, DongRankingItem, PropertyType } from '../types';
import { useBriefing } from '../hooks/useBriefing';
import { useRegionalTopBargains, useRegionalTopDivisions } from '../hooks/useBargains';
import { useLeaderboard, useTopPriceDrops } from '../hooks/useAnalysis';
import { useDongRankings, useDongArticles } from '../hooks/useDongRankings';
import { useSidoHeatmap } from '../hooks/useMapData';
import { formatWon, formatArea, abbreviateCity } from '../utils/format';
const MapExplorer = lazy(() => import('../components/map/MapExplorer'));
import SectionHeader from '../components/SectionHeader';
import LeaderboardRow from '../components/LeaderboardRow';
import TopPriceDropRow from '../components/TopPriceDropRow';
import LoadingSpinner from '../components/LoadingSpinner';
import ScoreBreakdownPopover from '../components/ScoreBreakdownPopover';
import InlineBannerAd from '../components/InlineBannerAd';

const PRICE_OPTIONS = [
  { value: 50000000, label: '5천만' },
  { value: 100000000, label: '1억' },
  { value: 200000000, label: '2억' },
  { value: 300000000, label: '3억' },
  { value: 500000000, label: '5억' },
  { value: 700000000, label: '7억' },
  { value: 1000000000, label: '10억' },
  { value: 1500000000, label: '15억' },
  { value: 2000000000, label: '20억' },
  { value: 3000000000, label: '30억' },
  { value: 5000000000, label: '50억' },
];

export default function HomePage() {
  const [bargainMode, setBargainMode] = useState<BargainMode>('all');
  const [leaderboardMode, setLeaderboardMode] = useState<string>('all');

  const { data: briefing } = useBriefing();
  const { data: leaderboard } = useLeaderboard(10, leaderboardMode);
  const { data: topPriceDrops } = useTopPriceDrops(10);
  const [dongRankingMode, setDongRankingMode] = useState<BargainMode>('keyword');
  const { data: dongRankings, loading: dongLoading } = useDongRankings(10, dongRankingMode);

  // Regional TOP 10
  const { data: sidoHeatmap } = useSidoHeatmap();
  const sidoList = [...sidoHeatmap.map(s => s.sido_name).filter(Boolean)].sort((a, b) => {
    const aa = abbreviateCity(a), bb = abbreviateCity(b);
    if (aa === '서울') return -1;
    if (bb === '서울') return 1;
    if (aa === '경기') return -1;
    if (bb === '경기') return 1;
    return aa.localeCompare(bb, 'ko');
  });
  const [selectedSido, setSelectedSido] = useState<string | null>(null);
  const [selectedSigungu, setSelectedSigungu] = useState<string | null>(null);
  const [regionalPropertyType, setRegionalPropertyType] = useState<PropertyType>('all');
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const activeSido = selectedSido || sidoList[0] || null;
  const { data: divisionsRaw } = useRegionalTopDivisions(activeSido, regionalPropertyType);
  const divisions = [...divisionsRaw].sort((a, b) => a.division.localeCompare(b.division, 'ko'));
  const { data: regionalBargains, loading: regionalLoading } = useRegionalTopBargains(activeSido, selectedSigungu, 10, regionalPropertyType, priceMin, priceMax);

  const handleDrillChange = useCallback((_level: DrillLevel, _sido: string | null, _sigungu: string | null) => {
  }, []);

  const handleBargainModeChange = useCallback((mode: BargainMode) => {
    setBargainMode(mode);
  }, []);

  const summary = briefing?.summary;

  return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: 8 }}>
        {/* Briefing Bar */}
        {summary && (
          <div className="flex gap-8 scroll-x animate-fade-in" style={{ marginBottom: 16, alignItems: 'center' }}>
            <span style={{
              padding: '4px 10px',
              background: 'var(--gray-100)',
              borderRadius: 'var(--radius-full)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--gray-600)',
              flexShrink: 0,
            }}>오늘</span>
            <BriefingChip label="급매" value={summary.new_bargains_today.toLocaleString()} color="var(--red-500)" />
            <BriefingChip label="신규" value={summary.new_today.toLocaleString()} color="var(--blue-500)" />
            <BriefingChip label="인하" value={String(summary.price_changes_today)} color="var(--green-500)" />
          </div>
        )}

        {/* Map Explorer */}
        <section className="section animate-fade-in-up stagger-1">
          <Suspense fallback={<div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>지도 로딩중...</div>}>
            <MapExplorer onDrillChange={handleDrillChange} onBargainModeChange={handleBargainModeChange} />
          </Suspense>
        </section>

        {/* Regional TOP 10 */}
        <section className="section animate-fade-in-up stagger-2">
          {/* Title row: left = title, right = price button + property type */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>최근 가격급매 TOP10</h3>
            <div className="flex gap-6" style={{ alignItems: 'center' }}>
              <button
                onClick={() => setShowPriceFilter(v => !v)}
                className={`chip ${(priceMin || priceMax) ? 'chip--active' : ''}`}
                style={{ fontSize: 'var(--text-sm)' }}
              >
                {priceMin || priceMax
                  ? `${priceMin ? formatWon(priceMin) : ''}~${priceMax ? formatWon(priceMax) : ''}`
                  : '가격'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 3, transform: showPriceFilter ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <select
                value={regionalPropertyType}
                onChange={e => setRegionalPropertyType(e.target.value as PropertyType)}
                style={{
                  background: 'var(--gray-100)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 12px',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--gray-700)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <option value="all">전체</option>
                <option value="APT">아파트</option>
                <option value="OPST">오피스텔</option>
              </select>
            </div>
          </div>

          {/* Price filter row (collapsible) */}
          {showPriceFilter && (
            <div className="flex gap-6" style={{ marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={priceMin ?? ''}
                onChange={e => setPriceMin(e.target.value ? Number(e.target.value) : null)}
                style={{
                  background: 'var(--gray-100)', border: 'none', borderRadius: 'var(--radius-full)',
                  padding: '6px 10px', fontSize: 'var(--text-sm)', color: 'var(--gray-700)', cursor: 'pointer',
                }}
              >
                <option value="">최소가</option>
                {PRICE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <span className="text-sm text-gray">~</span>
              <select
                value={priceMax ?? ''}
                onChange={e => setPriceMax(e.target.value ? Number(e.target.value) : null)}
                style={{
                  background: 'var(--gray-100)', border: 'none', borderRadius: 'var(--radius-full)',
                  padding: '6px 10px', fontSize: 'var(--text-sm)', color: 'var(--gray-700)', cursor: 'pointer',
                }}
              >
                <option value="">최대가</option>
                {PRICE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {(priceMin || priceMax) && (
                <button
                  onClick={() => { setPriceMin(null); setPriceMax(null); }}
                  className="text-xs" style={{ color: 'var(--gray-400)', padding: '4px 8px' }}
                >초기화</button>
              )}
            </div>
          )}

          {/* Sido + Sigungu selects */}
          <div className="flex gap-6" style={{ marginBottom: 12 }}>
            {sidoList.length > 0 && (
              <select
                value={activeSido || ''}
                onChange={e => { setSelectedSido(e.target.value); setSelectedSigungu(null); }}
                style={{
                  background: 'var(--gray-100)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 12px',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--gray-700)',
                  cursor: 'pointer',
                }}
              >
                {sidoList.map(sido => (
                  <option key={sido} value={sido}>{abbreviateCity(sido)}</option>
                ))}
              </select>
            )}
            {divisions.length > 0 && (
              <select
                value={selectedSigungu || ''}
                onChange={e => setSelectedSigungu(e.target.value || null)}
                style={{
                  background: 'var(--gray-100)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 12px',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--gray-700)',
                  cursor: 'pointer',
                }}
              >
                <option value="">전체</option>
                {divisions.map(d => (
                  <option key={d.division} value={d.division}>{d.division}</option>
                ))}
              </select>
            )}
          </div>

          {regionalLoading ? <LoadingSpinner /> : regionalBargains.length > 0 ? (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {regionalBargains.map((a, i) => (
                  <RegionalBargainRow key={a.id} item={a} rank={i + 1} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
              해당 지역에 최근 7일 가격 급매가 없습니다
            </div>
          )}
        </section>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <section className="section animate-fade-in-up stagger-2">
            <SectionHeader title="급매 리더보드" />
            <div className="flex gap-6" style={{ marginBottom: 'var(--space-8)' }}>
              {[
                { value: 'all', label: '전체' },
                { value: 'keyword', label: '키워드 급매' },
                { value: 'price', label: '가격 급매' },
              ].map(m => (
                <button
                  key={m.value}
                  className={`chip ${leaderboardMode === m.value ? 'chip--active' : ''}`}
                  onClick={() => setLeaderboardMode(m.value)}
                >{m.label}</button>
              ))}
            </div>
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {leaderboard.map((item, i) => (
                  <LeaderboardRow key={item.complex_id} item={item} rank={i + 1} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Ad: between leaderboard and dong rankings */}
        <InlineBannerAd />

        {/* Dong Rankings */}
        {dongRankings.length > 0 && (
          <section className="section animate-fade-in-up stagger-3">
            <SectionHeader title="지역별 급매 랭킹" right={<span className="text-sm text-gray">TOP {dongRankings.length}</span>} />
            <div className="flex gap-6" style={{ marginBottom: 'var(--space-8)' }}>
              {[
                { value: 'keyword' as BargainMode, label: '키워드 급매' },
                { value: 'price' as BargainMode, label: '가격 급매' },
              ].map(m => (
                <button
                  key={m.value}
                  className={`chip ${dongRankingMode === m.value ? 'chip--active' : ''}`}
                  onClick={() => setDongRankingMode(m.value)}
                >{m.label}</button>
              ))}
            </div>
            {dongLoading ? <LoadingSpinner /> : dongRankings.map((item, i) => (
              <DongRankingCard key={`${item.division}-${item.sector}`} item={item} rank={i + 1} />
            ))}
          </section>
        )}

        {/* Top Price Drops */}
        {topPriceDrops.length > 0 && (
          <section className="section animate-fade-in-up stagger-4">
            <SectionHeader title="누적 가격인하 TOP 10" />
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {topPriceDrops.map((item, i) => (
                  <TopPriceDropRow key={item.article_id} item={item} rank={i + 1} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Ad: after price drops */}
        <InlineBannerAd />
      </div>
    </div>
  );
}

function DongRankingCard({ item, rank }: { item: DongRankingItem; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="press-effect"
        style={{
          width: '100%',
          padding: 'var(--space-12) var(--space-16)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
          gap: 10,
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: rank <= 3 ? 'var(--red-500)' : 'var(--gray-300)',
          color: 'white', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{abbreviateCity(item.city)} {item.region_name}</div>
          <div className="text-xs text-gray" style={{ marginTop: 2 }}>
            급매 {item.bargain_count}건 · 평균 {item.avg_bargain_score}점
            {item.avg_price ? ` · ${formatWon(item.avg_price)}` : ''}
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--gray-400)" strokeWidth="2"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded && <DongRankingArticles division={item.division} sector={item.sector} />}
    </div>
  );
}

function DongRankingArticles({ division, sector }: { division: string; sector: string }) {
  const nav = useNavigate();
  const { data: articles, loading } = useDongArticles(division, sector, 5);

  if (loading) return <div style={{ padding: 'var(--space-8) var(--space-16)' }}><LoadingSpinner /></div>;
  if (articles.length === 0) return null;

  return (
    <div style={{ padding: '0 var(--space-16) var(--space-12)' }}>
      {articles.map(a => (
        <div
          key={a.id}
          onClick={() => nav(`/article/${a.id}`)}
          style={{
            padding: 'var(--space-8) 0',
            borderTop: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm" style={{ fontWeight: 600 }}>{a.complex_name}</span>
              <span className="text-xs text-gray" style={{ marginLeft: 6 }}>{formatArea(a.exclusive_space)}</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--blue-600)' }}>
              {formatWon(a.deal_price)}
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray" style={{ marginTop: 2 }}>
            <ScoreBreakdownPopover articleId={a.id} bargainScore={a.bargain_score}>
              <span style={{
                background: 'var(--orange-50)',
                color: 'var(--orange-500)',
                padding: '1px 6px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 10,
              }}>
                점수 {a.bargain_score}
              </span>
            </ScoreBreakdownPopover>
            {a.target_floor && <span>{a.target_floor}/{a.total_floor}층</span>}
            {a.bargain_keyword && <span style={{ color: 'var(--red-500)' }}>{a.bargain_keyword}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function RegionalBargainRow({ item, rank }: { item: { id: number; deal_price: number; formatted_price?: string; exclusive_space: number; target_floor?: string; total_floor?: string; bargain_score: number; bargain_keyword?: string; bargain_type?: string; complex_name: string; complex_id: number; division?: string }; rank: number }) {
  const nav = useNavigate();
  return (
    <div
      onClick={() => nav(`/article/${item.id}`)}
      style={{
        padding: 'var(--space-12) var(--space-16)',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: rank <= 3 ? 'var(--red-500)' : 'var(--gray-300)',
        color: 'white', fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center justify-between">
          <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>
            {item.complex_name} <span className="text-xs text-gray">{formatArea(item.exclusive_space)}</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--blue-600)', flexShrink: 0, marginLeft: 8 }}>
            {item.formatted_price || formatWon(item.deal_price)}
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs text-gray" style={{ marginTop: 2 }}>
          <span style={{
            background: 'var(--orange-50)',
            color: 'var(--orange-500)',
            padding: '1px 6px',
            borderRadius: 4,
            fontWeight: 600,
            fontSize: 10,
          }}>점수 {item.bargain_score}</span>
          {item.target_floor && <span>{item.target_floor}/{item.total_floor}층</span>}
          {item.bargain_keyword && <span style={{ color: 'var(--red-500)' }}>{item.bargain_keyword}</span>}
          {item.division && <span>{item.division}</span>}
        </div>
      </div>
    </div>
  );
}

function BriefingChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 14px',
      background: 'var(--white)',
      borderRadius: 'var(--radius-full)',
      boxShadow: 'var(--shadow-card)',
      flexShrink: 0,
    }}>
      <span style={{ fontWeight: 700, color, fontSize: 15 }}>{value}</span>
      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{label}</span>
    </div>
  );
}
