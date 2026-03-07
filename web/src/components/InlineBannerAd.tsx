'use client';

import { useEffect, useRef, useState } from 'react';

const DEFAULT_UNIT = 'DAN-z6BuxRIuldWmIPEA';

let scriptPromise: Promise<void> | null = null;

function ensureScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if ((window as any).adfit) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://t1.daumcdn.net/kas/static/ba.min.js';
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
  return scriptPromise;
}

let adCounter = 0;

export default function InlineBannerAd({ unit = DEFAULT_UNIT }: { unit?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [mountKey] = useState(() => ++adCounter);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create fresh <ins> element each mount so adfit.render() always picks it up
    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', unit);
    ins.setAttribute('data-ad-width', '320');
    ins.setAttribute('data-ad-height', '100');
    container.appendChild(ins);

    let cancelled = false;

    ensureScript().then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        const adfit = (window as any).adfit;
        if (adfit) adfit.render();
      });
    });

    return () => {
      cancelled = true;
      const af = (window as any).adfit;
      if (af) af.destroy(unit);
      // Remove the <ins> so next mount creates a fresh one
      if (container.contains(ins)) container.removeChild(ins);
    };
  }, [unit, mountKey]);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', margin: '12px 0', display: 'flex', justifyContent: 'center' }}
    />
  );
}
