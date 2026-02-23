import { useState, useCallback } from 'react';
import type { DrillLevel, BargainSort } from '../types';
import { useBriefing } from '../hooks/useBriefing';
import { useFilteredBargains } from '../hooks/useBargains';
import { useLeaderboard, useRecentPriceChanges } from '../hooks/useAnalysis';
import MapExplorer from '../components/map/MapExplorer';
import BargainCard from '../components/BargainCard';
import FilterBar from '../components/FilterBar';
import SectionHeader from '../components/SectionHeader';
import LeaderboardRow from '../components/LeaderboardRow';
import PriceChangeRow from '../components/PriceChangeRow';
import LoadingSpinner from '../components/LoadingSpinner';

export default function HomePage() {
  const [district, setDistrict] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<BargainSort>('newest');
  const [showAll, setShowAll] = useState(false);

  const { data: briefing } = useBriefing();
  const { data: bargains, loading: bargainsLoading, refetch } = useFilteredBargains({
    sort,
    district,
    limit: showAll ? 100 : 20,
  });
  const { data: leaderboard } = useLeaderboard(10);
  const { data: priceChanges } = useRecentPriceChanges(10);

  const handleDrillChange = useCallback((level: DrillLevel, _sido: string | null, sigungu: string | null) => {
    if (level === 'complex' && sigungu) {
      setDistrict(sigungu);
    } else {
      setDistrict(undefined);
    }
  }, []);

  const summary = briefing?.summary;

  return (
    <div className="page">
      {/* Brand Header */}
      <div className="page-header glass">
        <h1>급매 레이더</h1>
        <button onClick={() => refetch()} className="press-effect" style={{ padding: '4px 8px', color: 'var(--blue-500)', fontSize: 13, fontWeight: 600 }}>
          새로고침
        </button>
      </div>

      <div className="page-content">
        {/* Briefing Bar */}
        {summary && (
          <div className="flex gap-8 scroll-x animate-fade-in" style={{ marginBottom: 16 }}>
            <BriefingChip label="급매" value={summary.total_bargains.toLocaleString()} color="var(--red-500)" />
            <BriefingChip label="신규" value={summary.new_today.toLocaleString()} color="var(--blue-500)" />
            <BriefingChip label="인하" value={String(summary.price_changes_today)} color="var(--green-500)" />
          </div>
        )}

        {/* Map Explorer */}
        <section className="section animate-fade-in-up stagger-1">
          <MapExplorer onDrillChange={handleDrillChange} />
        </section>

        {/* Filter + Bargain Feed */}
        <section className="section animate-fade-in-up stagger-2">
          <SectionHeader
            title={district ? `${district} 급매` : '급매 매물'}
            right={<span className="text-sm text-gray">{bargains.length}건</span>}
          />

          <FilterBar
            tradeFilter="all"
            onTradeFilterChange={() => {}}
            sort={sort}
            onSortChange={setSort}
          />

          {bargainsLoading ? <LoadingSpinner /> : (
            <>
              {bargains.map(b => <BargainCard key={b.id} item={b} />)}
              {bargains.length >= 20 && !showAll && (
                <button onClick={() => setShowAll(true)} className="press-effect" style={{
                  width: '100%',
                  padding: 12,
                  background: 'var(--gray-100)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: 14,
                  color: 'var(--gray-700)',
                  marginTop: 8,
                }}>
                  더보기
                </button>
              )}
            </>
          )}
        </section>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <section className="section animate-fade-in-up stagger-3">
            <SectionHeader title="급매 리더보드" />
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {leaderboard.map((item, i) => (
                  <LeaderboardRow key={item.complex_id} item={item} rank={i + 1} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Recent Price Changes */}
        {priceChanges.length > 0 && (
          <section className="section animate-fade-in-up stagger-4">
            <SectionHeader title="최근 가격 인하" />
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {priceChanges.map((item, i) => (
                  <PriceChangeRow key={`${item.article_id}-${i}`} item={item} />
                ))}
              </div>
            </div>
          </section>
        )}
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
