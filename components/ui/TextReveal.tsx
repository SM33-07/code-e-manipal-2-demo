"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

export function TextReveal({ children, as: Tag = "div", className = "" }: { children: ReactNode; as?: ElementType; className?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReady(true);
    if (reduced.matches) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.15 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <Tag ref={ref} data-reveal-ready={ready || undefined} className={`text-reveal ${visible ? "text-reveal--visible" : ""} ${className}`}>{children}</Tag>;
}
