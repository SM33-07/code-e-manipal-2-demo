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

  const hydrateProfile = useCallback(async (fallbackUser: any) => {
    const response = await fetch("/api/auth/me", { cache: "no-store" })
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
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      if (!data.session?.user) {
        setLoading(false)
        return
      }
      try {
        await hydrateProfile(data.session.user)
      } catch {
        await supabase.auth.signOut()
        if (active) {
          setUser(null)
          setRole("participant")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    restoreSession()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null)
        setRole("participant")
      }
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [hydrateProfile, supabase])

  const login = async (identifier: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || "Unable to sign in.")

    const session = payload.data?.session
    if (!session?.access_token || !session?.refresh_token) throw new Error("Unable to establish a secure session.")
    const { data, error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
    if (error || !data.user) throw new Error(error?.message || "Unable to establish a secure session.")

    const hydrated = await hydrateProfile(data.user)
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
