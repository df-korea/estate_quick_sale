import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplexSearch } from '../hooks/useComplexSearch';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useComplexSearch(query);
  const navigate = useNavigate();

  return (
    <div>
      <div className="header">
        <h1>단지 검색</h1>
      </div>

      <div className="page-content">
        {/* Search input */}
        <div style={{
          position: 'relative',
          marginBottom: '20px',
        }}>
          <input
            type="text"
            placeholder="아파트/오피스텔 단지명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-gray-400)',
              fontSize: '15px',
              outline: 'none',
              background: 'var(--color-gray-100)',
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--color-blue)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--color-gray-400)'; }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--color-gray-400)',
                border: 'none',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Results */}
        {isLoading && <LoadingSpinner message="검색 중..." />}

        {!isLoading && query.length >= 1 && results && results.length === 0 && (
          <div className="empty-state">
            <p>'{query}' 검색 결과가 없습니다</p>
          </div>
        )}

        {!query && (
          <div className="empty-state">
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>🏢</p>
            <p>단지명을 입력하여 검색하세요</p>
            <p style={{ fontSize: '12px', color: 'var(--color-gray-600)', marginTop: '4px' }}>
              예: 잠실, 헬리오, 래미안
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {results?.map((complex) => {
            const totalArticles = complex.deal_count + complex.lease_count + complex.rent_count;
            return (
              <div
                key={complex.id}
                onClick={() => navigate(`/complex/${complex.id}`)}
                style={{
                  padding: '14px 0',
                  borderBottom: '1px solid var(--color-gray-200)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>{complex.complex_name}</span>
                      {complex.property_type === 'OPST' && (
                        <span style={{
                          fontSize: '11px', color: 'var(--color-blue)', fontWeight: 600,
                          background: 'var(--color-blue-light)', padding: '1px 6px', borderRadius: '3px',
                        }}>
                          오피스텔
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-gray-600)', marginTop: '2px' }}>
                      {complex.total_households ? `${complex.total_households.toLocaleString()}세대` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-gray-700)' }}>
                      매물 {totalArticles}건
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                      매매 {complex.deal_count} · 전세 {complex.lease_count} · 월세 {complex.rent_count}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
