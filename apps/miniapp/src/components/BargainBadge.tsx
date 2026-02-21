import React from 'react';

interface BargainBadgeProps {
  keyword?: string | null;
  size?: 'sm' | 'md';
}

export function BargainBadge({ keyword, size = 'sm' }: BargainBadgeProps) {
  const styles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: size === 'sm' ? '2px 8px' : '4px 12px',
    borderRadius: '4px',
    backgroundColor: 'var(--color-red-light)',
    color: 'var(--color-red)',
    fontSize: size === 'sm' ? '11px' : '13px',
    fontWeight: 700,
    lineHeight: 1.4,
  };

  return (
    <span style={styles}>
      {keyword || '급매'}
    </span>
  );
}
