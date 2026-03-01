'use client';

import type { ReactNode } from 'react';

interface Props {
  title: string;
  right?: ReactNode;
}

export default function SectionHeader({ title, right }: Props) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-12)' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>{title}</h3>
      {right}
    </div>
  );
}
