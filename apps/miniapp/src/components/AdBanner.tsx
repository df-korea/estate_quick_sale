import { useEffect, useRef, useState } from 'react';

const AD_GROUP_ID = 'ait.v2.live.7ea0dc7ac9314526';

export default function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adFailed, setAdFailed] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let attached: { destroy: () => void } | undefined;

    async function initAd() {
      try {
        const { TossAds } = await import('@apps-in-toss/web-framework');

        if (destroyed || !containerRef.current) return;
        if (!TossAds?.initialize?.isSupported?.()) {
          setAdFailed(true);
          return;
        }

        // Initialize SDK
        await new Promise<void>((resolve, reject) => {
          TossAds.initialize({
            callbacks: {
              onInitialized: () => resolve(),
              onInitializationFailed: (err: Error) => reject(err),
            },
          });
        });

        if (destroyed || !containerRef.current) return;

        // Attach banner
        attached = TossAds.attachBanner(AD_GROUP_ID, containerRef.current, {
          theme: 'auto',
          tone: 'grey',
          variant: 'expanded',
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

    return () => {
      destroyed = true;
      attached?.destroy();
    };
  }, []);

  if (hidden || adFailed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--tab-height) + var(--safe-bottom))',
      left: 0,
      right: 0,
      zIndex: 199,
    }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 96 }}
      />
      <button
        onClick={() => setHidden(true)}
        style={{
          position: 'absolute',
          right: 4,
          top: 2,
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.3)',
          color: 'white',
          fontSize: 11,
          lineHeight: 1,
        }}
        aria-label="배너 닫기"
      >
        ×
      </button>
    </div>
  );
}
