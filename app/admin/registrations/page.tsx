"use client"

import { useState, useEffect, useCallback } from "react"
import { useTheme } from "next-themes"
import {
  ClipboardList, CheckCircle, XCircle, Clock, Search,
  Download, Users, ChevronDown, Loader2, AlertCircle,
  Check, X,
} from "lucide-react"
import type { HackathonRegistration, RegistrationStatus } from "@/types"

const F     = "'Inter', sans-serif"
const SERIF = "'Cormorant Garamond', serif"

type TabStatus = "all" | RegistrationStatus

export default function AdminRegistrationsPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [registrations, setRegistrations] = useState<HackathonRegistration[]>([])
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [activeTab, setActiveTab] = useState<TabStatus>("all")
  const [roundFilter, setRoundFilter] = useState<"all" | "1" | "2">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const isDark = mounted && resolvedTheme === "dark"

  useEffect(() => { setMounted(true) }, [])

  const loadRegistrations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (activeTab !== "all") params.set("status", activeTab)
      if (roundFilter !== "all") params.set("round", roundFilter)

      const res = await fetch(`/api/admin/registrations?${params}`)
      const json = await res.json()
      setRegistrations(json.data ?? [])
      if (json.meta?.counts) setCounts(json.meta.counts)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [activeTab, roundFilter])

  useEffect(() => {
    setLoading(true)
    loadRegistrations()
  }, [loadRegistrations])

  const handleAction = async (ids: string[], action: "approve" | "reject") => {
    setActionLoading(ids.length === 1 ? ids[0] : "bulk")
    try {
      await fetch("/api/admin/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      })
      setSelectedIds(new Set())
      await loadRegistrations()
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab !== "all") params.set("status", activeTab)
      if (roundFilter !== "all") params.set("round", roundFilter)

      const res = await fetch(`/api/admin/registrations/export?${params}`)
      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `registrations_${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
    finally { setExportLoading(false) }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(r => r.id)))
  }

  // Filter by search query
  const filtered = registrations.filter(r => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return r.name.toLowerCase().includes(q)
      || r.email.toLowerCase().includes(q)
      || r.team_name.toLowerCase().includes(q)
      || r.phone.includes(q)
  })

  const pendingSelected = filtered.filter(r => selectedIds.has(r.id) && r.status === "pending")

  const tabs: { key: TabStatus; label: string; count: number; icon: React.ElementType; color: string }[] = [
    { key: "all",      label: "All",      count: counts.total,    icon: ClipboardList, color: isDark ? "#C9A227" : "#8B1F44" },
    { key: "pending",  label: "Pending",  count: counts.pending,  icon: Clock,         color: "#F59E0B" },
    { key: "approved", label: "Approved", count: counts.approved, icon: CheckCircle,   color: "#10B981" },
    { key: "rejected", label: "Rejected", count: counts.rejected, icon: XCircle,       color: "#EF4444" },
  ]

  const statusBadge = (status: RegistrationStatus) => {
    const styles: Record<RegistrationStatus, { bg: string; text: string; border: string }> = {
      pending:  { bg: "rgba(245,158,11,0.1)", text: "#F59E0B", border: "rgba(245,158,11,0.3)" },
      approved: { bg: "rgba(16,185,129,0.1)", text: "#10B981", border: "rgba(16,185,129,0.3)" },
      rejected: { bg: "rgba(239,68,68,0.1)",  text: "#EF4444", border: "rgba(239,68,68,0.3)" },
    }
    const s = styles[status]
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: s.bg, color: s.text, border: `1px solid ${s.border}`,
          textTransform: "capitalize", fontFamily: F,
        }}
      >
        {status === "pending" && <Clock size={10} />}
        {status === "approved" && <Check size={10} />}
        {status === "rejected" && <X size={10} />}
        {status}
      </span>
    )
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1" style={{ fontFamily: SERIF }}>
            Registrations
          </h1>
          <p className="text-muted-foreground" style={{ fontFamily: F }}>
            Manage hackathon team registrations and export data.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportLoading}
          className="shrink-0 flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
          style={{
            background: isDark ? "linear-gradient(135deg,#D4732A,#C1440E)" : "linear-gradient(135deg,#8B1F44,#6D1632)",
            color: "white",
            boxShadow: isDark ? "0 4px 16px rgba(212,115,42,0.3)" : "0 4px 16px rgba(139,31,68,0.2)",
            border: "none",
            cursor: exportLoading ? "not-allowed" : "pointer",
            fontFamily: F,
          }}
        >
          {exportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export to Excel
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tabs.map(({ key, label, count, icon: Icon, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setActiveTab(key); setSelectedIds(new Set()) }}
            className="bg-jaipur-card border rounded-xl p-4 flex items-center gap-3 transition-all text-left"
            style={{
              borderColor: activeTab === key ? color : (isDark ? "rgba(201,162,39,0.2)" : "rgba(233,216,199,0.8)"),
              boxShadow: activeTab === key ? `0 0 0 1px ${color}, 0 4px 16px ${color}22` : "none",
              cursor: "pointer",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}
            >
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none" style={{ fontFamily: SERIF }}>{count}</p>
              <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: F }}>{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, team or phone..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-jaipur-card border border-jaipur-secondary-light text-foreground text-sm outline-none focus:border-jaipur-gold transition-colors"
            style={{ fontFamily: F }}
          />
        </div>

        {/* Round filter */}
        <div className="relative shrink-0">
          <select
            value={roundFilter}
            onChange={e => { setRoundFilter(e.target.value as any); setSelectedIds(new Set()) }}
            className="h-11 pl-4 pr-10 rounded-xl bg-jaipur-card border border-jaipur-secondary-light text-foreground text-sm outline-none focus:border-jaipur-gold appearance-none cursor-pointer"
            style={{ fontFamily: F, minWidth: 140 }}
          >
            <option value="all" className="bg-[#FCF6EF] text-[#6A4635] dark:bg-[#1E1208] dark:text-[#F5EFE0]">All Rounds</option>
            <option value="1" className="bg-[#FCF6EF] text-[#6A4635] dark:bg-[#1E1208] dark:text-[#F5EFE0]">Round 1</option>
            <option value="2" className="bg-[#FCF6EF] text-[#6A4635] dark:bg-[#1E1208] dark:text-[#F5EFE0]">Round 2</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-jaipur-primary pointer-events-none" />
        </div>

        {/* Bulk actions */}
        {pendingSelected.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleAction(pendingSelected.map(r => r.id), "approve")}
              disabled={actionLoading === "bulk"}
              className="h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all border-none cursor-pointer"
              style={{
                background: "rgba(16,185,129,0.12)",
                color: "#10B981",
                border: "1px solid rgba(16,185,129,0.3)",
                fontFamily: F,
              }}
            >
              {actionLoading === "bulk" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Approve ({pendingSelected.length})
            </button>
            <button
              type="button"
              onClick={() => handleAction(pendingSelected.map(r => r.id), "reject")}
              disabled={actionLoading === "bulk"}
              className="h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all border-none cursor-pointer"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#EF4444",
                border: "1px solid rgba(239,68,68,0.3)",
                fontFamily: F,
              }}
            >
              <X size={14} /> Reject ({pendingSelected.length})
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-jaipur-card border border-jaipur-secondary-light rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-3" style={{ fontFamily: F }}>
            <Loader2 size={20} className="animate-spin" /> Loading registrations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground" style={{ fontFamily: F }}>
            <ClipboardList size={48} className="mb-4 opacity-40 text-jaipur-gold" />
            <p className="text-sm">No registrations found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontFamily: F }}>
              <thead>
                <tr style={{
                  borderBottom: isDark ? "1px solid rgba(201,162,39,0.15)" : "1px solid rgba(233,216,199,0.8)",
                }}>
                  <th style={{ padding: "14px 16px", textAlign: "left", width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      style={{ width: 16, height: 16, accentColor: isDark ? "#D4732A" : "#8B1F44", cursor: "pointer" }}
                    />
                  </th>
                  {["Name", "Team Name", "Phone", "Email", "Round", "Status", "Applied", "Actions"].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: isDark ? "#C9A227" : "#8A3150",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((reg, idx) => (
                  <tr
                    key={reg.id}
                    style={{
                      borderBottom: idx < filtered.length - 1
                        ? (isDark ? "1px solid rgba(201,162,39,0.08)" : "1px solid rgba(233,216,199,0.5)")
                        : "none",
                      background: selectedIds.has(reg.id)
                        ? (isDark ? "rgba(201,162,39,0.06)" : "rgba(139,31,68,0.03)")
                        : "transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(reg.id)}
                        onChange={() => toggleSelect(reg.id)}
                        style={{ width: 16, height: 16, accentColor: isDark ? "#D4732A" : "#8B1F44", cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: isDark ? "#F5EFE0" : "#4B1F24", whiteSpace: "nowrap" }}>
                      {reg.name}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: isDark ? "#A08070" : "#6E5A55", whiteSpace: "nowrap" }}>
                      <div className="flex items-center gap-2">
                        <Users size={13} style={{ opacity: 0.5 }} />
                        {reg.team_name}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: isDark ? "#A08070" : "#6E5A55", whiteSpace: "nowrap" }}>
                      {reg.phone}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: isDark ? "#A08070" : "#6E5A55", whiteSpace: "nowrap" }}>
                      {reg.email}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: isDark ? "#C9A227" : "#8A3150", textAlign: "center" }}>
                      {reg.round}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {statusBadge(reg.status)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: isDark ? "#A08070" : "#9A7B73", whiteSpace: "nowrap" }}>
                      {formatDate(reg.created_at)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {reg.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleAction([reg.id], "approve")}
                            disabled={actionLoading === reg.id}
                            title="Approve"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors border-none cursor-pointer"
                            style={{
                              background: "rgba(16,185,129,0.12)",
                              border: "1px solid rgba(16,185,129,0.3)",
                              color: "#10B981",
                            }}
                          >
                            {actionLoading === reg.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction([reg.id], "reject")}
                            disabled={actionLoading === reg.id}
                            title="Reject"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors border-none cursor-pointer"
                            style={{
                              background: "rgba(239,68,68,0.1)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              color: "#EF4444",
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: isDark ? "rgba(160,128,112,0.5)" : "rgba(154,123,115,0.5)", fontStyle: "italic" }}>
                          {reg.status === "approved" ? "Approved" : "Rejected"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
