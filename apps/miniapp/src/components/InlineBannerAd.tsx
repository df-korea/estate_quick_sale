import { useEffect, useRef, useState } from 'react';

const AD_GROUP_ID = 'ait.v2.live.7ea0dc7ac9314526';

export default function InlineBannerAd() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adFailed, setAdFailed] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let attached: { destroy: () => void } | undefined;

    async function initAd() {
      try {
        const { TossAds } = await import('@apps-in-toss/web-framework');
        if (destroyed || !containerRef.current) return;
        if (!TossAds?.attachBanner?.isSupported?.()) { setAdFailed(true); return; }

        // Initialize if not already (safe to call multiple times)
        await new Promise<void>((resolve, reject) => {
          TossAds.initialize({
            callbacks: {
              onInitialized: () => resolve(),
              onInitializationFailed: (err: Error) => reject(err),
            },
          });
        });

        if (destroyed || !containerRef.current) return;

        attached = TossAds.attachBanner(AD_GROUP_ID, containerRef.current, {
          theme: 'auto',
          tone: 'grey',
          variant: 'card',
          callbacks: {
            onNoFill: () => setAdFailed(true),
            onAdFailedToRender: () => setAdFailed(true),
          },
        });
      } catch {
        if (!destroyed) setAdFailed(true);
      }
    }

    initAd();
    return () => { destroyed = true; attached?.destroy(); };
  }, []);

  if (adFailed) return null;

  return (
    <div style={{ width: '100%', margin: '12px 0' }}>
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
}
