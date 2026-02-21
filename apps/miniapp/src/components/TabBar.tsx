import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/', label: '급매', icon: '🔴' },
  { path: '/search', label: '검색', icon: '🔍' },
  { path: '/settings', label: '설정', icon: '⚙️' },
];

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const barStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '480px',
    background: 'var(--color-white)',
    borderTop: '1px solid var(--color-gray-300)',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '64px',
    paddingBottom: '8px',
    zIndex: 200,
  };

  return (
    <div style={barStyle}>
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 16px',
              color: isActive ? 'var(--color-blue)' : 'var(--color-gray-600)',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <span style={{ fontSize: '20px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
