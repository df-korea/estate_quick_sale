import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SigunguComplex } from '../../types';
import { formatWon } from '../../utils/format';

declare global {
  interface Window {
    kakao: any;
  }
}

interface Props {
  complexes: SigunguComplex[];
  sigunguName: string;
}

export default function KakaoComplexMap({ complexes, sigunguName }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<SigunguComplex | null>(null);
  const nav = useNavigate();

  const withCoords = complexes.filter(c => c.lat && c.lon);

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps || withCoords.length === 0) return;

    const kakao = window.kakao;

    // Calculate center
    const avgLat = withCoords.reduce((s, c) => s + c.lat!, 0) / withCoords.length;
    const avgLon = withCoords.reduce((s, c) => s + c.lon!, 0) / withCoords.length;

    const map = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(avgLat, avgLon),
      level: 5,
    });

    // Fit bounds
    const bounds = new kakao.maps.LatLngBounds();
    withCoords.forEach(c => bounds.extend(new kakao.maps.LatLng(c.lat!, c.lon!)));
    map.setBounds(bounds, 40);

    // Create custom overlays
    withCoords.forEach(c => {
      const size = c.bargain_count >= 10 ? 36 : c.bargain_count >= 5 ? 30 : c.bargain_count >= 1 ? 24 : 18;
      const bg = c.bargain_count >= 10 ? '#e02020' : c.bargain_count >= 5 ? '#f04452' : c.bargain_count >= 1 ? '#ff6666' : '#b0b8c1';
      const label = c.bargain_count > 0 ? c.bargain_count : '';

      const content = document.createElement('div');
      content.style.cssText = `
        width:${size}px;height:${size}px;border-radius:50%;
        background:${bg};color:white;font-size:${size > 24 ? 11 : 9}px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);
        cursor:pointer;transition:transform 0.15s;
      `;
      content.textContent = String(label);
      content.addEventListener('click', () => setSelected(c));
      content.addEventListener('mouseenter', () => { content.style.transform = 'scale(1.2)'; });
      content.addEventListener('mouseleave', () => { content.style.transform = 'scale(1)'; });

      new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(c.lat!, c.lon!),
        content,
        yAnchor: 0.5,
        xAnchor: 0.5,
      });
    });

    return () => {
      // cleanup
    };
  }, [withCoords.length]);

  if (withCoords.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        fontSize: 11, color: 'var(--gray-500)',
        marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{sigunguName} 단지 위치</span>
        <span>{withCoords.length}개 단지</span>
      </div>

      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div ref={mapRef} style={{ width: '100%', height: 300 }} />
      </div>

      {/* Selected popup */}
      {selected && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          right: 8,
          background: 'var(--white)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          padding: 14,
          zIndex: 10,
        }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{selected.complex_name}</span>
            <button onClick={() => setSelected(null)} style={{ color: 'var(--gray-400)', padding: 2, fontSize: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-8" style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 8 }}>
            <span>매물 {selected.total_articles}건</span>
            {selected.bargain_count > 0 && <span style={{ color: 'var(--red-500)', fontWeight: 600 }}>급매 {selected.bargain_count}</span>}
            {selected.avg_price && <span>평균 {formatWon(selected.avg_price)}</span>}
          </div>
          <button onClick={() => nav(`/complex/${selected.complex_id}`)} className="press-effect" style={{
            width: '100%',
            padding: 10,
            background: 'var(--blue-500)',
            color: 'white',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: 14,
          }}>
            단지 상세 보기
          </button>
        </div>
      )}
    </div>
  );
}
