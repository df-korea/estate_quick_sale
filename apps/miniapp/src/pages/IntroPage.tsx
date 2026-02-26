import { useState } from 'react';

interface Props {
  onLogin: () => Promise<void>;
  onGuestLogin: () => void;
  loading: boolean;
}

export default function IntroPage({ onLogin, onGuestLogin, loading }: Props) {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await onLogin();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      background: 'linear-gradient(180deg, var(--blue-50) 0%, var(--white) 60%)',
    }}>
      {/* Logo area */}
      <div style={{
        width: 72,
        height: 72,
        borderRadius: 20,
        background: 'var(--blue-500)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(49, 130, 246, 0.3)',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
          <path d="M8 11h6M11 8v6" />
        </svg>
      </div>

      <h1 style={{
        fontSize: 26,
        fontWeight: 800,
        color: 'var(--gray-900)',
        marginBottom: 12,
        textAlign: 'center',
      }}>
        급매 레이더
      </h1>

      <p style={{
        fontSize: 15,
        color: 'var(--gray-600)',
        textAlign: 'center',
        lineHeight: 1.6,
        marginBottom: 40,
        maxWidth: 280,
      }}>
        전국 아파트 급매물을 실시간으로 모니터링하고,
        나만의 관심 단지 알림을 받아보세요.
      </p>

      {/* Features */}
      <div style={{
        width: '100%',
        maxWidth: 320,
        marginBottom: 48,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <FeatureItem
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          title="급매 분석"
          desc="키워드·가격 기반 급매 자동 감지"
        />
        <FeatureItem
          icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          title="실시간 알림"
          desc="관심 단지 새 매물·가격 변동 즉시 알림"
        />
        <FeatureItem
          icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          title="지역별 분석"
          desc="전국 시도·구·동 단위 급매 히트맵"
        />
      </div>

      {/* Login button */}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="press-effect"
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '16px 0',
          background: 'var(--blue-500)',
          color: 'white',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 700,
          border: 'none',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {loading ? '로그인 중...' : '토스로 시작하기'}
      </button>

      <button
        onClick={onGuestLogin}
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '14px 0',
          background: 'transparent',
          color: 'var(--gray-600)',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          border: '1px solid var(--gray-200)',
          cursor: 'pointer',
          marginTop: 10,
        }}
      >
        로그인 없이 둘러보기
      </button>

      {error && (
        <p style={{
          fontSize: 12,
          color: 'var(--red-500)',
          marginTop: 12,
          textAlign: 'center',
          maxWidth: 320,
          wordBreak: 'break-all',
        }}>
          {error}
        </p>
      )}

      <p style={{
        fontSize: 11,
        color: 'var(--gray-400)',
        marginTop: 16,
        textAlign: 'center',
      }}>
        로그인 시 <a href="/terms" style={{ color: 'var(--gray-500)', textDecoration: 'underline' }}>이용약관</a> 및 <a href="/privacy" style={{ color: 'var(--gray-500)', textDecoration: 'underline' }}>개인정보처리방침</a>에 동의합니다.
      </p>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: 'var(--blue-50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="var(--blue-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-800)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}
