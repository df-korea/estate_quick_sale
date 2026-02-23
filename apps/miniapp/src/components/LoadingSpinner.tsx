import type { CSSProperties } from 'react';

const spinner: CSSProperties = {
  width: 28,
  height: 28,
  border: '3px solid var(--gray-200)',
  borderTopColor: 'var(--blue-500)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

export default function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={spinner} />
    </div>
  );
}
