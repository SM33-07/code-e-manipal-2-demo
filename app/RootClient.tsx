"use client";

import { AuthProvider, useAuth } from "@/components/AuthProvider"
import { Suspense, useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

import { HeritageBackground } from "@/components/HeritageBackground"
import { SiteFooter } from "@/components/SiteFooter"
import { ScrollReveal } from "@/components/ui/ScrollReveal"

const Navbar = dynamic(() => import("@/components/Navbar"), { ssr: false })

interface Announcement {
  id: string;
  content: string;
  type: "info" | "warning" | "urgent" | "success";
}

function AnnouncementBanner({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const { isAuthenticated } = useAuth()
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [publishingAlert, setPublishingAlert] = useState<boolean>(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setAnnouncement(null)
      setPublishingAlert(false)
      onActiveChange(false)
      return
    }

    const fetchStatus = async () => {
      try {
        const [annRes, cfgRes] = await Promise.all([
          fetch("/api/announcements"),
          fetch("/api/event-config"),
        ])

        let hasPublishingAlert = false
        if (cfgRes.ok) {
          const cfgJson = await cfgRes.json()
          const cfg = cfgJson.data || {}
          if (cfg.results_published === "publishing") {
            hasPublishingAlert = true
          }
        }
        setPublishingAlert(hasPublishingAlert)

        if (annRes.ok) {
          const result = await annRes.json()
          const data = result.data
          setAnnouncement(data)
          onActiveChange(hasPublishingAlert || !!data)
        } else {
          setAnnouncement(null)
          onActiveChange(hasPublishingAlert)
        }
      } catch (err) {
        console.error("Error fetching announcements/config:", err)
        setAnnouncement(null)
        onActiveChange(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => {
      clearInterval(interval)
    }
  }, [isAuthenticated, onActiveChange])

  if (publishingAlert) {
    return (
      <div 
        className="fixed top-0 left-0 right-0 z-[9999] h-10 px-4 flex items-center justify-center gap-2 border-b shadow-sm transition-all duration-300 bg-amber-600 dark:bg-amber-950 text-white border-amber-500 animate-pulse"
      >
        <span className="text-sm">🏆</span>
        <p className="text-xs font-bold tracking-wide text-center uppercase truncate max-w-[90%]">
          Official Announcement: Results announcement in progress! The leaderboard will be live in 5 minutes.
        </p>
      </div>
    )
  }

  if (!announcement) return null

  const typeStyles = {
    info: {
      bg: "bg-primary text-primary-foreground border-primary/30",
      icon: "ℹ️"
    },
    warning: {
      bg: "bg-secondary text-secondary-foreground border-secondary/30",
      icon: "⚠️"
    },
    urgent: {
      bg: "bg-destructive text-destructive-foreground border-destructive/40 animate-pulse",
      icon: "🚨"
    },
    success: {
      bg: "bg-emerald-600 dark:bg-emerald-900/90 text-white border-emerald-500",
      icon: "✅"
    }
  }

  const style = typeStyles[announcement.type] || typeStyles.info

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[9999] h-10 px-4 flex items-center justify-center gap-2 border-b shadow-sm transition-all duration-300 ${style.bg}`}
    >
      <span className="text-sm">{style.icon}</span>
      <p className="text-xs font-semibold tracking-wide text-center uppercase truncate max-w-[90%]">
        {announcement.content}
      </p>
    </div>
  )
}

import LoaderAnimation from "@/components/LoaderAnimation"

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()
  const isLogin = pathname === "/login"
  const isLanding = pathname === "/"
  const isProtectedPortalRoute = ["/dashboard", "/team", "/submit", "/SubmissionForm", "/submission-result", "/judge", "/judging", "/admin", "/account"]
    .some((route) => pathname === route || pathname.startsWith(`${route}/`))
  // These pages intentionally serve public information too. Once a session is
  // known, they participate in the portal shell instead of losing account and
  // navigation access.
  const isSharedPortalRoute = ["/timeline", "/problem-statements", "/gallery", "/results"].includes(pathname)
  const isPortalRoute = isProtectedPortalRoute || (isAuthenticated && isSharedPortalRoute)

  const [hasBanner, setHasBanner] = useState(false)

  useEffect(() => {
    if (!isPortalRoute) setHasBanner(false)
  }, [isPortalRoute])

  if (isLogin) {
    return (
      <>
        <HeritageBackground />
        {children}
      </>
    )
  }

  const isFullBleedRoute = pathname.startsWith("/admin") || pathname.startsWith("/judge") || pathname.startsWith("/judging")

  return (
    <>
      <HeritageBackground />
      {isPortalRoute && <AnnouncementBanner onActiveChange={setHasBanner} />}
      
      <div style={{ paddingTop: hasBanner ? "40px" : "0px" }}>
        <Suspense fallback={null}>
          <Navbar portal={isPortalRoute} className={`cem-navbar-shell ${hasBanner ? "top-[40px]" : "top-0"}`} />
        </Suspense>
        <div className={`relative z-10 min-h-screen ${isFullBleedRoute ? "pt-20" : isLanding ? "pt-16 pb-12 sm:pt-20" : "pt-24 pb-12"}`}>
          {children}
        </div>
        {!isPortalRoute && <ScrollReveal as="div"><SiteFooter /></ScrollReveal>}
      </div>
    </>
  )
}

export default function RootClient({ children }: { children: React.ReactNode }) {
  const [showLoader, setShowLoader] = useState(true)

  const handleLoaderComplete = useCallback(() => {
    try {
      sessionStorage.setItem("cem_portal_booted", "1")
    } catch {}
    document.body.dataset.cemLoaderComplete = "true"
    setShowLoader(false)
  }, [])

  useEffect(() => {
    try {
      const navEntry = window.performance?.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined
      const isReload = navEntry?.type === "reload"

      if (isReload) {
        sessionStorage.removeItem("cem_portal_booted")
      } else {
        const alreadyBooted = sessionStorage.getItem("cem_portal_booted")
        if (alreadyBooted) {
          document.body.dataset.cemLoaderComplete = "true"
          setShowLoader(false)
          return
        }
      }
    } catch {
      // sessionStorage or performance unavailable
    }

    // Deterministic safety fallback
    const safety = setTimeout(handleLoaderComplete, 3500)

    return () => clearTimeout(safety)
  }, [handleLoaderComplete])

  return (
    <AuthProvider>
      {showLoader && (
        <LoaderAnimation onComplete={handleLoaderComplete} />
      )}
      <Shell>{children}</Shell>
    </AuthProvider>
  )
}
