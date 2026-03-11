"use client";

import { useEffect, useRef, type ReactNode } from "react";

type TimelineScrollProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Wraps the timeline chart container. On mobile (<768px),
 * auto-scrolls to the 18:00 area (50% of the 06–06 window).
 */
export default function TimelineScroll({ children, className }: TimelineScrollProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.innerWidth >= 768) return;

    // 18:00 is at 50% of the 24-hour window (06:00–06:00).
    // Scroll so 18:00 sits near the left edge of the viewport.
    const scrollTarget = (el.scrollWidth - el.clientWidth) * 0.55;
    el.scrollTo({ left: scrollTarget, behavior: "smooth" });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
