import { ImageResponse } from 'next/og';
import { getCommunityPosts } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const posts = await cached('ssr:community:newest:1', 60_000, () => getCommunityPosts(1, 5)).catch(() => []);

  return new ImageResponse(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
      padding: 60,
    }}>
      {/* Chat icon */}
      <div style={{ display: 'flex', marginBottom: 32 }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: 'white', marginBottom: 16 }}>
        부동산 급매 게시판
      </div>

      <div style={{ display: 'flex', fontSize: 32, color: 'rgba(255,255,255,0.7)', marginBottom: 40 }}>
        급매 정보, 투자 분석, 지역 정보를 나누세요
      </div>

      {/* Recent posts preview */}
      {posts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.slice(0, 3).map((post: any, i: number) => (
            <div key={i} style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '14px 24px',
              fontSize: 24,
              color: 'rgba(255,255,255,0.9)',
            }}>
              {String(post.title || '').substring(0, 40)}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', fontSize: 26, color: 'rgba(255,255,255,0.5)' }}>
        부동산 급매 레이더 · estate-rader.com
      </div>
    </div>,
    { ...size }
  );
}
