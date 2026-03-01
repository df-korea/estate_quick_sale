'use client';

import { useRouter } from 'next/navigation';
import { useSettings } from '@/hooks/useSettings';
import ToggleRow from '@/components/ToggleRow';

export default function NotificationSettingsPage() {
  const nav = useRouter();
  const { settings, update } = useSettings();

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => nav.back()} className="press-effect" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: '50%', background: 'var(--gray-100)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-700)" strokeWidth="2.5">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>알림 설정</h1>
      </div>
      <div className="page-content">
        <div className="section">
          <div className="card">
            <div className="card-body">
              <ToggleRow
                label="급매 알림"
                desc="새 급매물 등록 시 알림"
                checked={settings.notifyBargain}
                onChange={v => update({ notifyBargain: v })}
              />
              <ToggleRow
                label="가격 인하 알림"
                desc="관심 단지 호가 인하 시 알림"
                checked={settings.notifyPriceDrop}
                onChange={v => update({ notifyPriceDrop: v })}
              />
              <ToggleRow
                label="관심단지 신규매물"
                desc="관심 단지 새 매물 등록 시 알림"
                checked={settings.notifyWatchlist}
                onChange={v => update({ notifyWatchlist: v })}
              />
              <div className="text-xs text-gray" style={{
                marginTop: 12, padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 8,
              }}>
                알림은 토스 앱 연동 후 활성화됩니다
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
