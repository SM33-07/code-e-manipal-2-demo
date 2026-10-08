"use client";

import React, { useEffect, useState } from "react";
import { cn } from "./utils";

interface BorderGlowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

/**
 * CODE-e-MANIPAL 2.0 — Restrained Border Glow
 *
 * Implements Level 3 visual emphasis:
 * - Subtle animated Jaipur Pink & Antique Brass boundary glow
 * - Applied exclusively to major call-to-actions and high-value status badges
 * - Pure opaque underlying container
 * - Graceful fallback under prefers-reduced-motion
 */
export function BorderGlow({
  children,
  className,
  active = true,
  ...props
}: BorderGlowProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, []);

  if (!active) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl p-[1.5px] transition-all duration-300",
        prefersReducedMotion
          ? "bg-gradient-to-r from-primary via-secondary to-primary shadow-sm"
          : "bg-[linear-gradient(90deg,var(--jaipur-primary,#B95745),var(--jaipur-secondary,#B08A45),var(--jaipur-terracotta,#A64B3E),var(--jaipur-primary,#B95745))] bg-[length:200%_auto] animate-[borderGlow_6s_linear_infinite] shadow-sm",
        className
      )}
      {...props}
    >
      <div className="rounded-[calc(1rem-1.5px)] bg-card text-card-foreground overflow-hidden">
        {children}
      </div>
    </div>
  );
}
export default BorderGlow;
