"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { SpecularButton } from "@/components/ui/SpecularButton";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

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
    <div className="relative min-h-svh overflow-hidden bg-transparent">
      {/* Top Bar with Brand & Theme Toggle */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6">
        <BrandLogo size="md" subtitle="Account Recovery" />
        <ThemeToggle />
      </div>

      {/* Main Viewport */}
      <div className="relative z-10 flex min-h-svh w-full items-center justify-center px-4 py-24 sm:px-8">
        <div
          className={clsx(
            "w-full max-w-[440px] border border-border border-l-4 border-l-primary bg-surface-elevated text-card-foreground p-6 shadow-2xl transition-all duration-200 animate-entrance sm:p-9 rounded-2xl",
            shake && "animate-shake"
          )}
        >
          {/* Header */}
          <div className="mb-6 text-left">
            <div className="mb-3 inline-flex items-center gap-2 border-b border-secondary/50 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
              <Sparkles size={13} />
              <span>Code-e-Manipal · Password Recovery</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Reset Your Password
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Enter the email address registered with your participant, judge, or admin account.
            </p>
          </div>

          {submitted ? (
            /* Success confirmation card */
            <div className="space-y-4 animate-entrance">
              <div className="p-6 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                <h2 className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                  Instructions Dispatched
                </h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  If an account exists for that email address, you'll receive instructions to reset your password. Check your inbox and spam folder.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border text-[11px] text-muted-foreground text-center">
                Can't access your registered email? Contact your team leader or the event Help Desk for verified identity assistance.
              </div>

              <Link
                href="/login"
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-card hover:bg-accent border border-border text-foreground text-xs font-semibold transition-colors"
              >
                <ArrowLeft size={14} />
                <span>Return to Login</span>
              </Link>
            </div>
          ) : (
            /* Recovery Request Form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium text-center">
                  {error}
                </div>
              )}

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-foreground">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="e.g. name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full h-11 pl-10 pr-4 text-sm bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="mt-2 w-full">
                <SpecularButton
                  type="submit"
                  disabled={loading || !email.trim()}
                  variant="primary"
                  size="md"
                  className="w-full h-11"
                >
                  <span>{loading ? "Sending Instructions..." : "Send Reset Instructions"}</span>
                  {!loading && <ArrowRight size={16} />}
                </SpecularButton>
              </div>

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
