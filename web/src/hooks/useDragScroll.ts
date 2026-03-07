'use client';

import { useRef, useEffect, useCallback } from 'react';

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onDown = (e: MouseEvent) => {
      state.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
      el.classList.add('drag-scroll', 'dragging');
    };
    const onMove = (e: MouseEvent) => {
      if (!state.current.isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = x - state.current.startX;
      if (Math.abs(walk) > 5) state.current.moved = true;
      el.scrollLeft = state.current.scrollLeft - walk;
    };
    const onUp = () => {
      if (!state.current.isDown) return;
      state.current.isDown = false;
      el.classList.remove('dragging');
    };
    const onClick = (e: MouseEvent) => {
      if (state.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        state.current.moved = false;
      }
    };

    el.classList.add('drag-scroll');
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('click', onClick, true);

    return () => {
      el.classList.remove('drag-scroll', 'dragging');
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('click', onClick, true);
    };
  }, []);

  const setRef = useCallback((node: T | null) => {
    ref.current = node;
  }, []);

  return { ref, setRef };
}
