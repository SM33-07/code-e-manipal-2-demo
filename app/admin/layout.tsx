"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  FileText,
  BarChart3,
  LogOut,
  Radio,
  Users,
  ShieldAlert,
  X,
  Menu,
  FileCode,
  Gavel,
  FileQuestion,
  History,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const sideNav = [
  { label: "Operations Center", icon: LayoutDashboard, href: "/admin" },
  { label: "Event Control",     icon: Radio,           href: "/admin/event" },
  { label: "Problem Statements",icon: FileQuestion,    href: "/problem-statements" },
  { label: "Teams & Roster",    icon: Users,           href: "/admin/teams" },
  { label: "Submissions",       icon: FileCode,        href: "/admin/submissions" },
  { label: "Judging Operations",icon: Gavel,           href: "/admin/judging" },
  { label: "Results & Awards",  icon: Trophy,          href: "/admin/results" },
  { label: "Report & Export",   icon: FileText,        href: "/admin/report" },
  { label: "Live Analytics",    icon: BarChart3,       href: "/admin/analytics" },
  { label: "Users & Access",    icon: ShieldAlert,     href: "/admin/users" },
  { label: "Audit Log",         icon: History,         href: "/admin/audit" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user, role, loading, isAuthenticated } = useAuth();
  const [verificationTimedOut, setVerificationTimedOut] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Bounded verification safety timeout (5 seconds)
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setVerificationTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Handle automatic redirect for unauthenticated users after verification completes
  useEffect(() => {
    if (loading || hasRedirected) return;

    if (!isAuthenticated) {
      setHasRedirected(true);
      const timer = setTimeout(() => {
        router.push("/login?next=/admin&reason=session_required");
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [loading, isAuthenticated, hasRedirected, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login?logout=1");
    } catch {
      router.push("/login?logout=1");
    }
  };

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    router.push(href);
  };

  const currentSection = sideNav.find(
    (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
  )?.label || "Operations Center";

  // 1. Timed out state — provide explicit user choice rather than infinite spinner
  if (loading && verificationTimedOut) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="p-6 max-w-md w-full bg-surface-elevated border border-border rounded-2xl shadow-xl">
          <ShieldAlert size={32} className="text-secondary mx-auto mb-3" />
          <h2 className="text-base font-bold text-foreground">Verification Timed Out</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Credential verification took longer than expected. This usually occurs if your session has expired, network connectivity was interrupted, or the server is slow to respond.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => {
                setVerificationTimedOut(false);
                window.location.reload();
              }}
              className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-95 transition-opacity cursor-pointer"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl bg-secondary/15 border border-secondary/30 text-secondary hover:bg-secondary/25 transition-colors cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading state within bounded timeout
  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
        <div className="relative">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <ShieldAlert size={14} className="absolute inset-0 m-auto text-secondary" />
        </div>
        <span className="tracking-wide text-xs">Verifying administrator credentials...</span>
      </div>
    );
  }

  // 3. Unauthenticated state — session missing or expired
  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="p-6 max-w-md w-full bg-surface-elevated border border-border rounded-2xl shadow-xl">
          <ShieldAlert size={32} className="text-secondary mx-auto mb-3" />
          <h2 className="text-base font-bold text-foreground">Authentication Required</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Your administrator session is no longer active. Directing you to the secure sign-in portal...
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => router.push("/login?next=/admin&reason=session_required")}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-95 transition-opacity cursor-pointer"
            >
              Sign In to Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated but unauthorized role (e.g. participant or judge)
  if (role !== "admin") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="p-6 max-w-md w-full bg-surface-elevated border border-destructive/30 rounded-2xl shadow-xl">
          <ShieldAlert size={32} className="text-destructive mx-auto mb-3" />
          <h2 className="text-base font-bold text-foreground">Administrator Privileges Required</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Your current account ({user?.email || "User"}) is registered with role <span className="font-semibold text-foreground uppercase">{role}</span>. Access to the Operations Center is restricted to verified administrators.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => router.push(role === "judge" ? "/judge" : "/dashboard")}
              className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-95 transition-opacity cursor-pointer"
            >
              Go to {role === "judge" ? "Judging Portal" : "Team Dashboard"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl bg-surface border border-border text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-transparent text-foreground flex flex-col">
      {/* Mobile Operations Sub-bar beneath global Navbar */}
      <div className="md:hidden sticky top-16 z-30 bg-surface-elevated border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-secondary" />
          <span className="text-xs font-bold tracking-wide uppercase text-foreground truncate">
            {currentSection}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/15 border border-secondary/30 text-secondary text-xs font-semibold hover:bg-secondary/25 transition-colors cursor-pointer"
        >
          <Menu size={14} />
          <span>Operations Menu</span>
        </button>
      </div>

      {/* Workspace Body: Sidebar + Main Content */}
      <div className="flex-1 flex w-full relative">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4 flex-col shrink-0 sticky top-20 h-[calc(100vh-5rem)] z-20">
          <div className="mb-4 px-2">
            <h2 className="text-secondary font-bold tracking-widest text-[11px] uppercase opacity-90 flex items-center gap-1.5">
              Operations Navigation
            </h2>
          </div>

          <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
            {sideNav.map(({ label, icon: Icon, href }) => {
              const isActive =
                pathname === href || (href !== "/admin" && pathname.startsWith(href));
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleNavClick(href)}
                  aria-current={isActive ? "page" : undefined}
                  data-admin-nav-item
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-sm font-medium text-left cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon
                    size={17}
                    className={isActive ? "text-primary-foreground" : "text-secondary"}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-sidebar-border mt-auto">
            <div className="text-xs text-muted-foreground mb-3 px-2 truncate">
              Signed in as <strong className="text-foreground">{user?.email || "Admin"}</strong>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg border border-sidebar-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer Navigation */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 transition-opacity"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Content */}
            <div className="relative w-4/5 max-w-xs bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-full p-5 flex flex-col z-10 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-sidebar-border mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-primary" />
                  <span className="font-bold text-sm text-foreground">Admin Menu</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="text-xs text-muted-foreground mb-4 px-2 truncate">
                Signed in as <strong className="text-foreground">{user?.email || "Admin"}</strong>
              </div>

              <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
                {sideNav.map(({ label, icon: Icon, href }) => {
                  const isActive =
                    pathname === href || (href !== "/admin" && pathname.startsWith(href));
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleNavClick(href)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-lg transition-colors text-sm font-medium text-left cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={isActive ? "text-primary-foreground" : "text-secondary"}
                      />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-sidebar-border mt-auto">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Log Out of Admin</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
