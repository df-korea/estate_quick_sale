'use client';

import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { DrillLevel, BargainMode, Briefing, DongRankingItem, LeaderboardItem, TopPriceDropItem } from '@/types';
import { useBriefing } from '@/hooks/useBriefing';
import { useWeeklyFeaturedBargains } from '@/hooks/useBargains';
import { useLeaderboard, useTopPriceDrops } from '@/hooks/useAnalysis';
import { useDongRankings, useDongArticles } from '@/hooks/useDongRankings';
import { useSidoHeatmap } from '@/hooks/useMapData';
import { formatWon, formatAreaFull, formatArea, abbreviateCity, relativeDate } from '@/utils/format';
import { useDragScroll } from '@/hooks/useDragScroll';
const MapExplorer = lazy(() => import('@/components/map/MapExplorer'));
import SectionHeader from '@/components/SectionHeader';
import LeaderboardRow from '@/components/LeaderboardRow';
import TopPriceDropRow from '@/components/TopPriceDropRow';
import LoadingSpinner from '@/components/LoadingSpinner';
import ScoreBreakdownPopover from '@/components/ScoreBreakdownPopover';
import BargainBadge from '@/components/BargainBadge';
import InlineBannerAd from '@/components/InlineBannerAd';

interface HomePageProps {
  initialBriefing?: Briefing | null;
  initialLeaderboard?: LeaderboardItem[];
  initialTopPriceDrops?: TopPriceDropItem[];
  initialDongRankings?: DongRankingItem[];
}

export default function HomePage({ initialBriefing, initialLeaderboard, initialTopPriceDrops, initialDongRankings }: HomePageProps = {}) {
  const router = useRouter();
  const [bargainMode, setBargainMode] = useState<BargainMode>('all');
  const [leaderboardMode, setLeaderboardMode] = useState<string>('all');

  const { data: briefing } = useBriefing(initialBriefing);
  const { data: leaderboard } = useLeaderboard(10, leaderboardMode, initialLeaderboard);
  const [dropSort, setDropSort] = useState<string>('amount');
  const { data: topPriceDrops } = useTopPriceDrops(10, dropSort, initialTopPriceDrops);
  const [dongRankingMode, setDongRankingMode] = useState<BargainMode>('keyword');
  const { data: dongRankings, loading: dongLoading } = useDongRankings(10, dongRankingMode, initialDongRankings);

  // Sido list for weekly featured
  const { data: sidoHeatmap } = useSidoHeatmap();
  const sidoList = useMemo(() =>
    [...sidoHeatmap.map(s => s.sido_name).filter(Boolean)].sort((a, b) => {
      const aa = abbreviateCity(a), bb = abbreviateCity(b);
      if (aa === '서울') return -1;
      if (bb === '서울') return 1;
      if (aa === '경기') return -1;
      if (bb === '경기') return 1;
      return aa.localeCompare(bb, 'ko');
    }),
    [sidoHeatmap]
  );

  // Weekly featured bargains
  const [weeklySido, setWeeklySido] = useState<string | null>(null);
  const activeSido = weeklySido || sidoList[0] || null;
  const { data: weeklyBargains, loading: weeklyLoading } = useWeeklyFeaturedBargains(activeSido);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { ref: dragCarouselRef } = useDragScroll<HTMLDivElement>();
  const { ref: dragSidoRef } = useDragScroll<HTMLDivElement>();
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const setCarouselRef = useCallback((node: HTMLDivElement | null) => {
    carouselRef.current = node;
    dragCarouselRef.current = node;
  }, [dragCarouselRef]);

  useEffect(() => {
    carouselRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    setActiveCardIndex(0);
  }, [activeSido]);

  // Track scroll position to update active dot
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / 292);
      setActiveCardIndex(idx);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [weeklyBargains]);

  // Prefetch article pages for carousel items
  useEffect(() => {
    weeklyBargains.forEach(item => router.prefetch(`/article/${item.id}`));
  }, [weeklyBargains, router]);

  const [mapAdKey, setMapAdKey] = useState(0);

  const handleDrillChange = useCallback((level: DrillLevel, sido: string | null, sigungu: string | null) => {
    setMapAdKey(k => k + 1);

    // Update URL so GA4 tracks each drill level/region separately
    const params = new URLSearchParams();
    if (sido) params.set('sido', sido);
    if (sigungu) params.set('sigungu', sigungu);
    const qs = params.toString();
    const newPath = qs ? `/?${qs}` : '/';
    window.history.replaceState(null, '', newPath);

    // Send GA virtual pageview
    const g = (window as any).gtag;
    if (g) {
      g('event', 'page_view', {
        page_path: newPath,
        page_title: sigungu ? `${sido} ${sigungu}` : sido || '전국',
      });
    }
  }, []);

  const handleBargainModeChange = useCallback((mode: BargainMode) => {
    setBargainMode(mode);
    const g = (window as any).gtag;
    if (g) g('event', 'filter_change', { filter_type: 'bargain_mode', filter_value: mode });
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

        {/* Ad below map — remounts on every drill change */}
        <InlineBannerAd key={`map-${mapAdKey}`} />

        {/* Weekly Featured Bargains */}
        <section className="section animate-fade-in-up stagger-2">
          <div className="flex items-center gap-8" style={{ margin: '0 0 8px' }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>오늘 추천 급매</h3>
            <span className="text-xs text-gray">최근 24시간 기준</span>
          </div>

          {/* Sido tabs */}
          {sidoList.length > 0 && (
            <div ref={dragSidoRef} className="flex gap-8 scroll-x" style={{ marginBottom: 12 }}>
              {sidoList.map(s => (
                <button
                  key={s}
                  className={`chip ${(activeSido === s) ? 'chip--active' : ''}`}
                  onClick={() => setWeeklySido(s)}
                  style={{ fontSize: 'var(--text-sm)', flexShrink: 0 }}
                >{abbreviateCity(s)}</button>
              ))}
            </div>
          )}

          {/* Carousel */}
          {weeklyLoading ? <LoadingSpinner /> : weeklyBargains.length > 0 ? (
            <>
            <div
              ref={setCarouselRef}
              style={{
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                gap: 12,
                paddingBottom: 4,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {weeklyBargains.map((item, i) => (
                <div
                  key={item.id}
                  className="press-effect"
                  onClick={() => router.push(`/article/${item.id}`)}
                  style={{
                    minWidth: 280,
                    maxWidth: 280,
                    scrollSnapAlign: 'start',
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-card)',
                    padding: 'var(--space-12) var(--space-16)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {/* Rank + Badges */}
                  <div className="flex items-center gap-6" style={{ marginBottom: 6 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: i < 3 ? 'var(--red-500)' : 'var(--gray-300)',
                      color: 'white', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{i + 1}</span>
                    <BargainBadge keyword={item.bargain_keyword} bargainType={item.bargain_type} />
                  </div>

                  {/* Complex name + Division */}
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }} className="truncate">{item.complex_name}</div>
                  <div className="text-xs text-gray" style={{ marginBottom: 6 }}>
                    {item.division}{item.total_households ? ` · ${item.total_households.toLocaleString()}세대` : ''}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                    {/* Price + Score */}
                    <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
                      <div>
                        {item.last_tx_price && (
                          <span style={{ fontSize: 12, color: 'var(--gray-500)', textDecoration: 'line-through' }}>
                            {formatWon(item.last_tx_price)}
                          </span>
                        )}
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--blue-600)', marginLeft: item.last_tx_price ? 4 : 0 }}>
                          {item.formatted_price || formatWon(item.deal_price)}
                        </span>
                      </div>
                      <ScoreBreakdownPopover articleId={item.id} bargainScore={item.bargain_score}>
                        <span style={{
                          background: 'var(--orange-50)',
                          color: 'var(--orange-500)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 600,
                          fontSize: 10,
                        }}>점수 {item.bargain_score}</span>
                      </ScoreBreakdownPopover>
                    </div>
                    {/* Area + space_name */}
                    <div className="text-xs text-gray">
                      {formatAreaFull(item.exclusive_space, item.supply_space)}
                      {item.space_name && ` ${item.space_name}`}
                    </div>
                    {/* Floor + Dong + Direction + Date */}
                    <div className="text-xs text-gray" style={{ marginTop: 2 }}>
                      {item.target_floor && <span>{item.target_floor}/{item.total_floor}층</span>}
                      {item.dong_name && <span> · {item.dong_name}</span>}
                      {item.direction && <span> · {item.direction}</span>}
                      {item.first_seen_at && <span> · {relativeDate(item.first_seen_at)}</span>}
                    </div>
                    {/* Description */}
                    {item.description && (
                      <p className="text-xs text-gray truncate" style={{ marginTop: 2 }}>{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Dot indicator with arrows */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, marginTop: 10,
            }}>
              <button
                aria-label="이전"
                onClick={() => {
                  const next = Math.max(0, activeCardIndex - 1);
                  carouselRef.current?.scrollTo({ left: next * 292, behavior: 'smooth' });
                }}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)',
                  background: 'var(--white)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: 'var(--gray-500)',
                }}
              >‹</button>
              {weeklyBargains.map((_, i) => (
                <span
                  key={i}
                  onClick={() => carouselRef.current?.scrollTo({ left: i * 292, behavior: 'smooth' })}
                  style={{
                    width: activeCardIndex === i ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: activeCardIndex === i ? 'var(--blue-500)' : 'var(--gray-200)',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                />
              ))}
              <button
                aria-label="다음"
                onClick={() => {
                  const next = Math.min(weeklyBargains.length - 1, activeCardIndex + 1);
                  carouselRef.current?.scrollTo({ left: next * 292, behavior: 'smooth' });
                }}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)',
                  background: 'var(--white)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: 'var(--gray-500)',
                }}
              >›</button>
            </div>
            </>
          ) : (
            <div className="text-sm text-gray" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
              해당 지역에 오늘 급매가 없습니다
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
            <div className="flex gap-6" style={{ marginBottom: 'var(--space-8)' }}>
              {[
                { value: 'amount', label: '가격' },
                { value: 'rate', label: '인하율' },
              ].map(m => (
                <button key={m.value}
                  className={`chip ${dropSort === m.value ? 'chip--active' : ''}`}
                  onClick={() => setDropSort(m.value)}
                  style={{ fontSize: 'var(--text-sm)' }}
                >{m.label}</button>
              ))}
            </div>
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {topPriceDrops.map((item, i) => (
                  <TopPriceDropRow key={item.article_id} item={item} rank={i + 1} />
                ))}
              </div>
            </div>
          </section>
        )}

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
  const nav = useRouter();
  const { data: articles, loading } = useDongArticles(division, sector, 5);

  if (loading) return <div style={{ padding: 'var(--space-8) var(--space-16)' }}><LoadingSpinner /></div>;
  if (articles.length === 0) return null;

  return (
    <div style={{ padding: '0 var(--space-16) var(--space-12)' }}>
      {articles.map(a => (
        <div
          key={a.id}
          onClick={() => nav.push(`/article/${a.id}`)}
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
