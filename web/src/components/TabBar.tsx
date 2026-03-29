'use client';

import { usePathname, useRouter } from 'next/navigation';

const ALL_TABS = [
  { path: '/', label: '급매', icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z' },
  { path: '/real-transactions', label: '실거래', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { path: '/search', label: '검색', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { path: '/community', label: '게시판', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
];

export default function TabBar() {
  const pathname = usePathname();
  const nav = useRouter();

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
      {ALL_TABS.map(tab => {
        const isActive = tab.path === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.path);
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
