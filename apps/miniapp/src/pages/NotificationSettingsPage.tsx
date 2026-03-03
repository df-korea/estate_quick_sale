import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiPut } from '../lib/api';
import ToggleRow from '../components/ToggleRow';
import LoadingSpinner from '../components/LoadingSpinner';
import type { NotificationSettings } from '../types';

const DEFAULTS: NotificationSettings = {
  notify_keyword_bargain: true,
  notify_price_bargain: true,
  notify_new_article: true,
};

export default function NotificationSettingsPage() {
  const nav = useNavigate();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<NotificationSettings>('/notification-settings')
      .then(data => setSettings({
        notify_keyword_bargain: data.notify_keyword_bargain ?? true,
        notify_price_bargain: data.notify_price_bargain ?? true,
        notify_new_article: data.notify_new_article ?? true,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: keyof NotificationSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    try {
      await apiPut('/notification-settings', next);
    } catch {
      setSettings(settings); // revert
    }
    setSaving(false);
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => nav(-1)} className="press-effect" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: '50%', background: 'var(--gray-100)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-700)" strokeWidth="2.5">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>알림 설정</h1>
        {saving && <span className="text-xs text-gray">저장 중...</span>}
      </div>
      <div className="page-content">
        {loading ? <LoadingSpinner /> : (
          <div className="section">
            <div className="card">
              <div className="card-body">
                <ToggleRow
                  label="키워드 급매 알림"
                  desc="관심 단지에 키워드 급매 등록 시 알림"
                  checked={settings.notify_keyword_bargain}
                  onChange={v => toggle('notify_keyword_bargain', v)}
                />
                <ToggleRow
                  label="가격 급매 알림"
                  desc="관심 단지에 가격 급매 감지 시 알림"
                  checked={settings.notify_price_bargain}
                  onChange={v => toggle('notify_price_bargain', v)}
                />
                <ToggleRow
                  label="관심단지 신규매물"
                  desc="관심 단지 새 매물 등록 시 알림"
                  checked={settings.notify_new_article}
                  onChange={v => toggle('notify_new_article', v)}
                />
                <div className="text-xs text-gray" style={{
                  marginTop: 12, padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 8,
                }}>
                  알림은 토스 앱 연동 후 활성화됩니다
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
