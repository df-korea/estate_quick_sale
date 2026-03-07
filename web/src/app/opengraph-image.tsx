import { ImageResponse } from 'next/og';
import { getFullBriefing } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const briefing = await cached('ssr:briefing', 300_000, () => getFullBriefing()).catch(() => null);
  const summary = briefing?.summary;

  return new ImageResponse(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #0f4c81, #3182f6)',
      padding: 60,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Map-like background dots */}
      <div style={{
        display: 'flex',
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        opacity: 0.08,
        background: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 60% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px), radial-gradient(circle at 40% 70%, white 1px, transparent 1px), radial-gradient(circle at 15% 80%, white 1px, transparent 1px)',
        backgroundSize: '100px 100px',
      }} />

      {/* Map pin icons */}
      <div style={{ display: 'flex', position: 'absolute', top: 80, right: 80, opacity: 0.15 }}>
        <svg width="200" height="200" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      <div style={{ display: 'flex', position: 'absolute', top: 200, right: 200, opacity: 0.1 }}>
        <svg width="120" height="120" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      <div style={{ display: 'flex', position: 'absolute', bottom: 140, right: 120, opacity: 0.12 }}>
        <svg width="160" height="160" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
        전국 아파트 급매물 실시간 검색
      </div>
      <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: 'white', marginBottom: 40 }}>
        부동산 급매 레이더
      </div>

      {/* Stats */}
      {summary && (
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: '20px 32px', minWidth: 180 }}>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#ffe066' }}>
              {summary.total_bargains?.toLocaleString() || '0'}
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              급매 매물
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: '20px 32px', minWidth: 180 }}>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: 'white' }}>
              {summary.total_articles?.toLocaleString() || '0'}
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              전체 매물
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: '20px 32px', minWidth: 180 }}>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#7bed9f' }}>
              {summary.new_bargains_today?.toLocaleString() || '0'}
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              오늘 신규 급매
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', fontSize: 26, color: 'rgba(255,255,255,0.5)' }}>
        지도 기반 급매 탐색 · AI 급매 점수 · 시세 비교 · estate-rader.com
      </div>
    </div>,
    { ...size }
  );
}
