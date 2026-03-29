'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn, user, logout } = useAuth();
  const nav = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const go = (path: string) => { setOpen(false); nav.push(path); };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press-effect"
        aria-label="메뉴"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 300,
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-600)" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div ref={menuRef} style={{
            position: 'absolute',
            top: 0, right: 0,
            width: 260,
            height: '100%',
            background: '#fff',
            boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
            animation: 'slideLeft 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 16px 16px',
              borderBottom: '1px solid var(--gray-100)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {isLoggedIn ? (user?.nickname || '사용자') : '메뉴'}
                </span>
                <button onClick={() => setOpen(false)} style={{ padding: 4 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {isLoggedIn && (
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
                  {user?.authProvider === 'kakao' ? '카카오 로그인' : user?.authProvider === 'anonymous' ? '익명' : '토스 로그인'}
                </div>
              )}
            </div>

            {/* Menu Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              <MenuItem label="설정" icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                onClick={() => go('/settings')} />
              <MenuItem label="관심단지" icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                onClick={() => go('/watchlist')} />
              <MenuItem label="알림설정" icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                onClick={() => go('/settings/notifications')} />
              <div style={{ height: 1, background: 'var(--gray-100)', margin: '8px 16px' }} />
              <MenuItem label="이용약관" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                onClick={() => go('/terms')} />
              <MenuItem label="개인정보처리방침" icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                onClick={() => go('/privacy')} />
              <MenuItem label="서비스 소개" icon="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                onClick={() => go('/about')} />
            </div>

            {/* Login/Logout */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gray-100)' }}>
              {isLoggedIn ? (
                <button onClick={() => { logout(); setOpen(false); }} style={{
                  width: '100%', padding: '10px 0', borderRadius: 8,
                  background: 'var(--gray-100)', color: 'var(--gray-600)',
                  fontSize: 14, fontWeight: 500,
                }}>
                  로그아웃
                </button>
              ) : (
                <button onClick={() => go('/community')} style={{
                  width: '100%', padding: '10px 0', borderRadius: 8,
                  background: 'var(--blue-500)', color: '#fff',
                  fontSize: 14, fontWeight: 500,
                }}>
                  로그인
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}

function MenuItem({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press-effect" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', fontSize: 14, color: 'var(--gray-800)',
      textAlign: 'left',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      {label}
    </button>
  );
}
