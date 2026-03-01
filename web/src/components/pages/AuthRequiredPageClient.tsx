'use client';

import { useRouter } from 'next/navigation';
import { isTossWebView } from '@/lib/env';

export default function AuthRequiredPage() {
  const nav = useRouter();
  const isToss = isTossWebView();

  return (
    <div className="page">
      <div className="page-header glass">
        <button onClick={() => nav.back()} style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>로그인 필요</h1>
        <div style={{ width: 20 }} />
      </div>

      <div className="page-content" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 24px',
      }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" style={{ marginBottom: 20 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--gray-800)' }}>
          {isToss ? '로그인이 필요한 페이지입니다' : '토스 앱에서만 이용 가능합니다'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--gray-500)', lineHeight: 1.6 }}>
          {isToss
            ? '이 기능을 사용하려면 토스 로그인이 필요합니다.'
            : '관심목록, 알림 설정 등은 토스 앱의 급매 레이더에서 이용하실 수 있습니다.'}
        </p>

        <button
          onClick={() => nav.push('/')}
          className="press-effect"
          style={{
            marginTop: 24,
            padding: '12px 28px',
            background: 'var(--blue-500)',
            color: 'white',
            borderRadius: 'var(--radius-full)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
