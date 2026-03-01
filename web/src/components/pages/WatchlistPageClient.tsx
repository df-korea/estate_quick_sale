'use client';

import { useRouter } from 'next/navigation';
import { useWatchlist } from '@/hooks/useWatchlist';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { formatWon } from '@/utils/format';

export default function WatchlistPage() {
  const { data, loading, ids, remove } = useWatchlist();
  const nav = useRouter();

  return (
    <div className="page">
      <div className="page-header">
        <h1>관심 단지</h1>
        {ids.length > 0 && <span className="text-sm text-gray">{ids.length}개</span>}
      </div>
      <div className="page-content">
        {loading && <LoadingSpinner />}

        {!loading && data.length === 0 && (
          <EmptyState message="관심 단지를 추가해주세요" />
        )}

        {!loading && data.length > 0 && (
          <div>
            {data.map(c => (
              <div key={c.complex_id} className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <div className="card-body" style={{ padding: 'var(--space-12) var(--space-16)' }}>
                  <div className="flex items-center justify-between">
                    <div style={{ cursor: 'pointer', minWidth: 0, flex: 1 }}
                      onClick={() => nav.push(`/complex/${c.complex_id}`)}>
                      <div className="truncate" style={{ fontWeight: 600 }}>{c.complex_name}</div>
                      <div className="flex items-center gap-8 text-sm text-gray" style={{ marginTop: 'var(--space-4)' }}>
                        <span>매물 {c.total_articles}건</span>
                        {c.bargain_count > 0 && <span className="text-red">급매 {c.bargain_count}</span>}
                        {c.new_today > 0 && <span className="text-blue">오늘 +{c.new_today}</span>}
                      </div>
                      {c.avg_price && (
                        <div className="text-sm" style={{ marginTop: 'var(--space-4)' }}>
                          평균 {formatWon(c.avg_price)}
                          {c.min_price && ` · 최저 ${formatWon(c.min_price)}`}
                        </div>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); remove(c.complex_id); }}
                      style={{ color: 'var(--gray-400)', padding: 8, flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
