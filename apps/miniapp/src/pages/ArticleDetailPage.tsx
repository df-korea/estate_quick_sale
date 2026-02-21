import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useArticle, usePriceHistory } from '../hooks/useArticle';
import { BargainBadge } from '../components/BargainBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

function tradeTypeName(type: string): string {
  switch (type) {
    case 'A1': return '매매';
    case 'B1': return '전세';
    case 'B2': return '월세';
    default: return type;
  }
}

function formatPriceDisplay(article: any): string {
  if (article.trade_type === 'A1') return article.price_text || '-';
  if (article.trade_type === 'B1') return article.warrant_price_text || article.price_text || '-';
  if (article.trade_type === 'B2') {
    return [article.warrant_price_text, article.rent_price_text].filter(Boolean).join(' / ');
  }
  return article.price_text || '-';
}

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const articleId = id ? parseInt(id) : null;
  const { data: article, isLoading } = useArticle(articleId);
  const { data: priceHistory } = usePriceHistory(articleId);

  if (isLoading) return <LoadingSpinner />;
  if (!article) return <div className="empty-state"><p>매물을 찾을 수 없습니다.</p></div>;

  const naverUrl = `https://m.land.naver.com/article/info/${article.atcl_no}`;
  const imageUrl = article.rep_image_url
    ? `https://landthumb-phinf.pstatic.net${article.rep_image_url}`
    : null;

  const infoItems = [
    { label: '거래유형', value: tradeTypeName(article.trade_type) },
    { label: '공급면적', value: article.area_supply ? `${article.area_supply}m²` : '-' },
    { label: '전용면적', value: article.area_exclusive ? `${article.area_exclusive}m²` : '-' },
    { label: '층', value: article.floor_info || '-' },
    { label: '방향', value: article.direction || '-' },
    { label: '동', value: article.building_name || '-' },
    { label: '확인일', value: article.confirm_date || '-' },
    { label: '동일주소', value: article.same_addr_cnt ? `${article.same_addr_cnt}건` : '-' },
  ];

  const sectionStyle: React.CSSProperties = {
    padding: '16px 0',
    borderBottom: '1px solid var(--color-gray-200)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-gray-600)',
    marginBottom: '4px',
  };

  return (
    <div>
      {/* Header */}
      <div className="header">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
        >
          ← 뒤로
        </button>
        <span style={{ fontSize: '15px', fontWeight: 600 }}>매물 상세</span>
        <div style={{ width: '48px' }} />
      </div>

      <div className="page-content">
        {/* Removed banner */}
        {article.article_status === 'removed' && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-gray-200)',
            color: 'var(--color-gray-700)',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '16px',
            textAlign: 'center',
          }}>
            이 매물은 더 이상 등록되어 있지 않습니다
          </div>
        )}

        {/* Image */}
        {imageUrl && (
          <div style={{
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            marginBottom: '16px',
            aspectRatio: '4/3',
            background: 'var(--color-gray-200)',
          }}>
            <img
              src={imageUrl}
              alt="매물 사진"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Complex name & badges */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700 }}>{article.complexes.complex_name}</span>
            {article.complexes.property_type === 'OPST' && (
              <span style={{ fontSize: '12px', color: 'var(--color-blue)', fontWeight: 600, background: 'var(--color-blue-light)', padding: '2px 8px', borderRadius: '4px' }}>
                오피스텔
              </span>
            )}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-gray-700)' }}>
            {[article.area_exclusive && `${article.area_exclusive}m²`, article.floor_info, article.direction].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Bargain section */}
        {article.is_bargain && (
          <div style={{
            ...sectionStyle,
            background: 'var(--color-red-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            margin: '12px 0',
            border: 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <BargainBadge keyword={article.bargain_keyword} size="md" />
              <span style={{ fontSize: '12px', color: 'var(--color-gray-600)' }}>
                감지: {article.bargain_keyword_source === 'tag' ? '태그' : '설명'}
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-red)' }}>
              {formatPriceDisplay(article)}
            </div>
          </div>
        )}

        {/* Price (non-bargain) */}
        {!article.is_bargain && (
          <div style={sectionStyle}>
            <div style={labelStyle}>호가</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>
              {formatPriceDisplay(article)}
            </div>
          </div>
        )}

        {/* Description */}
        {article.description && (
          <div style={sectionStyle}>
            <div style={labelStyle}>매물 설명</div>
            <div style={{ fontSize: '15px', color: 'var(--color-gray-900)', lineHeight: 1.6 }}>
              "{article.description}"
            </div>
          </div>
        )}

        {/* Tags */}
        {article.tag_list && article.tag_list.length > 0 && (
          <div style={sectionStyle}>
            <div style={labelStyle}>태그</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {article.tag_list.map((tag, i) => (
                <span key={i} style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'var(--color-gray-200)',
                  fontSize: '12px',
                  color: 'var(--color-gray-800)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Info grid */}
        <div style={sectionStyle}>
          <div style={labelStyle}>상세 정보</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginTop: '8px',
          }}>
            {infoItems.map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: '12px', color: 'var(--color-gray-600)' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Realtor */}
        {article.realtor_name && (
          <div style={sectionStyle}>
            <div style={labelStyle}>중개사</div>
            <div style={{ fontSize: '14px' }}>{article.realtor_name}</div>
            {article.cp_name && (
              <div style={{ fontSize: '12px', color: 'var(--color-gray-600)' }}>{article.cp_name}</div>
            )}
          </div>
        )}

        {/* Price history */}
        {priceHistory && priceHistory.length > 0 && (
          <div style={sectionStyle}>
            <div style={labelStyle}>호가 변동 이력</div>
            {priceHistory.map((ph) => (
              <div key={ph.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                <span>{ph.price_text || `${ph.price_amount}만원`}</span>
                <span style={{ color: 'var(--color-gray-600)' }}>{new Date(ph.recorded_at).toLocaleDateString('ko-KR')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Naver link */}
        <div style={{ padding: '20px 0' }}>
          <a
            href={naverUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-green)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            네이버 부동산에서 보기 →
          </a>
        </div>
      </div>
    </div>
  );
}
