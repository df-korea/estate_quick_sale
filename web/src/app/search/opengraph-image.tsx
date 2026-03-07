import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #2c3e50, #3498db)',
      padding: 60,
    }}>
      {/* Search icon */}
      <div style={{ display: 'flex', marginBottom: 32 }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: 'white', marginBottom: 16 }}>
        아파트 급매 검색
      </div>

      <div style={{ display: 'flex', fontSize: 32, color: 'rgba(255,255,255,0.7)', marginBottom: 48 }}>
        단지명으로 급매물을 검색하세요
      </div>

      {/* Example search chips */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', padding: '12px 24px', borderRadius: 50, fontSize: 26 }}>
          헬리오시티
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', padding: '12px 24px', borderRadius: 50, fontSize: 26 }}>
          올림픽파크포레온
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', padding: '12px 24px', borderRadius: 50, fontSize: 26 }}>
          래미안원베일리
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', fontSize: 26, color: 'rgba(255,255,255,0.5)' }}>
        부동산 급매 레이더 · estate-rader.com
      </div>
    </div>,
    { ...size }
  );
}
