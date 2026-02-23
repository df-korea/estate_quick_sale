import { useStats } from '../hooks/useStats';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SettingsPage() {
  const { data: stats, loading } = useStats();

  if (loading) return <div className="page"><LoadingSpinner /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>설정</h1>
      </div>
      <div className="page-content">
        {/* Data Stats */}
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

        {/* Last Collection */}
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

        {/* App Info */}
        <div className="section">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>앱 정보</h3>
          <div className="card">
            <div className="card-body text-sm text-gray">
              <p>급매 레이더 v0.1</p>
              <p style={{ marginTop: 4 }}>부동산 급매물 모니터링 서비스</p>
            </div>
          </div>
        </div>
      </div>
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
