'use client';

import { useEffect, useRef } from 'react';

/** Esc 키로 닫기. 콜백이 매번 새로 만들어져도 리스너는 한 번만 단다. */
export function useEscape(onEscape?: () => void) {
  const ref = useRef(onEscape);
  useEffect(() => {
    ref.current = onEscape;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
