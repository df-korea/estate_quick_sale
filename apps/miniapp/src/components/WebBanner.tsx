import { useState } from 'react';

export default function WebBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed-top" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 300,
      background: 'linear-gradient(135deg, #3182f6, #1b64da)',
      color: 'white',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 13,
      fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <span style={{ flex: 1 }}>토스 앱에서 관심목록, 알림 등 더 많은 기능을 이용하세요</span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
          padding: '0 2px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
