import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBargains, useBargainCount } from '../hooks/useBargains';
import { BargainCard } from '../components/BargainCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { apiFetch } from '../lib/api';

type TradeFilter = 'all' | 'A1' | 'B1' | 'B2';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

export function HomePage() {
  const [filter, setFilter] = useState<TradeFilter>('all');
  const { data: bargains, isLoading, error, refetch } = useBargains(100);
  const { data: totalCount } = useBargainCount();
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<{ lastCollectionAt: string | null }>('/stats'),
    staleTime: 60_000,
  });

  const lastUpdate = stats?.lastCollectionAt
    ? formatTimeAgo(new Date(stats.lastCollectionAt))
    : null;

  const filtered = bargains?.filter(
    (b) => filter === 'all' || b.trade_type === filter
  );

  const filterButtons: { key: TradeFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'A1', label: '매매' },
    { key: 'B1', label: '전세' },
    { key: 'B2', label: '월세' },
  ];

  return (
    <div>
      <div className="header">
        <h1>급매 레이더</h1>
        <button
          onClick={() => refetch()}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '14px',
            color: 'var(--color-blue)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          새로고침
        </button>
      </div>

      <div className="page-content">
        {/* Summary */}
        <div style={{
          padding: '12px 0',
          marginBottom: '12px',
          borderBottom: '1px solid var(--color-gray-200)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: 'var(--color-gray-800)' }}>
              총 <strong style={{ color: 'var(--color-red)', fontSize: '16px' }}>{totalCount ?? 0}건</strong> 급매 감지 중
            </span>
            {lastUpdate && (
              <span style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                업데이트: {lastUpdate}
              </span>
            )}
          </div>
        </div>

        {/* Trade type filter */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          overflowX: 'auto',
        }}>
          {filterButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: filter === key ? 'none' : '1px solid var(--color-gray-400)',
                background: filter === key ? 'var(--color-blue)' : 'var(--color-white)',
                color: filter === key ? 'var(--color-white)' : 'var(--color-gray-800)',
                fontSize: '13px',
                fontWeight: filter === key ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading && <LoadingSpinner />}

        {error && (
          <div className="empty-state">
            <p>데이터를 불러오지 못했습니다.</p>
            <p style={{ fontSize: '12px', color: 'var(--color-gray-600)' }}>{String(error)}</p>
          </div>
        )}

        {!isLoading && filtered && filtered.length === 0 && (
          <div className="empty-state">
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>📭</p>
            <p>감지된 급매가 없습니다</p>
          </div>
        )}

        {filtered?.map((article) => (
          <BargainCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
