interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = '불러오는 중...' }: LoadingSpinnerProps) {
  return (
    <div className="loading-container">
      <div className="spinner" />
      <span style={{ fontSize: '14px', color: 'var(--color-gray-700)' }}>{message}</span>
    </div>
  );
}
