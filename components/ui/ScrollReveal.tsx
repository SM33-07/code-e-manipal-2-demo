"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

export function ScrollReveal({
  children,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"ready" | "visible">("visible");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      setState("visible");
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setState("visible");
      return;
    }

    const bounds = node.getBoundingClientRect();
    if (bounds.top < window.innerHeight && bounds.bottom > 0) {
      setState("visible");
      return;
    }

    setState("ready");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={state}
      className={`scroll-reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
