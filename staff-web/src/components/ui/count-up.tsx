"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated number ticker. Counts from 0 to `value` on mount with easeOutCubic.
 * SSR + first hydration render 0 (no mismatch), then the effect animates.
 * Respects prefers-reduced-motion by jumping straight to the final value.
 */
export function CountUp({
  value,
  format = (v) => String(Math.round(v)),
  duration = 900,
  className
}: {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    let start: number | undefined;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      if (start === undefined) start = now;
      const t = Math.min(1, (now - start) / duration);
      setDisplay(value * ease(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
