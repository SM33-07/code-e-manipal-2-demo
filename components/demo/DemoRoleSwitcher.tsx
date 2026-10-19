"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Award,
  ShieldAlert,
  Sparkles,
  ArrowLeft,
  LayoutDashboard,
  CheckCircle2,
  Info
} from "lucide-react";

interface DemoRoleSwitcherProps {
  currentRole: "hub" | "participant" | "judge" | "admin";
}

export function DemoRoleSwitcher({ currentRole }: DemoRoleSwitcherProps) {
  const pathname = usePathname();

  const roles = [
    {
      id: "hub",
      label: "Demo Hub",
      href: "/demo",
      icon: LayoutDashboard,
      activeColor: "border-primary bg-primary/20 text-foreground",
    },
    {
      id: "participant",
      label: "Participant Demo",
      href: "/demo/participant",
      icon: Users,
      activeColor: "border-primary bg-primary/20 text-foreground",
    },
    {
      id: "judge",
      label: "Judge Demo",
      href: "/demo/judge",
      icon: Award,
      activeColor: "border-secondary bg-secondary/20 text-foreground",
    },
    {
      id: "admin",
      label: "Admin Demo",
      href: "/demo/admin",
      icon: ShieldAlert,
      activeColor: "border-jaipur-pink bg-jaipur-pink/20 text-foreground",
    },
  ];

  return (
    <div className="w-full border-b border-border bg-surface-elevated/95 backdrop-blur-md sticky top-[var(--demo-banner-height,0px)] z-30 shadow-sm transition-all duration-200">
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Role Navigation Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mr-1"
              title="Return to Main Showcase"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Exit Demo</span>
            </Link>

            <span className="text-border mx-0.5 hidden sm:inline" aria-hidden="true">|</span>

            {roles.map((r) => {
              const Icon = r.icon;
              const isActive =
                r.id === "hub"
                  ? pathname === "/demo"
                  : pathname?.startsWith(r.href);

              return (
                <Link
                  key={r.id}
                  href={r.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    isActive
                      ? `${r.activeColor} font-bold shadow-sm ring-1 ring-border`
                      : "border-border/60 bg-surface/70 text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-primary" : "text-muted-foreground"} />
                  <span>{r.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right: Isolation & Safety Badge */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SYNTHETIC · READ-ONLY
            </span>
            <span className="hidden md:inline text-border">|</span>
            <span className="hidden md:inline">Zero Backend Persistence</span>
          </div>
        </div>
      </div>
    </div>
  );
}
