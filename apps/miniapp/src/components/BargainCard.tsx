import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BargainBadge } from './BargainBadge';
import type { BargainArticle } from '../hooks/useBargains';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}분전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간전`;
  const days = Math.floor(hours / 24);
  return `${days}일전`;
}

function tradeTypeName(type: string): string {
  switch (type) {
    case 'A1': return '매매';
    case 'B1': return '전세';
    case 'B2': return '월세';
    default: return type;
  }
}

function formatPrice(article: BargainArticle): string {
  if (article.trade_type === 'A1' && article.price_text) return article.price_text;
  if (article.trade_type === 'B1' && article.warrant_price_text) return article.warrant_price_text;
  if (article.trade_type === 'B2') {
    return [article.warrant_price_text, article.rent_price_text].filter(Boolean).join('/');
  }
  return article.price_text || '-';
}

interface BargainCardProps {
  article: BargainArticle;
}

export function BargainCard({ article }: BargainCardProps) {
  const navigate = useNavigate();

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-white)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--color-gray-300)',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s',
  };

  const topRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  };

  const complexName: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--color-black)',
  };

  const infoRow: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-gray-700)',
    marginBottom: '4px',
  };

  const priceStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--color-black)',
    marginBottom: '6px',
  };

  const descStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-gray-800)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const typeLabel = article.property_type === 'OPST' ? '오피스텔' : '';
  const areaStr = article.area_exclusive ? `${article.area_exclusive}m²` : '';
  const floorStr = article.floor_info || '';
  const dirStr = article.direction || '';
  const detailParts = [areaStr, floorStr, dirStr].filter(Boolean).join(' · ');

  return (
    <div
      style={cardStyle}
      onClick={() => navigate(`/article/${article.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
    >
      <div style={topRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BargainBadge keyword={article.bargain_keyword} />
          <span style={{ fontSize: '12px', color: 'var(--color-gray-600)' }}>
            {tradeTypeName(article.trade_type)}
          </span>
          {typeLabel && (
            <span style={{ fontSize: '11px', color: 'var(--color-blue)', fontWeight: 600 }}>
              {typeLabel}
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--color-gray-600)' }}>
          {timeAgo(article.first_seen_at)}
        </span>
      </div>

      <div style={complexName}>{article.complex_name}</div>
      <div style={infoRow}>{detailParts}</div>
      <div style={priceStyle}>{formatPrice(article)}</div>
      {article.description && (
        <div style={descStyle}>"{article.description}"</div>
      )}
    </div>
  );
}
