'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RtComplexChangeRate } from '@/types';
import { formatPrice } from '@/utils/format';
import { changeRateColor, changeRateTextColor } from '@/utils/mapCodes';

declare global {
  interface Window { kakao: any }
}

interface Props {
  complexes: RtComplexChangeRate[];
  sigunguName: string;
}

let _kakaoPromise: Promise<void> | null = null;

function loadKakaoMaps(): Promise<void> {
  if (_kakaoPromise) return _kakaoPromise;
  _kakaoPromise = new Promise<void>((resolve, reject) => {
    if (window.kakao?.maps?.Map) { resolve(); return; }
    if (window.kakao?.maps?.load) { window.kakao.maps.load(() => resolve()); return; }
    const start = Date.now();
    const poll = setInterval(() => {
      if (window.kakao?.maps?.Map) { clearInterval(poll); resolve(); }
      else if (window.kakao?.maps?.load) { clearInterval(poll); window.kakao.maps.load(() => resolve()); }
      else if (Date.now() - start > 15000) { clearInterval(poll); _kakaoPromise = null; reject(new Error('timeout')); }
    }, 200);
  });
  return _kakaoPromise;
}

function formatChangeAmount(amount: number): string {
  if (amount === 0) return '0';
  const prefix = amount > 0 ? '+' : '';
  const abs = Math.abs(amount);
  if (abs >= 10000) {
    const eok = Math.floor(abs / 10000);
    const remainder = abs % 10000;
    return remainder > 0 ? `${prefix}${eok}억${remainder.toLocaleString()}` : `${prefix}${eok}억`;
  }
  return `${prefix}${amount.toLocaleString()}만`;
}

export default function RtKakaoComplexMap({ complexes, sigunguName }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [selected, setSelected] = useState<RtComplexChangeRate | null>(null);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const nav = useRouter();

  const withCoords = complexes.filter(c => c.lat && c.lon);

  useEffect(() => {
    if (!mapRef.current || withCoords.length === 0) return;
    let cancelled = false;
    loadKakaoMaps()
      .then(() => { if (!cancelled && mapRef.current) { setMapStatus('ready'); initMap(); } })
      .catch(() => { if (!cancelled) setMapStatus('error'); });
    return () => { cancelled = true; };
  }, [complexes.length]);

  useEffect(() => {
    if (mapStatus === 'ready' && mapInstanceRef.current) renderOverlays(withCoords);
  }, [complexes, mapStatus]);

  function renderOverlays(items: RtComplexChangeRate[]) {
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    const kakao = window.kakao;
    const map = mapInstanceRef.current;
    if (!kakao?.maps || !map) return;

    items.forEach(c => {
      const rate = Number(c.change_rate ?? 0);
      const amount = Number(c.change_amount ?? 0);
      const bg = changeRateColor(rate);
      const textColor = rate === 0 ? '#666' : '#fff';
      const label = formatChangeAmount(amount);
      const size = c.tx_count_current >= 5 ? 32 : c.tx_count_current >= 2 ? 26 : 22;

      const content = document.createElement('div');
      content.style.cssText = `
        min-width:${size}px;height:${size}px;border-radius:${size / 2}px;
        padding:0 6px;
        background:${bg};color:${textColor};font-size:${size > 26 ? 10 : 9}px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);
        cursor:pointer;transition:transform 0.15s;white-space:nowrap;
      `;
      content.textContent = label;
      content.addEventListener('click', () => setSelected(c));
      content.addEventListener('mouseenter', () => { content.style.transform = 'scale(1.2)'; });
      content.addEventListener('mouseleave', () => { content.style.transform = 'scale(1)'; });

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(c.lat!, c.lon!),
        content,
        yAnchor: 0.5,
        xAnchor: 0.5,
      });
      overlaysRef.current.push(overlay);
    });
  }

  function initMap() {
    if (!mapRef.current || !window.kakao?.maps?.Map) return;
    const kakao = window.kakao;
    const coords = withCoords;
    const avgLat = coords.reduce((s, c) => s + c.lat!, 0) / coords.length;
    const avgLon = coords.reduce((s, c) => s + c.lon!, 0) / coords.length;
    const map = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(avgLat, avgLon),
      level: 5,
    });
    mapInstanceRef.current = map;
    const bounds = new kakao.maps.LatLngBounds();
    coords.forEach(c => bounds.extend(new kakao.maps.LatLng(c.lat!, c.lon!)));
    map.setBounds(bounds, 40);
    renderOverlays(coords);
  }

  if (withCoords.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
        이 기간에 실거래 데이터가 없습니다
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        fontSize: 11, color: 'var(--gray-500)', marginBottom: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{sigunguName} 단지별 변동</span>
        <span>{withCoords.length}개 단지</span>
      </div>

      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)', position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: 300 }} />
        {mapStatus === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', color: 'var(--gray-500)', fontSize: 13 }}>
            지도 로딩 중...
          </div>
        )}
        {mapStatus === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', color: 'var(--gray-500)', fontSize: 13, gap: 8 }}>
            <span>지도를 불러올 수 없습니다</span>
            <button onClick={() => window.location.reload()} className="press-effect" style={{ padding: '4px 12px', background: 'var(--blue-500)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>새로고침</button>
          </div>
        )}
        {mapStatus === 'ready' && (
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 5 }}>
            <button onClick={() => { const m = mapInstanceRef.current; if (m) m.setLevel(m.getLevel() - 1); }}
              style={{ width: 32, height: 32, background: 'var(--white)', border: '1px solid var(--gray-300)', borderRadius: '6px 6px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
            <button onClick={() => { const m = mapInstanceRef.current; if (m) m.setLevel(m.getLevel() + 1); }}
              style={{ width: 32, height: 32, background: 'var(--white)', border: '1px solid var(--gray-300)', borderRadius: '0 0 6px 6px', fontSize: 18, fontWeight: 700, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>-</button>
          </div>
        )}
      </div>

      {selected && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8, right: 8,
          background: 'var(--white)', borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          padding: 14, zIndex: 10,
        }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{selected.complex_name}</span>
            <button onClick={() => setSelected(null)} style={{ color: 'var(--gray-400)', padding: 2, fontSize: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>평균 {formatPrice(selected.avg_current)}</span>
            <span style={{ color: changeRateTextColor(Number(selected.change_rate)), fontWeight: 600 }}>
              {Number(selected.change_rate) > 0 ? '+' : ''}{Number(selected.change_rate).toFixed(1)}%
            </span>
            <span>거래 {selected.tx_count_current}건</span>
          </div>
          <button onClick={() => nav.push(`/complex/${selected.complex_id}`)} className="press-effect" style={{
            width: '100%', padding: 10, background: 'var(--blue-500)', color: 'white',
            borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: 14,
          }}>
            단지 상세 보기
          </button>
        </div>
      )}
    </div>
  );
}
