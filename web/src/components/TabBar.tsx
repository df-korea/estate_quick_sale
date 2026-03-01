'use client';

import { usePathname, useRouter } from 'next/navigation';

const ALL_TABS = [
  { path: '/', label: '홈', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0v-6a1 1 0 011-1h2a1 1 0 011 1v6m-6 0h6' },
  { path: '/search', label: '검색', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { path: '/community', label: '게시판', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { path: '/settings', label: '설정', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', authRequired: true },
];

interface TabBarProps {
  isLoggedIn: boolean;
  isToss: boolean;
}

export default function TabBar({ isLoggedIn, isToss }: TabBarProps) {
  const pathname = usePathname();
  const nav = useRouter();

  // 비로그인 + 비토스 환경: 설정 탭 숨김
  const tabs = (!isLoggedIn && !isToss)
    ? ALL_TABS.filter(t => !t.authRequired)
    : ALL_TABS;

  return (
    <nav className="fixed-bottom" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      height: 'calc(var(--tab-height) + var(--safe-bottom))',
      paddingBottom: 'var(--safe-bottom)',
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      display: 'flex',
      boxShadow: '0 -1px 8px rgba(0,0,0,0.04)',
    }}>
      {tabs.map(tab => {
        const isActive = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path);
        return (
          <button key={tab.path}
            onClick={() => nav.push(tab.path)}
            className="press-effect"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              color: isActive ? 'var(--blue-500)' : 'var(--gray-400)',
              transition: 'color 0.15s',
              position: 'relative',
            }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
            {isActive && (
              <div style={{
                position: 'absolute',
                top: 4,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--blue-500)',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
