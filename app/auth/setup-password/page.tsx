"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
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
        if (typeof window === "undefined") return;

        const searchParams = new URLSearchParams(window.location.search);
        let hashParams = new URLSearchParams();
        if (window.location.hash && window.location.hash.length > 1) {
          hashParams = new URLSearchParams(window.location.hash.substring(1));
        }

        // 1. Immediately handle explicit provider error in hash or query parameters (e.g. otp_expired)
        const urlError =
          hashParams.get("error_description") ||
          searchParams.get("error_description") ||
          hashParams.get("error") ||
          searchParams.get("error");

        if (urlError) {
          const decodedError = decodeURIComponent(urlError.replace(/\+/g, " "));
          setError(
            decodedError.includes("expired") || decodedError.includes("invalid")
              ? "Your password setup link is invalid, expired, or has already been used. Please request a new recovery link."
              : decodedError
          );
          setSessionChecking(false);
          return;
        }

        // 2. Handle implicit flow tokens in hash (#access_token=...&refresh_token=...)
        // Bypasses @supabase/ssr flowType mismatch by directly establishing session with tokens
        const accessTokenFromHash = hashParams.get("access_token");
        const refreshTokenFromHash = hashParams.get("refresh_token");

        if (accessTokenFromHash && refreshTokenFromHash) {
          try {
            const { data: setSessionData, error: setSessionErr } = await supabase.auth.setSession({
              access_token: accessTokenFromHash,
              refresh_token: refreshTokenFromHash,
            });

            if (!setSessionErr && setSessionData?.session) {
              // Strip sensitive tokens from the browser URL address bar
              window.history.replaceState(null, "", window.location.pathname);
              await processSession(setSessionData.session);
              return;
            } else if (setSessionErr) {
              setError("Your password setup link is invalid, expired, or has already been used. Please request a new recovery link.");
              setSessionChecking(false);
              return;
            }
          } catch (_) {
            // Fall through to additional session discovery methods
          }
        }

        // 3. Handle PKCE authorization code in search parameters (?code=...)
        const code = searchParams.get("code");
        if (code) {
          const { data: exchangeData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeErr && exchangeData?.session) {
            window.history.replaceState(null, "", window.location.pathname);
            await processSession(exchangeData.session);
            return;
          } else if (exchangeErr) {
            setError("Your password setup link is invalid, expired, or has already been used. Please request a new recovery link.");
            setSessionChecking(false);
            return;
          }
        }

        // 4. Handle email OTP token hash in search parameters (?token_hash=...&type=recovery)
        const tokenHash = searchParams.get("token_hash");
        const tokenType = searchParams.get("type");
        if (tokenHash && (tokenType === "recovery" || !tokenType)) {
          const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (!otpErr && otpData?.session) {
            window.history.replaceState(null, "", window.location.pathname);
            await processSession(otpData.session);
            return;
          } else if (otpErr) {
            setError("Your password setup link is invalid, expired, or has already been used. Please request a new recovery link.");
            setSessionChecking(false);
            return;
          }
        }

        // 5. Check for active session in client storage
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (!sessionErr && sessionData?.session) {
          await processSession(sessionData.session);
          return;
        }

        // Delay slightly before declaring token invalid to allow SDK background events
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
        }, 800);

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
      triggerError(`Password must be at least ${requiredLength} characters in length.`);
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

        <div className="relative z-10 w-full max-w-[500px] rounded-2xl border border-border/80 border-t-2 border-t-primary bg-card/95 text-card-foreground p-8 shadow-xl text-center">
          <div className="mx-auto mb-3.5 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Verifying secure recovery session...</p>
        </div>
      </div>
    );
  }

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
              <span>Code-e-Manipal · Account Security</span>
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
            <div className="space-y-6 animate-entrance">
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-left">
                <div className="flex items-start gap-3.5">
                  <div className="rounded-lg bg-destructive/15 p-2 text-destructive shrink-0 mt-0.5">
                    <AlertCircle size={20} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-destructive">Link Inactive or Expired</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Horizontal on tablet/desktop, stacked on mobile */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Link
                  href={userEmail ? `/auth/forgot-password?email=${encodeURIComponent(userEmail)}` : "/auth/forgot-password"}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer transition-colors shadow-sm text-center"
                >
                  Request New Reset Link
                </Link>
                <Link
                  href="/login"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-surface hover:bg-accent border border-border text-foreground text-xs font-semibold cursor-pointer transition-colors text-center"
                >
                  Return to Login
                </Link>
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
                  New Password <span className="text-muted-foreground">(min {requiredLength} characters for {userRole})</span>
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
                    {hasMinLength ? "✓" : "○"} {requiredLength}+ characters
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
