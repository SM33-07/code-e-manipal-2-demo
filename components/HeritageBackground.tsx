"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { getHeritageRouteConfig } from "@/lib/heritage/routeConfig";

/**
 * CODE-e-MANIPAL 2.0 — Heritage Background & Atmospheric Frame
 *
 * Implements Section 6, 12, 13, 14, 15, 16, 30 of the Visual Overhaul Specification.
 *
 * Requirements:
 * - Route-aware asset loading using next/image
 * - Priority only for hero routes (/ , /login , /dashboard , /results)
 * - Level C / Dense operational admin pages remain 100% solid (NO PHOTOGRAPHY)
 * - Light assets loaded exclusively in light mode; dark assets exclusively in dark mode
 * - Custom focal positioning per route
 * - Genuine opaque veil overlay, zero glassmorphism / zero blur
 */
export function HeritageBackground() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const routeConfig = getHeritageRouteConfig(pathname);

  // Level C / Solid Operational Surfaces: Strictly zero photography
  if (routeConfig.mode === "none") {
    return null;
  }

  const isDark = resolvedTheme === "dark";
  const themeConfig = isDark ? routeConfig.dark : routeConfig.light;

  if (!themeConfig || !themeConfig.asset) {
    return null;
  }

  const isHero = routeConfig.mode === "hero";
  const isLanding = pathname === "/";
  const position = themeConfig.position || "center center";
  const opacity = themeConfig.opacity ?? (isDark ? 0.45 : 0.75);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Authoritative Heritage Photographic Asset */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-in-out"
        style={{ opacity }}
      >
        <Image
          src={themeConfig.asset}
          alt=""
          fill
          priority={isHero}
          quality={75}
          sizes="100vw"
          className={isLanding ? "hero-image-settle object-cover" : "object-cover"}
          style={{ objectPosition: position }}
        />
      </div>

      {/* Atmospheric Veil Overlay (Pure Non-Sepia Gradient, Zero Glassmorphism) */}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          background: isDark
            ? isLanding
              ? "linear-gradient(90deg, rgba(21, 22, 23, 0.78) 0%, rgba(30, 28, 29, 0.52) 44%, rgba(21, 22, 23, 0.04) 100%), linear-gradient(180deg, rgba(21, 22, 23, 0.10) 0%, rgba(21, 22, 23, 0.02) 58%, rgba(21, 22, 23, 0.46) 100%)"
              : routeConfig.mode === "hero"
              ? "linear-gradient(180deg, rgba(21, 22, 23, 0.30) 0%, rgba(30, 28, 29, 0.66) 45%, rgba(21, 22, 23, 0.90) 100%)"
              : "linear-gradient(180deg, rgba(21, 22, 23, 0.56) 0%, rgba(30, 28, 29, 0.80) 50%, rgba(21, 22, 23, 0.95) 100%)"
            : isLanding
            ? "linear-gradient(90deg, rgba(244, 235, 221, 0.92) 0%, rgba(244, 235, 221, 0.70) 44%, rgba(244, 235, 221, 0.08) 100%), linear-gradient(180deg, rgba(244, 235, 221, 0.04) 0%, rgba(244, 235, 221, 0.02) 58%, rgba(244, 235, 221, 0.48) 100%)"
            : routeConfig.mode === "hero"
            ? "linear-gradient(180deg, rgba(244, 235, 221, 0.18) 0%, rgba(229, 208, 178, 0.48) 45%, rgba(244, 235, 221, 0.80) 100%)"
            : "linear-gradient(180deg, rgba(244, 235, 221, 0.34) 0%, rgba(229, 208, 178, 0.60) 50%, rgba(244, 235, 221, 0.88) 100%)",
        }}
      />
    </div>
  );
}
export default HeritageBackground;
