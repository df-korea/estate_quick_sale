'use client';

import { useRef, useState, useCallback } from 'react';

interface ViewBox { x: number; y: number; w: number; h: number }

const MAX_SCALE = 3;

export function useSvgPanZoom(baseWidth: number, baseHeight: number) {
  const initial: ViewBox = { x: 0, y: 0, w: baseWidth, h: baseHeight };
  const [viewBox, setViewBox] = useState<ViewBox>(initial);

  const touchState = useRef<{
    type: 'none' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startVB: ViewBox;
    startDist: number;
    midX: number;
    midY: number;
    lastTap: number;
  }>({ type: 'none', startX: 0, startY: 0, startVB: initial, startDist: 0, midX: 0, midY: 0, lastTap: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  const scale = baseWidth / viewBox.w;

  const clampVB = useCallback((vb: ViewBox): ViewBox => {
    const w = Math.max(baseWidth / MAX_SCALE, Math.min(baseWidth, vb.w));
    const h = w * (baseHeight / baseWidth);
    const x = Math.max(0, Math.min(baseWidth - w, vb.x));
    const y = Math.max(0, Math.min(baseHeight - h, vb.y));
    return { x, y, w, h };
  }, [baseWidth, baseHeight]);

  const screenToSvg = useCallback((clientX: number, clientY: number, vb: ViewBox): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    return [vb.x + rx * vb.w, vb.y + ry * vb.h];
  }, []);

  const dist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const ts = touchState.current;
    const vb = viewBox;

    if (e.touches.length === 2) {
      ts.type = 'pinch';
      ts.startDist = dist(e.touches[0], e.touches[1]);
      ts.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      ts.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      ts.startVB = { ...vb };
    } else if (e.touches.length === 1) {
      const scale = baseWidth / vb.w;
      const now = Date.now();

      // Double tap → reset
      if (now - ts.lastTap < 300) {
        setViewBox(initial);
        ts.type = 'none';
        ts.lastTap = 0;
        return;
      }
      ts.lastTap = now;

      if (scale > 1.05) {
        // Panning only when zoomed in
        ts.type = 'pan';
        ts.startX = e.touches[0].clientX;
        ts.startY = e.touches[0].clientY;
        ts.startVB = { ...vb };
      } else {
        ts.type = 'none';
      }
    }
  }, [viewBox, baseWidth, initial]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const ts = touchState.current;

    if (ts.type === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const newDist = dist(e.touches[0], e.touches[1]);
      const ratio = ts.startDist / newDist; // >1 = zoom out, <1 = zoom in
      const newW = Math.max(baseWidth / MAX_SCALE, Math.min(baseWidth, ts.startVB.w * ratio));
      const newH = newW * (baseHeight / baseWidth);

      // Zoom around pinch center
      const [svgMidX, svgMidY] = screenToSvg(ts.midX, ts.midY, ts.startVB);
      const scaleChange = newW / ts.startVB.w;
      const nx = svgMidX - (svgMidX - ts.startVB.x) * scaleChange;
      const ny = svgMidY - (svgMidY - ts.startVB.y) * scaleChange;

      setViewBox(clampVB({ x: nx, y: ny, w: newW, h: newH }));
    } else if (ts.type === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = (e.touches[0].clientX - ts.startX) / rect.width * ts.startVB.w;
      const dy = (e.touches[0].clientY - ts.startY) / rect.height * ts.startVB.h;
      setViewBox(clampVB({
        x: ts.startVB.x - dx,
        y: ts.startVB.y - dy,
        w: ts.startVB.w,
        h: ts.startVB.h,
      }));
    }
  }, [baseWidth, baseHeight, screenToSvg, clampVB]);

  const onTouchEnd = useCallback(() => {
    touchState.current.type = 'none';
  }, []);

  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  return {
    svgRef,
    viewBoxStr,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    scale,
    isZoomed: viewBox.w < baseWidth - 1,
  };
}
