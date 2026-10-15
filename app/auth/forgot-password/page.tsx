"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles, ShieldAlert, KeyRound, HelpCircle, Mail, Phone } from "lucide-react";
import clsx from "clsx";
import { SpecularButton } from "@/components/ui/SpecularButton";

const VERIFIED_ORGANISERS = [
  {
    name: "Yash Sahai (Convener)",
    email: "yashsrivastava3745@gmail.com",
    phone: "+91 8707877673",
  },
  {
    name: "Abhinav Aryan (Convener)",
    email: "abhinav.ong@gmail.com",
    phone: "+91 9031190278",
  },
  {
    name: "Soham More (Tech Lead)",
    email: "sohammore3312@gmail.com",
    phone: "+91 8928500841",
  },
];

export default function ForgotPasswordPage() {
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
            "w-full rounded-2xl border border-border/80 border-t-2 border-t-primary bg-card/95 text-card-foreground p-6 shadow-xl shadow-black/5 dark:shadow-black/30 backdrop-blur-sm transition-all duration-200 animate-entrance sm:p-8"
          )}
        >
          {/* Card Header */}
          <div className="mb-6 text-left">
            <div className="mb-2.5 inline-flex items-center gap-1.5 border-b border-secondary/40 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
              <Sparkles size={12} className="text-secondary" />
              <span>Code-e-Manipal · Account Assistance</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Forgot your passcode?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your team login uses an event-issued passcode. If you&apos;ve forgotten it, please contact your team coordinator or an event administrator to have it reset.
            </p>
          </div>

          {/* Security Note Box */}
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Security note: Only authorized event administrators can reset participant passcodes.
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Automated self-service password reset is disabled to ensure badge integrity and prevent unauthorized roster takeovers during the hackathon.
                </p>
              </div>
            </div>
          </div>

          {/* How to recover step-by-step guidance */}
          <div className="space-y-3 mb-6 text-left">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border">
              <KeyRound size={16} className="text-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-foreground">In-Person Help Desk:</span>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  Visit the Technical Help Desk at the Manipal University Jaipur venue. Provide your Team ID (e.g., TEAM-042) and leader registration proof for an immediate, audited passcode reset.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border">
              <HelpCircle size={16} className="text-secondary shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-foreground">Coordinator Contacts:</span>
                <div className="mt-2 space-y-2">
                  {VERIFIED_ORGANISERS.map((org) => (
                    <div key={org.email} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] bg-background/80 p-2 rounded-lg border border-border/60">
                      <span className="font-medium text-foreground">{org.name}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <a href={`mailto:${org.email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                          <Mail size={12} className="text-secondary" />
                          <span>{org.email}</span>
                        </a>
                        <a href={`tel:${org.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                          <Phone size={12} className="text-secondary" />
                          <span>{org.phone}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actions: Back to login & FAQ */}
          <div className="pt-2 flex flex-col gap-3">
            <Link href="/login" className="w-full">
              <SpecularButton
                type="button"
                variant="primary"
                className="w-full py-2.5 cursor-pointer text-sm font-semibold flex items-center justify-center gap-2"
              >
                <ArrowLeft size={15} />
                <span>Return to Login</span>
              </SpecularButton>
            </Link>

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
                View FAQ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
