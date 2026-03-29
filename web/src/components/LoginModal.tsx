'use client';

import { useState, useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({ open, onClose, onLoginSuccess }: Props) {
  const [mode, setMode] = useState<'choose' | 'anonymous'>('choose');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMode('choose');
      setNickname('');
      setError('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleKakaoLogin = () => {
    // Save current page for return
    localStorage.setItem('login_return_to', window.location.pathname);
    const redirectUri = window.location.origin + '/auth/kakao/callback';
    const clientId = process.env.NEXT_PUBLIC_KAKAO_LOGIN_KEY || '';
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  };

  const handleAnonymousLogin = async () => {
    if (nickname.trim().length < 2) {
      setError('닉네임은 2자 이상 입력하세요');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '로그인 실패');

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify({
        userId: data.userId,
        userKey: data.userKey,
        nickname: data.nickname,
        authProvider: data.authProvider,
      }));

      onLoginSuccess?.();
      onClose();
      window.location.reload();
    } catch (err: any) {
      setError(err.message || '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'fadeIn 0.15s ease',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#fff',
        borderRadius: '16px 16px 0 0',
        padding: '24px 20px calc(20px + var(--safe-bottom))',
        animation: 'slideUp 0.2s ease',
      }}>
        {mode === 'choose' ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--gray-900)' }}>
              로그인
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
              글쓰기, 댓글, 좋아요를 이용하려면 로그인이 필요합니다
            </div>

            {/* Kakao Login */}
            <button
              onClick={handleKakaoLogin}
              className="press-effect"
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8,
                background: '#FEE500', color: '#191919',
                fontSize: 15, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#191919" d="M12 3C6.48 3 2 6.58 2 10.94c0 2.73 1.74 5.12 4.39 6.56-.14.5-.89 3.22-.93 3.44 0 0-.02.16.08.22.1.06.22.01.22.01.29-.04 3.37-2.2 3.9-2.57.75.1 1.53.16 2.34.16 5.52 0 10-3.58 10-7.82S17.52 3 12 3"/>
              </svg>
              카카오로 시작하기
            </button>

            {/* Anonymous */}
            <button
              onClick={() => setMode('anonymous')}
              className="press-effect"
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8,
                background: 'var(--gray-100)', color: 'var(--gray-700)',
                fontSize: 15, fontWeight: 600,
                marginBottom: 16,
              }}
            >
              익명으로 시작하기
            </button>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-400)' }}>
              토스 앱 사용자는 토스 미니앱에서 로그인하세요
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--gray-900)' }}>
              익명 로그인
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
              사용할 닉네임을 입력하세요 (2~10자)
            </div>

            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="닉네임 입력"
              maxLength={10}
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 8,
                border: '1px solid var(--gray-200)', fontSize: 15,
                marginBottom: 10,
                outline: 'none',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--blue-500)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--gray-200)'; }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAnonymousLogin(); }}
            />

            {error && (
              <div style={{ fontSize: 12, color: 'var(--red-500)', marginBottom: 8 }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setMode('choose')}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 8,
                  background: 'var(--gray-100)', color: 'var(--gray-600)',
                  fontSize: 14, fontWeight: 500,
                }}
              >
                뒤로
              </button>
              <button
                onClick={handleAnonymousLogin}
                disabled={loading}
                className="press-effect"
                style={{
                  flex: 2, padding: '12px 0', borderRadius: 8,
                  background: 'var(--blue-500)', color: 'white',
                  fontSize: 14, fontWeight: 600,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '처리 중...' : '시작하기'}
              </button>
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-400)', marginTop: 12 }}>
              익명 계정은 24시간 후 만료됩니다
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
