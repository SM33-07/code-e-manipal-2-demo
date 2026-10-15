"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface AuthContextType {
  user: any | null
  role: string
  loading: boolean
  login: (identifier: string, password: string) => Promise<any>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type ProfileResponse = {
  data?: {
    user: { id: string; email: string | null; identifier: string | null }
    profile: { name: string | null; role: string }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<any | null>(null)
  const [role, setRole] = useState("participant")
  const [loading, setLoading] = useState(true)

  const hydrateProfile = useCallback(async (fallbackUser: any, token?: string | null) => {
    const headers: Record<string, string> = {}
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const response = await fetch("/api/auth/me", {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) throw new Error("Your session is no longer available.")

    const payload = (await response.json()) as ProfileResponse
    const account = payload.data
    if (!account) throw new Error("Profile details are unavailable.")

    const hydratedUser = {
      ...fallbackUser,
      id: account.user.id,
      email: account.user.email,
      user_metadata: {
        ...(fallbackUser?.user_metadata || {}),
        name: account.profile.name || account.user.identifier || "User",
        identifier: account.user.identifier,
      },
    }

    setUser(hydratedUser)
    setRole(account.profile.role)
    return { user: hydratedUser, role: account.profile.role }
  }, [])

  useEffect(() => {
    let active = true
    let isRestoring = false

    const restoreSession = async () => {
      if (isRestoring) return
      isRestoring = true

      try {
        // Do not attempt profile hydration or session manipulation if the page is currently
        // receiving recovery or invitation parameters (they are processed by /auth/setup-password)
        if (typeof window !== "undefined") {
          const hash = window.location.hash || ""
          const search = window.location.search || ""
          const pathname = window.location.pathname
          if (
            pathname === "/auth/setup-password" ||
            hash.includes("type=recovery") ||
            hash.includes("type=invite") ||
            hash.includes("type=signup") ||
            hash.includes("type=magiclink") ||
            hash.includes("access_token=") ||
            search.includes("type=recovery") ||
            search.includes("type=invite") ||
            search.includes("type=magiclink") ||
            search.includes("token_hash=") ||
            search.includes("code=")
          ) {
            if (active) setLoading(false)
            return
          }
        }

        let sessionUser: any = null
        let accessToken: string | null = null

        try {
          const { data, error } = await supabase.auth.getSession()
          if (!error && data?.session?.user) {
            sessionUser = data.session.user
            accessToken = data.session.access_token
          }
        } catch {
          // getSession failed (e.g., storage corruption or network failure)
        }

        if (!active) return

        if (!sessionUser) {
          if (active) setLoading(false)
          return
        }

        try {
          await hydrateProfile(sessionUser, accessToken)
        } catch {
          // Do NOT destroy sessions if the user is on an authentication onboarding/recovery route
          // or possesses a recovery/invite URL parameter
          const isAuthRoute =
            typeof window !== "undefined" && window.location.pathname.startsWith("/auth/")
          const isRecoveryContext =
            typeof window !== "undefined" &&
            (window.location.pathname === "/auth/setup-password" ||
             window.location.hash.includes("type=recovery") ||
             window.location.hash.includes("type=invite") ||
             window.location.hash.includes("access_token=") ||
             window.location.search.includes("type=recovery") ||
             window.location.search.includes("type=invite") ||
             window.location.search.includes("token_hash=") ||
             window.location.search.includes("code="))

          if (!isAuthRoute && !isRecoveryContext) {
            try {
              await supabase.auth.signOut()
            } catch {
              // Sign out error ignored during recovery
            }
          }
          if (active) {
            setUser(null)
            setRole("participant")
          }
        }
      } finally {
        if (active) {
          setLoading(false)
          isRestoring = false
        }
      }
    }

    // Unconditional bounded fallback timer (5 seconds) to ensure loading ALWAYS settles
    const safetyTimer = setTimeout(() => {
      if (active) {
        setLoading(false)
      }
    }, 5000)

    restoreSession()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        if (active) {
          setUser(null)
          setRole("participant")
          setLoading(false)
        }
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (active && !isRestoring) {
          try {
            await hydrateProfile(session.user, session.access_token)
          } catch {
            // Profile hydration error caught gracefully
          } finally {
            if (active) setLoading(false)
          }
        }
      }
    })

    return () => {
      active = false
      clearTimeout(safetyTimer)
      listener.subscription.unsubscribe()
    }
  }, [hydrateProfile, supabase])

  const login = async (identifier: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
      signal: AbortSignal.timeout(10000),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || "Unable to sign in.")

    const session = payload.data?.session
    if (!session?.access_token || !session?.refresh_token) throw new Error("Unable to establish a secure session.")
    const { data, error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
    if (error || !data.user) throw new Error(error?.message || "Unable to establish a secure session.")

    const hydrated = await hydrateProfile(data.user, session.access_token)
    return { user: hydrated.user, role: hydrated.role }
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Continue even if network fails
    }
    await supabase.auth.signOut();
    setUser(null);
    setRole("participant");
  };

  return <AuthContext.Provider value={{ user, role, loading, login, logout, isAuthenticated: !!user }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
