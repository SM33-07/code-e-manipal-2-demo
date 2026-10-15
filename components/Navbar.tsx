"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { ThemeToggle } from "@/components/ThemeToggle"
import { toast } from "sonner"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { Bell, Clock, AlertCircle, Info, X, CheckCircle2 } from "lucide-react"
import { BrandLogo } from "@/components/BrandLogo"
import { getPortalNavigation, publicNavigation } from "@/lib/navigation/portal"

import {
  Navbar as ResizableNavbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar"

interface LiveNotification {
  id: string;
  content: string;
  type: "info" | "warning" | "urgent" | "success";
  link_url?: string | null;
  event_id?: string | null;
  created_at: string;
  is_read: boolean;
  read_at?: string | null;
}

export default function Navbar({ className, portal = false }: { className?: string; portal?: boolean }) {
  const { role, logout, user, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Countdown timer config & live string states
  const [timerConfig, setTimerConfig] = useState<{
    hackathon_start_time?: string;
    hackathon_duration_hours?: string;
    hackathon_is_started?: string;
    results_published?: string;
    results_publish_time?: string;
  } | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState("Not Started");
  const [resultsCountdownStr, setResultsCountdownStr] = useState<string | null>(null);
  const [team, setTeam] = useState<{ deadline_extension?: string | null } | null>(null);

  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const fetchTimer = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/event-config");
        if (res.ok) {
          const data = await res.json();
          setTimerConfig(data.data || null);
        }
      } catch (e) {
        console.error("Failed to fetch timer in navbar:", e);
      }
    };

    fetchTimer();
    // Poll every 15s matching /api/event-config s-maxage=15 cache policy
    timerId = setInterval(fetchTimer, 15000);

    const handleVisibility = () => {
      if (!document.hidden) fetchTimer();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setTeam(null);
      return;
    }

    let teamTimerId: NodeJS.Timeout;

    const fetchTeam = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/teams");
        if (res.ok) {
          const json = await res.json();
          setTeam(json.data || null);
        }
      } catch (e) {
        console.error("Failed to fetch team in navbar:", e);
      }
    };

    fetchTeam();
    teamTimerId = setInterval(fetchTeam, 30000);

    const handleTeamVisibility = () => {
      if (!document.hidden) fetchTeam();
    };
    document.addEventListener("visibilitychange", handleTeamVisibility);

    return () => {
      clearInterval(teamTimerId);
      document.removeEventListener("visibilitychange", handleTeamVisibility);
    };
  }, [user]);

  useEffect(() => {
    const updateCountdown = () => {
      if (timerConfig?.hackathon_is_started === "true" && timerConfig?.hackathon_start_time) {
        const start = new Date(timerConfig.hackathon_start_time!).getTime();
        const durationHours = parseFloat(timerConfig.hackathon_duration_hours || "48");
        const globalEnd = start + durationHours * 60 * 60 * 1000;
        
        let end = globalEnd;
        if (team && team.deadline_extension) {
          end = new Date(team.deadline_extension).getTime();
        }
        
        const remaining = end - Date.now();

        if (remaining <= 0) {
          setTimeLeftStr("Closed");
        } else {
          const secs = Math.floor((remaining / 1000) % 60);
          const mins = Math.floor((remaining / (1000 * 60)) % 60);
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          
          const pad = (num: number) => String(num).padStart(2, "0");
          setTimeLeftStr(`${hours}:${pad(mins)}:${pad(secs)}`);
        }
      } else {
        setTimeLeftStr("Not Started");
      }

      // Check Results Publishing 5-Min Countdown
      if (timerConfig?.results_published === "publishing" && timerConfig?.results_publish_time) {
        const target = new Date(timerConfig.results_publish_time).getTime();
        const diff = target - Date.now();
        if (diff <= 0) {
          setResultsCountdownStr("00:00");
        } else {
          const mins = Math.floor((diff / (1000 * 60)) % 60);
          const secs = Math.floor((diff / 1000) % 60);
          const pad = (n: number) => String(n).padStart(2, "0");
          setResultsCountdownStr(`${pad(mins)}:${pad(secs)}`);
        }
      } else if (timerConfig?.results_published === "true") {
        setResultsCountdownStr("Live");
      } else {
        setResultsCountdownStr(null);
      }
    };

    updateCountdown();
    const ticker = setInterval(updateCountdown, 1000);

    return () => clearInterval(ticker);
  }, [timerConfig, team]);

  // Live Notifications state management (Phase 2 Requirement F)
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingNotifs(true);
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const json = await res.json();
        const items: LiveNotification[] = json.data?.notifications || [];
        setNotifications(items);
        setUnreadCount(json.data?.unreadCount || 0);
      }
    } catch (err) {
      // Retain existing state on transient error
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();

    // Controlled polling (15s)
    const interval = setInterval(fetchNotifications, 15000);

    // Sleep/tab wake-up and network reconnection catch-up
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    const handleOnline = () => fetchNotifications();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [isAuthenticated]);

  const handleMarkAllRead = async () => {
    try {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      toast.success("All notifications marked as read.");
    } catch (err) {
      toast.error("Failed to mark notifications as read.");
    }
  };

  const handleNotificationClick = async (notif: LiveNotification) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement_id: notif.id }),
      }).catch(() => {});
    }

    if (notif.link_url) {
      setNotifsOpen(false);
      setSheetOpen(false);
      router.push(notif.link_url);
    }
  };

  const formatNotifTime = (iso: string) => {
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return "Recently";
    }
  };

  const getNotifIconAndTitle = (type: string) => {
    switch (type) {
      case "urgent":
        return { Icon: AlertCircle, title: "Urgent Alert" };
      case "warning":
        return { Icon: Clock, title: "Deadline Notice" };
      case "success":
        return { Icon: CheckCircle2, title: "Update" };
      default:
        return { Icon: Info, title: "Announcement" };
    }
  };

  const hasUnread = unreadCount > 0;

  const handleViewAllNotifications = () => {
    setNotifsOpen(false);
    setSheetOpen(true);
  };

  // Close menus when route changes
  useEffect(() => {
    setMenuOpen(false)
    setMobileNavOpen(false)
    setSheetOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const mobileLinkClass = (path: string) => {
    const isActive = pathname === path || (path !== "/" && !!pathname?.startsWith(path))
    return isActive
      ? "block py-3 px-4 text-primary font-semibold bg-primary/10 rounded-lg text-center"
      : "block py-3 px-4 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors duration-200 text-center font-medium"
  }

  if (pathname === "/login") return null

  // A public visit always receives public navigation, even when an existing
  // session is present. The portal shell explicitly opts into role-aware links.
  const navItems = portal ? getPortalNavigation(role) : publicNavigation

  const isSubmissionForm = pathname?.startsWith("/submit") || pathname?.startsWith("/SubmissionForm")

  return (
    <ResizableNavbar isSubmissionForm={isSubmissionForm} className={className}>
      {/* ── Desktop Navigation ── */}
      <NavBody>
        {/* Brand / Logo Region with deterministic boundary */}
        <div className="flex items-center shrink-0 min-w-max mr-3 xl:mr-6">
          <BrandLogo size="md" />
        </div>

        {/* Dynamic Navigation Links Region */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-1 xl:px-3">
          <NavItems items={navItems} pathname={pathname} />
        </div>

        {/* Desktop Actions Region */}
        <div className="flex items-center gap-2 xl:gap-3 shrink-0 min-w-max ml-3 xl:ml-6 z-20">
          {/* Role Badge */}
          {portal && role && (
            <span className="hidden xl:inline-block text-xs px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary font-medium capitalize">
              {role}
            </span>
          )}

          {/* Hackathon Timer */}
          {portal && timerConfig && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/60 border border-border text-xs font-mono font-bold text-secondary">
              <span className={timeLeftStr !== "Not Started" && timeLeftStr !== "Closed" ? "animate-pulse" : ""}>⏳</span>
              <span>{timeLeftStr}</span>
            </div>
          )}

          {/* Results Publishing Countdown Pill */}
          {portal && resultsCountdownStr && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-jaipur-primary/20 border border-jaipur-primary/40 text-xs font-mono font-bold text-jaipur-gold animate-pulse shadow-sm">
              <span>🏆 Results: {resultsCountdownStr}</span>
            </div>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications Dropdown */}
          {portal && <div className="relative">
            <button
              onClick={() => {
                setNotifsOpen(!notifsOpen);
                if (menuOpen) setMenuOpen(false);
              }}
              className="relative p-1.5 rounded-lg hover:bg-accent transition-colors focus:outline-none cursor-pointer flex items-center justify-center"
            >
              <Bell size={isSubmissionForm ? 24 : 20} className="text-muted-foreground transition-all duration-300" />
              {hasUnread && (
                <div className={`absolute rounded-full bg-primary transition-all duration-300 ${isSubmissionForm ? "top-1 right-2.5 w-2.5 h-2.5" : "top-1 right-1.5 w-2 h-2"}`} />
              )}
            </button>

            <AnimatePresence>
              {notifsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{ backgroundColor: "var(--background)", transform: "translateZ(0)" }}
                  className="absolute right-0 mt-3 w-80 border border-jaipur-gold/30 rounded-xl shadow-xl overflow-hidden z-50 isolate"
                >
                  <div className="px-4 py-3 border-b border-jaipur-gold/20 flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">Notifications</span>
                    <button 
                      onClick={handleMarkAllRead}
                      className="text-xs text-jaipur-primary cursor-pointer hover:underline bg-transparent border-none p-0 focus:outline-none"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {loadingNotifs && notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        Loading notifications...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        No notifications yet. Check back soon!
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const { Icon, title } = getNotifIconAndTitle(notif.type);
                        const isRead = notif.is_read;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`px-4 py-3 border-b border-jaipur-gold/10 hover:bg-jaipur-secondary/50 transition-colors cursor-pointer flex gap-3 ${
                              isRead ? "opacity-50" : ""
                            }`}
                          >
                            <div
                              className={`mt-0.5 p-2 rounded-full h-fit shrink-0 ${
                                isRead
                                  ? "bg-muted text-muted-foreground"
                                  : notif.type === "urgent"
                                  ? "bg-jaipur-pink/20 text-jaipur-pink"
                                  : notif.type === "warning"
                                  ? "bg-jaipur-primary/20 text-jaipur-primary"
                                  : "bg-jaipur-gold/20 text-jaipur-gold"
                              }`}
                            >
                              <Icon size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h4
                                  className={`text-sm font-medium leading-none truncate ${
                                    isRead ? "text-muted-foreground" : "text-foreground"
                                  }`}
                                >
                                  {title}
                                </h4>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                  {formatNotifTime(notif.created_at)}
                                </span>
                              </div>
                              <p
                                className={`text-xs mt-1 leading-snug break-words ${
                                  isRead ? "text-muted-foreground/80" : "text-muted-foreground"
                                }`}
                              >
                                {notif.content}
                              </p>
                              {notif.link_url && (
                                <span className="inline-block mt-1 text-[10px] text-jaipur-primary font-medium underline">
                                  View details &rarr;
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="px-4 py-2 bg-jaipur-secondary/30 text-center">
                    <button 
                      onClick={handleViewAllNotifications}
                      className="text-xs text-jaipur-primary cursor-pointer hover:underline bg-transparent border-none p-0 focus:outline-none"
                    >
                      View all notifications
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>}

          {/* User Auth / Enter Console CTA */}
          {!portal || !isAuthenticated ? (
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-95 transition-opacity"
            >
              Enter Console
            </Link>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(!menuOpen);
                  if (notifsOpen) setNotifsOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-secondary/15 text-secondary border border-secondary/30 flex items-center justify-center font-bold text-sm shadow-sm focus:outline-none cursor-pointer"
              >
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    style={{ backgroundColor: "var(--background)", transform: "translateZ(0)" }}
                    className="absolute right-0 mt-3 w-48 border border-border bg-card rounded-xl shadow-xl overflow-hidden z-50 isolate"
                  >
                    <div className="px-4 py-3 border-b border-border text-xs text-muted-foreground truncate">
                      {user?.email}
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      Account
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-destructive font-medium hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </NavBody>

      {/* ── Mobile Navigation ── */}
      <MobileNav>
        <MobileNavHeader>
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2.5">
            {portal && timerConfig && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/60 border border-border text-[10px] font-mono font-bold text-secondary">
                <span className={timeLeftStr !== "Not Started" && timeLeftStr !== "Closed" ? "animate-pulse" : ""}>⏳</span>
                <span>{timeLeftStr}</span>
              </div>
            )}
            <ThemeToggle />
            <MobileNavToggle
              isOpen={mobileNavOpen}
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            />
          </div>
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          className="border border-border bg-card shadow-2xl"
        >
          {navItems.map((item) => (
            <Link
              key={item.link}
              href={item.link}
              onClick={() => setMobileNavOpen(false)}
              className={mobileLinkClass(item.link)}
            >
              {item.name}
            </Link>
          ))}
          
          <div className="flex w-full flex-col gap-3 pt-4 border-t border-border items-center">
            {portal && isAuthenticated ? (
              <>
                {role && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary font-medium capitalize">
                    Role: {role}
                  </span>
                )}
                {user?.email && (
                  <span className="text-xs text-muted-foreground truncate max-w-full">
                    {user.email}
                  </span>
                )}
                <Link
                  href="/account"
                  onClick={() => setMobileNavOpen(false)}
                  className="w-full py-2.5 rounded-lg border border-border text-center text-sm font-semibold text-foreground hover:bg-accent transition-colors"
                >
                  Account
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 text-destructive font-semibold text-sm transition duration-200 cursor-pointer"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileNavOpen(false)}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition duration-200 text-center"
              >
                Enter Hackathon Console
              </Link>
            )}
          </div>
        </MobileNavMenu>
      </MobileNav>

      {/* ── Side Notifications Sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 bg-black/60 z-[90]"
            />

            {/* Slide-out Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{ backgroundColor: "var(--background)", transform: "translateZ(0)" }}
              className="fixed inset-y-0 right-0 w-full max-w-md shadow-2xl z-[100] border-l border-jaipur-gold/20 flex flex-col h-screen isolate"
            >
              {/* Header */}
              <div className="p-6 border-b border-jaipur-gold/20 flex justify-between items-center bg-card/10">
                <div className="text-left">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Bell className="text-jaipur-primary" />
                    All Notifications
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Stay updated on Code-e-Manipal 2.0 hackathon events
                  </p>
                </div>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="p-1.5 rounded-full hover:bg-jaipur-secondary/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-6" />
                </button>
              </div>

              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-jaipur-gold/10 bg-jaipur-secondary/20 flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">
                  {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
                </span>
                <button
                  onClick={handleMarkAllRead}
                  disabled={!hasUnread}
                  className="text-xs text-jaipur-primary font-semibold hover:underline disabled:opacity-40 disabled:no-underline bg-transparent border-none cursor-pointer p-0"
                >
                  Mark all as read
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {notifications.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="p-4 bg-jaipur-secondary/20 rounded-full">
                      <Bell size={28} className="text-muted-foreground/60" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">All caught up!</p>
                      <p className="text-xs text-muted-foreground">You have no new notifications.</p>
                    </div>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const { Icon, title } = getNotifIconAndTitle(notif.type);
                    const isRead = notif.is_read;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 rounded-xl border transition-all duration-300 relative flex gap-4 text-left cursor-pointer ${
                          isRead
                            ? "bg-transparent border-jaipur-gold/10 opacity-60"
                            : "bg-jaipur-secondary/10 border-jaipur-primary/20 shadow-sm"
                        }`}
                      >
                        {/* Type Icon indicator */}
                        <div className={`p-2.5 rounded-full h-fit flex-shrink-0 ${
                          isRead 
                            ? "bg-muted text-muted-foreground/60"
                            : notif.type === 'urgent' 
                            ? 'bg-jaipur-pink/20 text-jaipur-pink' 
                            : notif.type === 'warning' 
                            ? 'bg-jaipur-primary/20 text-jaipur-primary' 
                            : 'bg-jaipur-gold/20 text-jaipur-gold'
                        }`}>
                          <Icon size={18} />
                        </div>

                        {/* Details */}
                        <div className="space-y-1 flex-1">
                          <div className="flex justify-between items-baseline gap-2">
                            <h4 className={`text-sm font-semibold leading-tight ${isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatNotifTime(notif.created_at)}</span>
                          </div>
                          <p className={`text-xs leading-relaxed ${isRead ? 'text-muted-foreground/80' : 'text-muted-foreground'}`}>
                            {notif.content}
                          </p>
                          {notif.link_url && (
                            <span className="inline-block mt-1 text-[10px] text-jaipur-primary font-medium underline">
                              View details &rarr;
                            </span>
                          )}
                          
                          {/* Visual Unread Accent Dot */}
                          {!isRead && (
                            <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-jaipur-primary" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-jaipur-gold/20 bg-card/10 text-center">
                <button
                  onClick={async () => {
                    await handleMarkAllRead();
                    setNotifications([]);
                  }}
                  disabled={notifications.length === 0}
                  className="w-full py-2.5 rounded-xl border border-jaipur-gold/30 hover:bg-jaipur-primary/10 hover:text-jaipur-primary text-sm font-semibold text-muted-foreground transition duration-200 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                >
                  Clear All Notifications
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ResizableNavbar>
  )
}
