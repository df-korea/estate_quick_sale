import { ImageResponse } from 'next/og';
import { getArticleById } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function formatWon(won: number | null): string {
  if (!won) return '';
  if (won >= 100000000) {
    const eok = Math.floor(won / 100000000);
    const remainder = Math.round((won % 100000000) / 10000);
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
  }
  return `${Math.round(won / 10000).toLocaleString()}만`;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await cached(`ssr:article:${id}`, 300_000, () => getArticleById(Number(id)));

  if (!article) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#3182f6', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 48 }}>
        부동산 급매 레이더
      </div>,
      { ...size }
    );
  }

  const complexName = article.complexes.complex_name;
  const price = article.formatted_price || formatWon(article.deal_price);
  const area = `${article.exclusive_space}m2 (${Math.round(article.exclusive_space / 3.3058)}평)`;
  const floor = article.target_floor ? `${article.target_floor}/${article.total_floor}층` : '';
  const keyword = article.bargain_keyword || '';
  const isBargain = article.is_bargain;

  return new ImageResponse(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1b64da, #3182f6)',
      padding: 60,
    }}>
      {/* Top badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {isBargain && (
          <div style={{ display: 'flex', background: '#ff4757', color: 'white', padding: '8px 20px', borderRadius: 8, fontSize: 28, fontWeight: 700 }}>
            {keyword || '급매'}
          </div>
        )}
        {article.bargain_score > 0 && (
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px 20px', borderRadius: 8, fontSize: 28, fontWeight: 700 }}>
            {`급매점수 ${article.bargain_score}`}
          </div>
        )}
      </div>

      {/* Complex name */}
      <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: 'white', marginBottom: 16 }}>
        {complexName}
      </div>

      {/* Price */}
      <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, color: '#ffe066', marginBottom: 32 }}>
        {price}
      </div>

      {/* Details */}
      <div style={{ display: 'flex', gap: 16, fontSize: 32, color: 'rgba(255,255,255,0.85)' }}>
        {`${area}${floor ? ` · ${floor}` : ''}`}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', fontSize: 28, color: 'rgba(255,255,255,0.6)' }}>
        부동산 급매 레이더 · estate-rader.com
      </div>
    </div>,
    { ...size }
  );
}
