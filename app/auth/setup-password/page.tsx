"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { SpecularButton } from "@/components/ui/SpecularButton";

export default function SetupPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("participant");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const processSession = async (session: any) => {
      if (!session?.user || resolvedRef.current) return;
      resolvedRef.current = true;
      if (!isMounted) return;

      const user = session.user;
      setUserEmail(user.email || null);
      setAccessToken(session.access_token || null);

      // Fetch authoritative role from profiles if available
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const role = profile?.role || user.user_metadata?.role || "participant";
        if (isMounted) setUserRole(role);
      } catch (_) {
        if (isMounted) setUserRole(user.user_metadata?.role || "participant");
      }

      if (isMounted) setSessionChecking(false);
    };

    const initAuth = async () => {
      try {
        // 1. Check for PKCE exchange code in search params (?code=...)
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get("code");
          if (code) {
            const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (!exchangeErr && data.session) {
              await processSession(data.session);
              return;
            }
          }
        }

        // 2. Check for active session
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (!sessionErr && sessionData.session) {
          await processSession(sessionData.session);
          return;
        }

        // 3. Fallback: Check hash fragment for implicit flow (#access_token=...)
        if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
          // Allow Supabase SDK to parse hash fragment
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            const { data: currentSession } = await supabase.auth.getSession();
            await processSession(currentSession?.session || { user: authData.user });
            return;
          }
        }

        // Delay slightly before declaring token invalid to allow SDK background recovery
        setTimeout(async () => {
          if (!resolvedRef.current && isMounted) {
            const { data: retrySession } = await supabase.auth.getSession();
            if (retrySession?.session) {
              await processSession(retrySession.session);
            } else {
              setError("Your password setup link is invalid, expired, or has already been used. Please request a new recovery link.");
              setSessionChecking(false);
            }
          }
        }, 1200);

      } catch (err: any) {
        if (isMounted) {
          setError("Unable to verify invitation session. Please request a new recovery link.");
          setSessionChecking(false);
        }
      }
    };

    // Listen for auth state events (e.g. PASSWORD_RECOVERY)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        await processSession(session);
      }
    });

    initAuth();

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Role-appropriate password policy:
  // Admins & Judges: min 16 characters (ADR-007); Participants: min 8 characters
  const minLength = 16;
  const requiredLength = (userRole === "admin" || userRole === "judge") ? minLength : 8;

  const hasMinLength = password.length >= requiredLength;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUpper && hasLower && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!hasMinLength) {
      triggerError(`Password must be at least ${minLength} characters in length.`);
      return;
    }
    if (!hasUpper || !hasLower || !hasNumber) {
      triggerError("Password must include uppercase, lowercase, and numeric characters.");
      return;
    }
    if (!passwordsMatch) {
      triggerError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      // Update password directly via Supabase Auth
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        triggerError(updateError.message || "Failed to update password.");
        return;
      }

      setSuccess(true);

      // Record audit event via API
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
        }

        await fetch("/api/auth/setup-password", {
          method: "POST",
          headers,
          body: JSON.stringify({ email: userEmail, role: userRole }),
        });
      } catch (_) {}

      // Redirect to appropriate dashboard after brief confirmation delay
      setTimeout(() => {
        if (userRole === "admin") {
          router.push("/admin");
        } else if (userRole === "judge") {
          router.push("/judge");
        } else {
          router.push("/dashboard");
        }
      }, 1500);
    } catch (err: any) {
      triggerError(err?.message || "An unexpected error occurred while saving your password.");
    } finally {
      setLoading(false);
    }
  };

  if (sessionChecking) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background text-muted-foreground text-sm">
        Verifying secure recovery session...
      </div>
    );
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-transparent">
      {/* Top Bar with Brand & Theme Toggle */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6">
        <BrandLogo size="md" subtitle="Security & Account Onboarding" />
        <ThemeToggle />
      </div>

      {/* Main Setup Viewport */}
      <div className="relative z-10 flex min-h-svh w-full items-center justify-center px-4 py-24 sm:px-8">
        <div
          className={clsx(
            "w-full max-w-[480px] border border-border border-l-4 border-l-primary bg-surface-elevated text-card-foreground p-6 shadow-2xl transition-all duration-200 animate-entrance sm:p-9 rounded-2xl",
            shake && "animate-shake"
          )}
        >
          {/* Header */}
          <div className="mb-6 text-left">
            <div className="mb-3 inline-flex items-center gap-2 border-b border-secondary/50 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
              <Sparkles size={13} />
              <span>Code-e-Manipal · Secure Password Setup</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Set Your Password
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {userEmail ? (
                <>Setting up credentials for <strong className="text-foreground">{userEmail}</strong> ({userRole}).</>
              ) : (
                "Choose a strong, private password for your provisioned account."
              )}
            </p>
          </div>

          {/* Success Banner */}
          {success ? (
            <div className="p-6 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center animate-entrance">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
              <h2 className="text-base font-bold text-emerald-700 dark:text-emerald-300">Password Setup Successful</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Your credentials have been securely registered. Redirecting to your {userRole} console...
              </p>
            </div>
          ) : error && !userEmail ? (
            /* Expired / Invalid Token Banner */
            <div className="p-5 rounded-xl bg-destructive/15 border border-destructive/30 text-left">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-destructive shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-destructive">Link Inactive or Expired</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{error}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <Link
                      href="/auth/forgot-password"
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Request New Reset Link
                    </Link>
                    <Link
                      href="/login"
                      className="px-4 py-2 rounded-lg bg-background hover:bg-accent border border-border text-foreground text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Return to Login
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Password Setup Form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium text-center">
                  {error}
                </div>
              )}

              {/* Password field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  New Password <span className="text-muted-foreground">(min {minLength} characters for {userRole})</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Lock size={15} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter private password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Lock size={15} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              {/* Security Requirements Checklist */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs flex flex-col gap-1.5 mt-1">
                <span className="font-semibold text-foreground mb-0.5 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-secondary" /> Policy Requirements ({userRole}):
                </span>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                  <span className={clsx(hasMinLength && "text-emerald-600 dark:text-emerald-400 font-semibold")}>
                    {hasMinLength ? "✓" : "○"} {minLength}+ characters
                  </span>
                  <span className={clsx(hasUpper && "text-emerald-600 dark:text-emerald-400 font-semibold")}>
                    {hasUpper ? "✓" : "○"} Uppercase letter
                  </span>
                  <span className={clsx(hasLower && "text-emerald-600 dark:text-emerald-400 font-semibold")}>
                    {hasLower ? "✓" : "○"} Lowercase letter
                  </span>
                  <span className={clsx(hasNumber && "text-emerald-600 dark:text-emerald-400 font-semibold")}>
                    {hasNumber ? "✓" : "○"} Number (0-9)
                  </span>
                </div>
                {confirmPassword && (
                  <div className="pt-1 text-[11px] border-t border-border mt-1">
                    <span className={clsx(passwordsMatch ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-destructive font-semibold")}>
                      {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <SpecularButton
                type="submit"
                variant="primary"
                disabled={loading || !isFormValid}
                className="w-full mt-2 py-3 cursor-pointer text-sm font-semibold flex items-center justify-center gap-2"
              >
                {loading ? "Registering Credentials..." : (
                  <>
                    <span>Complete Setup & Sign In</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </SpecularButton>

              <p className="text-[11px] text-center text-muted-foreground mt-2">
                Your password is cryptographically hashed with bcrypt by Supabase Auth and never stored in plaintext.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
