"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { ShieldCheck, LogOut, Menu, X, Radio } from "lucide-react";

interface AdminHeaderProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

export function AdminHeader({ mobileOpen, onToggleMobile }: AdminHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 border-b border-border bg-card text-foreground flex items-center justify-between px-4 md:px-8 shadow-sm transition-colors">
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobile}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <BrandLogo
          href="/admin"
          size="sm"
          subtitle="Event Operations & Evaluation Console"
          badge="Admin"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* User identification badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-accent/40 text-xs text-foreground">
          <ShieldCheck size={14} className="text-secondary" />
          <span className="font-medium truncate max-w-[160px]">
            {user?.email || "Admin Workspace"}
          </span>
          <span className="px-1.5 py-0.2 rounded bg-secondary/15 text-secondary text-[10px] font-bold uppercase tracking-wider">
            Admin
          </span>
        </div>

        {/* Theme switcher */}
        <ThemeToggle />

        {/* Logout (Desktop) */}
        <button
          type="button"
          onClick={handleLogout}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors cursor-pointer"
          title="Sign out of Admin Console"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
