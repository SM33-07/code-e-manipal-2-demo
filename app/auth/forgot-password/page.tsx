"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { SpecularButton } from "@/components/ui/SpecularButton";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) {
        setEmail(emailParam);
      }
    }
  }, []);

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      triggerError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok && res.status !== 429) {
        throw new Error(data.error || "Failed to process recovery request.");
      }

      if (res.status === 429) {
        triggerError("Too many attempts. Please wait a few minutes before trying again.");
        return;
      }

      setSubmitted(true);
    } catch (err: any) {
      triggerError(err.message || "An unexpected error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100svh-6rem)] w-full flex items-center justify-center px-4 py-8 sm:px-6">
      {/* Full-Page Background: Jaipur Heritage Architectural Entrance */}
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-cover bg-center bg-no-repeat bg-[url('/images/heritage/light/14-city-palace-ornate-hall.webp')] dark:bg-[url('/images/heritage/dark/03-sheesh-mahal-corridor.webp')] opacity-80 dark:opacity-45 transition-opacity duration-700"
        style={{
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
        aria-hidden="true"
      />

      {/* Atmospheric Theme-Adaptive Overlay (Warm Cream in Light, Neutral Charcoal in Dark) */}
      <div
        className="fixed inset-0 z-0 pointer-events-none transition-colors duration-500 bg-gradient-to-b from-background/75 via-background/88 to-background/95 dark:from-background/80 dark:via-background/92 dark:to-background/98"
        aria-hidden="true"
      />

      {/* Centered Authentication Card */}
      <div className="relative z-10 w-full max-w-[500px]">
        <div
          className={clsx(
            "w-full rounded-2xl border border-border/80 border-t-2 border-t-primary bg-card/95 text-card-foreground p-6 shadow-xl shadow-black/5 dark:shadow-black/30 backdrop-blur-sm transition-all duration-200 animate-entrance sm:p-8",
            shake && "animate-shake"
          )}
        >
          {/* Card Header */}
          <div className="mb-6 text-left">
            <div className="mb-2.5 inline-flex items-center gap-1.5 border-b border-secondary/40 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
              <Sparkles size={12} className="text-secondary" />
              <span>Code-e-Manipal · Account Recovery</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Reset Your Password
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Enter your registered email address to receive password setup instructions.
            </p>
          </div>

          {submitted ? (
            /* Success confirmation card */
            <div className="space-y-5 animate-entrance">
              <div className="p-6 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
                <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2.5" />
                <h2 className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                  Instructions Dispatched
                </h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  If an account exists for <strong className="text-foreground">{email}</strong>, you will receive password reset instructions. Please check your inbox and spam folder.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground text-center leading-relaxed">
                Can't access your registered email? Contact your team leader or the event Help Desk for verified identity assistance.
              </div>

              {/* Action Buttons: Responsive row on sm+, stacked on mobile */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Link
                  href="/login"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer transition-colors shadow-sm text-center"
                >
                  Return to Login
                </Link>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); }}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-surface hover:bg-accent border border-border text-foreground text-xs font-semibold cursor-pointer transition-colors text-center"
                >
                  Try Another Email
                </button>
              </div>
            </div>
          ) : (
            /* Recovery Request Form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium text-center">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-foreground">
                  Registered Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Mail size={15} />
                  </div>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="e.g. name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              <SpecularButton
                type="submit"
                variant="primary"
                disabled={loading || !email.trim()}
                className="w-full mt-2 py-3 cursor-pointer text-sm font-semibold flex items-center justify-center gap-2"
              >
                <span>{loading ? "Sending Instructions..." : "Send Reset Instructions"}</span>
                {!loading && <ArrowRight size={15} />}
              </SpecularButton>

              <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Login</span>
                </Link>
                <Link
                  href="/faq"
                  className="hover:text-secondary transition-colors font-medium"
                >
                  Help Desk
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
