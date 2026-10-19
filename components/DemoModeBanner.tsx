"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Code2,
  Calendar,
  Trophy,
  Info,
  Sparkles
} from "lucide-react";
import { isDemoMode } from "@/lib/demo/demoMode";

interface DemoModeBannerProps {
  onHeightChange?: (height: number) => void;
}

export function DemoModeBanner({ onHeightChange }: DemoModeBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const bannerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    // Remember user preference in sessionStorage if available
    try {
      const stored = sessionStorage.getItem("cem_demo_banner_minimized");
      if (stored === "true") setMinimized(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted || !isDemoMode()) {
      onHeightChange?.(0);
      document.documentElement.style.setProperty("--demo-banner-height", "0px");
      return;
    }

    const updateHeight = () => {
      if (bannerRef.current) {
        const height = Math.round(bannerRef.current.getBoundingClientRect().height);
        onHeightChange?.(height);
        document.documentElement.style.setProperty("--demo-banner-height", `${height}px`);
      }
    };

    updateHeight();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && bannerRef.current) {
      ro = new ResizeObserver(() => {
        updateHeight();
      });
      ro.observe(bannerRef.current);
    }

    window.addEventListener("resize", updateHeight);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateHeight);
      onHeightChange?.(0);
      document.documentElement.style.setProperty("--demo-banner-height", "0px");
    };
  }, [mounted, minimized, onHeightChange]);

  if (!mounted || !isDemoMode()) return null;

  const toggleMinimized = () => {
    const next = !minimized;
    setMinimized(next);
    try {
      sessionStorage.setItem("cem_demo_banner_minimized", String(next));
    } catch {}
  };

  return (
    <aside
      ref={bannerRef}
      aria-label="Public Demo Mode Announcement"
      className="fixed top-0 inset-x-0 z-40 w-full border-b border-emerald-500/30 bg-emerald-950/90 text-emerald-100 backdrop-blur-md shadow-sm transition-all duration-300 dark:border-emerald-500/20 dark:bg-emerald-950/95"
    >
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Badge & Header */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Public Demo · Read Only
            </span>

            <p className="truncate text-xs font-semibold text-emerald-100 sm:text-sm">
              <span className="hidden sm:inline font-bold text-white">Code-e-Manipal 2.0</span>
              <span className="hidden sm:inline text-emerald-400/80 mx-1.5">/</span>
              <span>Architectural Showcase</span>
            </p>
          </div>

          {/* Quick Action Navigation Pills */}
          <div className="flex items-center gap-2">
            {!minimized && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs">
                <Link
                  href="/demo"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
                    pathname?.startsWith("/demo")
                      ? "border-emerald-300 bg-emerald-400/25 text-white font-bold shadow-sm"
                      : "border-emerald-500/30 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200"
                  }`}
                >
                  <Sparkles size={12} className="text-emerald-300" />
                  <span>Portal Demo</span>
                </Link>

                <Link
                  href="/problem-statements"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
                    pathname?.startsWith("/problem-statements")
                      ? "border-emerald-300 bg-emerald-400/20 text-white font-bold"
                      : "border-emerald-500/30 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200"
                  }`}
                >
                  <Code2 size={12} className="text-emerald-300" />
                  <span>35 Challenges</span>
                </Link>

                <Link
                  href="/timeline"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
                    pathname === "/timeline"
                      ? "border-emerald-300 bg-emerald-400/20 text-white font-bold"
                      : "border-emerald-500/30 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200"
                  }`}
                >
                  <Calendar size={12} className="text-emerald-300" />
                  <span>Timeline</span>
                </Link>

                <Link
                  href="/results"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
                    pathname === "/results"
                      ? "border-emerald-300 bg-emerald-400/20 text-white font-bold"
                      : "border-emerald-500/30 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200"
                  }`}
                >
                  <Trophy size={12} className="text-emerald-300" />
                  <span>Results</span>
                </Link>
              </div>
            )}

            {/* Minimize / Expand Toggle */}
            <button
              type="button"
              onClick={toggleMinimized}
              aria-expanded={!minimized}
              aria-label={minimized ? "Expand demo details" : "Collapse demo details"}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-900/60 px-2 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-800/70 hover:text-white transition-colors cursor-pointer"
            >
              <span>{minimized ? "Show details" : "Hide"}</span>
              {minimized ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
          </div>
        </div>

        {/* Expanded Description Details */}
        {!minimized && (
          <div className="mt-2 pt-2 border-t border-emerald-500/20 text-[11px] sm:text-xs text-emerald-200/90 leading-relaxed flex flex-col md:flex-row md:items-center justify-between gap-2">
            <p className="max-w-4xl">
              <span className="font-semibold text-white">Public Portfolio Deployment:</span> Real-time data mutations, participant sign-in, and background cron jobs are disabled. You are viewing verified synthetic showcase data, versioned challenge releases, and jury rubric scores without connecting to production databases.
            </p>
            <div className="flex items-center gap-3 shrink-0 text-[11px]">
              <span className="text-emerald-400">Isolated Data Mode: Active</span>
              <span className="text-emerald-500">·</span>
              <span className="text-emerald-400">Zero Mutations: Enforced</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
