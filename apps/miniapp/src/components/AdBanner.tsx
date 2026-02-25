import { useState } from 'react';

const AD_GROUP_ID = 'ait.v2.live.7ea0dc7ac9314526';

export default function AdBanner() {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div style={{
      position: 'sticky',
      bottom: 'calc(var(--tab-height) + var(--safe-bottom))',
      zIndex: 199,
      height: 50,
      background: 'var(--gray-100)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      color: 'var(--gray-500)',
    }}>
      <div
        data-ad-group-id={AD_GROUP_ID}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>AD</span>
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--gray-500)' }}>광고 영역</span>
      </div>
      <button
        onClick={() => setHidden(true)}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'var(--gray-200)',
          color: 'var(--gray-500)',
          fontSize: 12,
          lineHeight: 1,
        }}
        aria-label="배너 닫기"
      >
        ×
      </button>
    </div>
  );
}
