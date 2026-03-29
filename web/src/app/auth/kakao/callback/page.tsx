'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function KakaoCallbackInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg('카카오 로그인이 취소되었습니다');
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('인증 코드가 없습니다');
      return;
    }

    fetch('/api/auth/kakao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirectUri: window.location.origin + '/auth/kakao/callback',
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '로그인 실패');
        }
        return res.json();
      })
      .then((data) => {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify({
          userId: data.userId,
          userKey: data.userKey,
          nickname: data.nickname,
          authProvider: data.authProvider,
        }));
        setStatus('success');
        const returnTo = localStorage.getItem('login_return_to') || '/';
        localStorage.removeItem('login_return_to');
        window.location.href = returnTo;
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || '로그인 중 오류가 발생했습니다');
      });
  }, [searchParams]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12, padding: 20,
    }}>
      {status === 'loading' && (
        <div style={{ fontSize: 14, color: 'var(--gray-600)' }}>카카오 로그인 처리 중...</div>
      )}
      {status === 'success' && (
        <div style={{ fontSize: 14, color: 'var(--blue-500)' }}>로그인 성공! 이동 중...</div>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 14, color: 'var(--red-500)' }}>{errorMsg}</div>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '8px 20px', background: 'var(--blue-500)', color: 'white',
              borderRadius: 8, fontSize: 14, fontWeight: 600, marginTop: 8,
            }}
          >
            홈으로 돌아가기
          </button>
        </>
      )}
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--gray-600)' }}>로딩 중...</div>
      </div>
    }>
      <KakaoCallbackInner />
    </Suspense>
  );
}
