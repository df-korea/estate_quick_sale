'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, apiPut } from '@/lib/api';
import type { BargainSort, BargainMode } from '@/types';

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { user, logout } = useAuth();
  const nav = useRouter();

  // Profile state
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [nicknameError, setNicknameError] = useState('');
  const [nextChangeAt, setNextChangeAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ nickname_changed_at: string | null }>('/users/profile')
      .then(p => {
        if (p.nickname_changed_at) {
          const next = new Date(new Date(p.nickname_changed_at).getTime() + 30 * 24 * 60 * 60 * 1000);
          if (next > new Date()) setNextChangeAt(next.toLocaleDateString('ko-KR'));
        }
      })
      .catch(() => {});
  }, []);

  async function saveNickname() {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 12) {
      setNicknameError('닉네임은 2~12자여야 합니다');
      return;
    }
    setSaving(true);
    setNicknameError('');
    try {
      await apiPut('/users/nickname', { nickname: trimmed });
      setEditing(false);
      setNextChangeAt(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR'));
      // Update local auth user
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        u.nickname = trimmed;
        localStorage.setItem('auth_user', JSON.stringify(u));
      }
    } catch (e: any) {
      const msg = e.message || '변경에 실패했습니다';
      setNicknameError(msg);
      if (e.data?.next_change_at) {
        setNextChangeAt(new Date(e.data.next_change_at).toLocaleDateString('ko-KR'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>설정</h1>
      </div>
      <div className="page-content">

        {/* 프로필 카드 */}
        <div className="section">
          <div className="card">
            <div className="card-body" style={{ padding: '16px' }}>
              <div className="text-xs text-gray" style={{ marginBottom: 8 }}>프로필</div>
              {!editing ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.nickname || '사용자'}</div>
                    {nextChangeAt && (
                      <div className="text-xs text-gray" style={{ marginTop: 4 }}>
                        다음 닉네임 변경: {nextChangeAt}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditing(true); setNickname(user?.nickname || ''); setNicknameError(''); }}
                    className="press-effect"
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-full)',
                      background: 'var(--gray-100)', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)',
                    }}
                  >변경</button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-8">
                    <input
                      value={nickname}
                      onChange={e => { setNickname(e.target.value); setNicknameError(''); }}
                      maxLength={12}
                      placeholder="새 닉네임 (2~12자)"
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8,
                        border: nicknameError ? '1px solid var(--red-500)' : '1px solid var(--gray-200)',
                        fontSize: 14, background: 'var(--gray-50)',
                      }}
                    />
                    <button
                      onClick={saveNickname}
                      disabled={saving}
                      className="press-effect"
                      style={{
                        padding: '8px 16px', borderRadius: 8,
                        background: 'var(--blue-500)', color: 'white',
                        fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1,
                      }}
                    >{saving ? '...' : '저장'}</button>
                    <button
                      onClick={() => setEditing(false)}
                      style={{ padding: '8px', color: 'var(--gray-400)', fontSize: 13 }}
                    >취소</button>
                  </div>
                  {nicknameError && (
                    <div style={{ color: 'var(--red-500)', fontSize: 12, marginTop: 6 }}>{nicknameError}</div>
                  )}
                  <div className="text-xs text-gray" style={{ marginTop: 6 }}>
                    닉네임 변경 후 30일간 변경할 수 없습니다
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 바로가기 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>바로가기</h3>
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <NavRow label="관심단지 관리" onClick={() => nav.push('/watchlist')} />
              <NavRow label="알림 설정" onClick={() => nav.push('/settings/notifications')} last />
            </div>
          </div>
        </div>

        {/* 표시 설정 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>표시 설정</h3>
          <div className="card">
            <div className="card-body">
              <div style={{ marginBottom: 'var(--space-12)' }}>
                <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>기본 거래유형</label>
                <select
                  value={settings.defaultTradeType}
                  onChange={e => update({ defaultTradeType: e.target.value })}
                  style={selectStyle}
                >
                  <option value="A1">매매</option>
                  <option value="B1">전세</option>
                  <option value="B2">월세</option>
                  <option value="all">전체</option>
                </select>
              </div>
              <div style={{ marginBottom: 'var(--space-12)' }}>
                <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>기본 정렬</label>
                <select
                  value={settings.defaultSort}
                  onChange={e => update({ defaultSort: e.target.value as BargainSort })}
                  style={selectStyle}
                >
                  <option value="score_desc">급매점수 높은순</option>
                  <option value="newest">최신순</option>
                  <option value="price_asc">가격 낮은순</option>
                  <option value="price_desc">가격 높은순</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>기본 급매 모드</label>
                <select
                  value={settings.defaultBargainMode}
                  onChange={e => update({ defaultBargainMode: e.target.value as BargainMode })}
                  style={selectStyle}
                >
                  <option value="all">전체</option>
                  <option value="keyword">키워드 급매</option>
                  <option value="price">가격 급매</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 계정 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>계정</h3>
          <div className="card">
            <div className="card-body">
              <button
                onClick={logout}
                className="press-effect"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 8,
                  color: 'var(--red-500)',
                  fontSize: 13,
                  fontWeight: 500,
                  background: 'transparent',
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavRow({ label, onClick, last }: { label: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="press-effect flex items-center justify-between"
      style={{
        width: '100%', padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid var(--gray-100)',
        fontSize: 14, fontWeight: 500, color: 'var(--gray-800)',
      }}
    >
      <span>{label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--gray-200)',
  background: 'var(--gray-50)',
  fontSize: 14,
  color: 'var(--gray-800)',
  appearance: 'auto' as const,
};
