"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  ArrowRight, ChevronDown, CheckCircle, FileText,
  Scale, Shuffle, Trophy, UserCircle, Users, Trash2, UserPlus, ShieldAlert,
} from "lucide-react"


export default function AdminPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [selSub,      setSelSub]      = useState("")
  const [selJudge,    setSelJudge]    = useState("")

  // Create User Modal States
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRole, setNewUserRole] = useState<"participant" | "judge" | "admin">("judge")
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [stats, setStats] = useState([
    { label: "Total Teams",       value: 0, Icon: Users },
    { label: "Total Submissions", value: 0, Icon: FileText },
    { label: "Submitted",         value: 0, Icon: Scale },
    { label: "Reviewed",          value: 0, Icon: CheckCircle },
  ])

  type SubOpt = { id: string; title: string }
  type JudgeOpt = { id: string; name: string; email: string }
  type AssignItem = {
    judge_id: string; submission_id: string; assigned_at: string
    submissions: { id: string; title: string } | null
    profiles: { id: string; name: string; email: string } | null
  }

  const [submissions,   setSubmissions]   = useState<SubOpt[]>([])
  const [judges,        setJudges]        = useState<JudgeOpt[]>([])
  const [assignments,   setAssignments]   = useState<AssignItem[]>([])
  const [reviewedCount, setReviewedCount] = useState(0)
  const [pendingCount,  setPendingCount]  = useState(0)

  const [users,         setUsers]         = useState<any[]>([])
  const [userSearch,    setUserSearch]    = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState("all")
  const [usersLoading,  setUsersLoading]  = useState(false)
  const [roleError,     setRoleError]     = useState("")

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch("/api/admin/users")
      const json = await res.json()
      setUsers(json.data ?? [])
    } catch {
      setRoleError("Failed to load users")
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const handleRoleChange = async (userId: string, newRole: "participant" | "judge" | "admin") => {
    setRoleError("")
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      })
      if (!res.ok) {
        const json = await res.json()
        setRoleError(json.error || "Failed to update role")
        return
      }
      await loadUsers()
      // Reload judges select option
      const jRes = await fetch("/api/admin/users?role=judge")
      const jJson = await jRes.json()
      setJudges(jJson.data ?? [])
    } catch {
      setRoleError("Failed to change role due to connection error")
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError("")
    setCreateSuccess("")
    setCreateLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateError(json.error || "Failed to create user account")
        return
      }
      setCreateSuccess("User account created successfully!")
      setNewUserName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setNewUserRole("judge")
      
      // Reload lists
      await loadUsers()
      
      // If it's a judge, reload judge list too
      if (newUserRole === "judge") {
        const jRes = await fetch("/api/admin/users?role=judge")
        const jJson = await jRes.json()
        setJudges(jJson.data ?? [])
      }

      // Close modal after a delay
      setTimeout(() => {
        setShowCreateModal(false)
        setCreateSuccess("")
      }, 1500)
    } catch {
      setCreateError("Failed to connect to the server")
    } finally {
      setCreateLoading(false)
    }
  }

  const loadAssignments = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/assignments")
      const json = await res.json()
      setAssignments(json.data ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      try {
        const [aRes, sRes, jRes] = await Promise.all([
          fetch("/api/admin/analytics"),
          fetch("/api/submissions"),
          fetch("/api/admin/users?role=judge"),
        ])
        const [aJson, sJson, jJson] = await Promise.all([
          aRes.json(), sRes.json(), jRes.json(),
        ])
        const d = aJson.data ?? {}
        setStats([
          { label: "Total Teams",       value: d.total_teams ?? 0,       Icon: Users },
          { label: "Total Submissions", value: d.total_submissions ?? 0, Icon: FileText },
          { label: "Submitted",         value: d.submitted_count ?? 0,   Icon: Scale },
          { label: "Reviewed",          value: d.reviewed_count ?? 0,    Icon: CheckCircle },
        ])
        setReviewedCount(d.reviewed_count ?? 0)
        setPendingCount((d.submitted_count ?? 0) - (d.reviewed_count ?? 0))
        setSubmissions(sJson.data ?? [])
        setJudges(jJson.data ?? [])
      } catch { /* ignore */ }
    }
    load()
    loadAssignments()
    loadUsers()
  }, [loadAssignments, loadUsers])

  const isDark = mounted && resolvedTheme === "dark"
  const canAssign = selSub !== "" && selJudge !== ""

  const filteredUsers = users.filter(u => {
    const nameMatch = (u.name || "").toLowerCase().includes(userSearch.toLowerCase())
    const emailMatch = (u.email || "").toLowerCase().includes(userSearch.toLowerCase())
    const roleMatch = userRoleFilter === "all" || u.role === userRoleFilter
    return (nameMatch || emailMatch) && roleMatch
  })

  const handleAssign = async () => {
    if (!canAssign) return
    try {
      await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", judge_id: selJudge, submission_id: selSub }),
      })
    } catch { /* ignore */ }
    setSelSub(""); setSelJudge("")
    loadAssignments()
  }

  const handleShuffle = async () => {
    try {
      await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_assign" }),
      })
    } catch { /* ignore */ }
    loadAssignments()
  }

  const handleUnassign = async (judgeId: string, subId: string) => {
    try {
      await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unassign", judge_id: judgeId, submission_id: subId }),
      })
    } catch { /* ignore */ }
    loadAssignments()
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">

      {/* Operations Center Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Operations Command Center
            </span>
            <span className="text-xs text-muted-foreground">&bull;</span>
            <span className="text-xs font-mono text-muted-foreground">LIVE EVENT OPERATIONS</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Event Operations Control Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unified command for judge assignments, evaluation tracking, user roles, and system workflows.
          </p>
        </div>

        {/* Quick Module Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/event")}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            Event Control
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/teams")}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            Teams
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/results")}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            Results
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/report")}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            Report & Audit
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/analytics")}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            Analytics
          </button>
        </div>
      </div>

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, Icon }) => (
          <div 
            key={label} 
            className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border">
              <Icon size={24} className="text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
              <p className="text-3xl font-bold text-foreground leading-none">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* JUDGE ASSIGNMENT PANEL */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 md:p-8 relative overflow-hidden flex flex-col min-h-[500px] hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 shadow-sm">
          
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-muted p-3 rounded-xl shrink-0 border border-border">
                <UserCircle size={28} className="text-secondary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Judge Assignment</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Assign judges to submissions quickly, with a shuffle option to randomize.
                </p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={handleShuffle} 
              className="shrink-0 flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-secondary/40 bg-secondary/10 text-secondary text-sm font-semibold hover:bg-secondary/20 transition-colors"
            >
              <Shuffle size={16} /> Auto-Assign
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-8 shrink-0">
            <div className="flex-1 relative">
              <select 
                value={selSub} 
                onChange={e => setSelSub(e.target.value)} 
                className="w-full h-11 bg-background border border-border rounded-xl pl-4 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="" className="bg-card text-foreground">Select Submission</option>
                {submissions.map(s => (
                  <option key={s.id} value={s.id} className="bg-card text-foreground">{s.title}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <div className="flex-1 relative">
              <select 
                value={selJudge} 
                onChange={e => setSelJudge(e.target.value)} 
                className="w-full h-11 bg-background border border-border rounded-xl pl-4 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="" className="bg-card text-foreground">Select Judge</option>
                {judges.map(j => (
                  <option key={j.id} value={j.id} className="bg-card text-foreground">{j.name || j.email}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <button 
              type="button" 
              onClick={handleAssign} 
              disabled={!canAssign} 
              className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all shrink-0 shadow-sm"
            >
              Assign <ArrowRight size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mt-6 flex flex-col gap-3 pr-2">
            {assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
                <FileText size={44} className="mb-3 opacity-40 text-muted-foreground" />
                <p className="text-sm font-medium">No assignments yet.</p>
              </div>
            ) : assignments.map((item, i) => (
              <div 
                key={`${item.judge_id}-${item.submission_id}`} 
                className="flex items-center justify-between gap-4 bg-background border border-border rounded-xl p-3 sm:p-4 hover:border-border/80 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted shrink-0 flex items-center justify-center hidden sm:flex border border-border">
                    <UserCircle size={20} className="text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground line-clamp-1">
                      {item.submissions?.title ?? "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      Assigned to: <span className="font-semibold text-secondary">{item.profiles?.name || item.profiles?.email || "Unknown"}</span>
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => handleUnassign(item.judge_id, item.submission_id)} 
                  className="w-8 h-8 shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors focus:outline-none"
                  title="Remove Assignment"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* RESULTS MANAGEMENT PANEL */}
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 flex flex-col relative overflow-hidden shadow-sm">
          <div className="flex items-start gap-4 shrink-0">
            <div className="bg-muted p-3 rounded-xl shrink-0 border border-border">
              <Trophy size={28} className="text-secondary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Results</h2>
              <p className="text-sm text-muted-foreground mt-1">
                View final ranked report and export data.
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={() => router.push("/admin/report")} 
            className="w-full mt-8 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:bg-primary/90"
          >
            View Full Report <ArrowRight size={16} />
          </button>

          <div className="flex justify-center mt-8 mb-4">
             <div className="h-[1px] w-24 bg-border relative flex items-center justify-center">
               <div className="w-2 h-2 rotate-45 bg-secondary absolute" />
             </div>
          </div>

          <div className="mt-4 flex-1 bg-muted/30 border border-border rounded-xl p-5 overflow-hidden shadow-inner">
            <p className="text-xs uppercase tracking-widest text-secondary font-bold mb-4">
              Summary
            </p>
            <div className="flex flex-col gap-4">
              {[
                { label: "Projects reviewed", val: String(reviewedCount) },
                { label: "Pending reports",   val: String(pendingCount) },
                { label: "Export ready",      val: reviewedCount > 0 ? "Yes" : "No" },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center pb-3 border-b border-border/60 last:border-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-lg font-bold text-foreground">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
