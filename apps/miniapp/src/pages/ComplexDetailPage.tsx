import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useComplexArticles } from '../hooks/useComplexSearch';
import { BargainBadge } from '../components/BargainBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { apiFetch } from '../lib/api';

function useComplex(complexId: number | null) {
  return useQuery({
    queryKey: ['complex', complexId],
    queryFn: () => apiFetch<any>(`/complexes/${complexId}`),
    enabled: !!complexId,
  });
}

export function ComplexDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const complexId = id ? parseInt(id) : null;
  const { data: complex, isLoading: loadingComplex } = useComplex(complexId);
  const { data: articles, isLoading: loadingArticles } = useComplexArticles(complexId);

  if (loadingComplex) return <LoadingSpinner />;
  if (!complex) return <div className="empty-state"><p>단지를 찾을 수 없습니다.</p></div>;

  return (
    <div>
      <div className="header">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
        >
          ← 뒤로
        </button>
        <span style={{ fontSize: '15px', fontWeight: 600 }}>{complex.complex_name}</span>
        <div style={{ width: '48px' }} />
      </div>

      <div className="page-content">
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--color-gray-200)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700 }}>{complex.complex_name}</span>
            {complex.property_type === 'OPST' && (
              <span style={{
                fontSize: '12px', color: 'var(--color-blue)', fontWeight: 600,
                background: 'var(--color-blue-light)', padding: '2px 8px', borderRadius: '4px',
              }}>
                오피스텔
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-gray-600)', display: 'flex', gap: '12px' }}>
            {complex.total_households && <span>{complex.total_households.toLocaleString()}세대</span>}
            {complex.use_approval_date && <span>사용승인 {complex.use_approval_date}</span>}
          </div>
        </div>

        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--color-gray-200)' }}>
          <span style={{ fontSize: '14px', color: 'var(--color-gray-800)' }}>
            매매 매물 <strong>{articles?.length ?? 0}건</strong>
          </span>
        </div>

        {loadingArticles && <LoadingSpinner message="매물 로딩 중..." />}

        {!loadingArticles && articles && articles.length === 0 && (
          <div className="empty-state"><p>등록된 매매 매물이 없습니다</p></div>
        )}

        {articles?.map((article: any) => (
          <div
            key={article.id}
            onClick={() => navigate(`/article/${article.id}`)}
            style={{ padding: '14px 0', borderBottom: '1px solid var(--color-gray-200)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700 }}>{article.price_text || '-'}</span>
                  {article.is_bargain && <BargainBadge keyword={article.bargain_keyword} />}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-gray-600)' }}>
                  {[
                    article.area_exclusive && `${article.area_exclusive}m²`,
                    article.floor_info,
                    article.direction,
                  ].filter(Boolean).join(' · ')}
                </div>
                {article.description && (
                  <div style={{
                    fontSize: '12px', color: 'var(--color-gray-500)', marginTop: '4px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px',
                  }}>
                    {article.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
