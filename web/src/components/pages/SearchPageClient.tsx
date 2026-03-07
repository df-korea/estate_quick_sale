'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useComplexSearch, usePopularComplexes } from '@/hooks/useComplex';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useRegionalTopBargains, useRegionalTopDivisions } from '@/hooks/useBargains';
import { useSidoHeatmap } from '@/hooks/useMapData';
import type { PropertyType, BargainMode } from '@/types';
import { formatWon, abbreviateCity } from '@/utils/format';
import { HOUSEHOLD_OPTIONS, AREA_OPTIONS, BUILD_YEAR_OPTIONS } from '@/utils/constants';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import RegionalBargainRow from '@/components/RegionalBargainRow';
import DualRangeSlider from '@/components/DualRangeSlider';
import InlineBannerAd from '@/components/InlineBannerAd';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const { results, loading } = useComplexSearch(query);
  const { data: popularComplexes, loading: popularLoading } = usePopularComplexes();
  const { data: watchlistData, loading: watchlistLoading } = useWatchlist();
  const nav = useRouter();

  // Regional TOP10 state
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
  const [selectedSido, setSelectedSido] = useState<string | null>(null);
  const [selectedSigungu, setSelectedSigungu] = useState<string | null>(null);
  const [regionalPropertyType, setRegionalPropertyType] = useState<PropertyType>('APT');
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [bargainSort, setBargainSort] = useState('score_desc');
  const [bargainType, setBargainType] = useState<BargainMode>('all');
  const [minHouseholds, setMinHouseholds] = useState<number | null>(null);
  const [minArea, setMinArea] = useState<number | null>(null);
  const [maxArea, setMaxArea] = useState<number | null>(null);
  const [maxBuildYear, setMaxBuildYear] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const activeSido = selectedSido || sidoList[0] || null;
  const { data: divisionsRaw } = useRegionalTopDivisions(activeSido, regionalPropertyType);
  const divisions = [...divisionsRaw].sort((a, b) => a.division.localeCompare(b.division, 'ko'));
  const { data: regionalBargains, loading: regionalLoading } = useRegionalTopBargains(
    activeSido, selectedSigungu, 10, regionalPropertyType, priceMin, priceMax, bargainSort, bargainType,
    minHouseholds, minArea, maxArea, maxBuildYear
  );

  // Count active filters (excluding defaults)
  const activeFilterCount = [
    priceMin, priceMax, minHouseholds, minArea, maxArea, maxBuildYear,
    bargainType !== 'all' ? bargainType : null,
    regionalPropertyType !== 'APT' ? regionalPropertyType : null,
  ].filter(Boolean).length;

  function resetFilters() {
    setPriceMin(null);
    setPriceMax(null);
    setMinHouseholds(null);
    setMinArea(null);
    setMaxArea(null);
    setMaxBuildYear(null);
    setBargainType('all');
    setRegionalPropertyType('APT');
  }

  const selectStyle = {
    background: 'var(--gray-100)',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    padding: '6px 12px',
    fontSize: 'var(--text-sm)',
    color: 'var(--gray-700)',
    cursor: 'pointer',
    flexShrink: 0 as const,
  };

  const filterSelectStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--gray-200)',
    background: 'var(--gray-50)',
    fontSize: 14,
    color: 'var(--gray-800)',
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>검색</h1>
      </div>
      <div className="page-content">
        {/* Search Input */}
        <div style={{
          position: 'relative',
          marginBottom: 'var(--space-16)',
        }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => setInputFocused(false), 150)}
            placeholder="단지명을 검색하세요"
            style={{
              width: '100%',
              padding: 'var(--space-12) var(--space-16)',
              paddingLeft: 40,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--white)',
              fontSize: 'var(--text-md)',
              outline: 'none',
            }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {query && (
            <button onClick={() => setQuery('')}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Focused overlay: 입력 포커스 + 빈 쿼리 → 깨끗한 화면 + 광고 */}
        {inputFocused && query.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-24) 0',
            minHeight: 200,
          }}>
            <div style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 'var(--space-16)' }}>
              관심있는 단지명을 입력하세요
            </div>
            <InlineBannerAd />
          </div>
        )}

        {/* Results */}
        {loading && <LoadingSpinner />}

        {!loading && query.length >= 1 && results.length === 0 && (
          <EmptyState message="검색 결과가 없습니다" />
        )}

        {!loading && results.length > 0 && (
          <div>
            <div className="text-sm text-gray" style={{ marginBottom: 'var(--space-8)' }}>
              {results.length}개 단지
            </div>
            {results.map((c, i) => (
              <div key={c.id}>
                <div
                  className="flex items-center justify-between"
                  style={{ padding: 'var(--space-12) 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => nav.push(`/complex/${c.id}`)}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.complex_name}</div>
                    <div className="text-sm text-gray">
                      {c.property_type && `${c.property_type} · `}
                      {c.total_households && `${c.total_households}세대`}
                    </div>
                  </div>
                  <div className="text-sm text-gray" style={{ flexShrink: 0, textAlign: 'right' }}>
                    {c.deal_count > 0 && <span>매매 {c.deal_count}</span>}
                    {c.lease_count > 0 && <span style={{ marginLeft: 6 }}>전세 {c.lease_count}</span>}
                  </div>
                </div>
                {(i === 2 || (results.length <= 2 && i === results.length - 1)) && <InlineBannerAd />}
              </div>
            ))}
          </div>
        )}

        {!loading && query.length === 0 && !inputFocused && (
          <div>
            {/* 나의 관심 단지 */}
            {!watchlistLoading && watchlistData.length > 0 && (
              <div style={{ marginBottom: 'var(--space-24)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-12)' }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>
                    나의 관심 단지
                  </div>
                  <button onClick={() => nav.push('/watchlist')} className="text-sm" style={{ color: 'var(--blue-500)' }}>
                    전체보기
                  </button>
                </div>
                {watchlistData.slice(0, 5).map(w => (
                  <div key={w.id}
                    className="flex items-center justify-between"
                    style={{ padding: 'var(--space-10) 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => nav.push(`/complex/${w.complex_id}`)}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="flex items-center gap-6">
                        <span style={{ fontWeight: 600 }}>{w.complex_name}</span>
                        {w.pyeong_type && <span className="text-xs text-gray">{w.pyeong_type}</span>}
                      </div>
                      <div className="text-sm text-gray" style={{ marginTop: 2 }}>
                        매물 {w.total_articles} · 급매 {w.bargain_count}
                        {w.min_price ? ` · 최저 ${formatWon(w.min_price)}` : ''}
                      </div>
                    </div>
                    {w.new_today > 0 && (
                      <span className="text-xs text-blue" style={{ flexShrink: 0, fontWeight: 600 }}>
                        +{w.new_today}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 가격급매 TOP10 */}
            <div style={{ marginBottom: 'var(--space-24)' }}>
              {/* Title */}
              <h3 style={{ fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>가격급매 TOP10</h3>
              {/* Dropdowns row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {sidoList.length > 0 && (
                  <select
                    value={activeSido || ''}
                    onChange={e => { setSelectedSido(e.target.value); setSelectedSigungu(null); }}
                    style={selectStyle}
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
                    style={selectStyle}
                  >
                    <option value="">전체</option>
                    {divisions.map(d => (
                      <option key={d.division} value={d.division}>{d.division}</option>
                    ))}
                  </select>
                )}
                <select
                  value={bargainSort}
                  onChange={e => setBargainSort(e.target.value)}
                  style={selectStyle}
                >
                  <option value="score_desc">점수순</option>
                  <option value="newest">최신순</option>
                  <option value="price_asc">낮은가격순</option>
                  <option value="price_desc">높은가격순</option>
                </select>
                <button
                  onClick={() => setFilterOpen(v => !v)}
                  style={{
                    ...selectStyle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: activeFilterCount > 0 ? 'var(--blue-50)' : 'var(--gray-100)',
                    color: activeFilterCount > 0 ? 'var(--blue-600)' : 'var(--gray-700)',
                  }}
                >
                  필터{activeFilterCount > 0 && (
                    <span style={{
                      background: 'var(--blue-500)',
                      color: 'white',
                      borderRadius: '50%',
                      width: 16,
                      height: 16,
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>{activeFilterCount}</span>
                  )}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>

              {/* Collapsible filter section */}
              {filterOpen && (
                <div style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 16px',
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}>
                  {/* Row: 급매유형 + 물건유형 */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>급매유형</label>
                      <div className="flex gap-6">
                        {[
                          { value: 'all' as BargainMode, label: '전체' },
                          { value: 'keyword' as BargainMode, label: '키워드' },
                          { value: 'price' as BargainMode, label: '가격' },
                        ].map(m => (
                          <button
                            key={m.value}
                            className={`chip ${bargainType === m.value ? 'chip--active' : ''}`}
                            onClick={() => setBargainType(m.value)}
                            style={{ fontSize: 'var(--text-sm)' }}
                          >{m.label}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>물건유형</label>
                      <select
                        value={regionalPropertyType}
                        onChange={e => setRegionalPropertyType(e.target.value as PropertyType)}
                        style={filterSelectStyle}
                      >
                        <option value="all">전체</option>
                        <option value="APT">아파트</option>
                        <option value="OPST">오피스텔</option>
                      </select>
                    </div>
                  </div>

                  {/* Price slider */}
                  <div>
                    <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>가격</label>
                    <DualRangeSlider
                      min={priceMin}
                      max={priceMax}
                      onMinChange={setPriceMin}
                      onMaxChange={setPriceMax}
                    />
                  </div>

                  {/* Row: 세대수 + 입주년차 */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>세대수</label>
                      <select
                        value={minHouseholds ?? ''}
                        onChange={e => setMinHouseholds(e.target.value ? Number(e.target.value) : null)}
                        style={filterSelectStyle}
                      >
                        <option value="">전체</option>
                        {HOUSEHOLD_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>입주년차</label>
                      <select
                        value={maxBuildYear ?? ''}
                        onChange={e => setMaxBuildYear(e.target.value ? Number(e.target.value) : null)}
                        style={filterSelectStyle}
                      >
                        <option value="">전체</option>
                        {BUILD_YEAR_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Area range */}
                  <div>
                    <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>전용면적</label>
                    <div className="flex gap-8 items-center">
                      <select
                        value={minArea ?? ''}
                        onChange={e => setMinArea(e.target.value ? Number(e.target.value) : null)}
                        style={{ ...filterSelectStyle, flex: 1 }}
                      >
                        <option value="">최소</option>
                        {AREA_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <span className="text-xs text-gray">~</span>
                      <select
                        value={maxArea ?? ''}
                        onChange={e => setMaxArea(e.target.value ? Number(e.target.value) : null)}
                        style={{ ...filterSelectStyle, flex: 1 }}
                      >
                        <option value="">최대</option>
                        {AREA_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Reset button */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="press-effect"
                      style={{
                        padding: '8px 0',
                        fontSize: 13,
                        color: 'var(--red-500)',
                        fontWeight: 600,
                        textAlign: 'center',
                      }}
                    >필터 초기화</button>
                  )}
                </div>
              )}

              {/* Results */}
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
            </div>

            {/* 인기 단지 */}
            {popularLoading ? <LoadingSpinner /> : popularComplexes.length > 0 ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', marginBottom: 'var(--space-12)' }}>
                  실시간 인기 단지 <span className="text-sm text-gray" style={{ fontWeight: 400 }}>(최근 7일)</span>
                </div>
                {popularComplexes.map((c, i) => (
                  <div key={c.id}
                    className="flex items-center justify-between"
                    style={{ padding: 'var(--space-12) 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => nav.push(`/complex/${c.id}`)}>
                    <div className="flex items-center gap-12">
                      <span style={{ width: 24, fontWeight: 700, color: i < 3 ? 'var(--blue-500)' : 'var(--gray-400)', fontSize: 'var(--text-md)' }}>
                        {i + 1}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.complex_name}</div>
                        <div className="text-sm text-gray">
                          {c.property_type && `${c.property_type} · `}
                          {c.total_households && `${c.total_households}세대`}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray" style={{ flexShrink: 0, textAlign: 'right' }}>
                      {c.deal_count > 0 && <span>매매 {c.deal_count}</span>}
                      {c.lease_count > 0 && <span style={{ marginLeft: 6 }}>전세 {c.lease_count}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
                <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 8 }}>검색</div>
                <p className="text-sm">관심있는 단지명을 입력하세요</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
