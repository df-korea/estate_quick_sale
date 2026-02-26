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

function loadKakaoMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.Map) { resolve(); return; }
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve());
      return;
    }
    // Dynamic script fallback
    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=405aeb3782bea91f07f42d1bae32efd8&libraries=clusterer&autoload=false';
      script.onload = () => {
        if (window.kakao?.maps) window.kakao.maps.load(() => resolve());
        else reject(new Error('Kakao SDK loaded but maps unavailable'));
      };
      script.onerror = () => reject(new Error('Failed to load Kakao Maps SDK'));
      document.head.appendChild(script);
    } else {
      // Script exists but not loaded yet - wait
      const timer = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(timer);
          if (window.kakao.maps.Map) resolve();
          else window.kakao.maps.load(() => resolve());
        }
      }, 100);
      setTimeout(() => { clearInterval(timer); reject(new Error('Kakao Maps load timeout')); }, 10000);
    }
  });
}

export default function KakaoComplexMap({ complexes, sigunguName }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [selected, setSelected] = useState<SigunguComplex | null>(null);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const nav = useNavigate();

  const withCoords = complexes.filter(c => c.lat && c.lon);

  useEffect(() => {
    if (!mapRef.current || withCoords.length === 0) return;
    let cancelled = false;

    loadKakaoMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        setMapStatus('ready');
        initMap();
      })
      .catch(() => {
        if (!cancelled) setMapStatus('error');
      });

    return () => { cancelled = true; };
  }, [withCoords.length]);

  function initMap() {
    if (!mapRef.current || !window.kakao?.maps?.Map) return;

    const kakao = window.kakao;

    // Calculate center
    const avgLat = withCoords.reduce((s, c) => s + c.lat!, 0) / withCoords.length;
    const avgLon = withCoords.reduce((s, c) => s + c.lon!, 0) / withCoords.length;

    const map = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(avgLat, avgLon),
      level: 5,
    });
    mapInstanceRef.current = map;

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

  }

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

      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)', position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: 300 }} />

        {/* Loading / Error overlay */}
        {mapStatus === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--gray-50)', color: 'var(--gray-500)', fontSize: 13,
          }}>지도 로딩 중...</div>
        )}
        {mapStatus === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--gray-50)', color: 'var(--gray-500)', fontSize: 13, gap: 8,
          }}>
            <span>지도를 불러올 수 없습니다</span>
            <button onClick={() => window.location.reload()} className="press-effect" style={{
              padding: '4px 12px', background: 'var(--blue-500)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: 12,
            }}>새로고침</button>
          </div>
        )}

        {/* Zoom buttons */}
        {mapStatus === 'ready' && (
          <div style={{
            position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 5,
          }}>
            <button onClick={() => { const m = mapInstanceRef.current; if (m) m.setLevel(m.getLevel() - 1); }}
              style={{
                width: 32, height: 32, background: 'var(--white)', border: '1px solid var(--gray-300)',
                borderRadius: '6px 6px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--gray-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>+</button>
            <button onClick={() => { const m = mapInstanceRef.current; if (m) m.setLevel(m.getLevel() + 1); }}
              style={{
                width: 32, height: 32, background: 'var(--white)', border: '1px solid var(--gray-300)',
                borderRadius: '0 0 6px 6px', fontSize: 18, fontWeight: 700, color: 'var(--gray-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>-</button>
          </div>
        )}
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
