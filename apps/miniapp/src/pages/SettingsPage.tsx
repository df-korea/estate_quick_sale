import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface Stats {
  complexCount: number;
  articleCount: number;
  bargainCount: number;
  removedCount: number;
  lastCollectionAt: string | null;
  recentRuns: any[];
}

export function SettingsPage() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<Stats>('/stats'),
    staleTime: 30_000,
  });

  const sectionStyle: React.CSSProperties = {
    padding: '16px 0',
    borderBottom: '1px solid var(--color-gray-200)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-gray-800)',
    marginBottom: '12px',
  };

  return (
    <div>
      <div className="header">
        <h1>설정</h1>
      </div>

      <div className="page-content">
        {/* Data Stats */}
        <div style={sectionStyle}>
          <div style={titleStyle}>데이터 현황</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <StatBox label="단지" value={stats?.complexCount || 0} />
            <StatBox label="매물" value={stats?.articleCount || 0} />
            <StatBox label="급매" value={stats?.bargainCount || 0} color="var(--color-red)" />
            <StatBox label="삭제됨" value={stats?.removedCount || 0} color="var(--color-gray-500)" />
          </div>
        </div>

        {/* Recent Runs */}
        <div style={sectionStyle}>
          <div style={titleStyle}>최근 수집 이력</div>
          {stats?.recentRuns.map((run: any) => (
            <div key={run.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              fontSize: '13px',
              borderBottom: '1px solid var(--color-gray-100)',
            }}>
              <div>
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: run.status === 'completed' ? 'var(--color-green-light)' : 'var(--color-gray-200)',
                  color: run.status === 'completed' ? 'var(--color-green)' : 'var(--color-gray-700)',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginRight: '8px',
                }}>
                  {run.run_type}
                </span>
                <span style={{ color: 'var(--color-gray-600)' }}>
                  {run.new_articles || 0}건 신규 / {run.new_bargains || 0}건 급매{run.removed_articles ? ` / ${run.removed_articles}건 제거` : ''}
                </span>
              </div>
              <span style={{ color: 'var(--color-gray-500)' }}>
                {new Date(run.started_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {(!stats?.recentRuns || stats.recentRuns.length === 0) && (
            <div style={{ fontSize: '13px', color: 'var(--color-gray-600)' }}>수집 이력이 없습니다.</div>
          )}
        </div>

        {/* Notification settings stub */}
        <div style={sectionStyle}>
          <div style={titleStyle}>알림 설정</div>
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-gray-100)',
            textAlign: 'center',
            color: 'var(--color-gray-600)',
            fontSize: '13px',
          }}>
            토스 앱 연동 후 사용 가능합니다
          </div>
        </div>

        {/* About */}
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
            부동산 급매 레이더 v0.1.0
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-gray-400)', marginTop: '4px' }}>
            데이터 출처: 네이버 부동산
          </p>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '12px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--color-gray-100)',
    }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color || 'var(--color-black)' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-gray-600)', marginTop: '2px' }}>
        {label}
      </div>
    </div>
  );
}
