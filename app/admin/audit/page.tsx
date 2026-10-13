"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Filter,
  Download,
  RotateCw,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  User,
  Calendar,
  Layers,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import clsx from "clsx";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  details: Record<string, any>;
  ip_hash: string | null;
  user_agent_summary: string | null;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchAuditLogs = useCallback(async (pageToLoad = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(pageToLoad));
      params.set("limit", String(pagination.limit));

      if (search.trim()) params.set("search", search.trim());
      if (selectedAction && selectedAction !== "all") params.set("action", selectedAction);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || "Failed to load audit logs");
      }

      setLogs(payload.data || []);
      if (payload.meta?.pagination) {
        setPagination(payload.meta.pagination);
      }
      if (payload.meta?.availableActions) {
        setAvailableActions(payload.meta.availableActions);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch audit log telemetry");
    } finally {
      setLoading(false);
    }
  }, [search, selectedAction, startDate, endDate, pagination.limit]);

  useEffect(() => {
    fetchAuditLogs(1);
  }, [fetchAuditLogs]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedAction && selectedAction !== "all") params.set("action", selectedAction);
    window.location.href = `/api/admin/audit-logs/export?${params.toString()}`;
  };

  const getActionBadgeClass = (action: string) => {
    const upper = action.toUpperCase();
    if (upper.includes("PROVISION") || upper.includes("CREATED")) {
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    }
    if (upper.includes("ROLE") || upper.includes("CHANGE")) {
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30";
    }
    if (upper.includes("RESET") || upper.includes("LOGOUT")) {
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    }
    if (upper.includes("FAIL") || upper.includes("DELETE") || upper.includes("DEACTIVAT")) {
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
    }
    if (upper.includes("SUCCESS") || upper.includes("COMPLETE") || upper.includes("APPROVED")) {
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    }
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <History size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Audit Log & Security Telemetry
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Immutable, append-only record of administrative mutations, role transitions, and account provisioning.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAuditLogs(pagination.page)}
            className="px-3.5 py-2 rounded-xl bg-card hover:bg-accent text-foreground border border-border text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Refresh logs"
          >
            <RotateCw size={14} className={clsx(loading && "animate-spin")} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Export filtered audit logs to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Events</div>
          <div className="text-2xl font-extrabold text-foreground mt-1">{pagination.total}</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Current Page</div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {pagination.page} <span className="text-sm font-normal text-muted-foreground">/ {pagination.totalPages}</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Page Size</div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{pagination.limit}</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tracked Actions</div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {availableActions.length}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by action, actor, target ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchAuditLogs(1)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Action Dropdown */}
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Action Types</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>

            {/* Start Date */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              title="Start Date filter"
            />

            {/* End Date */}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              title="End Date filter"
            />

            {(search || selectedAction !== "all" || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedAction("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-sm font-medium flex items-center justify-between">
          <span>❌ {error}</span>
          <button type="button" onClick={() => fetchAuditLogs(1)} className="text-xs font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full text-left text-sm text-foreground">
          <thead className="bg-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3.5 w-10"></th>
              <th className="px-4 py-3.5">Timestamp (UTC)</th>
              <th className="px-4 py-3.5">Action</th>
              <th className="px-4 py-3.5">Actor</th>
              <th className="px-4 py-3.5">Target Entity</th>
              <th className="px-4 py-3.5">Details Overview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground font-medium">
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground font-medium">
                  No audit log entries match the selected filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedRows.has(log.id);
                const dateObj = new Date(log.created_at);
                const localStr = dateObj.toLocaleString();
                const utcStr = dateObj.toISOString();

                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRow(log.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                          title="Toggle details"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">{localStr}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{utcStr}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={clsx(
                            "px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border",
                            getActionBadgeClass(log.action)
                          )}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {log.actor_name || "System"}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                          {log.actor_email || (log.user_id ? `ID: ${log.user_id.slice(0, 8)}...` : "Automated Job")}
                        </div>
                        {log.actor_role && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-muted text-secondary">
                            {log.actor_role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.target_table ? (
                          <div>
                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border">
                              {log.target_table}
                            </span>
                            {log.target_id && (
                              <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
                                {log.target_id}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <div className="font-mono text-[11px] text-muted-foreground truncate">
                          {typeof log.details === "object" && log.details !== null
                            ? JSON.stringify(log.details)
                            : String(log.details || "{}")}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Structured Details Drawer */}
                    {isExpanded && (
                      <tr className="bg-muted/15 border-b border-border">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                            <div className="flex items-center justify-between border-b border-border pb-2">
                              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                                <Layers size={14} className="text-secondary" />
                                Event Details & Telemetry
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                Event ID: {log.id}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {/* Metadata Block */}
                              <div className="space-y-1.5 text-muted-foreground">
                                <div>
                                  <strong className="text-foreground">Timestamp:</strong> {utcStr}
                                </div>
                                <div>
                                  <strong className="text-foreground">Actor ID:</strong>{" "}
                                  <span className="font-mono">{log.user_id || "None"}</span>
                                </div>
                                <div>
                                  <strong className="text-foreground">Target Entity:</strong>{" "}
                                  <span className="font-mono">{log.target_table || "—"} : {log.target_id || "—"}</span>
                                </div>
                                {log.ip_hash && (
                                  <div>
                                    <strong className="text-foreground">Hashed IP:</strong>{" "}
                                    <span className="font-mono text-secondary">{log.ip_hash}</span>
                                  </div>
                                )}
                                {log.user_agent_summary && (
                                  <div>
                                    <strong className="text-foreground">Client:</strong> {log.user_agent_summary}
                                  </div>
                                )}
                              </div>

                              {/* Structured Payload JSON */}
                              <div>
                                <div className="text-[11px] font-bold uppercase text-muted-foreground mb-1">
                                  Payload Data
                                </div>
                                <pre className="p-2.5 rounded-lg bg-background border border-border font-mono text-[11px] text-foreground overflow-x-auto max-h-40">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          Showing {logs.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{" "}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fetchAuditLogs(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg bg-card hover:bg-accent border border-border text-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
          >
            <ArrowLeft size={13} />
            <span>Previous</span>
          </button>

          <span className="px-3 py-1.5 font-medium text-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            type="button"
            onClick={() => fetchAuditLogs(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="px-3 py-1.5 rounded-lg bg-card hover:bg-accent border border-border text-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Next</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
