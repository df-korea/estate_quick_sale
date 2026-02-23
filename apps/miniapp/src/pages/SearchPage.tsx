import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplexSearch } from '../hooks/useComplex';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { results, loading } = useComplexSearch(query);
  const nav = useNavigate();

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
            {results.map(c => (
              <div key={c.id}
                className="flex items-center justify-between"
                style={{ padding: 'var(--space-12) 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => nav(`/complex/${c.id}`)}>
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
            ))}
          </div>
        )}

        {!loading && query.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
            <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 8 }}>검색</div>
            <p className="text-sm">관심있는 단지명을 입력하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
