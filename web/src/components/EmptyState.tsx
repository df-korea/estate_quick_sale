'use client';

interface Props {
  message?: string;
}

export default function EmptyState({ message = '데이터가 없습니다' }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      color: 'var(--gray-400)',
      fontSize: 'var(--text-sm)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>-</div>
      <p>{message}</p>
    </div>
  );
}
