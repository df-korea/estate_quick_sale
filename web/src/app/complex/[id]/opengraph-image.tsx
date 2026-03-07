import { ImageResponse } from 'next/og';
import { getComplexById } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const complex = await cached(`ssr:complex:${id}`, 300_000, () => getComplexById(Number(id)));

  if (!complex) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#3182f6', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 48 }}>
        부동산 급매 레이더
      </div>,
      { ...size }
    );
  }

  const location = [complex.city, complex.division, complex.sector].filter(Boolean).join(' ');
  const listings = [
    complex.deal_count > 0 ? `매매 ${complex.deal_count}건` : '',
    complex.lease_count > 0 ? `전세 ${complex.lease_count}건` : '',
    complex.rent_count > 0 ? `월세 ${complex.rent_count}건` : '',
  ].filter(Boolean).join(' · ');

  return new ImageResponse(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1a5276, #2980b9)',
      padding: 60,
    }}>
      {/* Type badges */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px 20px', borderRadius: 8, fontSize: 28, fontWeight: 700 }}>
          {complex.property_type || 'APT'}
        </div>
        {complex.total_households && (
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px 20px', borderRadius: 8, fontSize: 28, fontWeight: 700 }}>
            {`${complex.total_households.toLocaleString()}세대`}
          </div>
        )}
      </div>

      {/* Complex name */}
      <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: 'white', marginBottom: 16 }}>
        {complex.complex_name}
      </div>

      {/* Location */}
      <div style={{ display: 'flex', fontSize: 36, color: 'rgba(255,255,255,0.8)', marginBottom: 40 }}>
        {location}
      </div>

      {/* Listing counts */}
      <div style={{ display: 'flex', fontSize: 32, color: 'white', fontWeight: 600 }}>
        {listings}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', fontSize: 28, color: 'rgba(255,255,255,0.6)' }}>
        부동산 급매 레이더 · estate-rader.com
      </div>
    </div>,
    { ...size }
  );
}
