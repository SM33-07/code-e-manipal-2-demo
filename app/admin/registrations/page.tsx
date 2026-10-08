"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Download,
  Users,
  ChevronDown,
  Loader2,
  Check,
  X,
} from "lucide-react";
import type { HackathonRegistration, RegistrationStatus } from "@/types";

type TabStatus = "all" | RegistrationStatus;

export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<HackathonRegistration[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [activeTab, setActiveTab] = useState<TabStatus>("all");
  const [roundFilter, setRoundFilter] = useState<"all" | "1" | "2">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const loadRegistrations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      if (roundFilter !== "all") params.set("round", roundFilter);

      const res = await fetch(`/api/admin/registrations?${params}`);
      const json = await res.json();
      setRegistrations(json.data ?? []);
      if (json.meta?.counts) setCounts(json.meta.counts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeTab, roundFilter]);

  useEffect(() => {
    setLoading(true);
    loadRegistrations();
  }, [loadRegistrations]);

  const handleAction = async (ids: string[], action: "approve" | "reject") => {
    setActionLoading(ids.length === 1 ? ids[0] : "bulk");
    try {
      await fetch("/api/admin/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      setSelectedIds(new Set());
      await loadRegistrations();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      if (roundFilter !== "all") params.set("round", roundFilter);

      const res = await fetch(`/api/admin/registrations/export?${params}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registrations_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExportLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((r) => r.id)));
  };

  // Filter by search query
  const filtered = registrations.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.team_name.toLowerCase().includes(q) ||
      r.phone.includes(q)
    );
  });

  const pendingSelected = filtered.filter((r) => selectedIds.has(r.id) && r.status === "pending");

  const tabs: { key: TabStatus; label: string; count: number; icon: React.ElementType }[] = [
    { key: "all", label: "All Registrations", count: counts.total, icon: ClipboardList },
    { key: "pending", label: "Pending Review", count: counts.pending, icon: Clock },
    { key: "approved", label: "Approved", count: counts.approved, icon: CheckCircle },
    { key: "rejected", label: "Rejected", count: counts.rejected, icon: XCircle },
  ];

  const statusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Check size={12} /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <X size={12} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={12} /> Pending
          </span>
        );
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Registrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage hackathon team registrations, approve participants, and export data.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportLoading}
          className="shrink-0 flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
        >
          {exportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export to Excel
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tabs.map(({ key, label, count, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveTab(key);
                setSelectedIds(new Set());
              }}
              className={`bg-card border rounded-2xl p-4 flex items-center gap-3 transition-all text-left shadow-sm ${
                isActive
                  ? "border-primary ring-1 ring-primary/40 bg-primary/5"
                  : "border-border hover:border-border/80"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{count}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, team or phone..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all shadow-sm"
          />
        </div>

        {/* Round filter */}
        <div className="relative shrink-0">
          <select
            value={roundFilter}
            onChange={(e) => {
              setRoundFilter(e.target.value as "all" | "1" | "2");
              setSelectedIds(new Set());
            }}
            className="h-10 pl-4 pr-10 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer shadow-sm min-w-[140px]"
          >
            <option value="all">All Rounds</option>
            <option value="1">Round 1</option>
            <option value="2">Round 2</option>
          </select>
          <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Bulk actions */}
        {pendingSelected.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleAction(pendingSelected.map((r) => r.id), "approve")}
              disabled={actionLoading === "bulk"}
              className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "bulk" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Approve ({pendingSelected.length})
            </button>
            <button
              type="button"
              onClick={() => handleAction(pendingSelected.map((r) => r.id), "reject")}
              disabled={actionLoading === "bulk"}
              className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <X size={14} /> Reject ({pendingSelected.length})
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 size={20} className="animate-spin text-primary" /> Loading registrations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ClipboardList size={40} className="mb-3 opacity-40 text-muted-foreground" />
            <p className="text-sm font-medium">No registrations found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Team Name</th>
                  <th className="px-4 py-3.5">Phone</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5 text-center">Round</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Applied</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((reg) => (
                  <tr
                    key={reg.id}
                    className={`transition-colors hover:bg-muted/30 ${
                      selectedIds.has(reg.id) ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(reg.id)}
                        onChange={() => toggleSelect(reg.id)}
                        className="rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                      {reg.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Users size={13} className="text-muted-foreground" />
                        {reg.team_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {reg.phone}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {reg.email}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-xs text-secondary whitespace-nowrap">
                      {reg.round}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {statusBadge(reg.status)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(reg.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {reg.status === "pending" ? (
                        <div className="inline-flex gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleAction([reg.id], "approve")}
                            disabled={actionLoading === reg.id}
                            title="Approve"
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoading === reg.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction([reg.id], "reject")}
                            disabled={actionLoading === reg.id}
                            title="Reject"
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/70 italic">
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
  );
}
