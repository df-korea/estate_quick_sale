import { useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DrillLevel, BargainSort, BargainMode, DongRankingItem } from '../types';
import { useBriefing } from '../hooks/useBriefing';
import { useFilteredBargains } from '../hooks/useBargains';
import { useLeaderboard, useTopPriceDrops } from '../hooks/useAnalysis';
import { useDongRankings, useDongArticles } from '../hooks/useDongRankings';
import { formatWon, formatArea, abbreviateCity } from '../utils/format';
const MapExplorer = lazy(() => import('../components/map/MapExplorer'));
import BargainCard from '../components/BargainCard';
import FilterBar from '../components/FilterBar';
import SectionHeader from '../components/SectionHeader';
import LeaderboardRow from '../components/LeaderboardRow';
import TopPriceDropRow from '../components/TopPriceDropRow';
import LoadingSpinner from '../components/LoadingSpinner';
import ScoreBreakdownPopover from '../components/ScoreBreakdownPopover';
import InlineBannerAd from '../components/InlineBannerAd';

export default function HomePage() {
  const [district, setDistrict] = useState<string | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<BargainSort>('score_desc');
  const [bargainMode, setBargainMode] = useState<BargainMode>('all');
  const [leaderboardMode, setLeaderboardMode] = useState<string>('all');

  const { data: briefing } = useBriefing();
  const { data: bargains, loading: bargainsLoading } = useFilteredBargains({
    sort,
    district,
    city,
    bargainType: bargainMode,
    limit: 10,
  });
  const { data: leaderboard } = useLeaderboard(10, leaderboardMode);
  const { data: topPriceDrops } = useTopPriceDrops(10);
  const [dongRankingMode, setDongRankingMode] = useState<BargainMode>('keyword');
  const { data: dongRankings, loading: dongLoading } = useDongRankings(10, dongRankingMode);

  const handleDrillChange = useCallback((level: DrillLevel, sido: string | null, sigungu: string | null) => {
    if (level === 'complex' && sigungu) {
      setDistrict(sigungu);
      setCity(sido ?? undefined);
    } else {
      setDistrict(undefined);
      setCity(undefined);
    }
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

        {/* Dong Rankings */}
        {dongRankings.length > 0 && (
          <section className="section animate-fade-in-up stagger-2">
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

        {/* Ad: between rankings and leaderboard */}
        <InlineBannerAd />

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <section className="section animate-fade-in-up stagger-3">
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

        {/* Ad: between price drops and bargain top 10 */}
        <InlineBannerAd />

        {/* Bargain TOP 10 */}
        <section className="section animate-fade-in-up stagger-5">
          <SectionHeader
            title={district
              ? `${district} ${bargainMode === 'keyword' ? '키워드 급매' : bargainMode === 'price' ? '가격 급매' : '급매'} TOP 10`
              : bargainMode === 'keyword' ? '키워드 급매 TOP 10' : bargainMode === 'price' ? '가격 급매 TOP 10' : '급매 TOP 10'}
            right={<span className="text-sm text-gray">{bargains.length}건</span>}
          />

          <FilterBar
            tradeFilter="all"
            onTradeFilterChange={() => {}}
            sort={sort}
            onSortChange={setSort}
          />

          {bargainsLoading ? <LoadingSpinner /> : (
            bargains.map(b => <BargainCard key={b.id} item={b} />)
          )}
        </section>
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
