import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStats } from '../hooks/useStats';
import { useSettings } from '../hooks/useSettings';
import { useWatchlist } from '../hooks/useWatchlist';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import { formatWon, abbreviateCity } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';
import type { BargainSort, BargainMode } from '../types';

const CITIES = [
  '서울특별시', '경기도', '인천광역시', '부산광역시', '대구광역시',
  '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '강원특별자치도', '충청북도', '충청남도', '전라북도', '전라남도',
  '경상북도', '경상남도', '제주특별자치도',
];

export default function SettingsPage() {
  const { data: stats, loading } = useStats();
  const { settings, update } = useSettings();
  const { data: watchlist, ids: watchlistIds, remove: removeWatchlist } = useWatchlist();
  const { user, logout } = useAuth();
  const [districts, setDistricts] = useState<string[]>([]);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    apiFetch<string[]>('/districts').then(setDistricts).catch(() => {});
  }, []);

  if (loading) return <div className="page"><LoadingSpinner /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>설정</h1>
      </div>
      <div className="page-content">

        {/* 관심 지역 설정 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>관심 지역</h3>
          <div className="card">
            <div className="card-body">
              <div style={{ marginBottom: 'var(--space-12)' }}>
                <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>시/도</label>
                <select
                  value={settings.preferredCity ?? ''}
                  onChange={e => update({ preferredCity: e.target.value || null, preferredDistrict: null })}
                  style={selectStyle}
                >
                  <option value="">전체</option>
                  {CITIES.map(c => <option key={c} value={c}>{abbreviateCity(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>구/군</label>
                <select
                  value={settings.preferredDistrict ?? ''}
                  onChange={e => update({ preferredDistrict: e.target.value || null })}
                  style={selectStyle}
                >
                  <option value="">전체</option>
                  {districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>알림 설정</h3>
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
              <div className="text-xs text-gray" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                알림은 토스 앱 연동 후 활성화됩니다
              </div>
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

        {/* 관심 단지 관리 */}
        <div className="section">
          <button
            onClick={() => setWatchlistOpen(v => !v)}
            className="press-effect"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 'var(--space-12)',
            }}
          >
            <h3 style={{ fontWeight: 700 }}>관심 단지 ({watchlistIds.length})</h3>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--gray-400)" strokeWidth="2"
              style={{ transform: watchlistOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {watchlistOpen && (
            <div>
              {watchlist.length === 0 && (
                <div className="card">
                  <div className="card-body text-sm text-gray">관심 단지를 추가해주세요</div>
                </div>
              )}
              {watchlist.map(c => (
                <div key={c.complex_id} className="card" style={{ marginBottom: 'var(--space-8)' }}>
                  <div className="card-body" style={{ padding: 'var(--space-12) var(--space-16)' }}>
                    <div className="flex items-center justify-between">
                      <div style={{ cursor: 'pointer', minWidth: 0, flex: 1 }}
                        onClick={() => nav(`/complex/${c.complex_id}`)}>
                        <div className="truncate" style={{ fontWeight: 600 }}>{c.complex_name}</div>
                        <div className="flex items-center gap-8 text-sm text-gray" style={{ marginTop: 4 }}>
                          <span>매물 {c.total_articles}</span>
                          {c.bargain_count > 0 && <span className="text-red">급매 {c.bargain_count}</span>}
                          {c.avg_price && <span>{formatWon(c.avg_price)}</span>}
                        </div>
                      </div>
                      <button onClick={() => removeWatchlist(c.complex_id)}
                        style={{ color: 'var(--gray-400)', padding: 8, flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 데이터 현황 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>데이터 현황</h3>
          <div className="card">
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-12)' }}>
                <StatItem label="단지" value={stats?.complexCount?.toLocaleString() ?? '-'} />
                <StatItem label="활성 매물" value={stats?.articleCount?.toLocaleString() ?? '-'} />
                <StatItem label="급매" value={stats?.bargainCount?.toLocaleString() ?? '-'} color="var(--red-500)" />
                <StatItem label="삭제된 매물" value={stats?.removedCount?.toLocaleString() ?? '-'} />
                <StatItem label="실거래" value={stats?.realTransactionCount?.toLocaleString() ?? '-'} />
              </div>
            </div>
          </div>
        </div>

        {/* 최근 수집 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>최근 수집</h3>
          <div className="card">
            <div className="card-body">
              {stats?.lastCollectionAt ? (
                <div className="text-sm">
                  마지막 수집: {new Date(stats.lastCollectionAt).toLocaleString('ko-KR')}
                </div>
              ) : (
                <div className="text-sm text-gray">수집 이력 없음</div>
              )}
              {stats?.recentRuns && stats.recentRuns.length > 0 && (
                <div style={{ marginTop: 'var(--space-12)' }}>
                  <div className="text-xs text-gray" style={{ marginBottom: 'var(--space-8)' }}>최근 실행</div>
                  {stats.recentRuns.map((run, i) => (
                    <div key={i} className="flex items-center justify-between"
                      style={{ padding: 'var(--space-6) 0', borderBottom: i < stats.recentRuns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <span className={`badge ${run.status === 'completed' ? 'badge--green' : run.status === 'running' ? 'badge--blue' : 'badge--red'}`}>
                          {run.mode || 'full'}
                        </span>
                        <span className="text-xs text-gray" style={{ marginLeft: 8 }}>
                          {run.started_at ? new Date(run.started_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                      </div>
                      <div className="text-xs text-gray">
                        {run.articles_upserted != null && `+${run.articles_upserted}`}
                        {run.articles_removed != null && ` -${run.articles_removed}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 계정 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>계정</h3>
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                  <div className="text-sm" style={{ fontWeight: 500 }}>{user?.nickname || '사용자'}</div>
                  <div className="text-xs text-gray" style={{ marginTop: 2 }}>토스로 로그인됨</div>
                </div>
              </div>
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
                  marginTop: 'var(--space-8)',
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>

        {/* 앱 정보 */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>앱 정보</h3>
          <div className="card">
            <div className="card-body text-sm text-gray">
              <p>급매 레이더 v0.2</p>
              <p style={{ marginTop: 4 }}>부동산 급매물 모니터링 서비스</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: 'var(--space-8) 0', borderBottom: '1px solid var(--gray-100)' }}>
      <div>
        <div className="text-sm" style={{ fontWeight: 500 }}>{label}</div>
        <div className="text-xs text-gray">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, padding: 2,
          background: checked ? 'var(--blue-500)' : 'var(--gray-300)',
          transition: 'background 0.2s',
          display: 'flex', alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: 'white',
          transition: 'transform 0.2s',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </button>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-xs text-gray">{label}</div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-xl)', color }}>{value}</div>
    </div>
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
