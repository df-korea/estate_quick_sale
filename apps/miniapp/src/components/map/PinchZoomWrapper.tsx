import { useRef, useCallback } from 'react';

interface Props {
  children: React.ReactNode;
}

export default function PinchZoomWrapper({ children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ scale: 1, startDist: 0, startScale: 1, lastTap: 0 });

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const state = stateRef.current;
    if (e.touches.length === 2) {
      state.startDist = getDistance(e.touches[0], e.touches[1]);
      state.startScale = state.scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - state.lastTap < 300) {
        // Double tap → reset
        state.scale = 1;
        if (containerRef.current) {
          containerRef.current.style.transform = 'scale(1)';
        }
      }
      state.lastTap = now;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    const state = stateRef.current;
    const dist = getDistance(e.touches[0], e.touches[1]);
    const newScale = Math.max(0.5, Math.min(3, state.startScale * (dist / state.startDist)));
    state.scale = newScale;
    if (containerRef.current) {
      containerRef.current.style.transform = `scale(${newScale})`;
    }
  }, []);

  return (
    <div
      style={{ overflow: 'hidden', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div
        ref={containerRef}
        style={{ transformOrigin: 'center center', transition: 'none', willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  );
}
