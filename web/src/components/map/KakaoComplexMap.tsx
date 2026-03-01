'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SigunguComplex, BargainMode } from '@/types';
import { formatWon } from '@/utils/format';
import { apiFetch } from '@/lib/api';

declare global {
  interface Window {
    kakao: any;
  }
}

interface Props {
  complexes: SigunguComplex[];
  sigunguName: string;
  bargainMode?: BargainMode;
}

let _kakaoPromise: Promise<void> | null = null;

function loadKakaoMaps(): Promise<void> {
  if (_kakaoPromise) return _kakaoPromise;
  _kakaoPromise = new Promise<void>((resolve, reject) => {
    if (window.kakao?.maps?.Map) { resolve(); return; }

    // autoload=false: use kakao.maps.load() callback
    if (window.kakao?.maps?.load) {
      window.kakao.maps.load(() => resolve());
      return;
    }

    // SDK script not yet loaded, poll for kakao.maps.load
    const start = Date.now();
    const poll = setInterval(() => {
      if (window.kakao?.maps?.Map) {
        clearInterval(poll);
        resolve();
      } else if (window.kakao?.maps?.load) {
        clearInterval(poll);
        window.kakao.maps.load(() => resolve());
      } else if (Date.now() - start > 15000) {
        clearInterval(poll);
        _kakaoPromise = null;
        reject(new Error('Kakao Maps load timeout'));
      }
    }, 200);
  });
  return _kakaoPromise;
}

export default function KakaoComplexMap({ complexes, sigunguName, bargainMode = 'all' }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [selected, setSelected] = useState<SigunguComplex | null>(null);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [boundsResults, setBoundsResults] = useState<SigunguComplex[] | null>(null);
  const [boundsSearching, setBoundsSearching] = useState(false);
  const [showBoundsButton, setShowBoundsButton] = useState(false);
  const nav = useRouter();

  const displayComplexes = boundsResults ?? complexes;
  const withCoords = displayComplexes.filter(c => c.lat && c.lon);

  useEffect(() => {
    if (!mapRef.current || complexes.filter(c => c.lat && c.lon).length === 0) return;
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
  }, [complexes.length]);

  // Re-render overlays when bargainMode or boundsResults change
  useEffect(() => {
    if (mapStatus === 'ready' && mapInstanceRef.current) {
      renderOverlays(displayComplexes.filter(c => c.lat && c.lon));
    }
  }, [bargainMode, boundsResults, mapStatus]);

  function getDisplayCount(c: SigunguComplex): number {
    if (bargainMode === 'keyword') return c.keyword_count ?? c.bargain_count;
    if (bargainMode === 'price') return c.price_count ?? c.bargain_count;
    return c.bargain_count;
  }

  function renderOverlays(items: SigunguComplex[]) {
    // Clear existing overlays
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    const kakao = window.kakao;
    const map = mapInstanceRef.current;
    if (!kakao?.maps || !map) return;

    items.forEach(c => {
      const count = getDisplayCount(c);
      const size = count >= 10 ? 36 : count >= 5 ? 30 : count >= 1 ? 24 : 18;
      const bg = count >= 10 ? '#e02020' : count >= 5 ? '#f04452' : count >= 1 ? '#ff6666' : '#b0b8c1';
      const label = count > 0 ? count : '';

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
    const initCoords = complexes.filter(c => c.lat && c.lon);

    // Calculate center
    const avgLat = initCoords.reduce((s, c) => s + c.lat!, 0) / initCoords.length;
    const avgLon = initCoords.reduce((s, c) => s + c.lon!, 0) / initCoords.length;

    const map = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(avgLat, avgLon),
      level: 5,
    });
    mapInstanceRef.current = map;

    // Fit bounds
    const bounds = new kakao.maps.LatLngBounds();
    initCoords.forEach(c => bounds.extend(new kakao.maps.LatLng(c.lat!, c.lon!)));
    map.setBounds(bounds, 40);

    // Show "이 지역에서 급매찾기" after drag/zoom
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleMapChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => setShowBoundsButton(true), 500);
    };
    kakao.maps.event.addListener(map, 'dragend', handleMapChange);
    kakao.maps.event.addListener(map, 'zoom_changed', handleMapChange);

    renderOverlays(initCoords);
  }

  const searchBounds = useCallback(async (type: BargainMode) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setBoundsSearching(true);
    setShowBoundsButton(false);
    try {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const qs = new URLSearchParams({
        minLat: sw.getLat().toFixed(6),
        maxLat: ne.getLat().toFixed(6),
        minLon: sw.getLng().toFixed(6),
        maxLon: ne.getLng().toFixed(6),
        bargain_type: type,
      });
      const results = await apiFetch<SigunguComplex[]>(`/map/bargains-in-bounds?${qs}`);
      setBoundsResults(results);
    } catch {
      // ignore
    } finally {
      setBoundsSearching(false);
    }
  }, []);

  if (complexes.filter(c => c.lat && c.lon).length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        fontSize: 11, color: 'var(--gray-500)',
        marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{sigunguName} 단지 위치</span>
        <span>{withCoords.length}개 단지{boundsResults ? ' (검색결과)' : ''}</span>
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

        {/* Bounds search buttons */}
        {mapStatus === 'ready' && (
          <div style={{
            position: 'absolute', bottom: selected ? 140 : 10, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6, zIndex: 6,
          }}>
            {showBoundsButton && (
              <>
                <button onClick={() => searchBounds('keyword')} disabled={boundsSearching}
                  className="press-effect" style={{
                    padding: '6px 12px', background: 'var(--white)', border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: 'var(--purple-600, #7c3aed)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
                  }}>키워드 급매 찾기</button>
                <button onClick={() => searchBounds('price')} disabled={boundsSearching}
                  className="press-effect" style={{
                    padding: '6px 12px', background: 'var(--white)', border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: 'var(--red-500)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
                  }}>가격 급매 찾기</button>
              </>
            )}
            {boundsResults && (
              <button onClick={() => { setBoundsResults(null); setShowBoundsButton(false); }}
                className="press-effect" style={{
                  padding: '6px 12px', background: 'var(--gray-100)', border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: 'var(--gray-600)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
                }}>초기화</button>
            )}
          </div>
        )}

        {boundsSearching && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.6)', zIndex: 7,
          }}>
            <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>검색 중...</span>
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
          <div className="flex items-center gap-8" style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 8, flexWrap: 'wrap' }}>
            <span>매물 {selected.total_articles}건</span>
            {selected.bargain_count > 0 && <span style={{ color: 'var(--red-500)', fontWeight: 600 }}>급매 {selected.bargain_count}</span>}
            {(selected.keyword_count > 0 || selected.price_count > 0) && (
              <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                (키워드 {selected.keyword_count ?? 0} / 가격 {selected.price_count ?? 0})
              </span>
            )}
            {selected.avg_price && <span>평균 {formatWon(selected.avg_price)}</span>}
          </div>
          <button onClick={() => nav.push(`/complex/${selected.complex_id}`)} className="press-effect" style={{
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
