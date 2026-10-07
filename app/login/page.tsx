"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";

import { SpecularButton } from "@/components/ui/SpecularButton";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const cleanIdentifier = identifier.trim();
      const authResult = await login(cleanIdentifier, password);
      const userRole = authResult?.role || "participant";

      const searchParams = new URLSearchParams(window.location.search);
      const requestedNextUrl = searchParams.get("next");
      const nextUrl = requestedNextUrl?.startsWith("/")
        ? new URL(requestedNextUrl, window.location.origin)
        : null;

      if (nextUrl?.origin === window.location.origin) {
        router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      } else if (userRole === "admin") {
        router.push("/admin");
      } else if (userRole === "judge") {
        router.push("/judge");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      triggerError(err?.message || "Login failed. Please verify your ID and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-transparent">
      {/* Subtle directional vignette veil for right-docked login card contrast */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/15 via-background/55 to-background/90 dark:from-background/20 dark:via-background/65 dark:to-background/95" />

      {/* Top Bar with Brand & Theme Toggle */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6">
        <BrandLogo size="md" subtitle="Technical Hackathon Console" />
        <ThemeToggle />
      </div>

      {/* Main Login Viewport */}
      <div className="relative z-10 flex min-h-svh w-full items-center justify-center px-4 py-24 sm:px-8 lg:justify-end lg:px-[10vw]">
        <div
          className={clsx(
            "w-full max-w-[440px] border border-border border-l-4 border-l-primary bg-surface-elevated text-card-foreground p-6 shadow-xl transition-all duration-200 animate-entrance sm:p-9",
            shake && "animate-shake"
          )}
        >
          {/* Header */}
          <div className="mb-6 text-left">
          <div className="mb-4 inline-flex items-center gap-2 border-b border-secondary/50 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            <Sparkles size={13} />
            <span>Code-e-Manipal · Secure portal</span>
            </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sign in to build.
            </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Use your provisioned participant, judge, or administrator credentials.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium text-center">
                {error}
              </div>
            )}

            {/* Identifier input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-foreground">
                User ID / Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="e.g. TEAM-001 or judge identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.toLowerCase())}
                  required
                  className="w-full h-11 pl-10 pr-4 text-sm bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-11 text-sm bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Helper pill */}
            <div className="p-2.5 rounded-xl bg-accent/40 border border-border text-[11px] text-muted-foreground leading-snug">
              Credentials provisioned by Organizing Committee: Team Leaders use team ID, Judges use assigned judge badge ID.
            </div>

            {/* Remember me & Venue Help Desk */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
                />
                <span>Remember session</span>
              </label>
              <Link
                href="/faq"
                className="text-muted-foreground hover:text-secondary transition-colors font-medium"
              >
                Need help?
              </Link>
            </div>

            {/* Submit Button */}
            <div className="mt-2 w-full">
              <SpecularButton
                type="submit"
                disabled={loading}
                variant="primary"
                size="md"
                className="w-full h-11"
              >
                <span>{loading ? "Authenticating..." : "Access Console"}</span>
                {!loading && <ArrowRight size={16} />}
              </SpecularButton>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
