"use client";

import React, { useRef, useState, useEffect } from "react";
import { cn } from "./utils";

interface SpecularButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "brass";
  size?: "sm" | "md" | "lg";
  className?: string;
  asChild?: boolean;
}

/**
 * CODE-e-MANIPAL 2.0 — Specular-Style Dimensional Button
 *
 * Implements Level 4 major CTA treatment:
 * - Lightweight CSS-based directional sheen and specular reflection
 * - Zero WebGL / OGL dependencies
 * - Solid opaque reflective highlight
 * - Antique Brass & Jaipur Pink bevel styling
 * - Full keyboard accessibility and focus-visible states
 */
export const SpecularButton = React.forwardRef<HTMLButtonElement, SpecularButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [mouseOffset, setMouseOffset] = useState<number | null>(null);
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

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (prefersReducedMotion || disabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeX = (e.clientX - rect.left) / rect.width;
      setMouseOffset(Math.round(relativeX * 100));
    };

    const handleMouseLeave = () => {
      setMouseOffset(null);
    };

    const sizeClasses = {
      sm: "px-3.5 py-1.5 text-xs font-semibold rounded-lg gap-1.5",
      md: "px-5 py-2.5 text-sm font-bold rounded-xl gap-2",
      lg: "px-7 py-3 text-base font-extrabold rounded-2xl gap-2.5",
    };

    const variantClasses = {
      primary:
        "bg-primary text-primary-foreground border border-primary/50 shadow-[0_4px_16px_rgba(185,87,69,0.25)] hover:shadow-[0_6px_20px_rgba(185,87,69,0.35)]",
      secondary:
        "bg-card text-foreground border border-border shadow-xs hover:border-secondary/60 hover:bg-accent/40",
      brass:
        "bg-secondary text-secondary-foreground border border-secondary/60 shadow-[0_4px_16px_rgba(176,138,69,0.25)] hover:shadow-[0_6px_20px_rgba(176,138,69,0.35)]",
    };

    return (
      <button
        ref={(node) => {
          buttonRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        className={cn(
          "relative inline-flex items-center justify-center select-none overflow-hidden transition-all duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {/* Specular Reflective Light Sweep */}
        {!prefersReducedMotion && !disabled && (
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover:opacity-100"
            style={{
              opacity: mouseOffset !== null ? 1 : 0,
              background: `linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.22) ${
                mouseOffset ?? 50
              }%, transparent 100%)`,
            }}
            aria-hidden="true"
          />
        )}

        {/* Top Edge Bevel Highlight */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/25"
          aria-hidden="true"
        />

        {/* Content */}
        <span className="relative z-10 inline-flex items-center gap-inherit">
          {children}
        </span>
      </button>
    );
  }
);

SpecularButton.displayName = "SpecularButton";
export default SpecularButton;
