"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { ThemeToggle } from "@/components/ThemeToggle"
import { toast } from "sonner"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { Bell, Clock, AlertCircle, Info, X } from "lucide-react"

import {
  Navbar as ResizableNavbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar"

const mockNotifications = [
  { id: 1, type: "time", icon: Clock, title: "Time Remaining", text: "2 hours left for Round 1 submissions. Make sure your repo is public.", time: "Just now" },
  { id: 2, type: "alert", icon: AlertCircle, title: "Notice", text: "Judging criteria updated for the AI category.", time: "1h ago" },
  { id: 3, type: "info", icon: Info, title: "Welcome", text: "Welcome to Code-E-Manipal! Hack away.", time: "2h ago" },
]

export default function Navbar({ className }: { className?: string }) {
  const { role, logout, user } = useAuth()
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
    const fetchTimer = async () => {
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
    const interval = setInterval(fetchTimer, 5000); // Poll every 5 seconds for responsive publishing state

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) {
      setTeam(null);
      return;
    }

    const fetchTeam = async () => {
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
    const interval = setInterval(fetchTeam, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
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

  // Notifications state management
  const [notifications, setNotifications] = useState(
    mockNotifications.map((n) => ({ ...n, read: false }))
  )
  const [hasUnread, setHasUnread] = useState(true)

  const handleMarkAllRead = () => {
    setHasUnread(false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast.success("All notifications marked as read.")
  }

  const handleViewAllNotifications = () => {
    setNotifsOpen(false)
    setSheetOpen(true)
  }

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
    const isActive = pathname === path
    return isActive
      ? "block py-3 px-4 text-jaipur-primary font-semibold bg-jaipur-primary/10 rounded-lg text-center"
      : "block py-3 px-4 text-muted-foreground hover:text-jaipur-primary hover:bg-jaipur-primary/10 rounded-lg transition-colors duration-200 text-center"
  }

  if (pathname === "/login") return null

  // Generate dynamic links based on user role
  const navItems = []
  if (role === "admin" || role === "participant") {
    navItems.push({ name: "Team", link: "/team" })
    navItems.push({ name: "Submit", link: "/SubmissionForm" })
  }
  if (role === "admin" || role === "judge") {
    navItems.push({ name: "Judging", link: "/judging" })
  }
  if (role === "admin") {
    navItems.push({ name: "Admin", link: "/admin" })
  }
  navItems.push({ name: "Gallery", link: "/gallery" })

  const isSubmissionForm = pathname?.startsWith("/SubmissionForm")

  return (
    <ResizableNavbar isSubmissionForm={isSubmissionForm} className={className}>
      {/* ── Desktop Navigation ── */}
      <NavBody className="bg-background/90 border border-jaipur-gold/30 shadow-md backdrop-blur-md">
        {/* Logo */}
        <Link href="/" className="flex items-center no-underline h-12 flex-shrink-0 z-20">
          <Image
            src="/logo.png"
            width={200}
            height={52}
            alt="Code-e-Manipal 2.0"
            className="h-13 w-auto object-contain"
            priority
          />
        </Link>

        {/* Dynamic Navigation Links */}
        <NavItems items={navItems} pathname={pathname} />

        {/* Desktop Actions */}
        <div className="flex items-center gap-4 flex-shrink-0 z-20">
          {/* Role Badge */}
          {role && (
            <span className="hidden xl:inline-block text-xs px-3 py-1 rounded-full bg-jaipur-secondary border border-jaipur-secondary-light text-foreground font-medium capitalize">
              {role}
            </span>
          )}

          {/* Hackathon Timer */}
          {timerConfig && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-jaipur-secondary/50 border border-jaipur-gold/20 text-xs font-mono font-bold text-[#F0C060]">
              <span className={timeLeftStr !== "Not Started" && timeLeftStr !== "Closed" ? "animate-pulse" : ""}>⏳</span>
              <span>{timeLeftStr}</span>
            </div>
          )}

          {/* Results Publishing Countdown Pill */}
          {resultsCountdownStr && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-jaipur-primary/20 border border-jaipur-primary/40 text-xs font-mono font-bold text-jaipur-gold animate-pulse shadow-sm">
              <span>🏆 Results: {resultsCountdownStr}</span>
            </div>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifsOpen(!notifsOpen);
                if (menuOpen) setMenuOpen(false);
              }}
              className="relative p-1.5 rounded-full hover:bg-jaipur-secondary transition-colors focus:outline-none cursor-pointer flex items-center justify-center"
            >
              <Bell size={isSubmissionForm ? 24 : 20} className="text-muted-foreground transition-all duration-300" />
              {hasUnread && (
                <div className={`absolute rounded-full bg-jaipur-pink transition-all duration-300 ${isSubmissionForm ? "top-1 right-2.5 w-2.5 h-2.5" : "top-1 right-1.5 w-2 h-2"}`} />
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
                    {notifications.map((notif) => {
                      const Icon = notif.icon;
                      return (
                        <div key={notif.id} className={`px-4 py-3 border-b border-jaipur-gold/10 hover:bg-jaipur-secondary/50 transition-colors cursor-pointer flex gap-3 ${notif.read ? 'opacity-50' : ''}`}>
                          <div className={`mt-0.5 p-2 rounded-full h-fit ${notif.read ? 'bg-muted text-muted-foreground' : notif.type === 'time' ? 'bg-jaipur-primary/20 text-jaipur-primary' : notif.type === 'alert' ? 'bg-jaipur-pink/20 text-jaipur-pink' : 'bg-jaipur-gold/20 text-jaipur-gold'}`}>
                            <Icon size={14} />
                          </div>
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <h4 className={`text-sm font-medium leading-none ${notif.read ? 'text-muted-foreground' : 'text-foreground'}`}>{notif.title}</h4>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{notif.time}</span>
                            </div>
                            <p className={`text-xs mt-1 leading-snug ${notif.read ? 'text-muted-foreground/80' : 'text-muted-foreground'}`}>{notif.text}</p>
                          </div>
                        </div>
                      );
                    })}
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
          </div>

          {/* User Avatar Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(!menuOpen);
                if (notifsOpen) setNotifsOpen(false);
              }}
              className="w-8 h-8 rounded-full bg-jaipur-secondary text-jaipur-primary flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-jaipur-gold/30 focus:outline-none cursor-pointer"
            >
              {user?.email?.charAt(0).toUpperCase()}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{ backgroundColor: "var(--background)", transform: "translateZ(0)" }}
                  className="absolute right-0 mt-3 w-48 border border-jaipur-gold/30 rounded-xl shadow-xl overflow-hidden z-50 isolate"
                >
                  <div className="px-4 py-3 border-b border-jaipur-gold/20 text-xs text-muted-foreground truncate">
                    {user?.email}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm text-jaipur-primary font-medium hover:bg-jaipur-primary/10 transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </NavBody>

      {/* ── Mobile Navigation ── */}
      <MobileNav className="bg-background/95 border-b border-jaipur-gold/20 shadow-sm">
        <MobileNavHeader>
          <Link href="/" className="flex items-center no-underline h-10">
            <Image
              src="/logo.png"
              width={160}
              height={40}
              alt="Code-e-Manipal 2.0"
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
          <div className="flex items-center gap-3">
            {timerConfig && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-jaipur-secondary/50 border border-jaipur-gold/20 text-[10px] font-mono font-bold text-[#F0C060]">
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
          className="border border-jaipur-gold/20"
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
          
          <div className="flex w-full flex-col gap-4 pt-4 border-t border-jaipur-gold/10 items-center">
            {role && (
              <span className="text-xs px-3 py-1 rounded-full bg-jaipur-secondary border border-jaipur-secondary-light text-foreground font-medium capitalize">
                Role: {role}
              </span>
            )}
            {user?.email && (
              <span className="text-xs text-muted-foreground truncate max-w-full">
                {user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-lg bg-jaipur-primary/10 hover:bg-jaipur-primary/20 text-jaipur-primary font-semibold text-sm transition duration-200 cursor-pointer"
            >
              Logout
            </button>
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
              className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm"
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
                  {notifications.filter(n => !n.read).length} unread notifications
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
                    const Icon = notif.icon;
                    return (
                      <div
                        key={notif.id}
                        className={`p-4 rounded-xl border transition-all duration-300 relative flex gap-4 text-left ${
                          notif.read
                            ? "bg-transparent border-jaipur-gold/10 opacity-60"
                            : "bg-jaipur-secondary/10 border-jaipur-primary/20 shadow-sm"
                        }`}
                      >
                        {/* Type Icon indicator */}
                        <div className={`p-2.5 rounded-full h-fit flex-shrink-0 ${
                          notif.read 
                            ? "bg-muted text-muted-foreground/60"
                            : notif.type === 'time' 
                            ? 'bg-jaipur-primary/20 text-jaipur-primary' 
                            : notif.type === 'alert' 
                            ? 'bg-jaipur-pink/20 text-jaipur-pink' 
                            : 'bg-jaipur-gold/20 text-jaipur-gold'
                        }`}>
                          <Icon size={18} />
                        </div>

                        {/* Details */}
                        <div className="space-y-1 flex-1">
                          <div className="flex justify-between items-baseline gap-2">
                            <h4 className={`text-sm font-semibold leading-tight ${notif.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{notif.time}</span>
                          </div>
                          <p className={`text-xs leading-relaxed ${notif.read ? 'text-muted-foreground/80' : 'text-muted-foreground'}`}>
                            {notif.text}
                          </p>
                          
                          {/* Visual Unread Accent Dot */}
                          {!notif.read && (
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
                  onClick={() => {
                    setNotifications([]);
                    setHasUnread(false);
                    toast.success("Notification log cleared.");
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
