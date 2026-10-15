"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

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
  const [user, setUser] = useState<any | null>(null)
  const [role, setRole] = useState("participant")
  const [loading, setLoading] = useState(true)

  const hydrateProfile = useCallback(async (token?: string | null, fallbackUser?: any) => {
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
      ...(fallbackUser || {}),
      id: account.user.id,
      email: account.user.email,
      user_metadata: {
        ...(fallbackUser?.user_metadata || {}),
        name: account.profile.name || account.user.identifier || "User",
        identifier: account.user.identifier,
        role: account.profile.role,
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

        try {
          await hydrateProfile()
        } catch {
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

    return () => {
      active = false
      clearTimeout(safetyTimer)
    }
  }, [hydrateProfile])

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
    const hydrated = await hydrateProfile(session?.access_token, payload.data?.user)
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
