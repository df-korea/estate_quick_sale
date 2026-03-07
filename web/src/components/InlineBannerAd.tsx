'use client';

import { useEffect, useRef } from 'react';

const DEFAULT_UNIT = 'DAN-z6BuxRIuldWmIPEA';
const SCRIPT_SRC = 'https://t1.daumcdn.net/kas/static/ba.min.js';

/** SDK가 초기화 완료된 객체인지 (배열 큐가 아닌지) 확인 */
function isAdfitReady(): boolean {
  const af = (window as any).adfit;
  return af && typeof af.display === 'function';
}

export default function InlineBannerAd({ unit = DEFAULT_UNIT }: { unit?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', unit);
    ins.setAttribute('data-ad-width', '320');
    ins.setAttribute('data-ad-height', '100');
    container.appendChild(ins);

    const w = window as any;
    if (isAdfitReady()) {
      // SDK 이미 로드됨 → 이전 유닛 정리 후 즉시 재렌더 (같은 프레임)
      try { w.adfit.destroy(unit); } catch (_) {}
      w.adfit.display(unit);
    } else {
      // 최초 로드 → ba.min.js가 모든 ins.kakao_ad_area를 자동 스캔·처리
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      container.appendChild(script);
    }

    return () => {
      container.innerHTML = '';
    };
  }, [unit]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', margin: '12px 0', display: 'flex', justifyContent: 'center' }}
    />
  );
}
