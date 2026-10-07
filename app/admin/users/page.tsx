'use client';

import React, { useState, useEffect } from 'react';

interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: 'admin' | 'judge' | 'participant';
  identifier?: string;
  is_disabled: boolean;
  force_logout_before?: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  user_id: string;
  target_id?: string;
  target_table?: string;
  details: any;
  created_at: string;
  actor_name?: string;
  actor_email?: string;
}

export default function AdminUsersPage() {
  const [mounted, setMounted] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');

  // Modals & Active state
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ password: string; user: Profile } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Bulk Generator State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRole, setBulkRole] = useState<'participant' | 'judge'>('participant');
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [bulkResult, setBulkResult] = useState<any[] | null>(null);

  // Audit Logs
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setProfiles(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (user: Profile) => {
    if (!confirm(`Are you sure you want to reset password and invalidate all active sessions for ${user.name} (${user.email})?`)) {
      return;
    }

    try {
      setIsResetting(true);
      setError(null);
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin one-click reset' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed');

      setResetPasswordResult({
        password: data.data.temporary_password,
        user,
      });
      setSuccessMsg(`Password successfully reset for ${user.email}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleForceLogout = async (user: Profile) => {
    if (!confirm(`Force logout will immediately terminate all active sessions for ${user.name}. Continue?`)) {
      return;
    }

    try {
      setIsLoggingOut(true);
      setError(null);
      const res = await fetch(`/api/admin/users/${user.id}/force-logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin manual revocation' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Force logout failed');

      setSuccessMsg(`All active sessions revoked for ${user.email}.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleToggleDisable = async (user: Profile) => {
    const actionWord = user.is_disabled ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${actionWord} account for ${user.name}?`)) {
      return;
    }

    try {
      setError(null);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-disable',
          user_id: user.id,
          is_disabled: !user.is_disabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status update failed');

      setSuccessMsg(`Account ${actionWord}d successfully.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (user: Profile, newRole: string) => {
    try {
      setError(null);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Role change failed');

      setSuccessMsg(`Role updated to ${newRole} for ${user.email}.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBulkGenerate = async (downloadCsv = false) => {
    try {
      setIsGenerating(true);
      setError(null);

      if (downloadCsv) {
        const res = await fetch('/api/admin/users/bulk-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: bulkRole,
            count: bulkCount,
            prefix: bulkPrefix || undefined,
            format: 'csv',
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'CSV generation failed');
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `badges-${bulkRole}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccessMsg(`Downloaded badge credentials CSV for ${bulkCount} ${bulkRole}s.`);
        setShowBulkModal(false);
        fetchUsers();
      } else {
        const res = await fetch('/api/admin/users/bulk-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: bulkRole,
            count: bulkCount,
            prefix: bulkPrefix || undefined,
            format: 'json',
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Bulk generation failed');

        setBulkResult(data.data);
        setSuccessMsg(`Generated ${data.data.length} credentials successfully.`);
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const res = await fetch('/api/admin/users?audit=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load audit logs');
      setAuditLogs(data.data || []);
      setShowAuditModal(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  if (!mounted) return null;

  // Filter profiles
  const filteredProfiles = profiles.filter((p) => {
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !p.is_disabled) ||
      (statusFilter === 'disabled' && p.is_disabled);
    const matchesSearch =
      searchQuery === '' ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.identifier?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesStatus && matchesSearch;
  });

  const totalUsers = profiles.length;
  const adminCount = profiles.filter((p) => p.role === 'admin').length;
  const judgeCount = profiles.filter((p) => p.role === 'judge').length;
  const participantCount = profiles.filter((p) => p.role === 'participant').length;
  const disabledCount = profiles.filter((p) => p.is_disabled).length;

  return (
    <div className="space-y-6">
      {/* Title & Action Dock */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Admin Governance & Credential Issuance</span>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold">
              ADR-001 / ADR-010
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bulk event provisioning, credential generation, session invalidation, and badge CSV exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAuditLogs()}
            className="px-3.5 py-2 rounded-xl bg-card hover:bg-accent text-foreground border border-border text-sm font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>📜</span>
            <span>Audit Log</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBulkResult(null);
              setShowBulkModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>⚡</span>
            <span>Bulk Credentials</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-sm font-medium flex items-center justify-between shadow-xs">
          <span>❌ {error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-semibold underline text-destructive hover:opacity-80 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center justify-between shadow-xs">
          <span>✅ {successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs font-semibold underline text-emerald-700 dark:text-emerald-300 hover:opacity-80 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Users</div>
          <div className="text-2xl font-extrabold text-foreground mt-1">{totalUsers}</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Participants</div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{participantCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Judges</div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{judgeCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Admins</div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{adminCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disabled</div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{disabledCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card p-3.5 rounded-2xl border border-border shadow-xs">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search by name, email, or badge ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="absolute left-3 top-2.5 text-xs text-muted-foreground pointer-events-none">🔍</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Roles</option>
            <option value="participant">Participants</option>
            <option value="judge">Judges</option>
            <option value="admin">Admins</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>

          <button
            type="button"
            onClick={fetchUsers}
            className="p-2 rounded-xl bg-background hover:bg-accent text-foreground border border-border text-sm transition-colors cursor-pointer"
            title="Refresh Users"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full text-left text-sm text-foreground">
          <thead className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3.5">User</th>
              <th className="px-4 py-3.5">Role</th>
              <th className="px-4 py-3.5">Identifier / Badge</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground font-medium">
                  Loading users...
                </td>
              </tr>
            ) : filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground font-medium">
                  No users found matching filters.
                </td>
              </tr>
            ) : (
              filteredProfiles.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{user.name || 'Unnamed'}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none ${
                        user.role === 'admin'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : user.role === 'judge'
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                      }`}
                    >
                      <option value="participant">Participant</option>
                      <option value="judge">Judge</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                      {user.identifier || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        user.is_disabled
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {user.is_disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleResetPassword(user)}
                        disabled={isResetting}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-card hover:bg-accent text-foreground border border-border transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                        title="Reset password and invalidate sessions"
                      >
                        Reset PW
                      </button>
                      <button
                        type="button"
                        onClick={() => handleForceLogout(user)}
                        disabled={isLoggingOut}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors cursor-pointer disabled:opacity-50"
                        title="Force logout and revoke sessions"
                      >
                        Kick
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleDisable(user)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                          user.is_disabled
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                      >
                        {user.is_disabled ? 'Enable' : 'Disable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Password Reset Result Modal */}
      {resetPasswordResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-foreground">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>🔐 Temporary Password Generated</span>
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <strong>Notice:</strong> Zero Plaintext Persistence. This password will never be shown again and is not stored in plaintext in the database.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">User Email</label>
              <div className="text-sm font-medium text-foreground">{resetPasswordResult.user.email}</div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Temporary Password</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={resetPasswordResult.password}
                  className="font-mono text-base font-bold bg-background border border-border px-3 py-2 rounded-xl text-amber-700 dark:text-amber-400 w-full focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resetPasswordResult.password);
                    alert('Password copied to clipboard!');
                  }}
                  className="px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors cursor-pointer shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setResetPasswordResult(null)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-accent text-foreground border border-border text-sm font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generator Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>⚡ Bulk Credential Generator & Badge Export</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs leading-relaxed">
              <strong>Strict Separation of Admin Accounts (Baseline Line 603):</strong> The bulk generator produces 6-character credentials strictly for participants and judges. Administrative accounts must be provisioned individually with 16+ character high-entropy credentials.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Role</label>
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="participant">Participant</option>
                  <option value="judge">Judge</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Quantity (1–100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Prefix (Optional)</label>
              <input
                type="text"
                placeholder={bulkRole === 'judge' ? 'JUDGE' : 'TEAM'}
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {bulkResult && (
              <div className="mt-3 p-3 rounded-xl bg-muted/60 border border-border max-h-48 overflow-y-auto space-y-1">
                <div className="text-xs font-bold text-muted-foreground mb-2">
                  Generated {bulkResult.length} Credentials:
                </div>
                {bulkResult.map((c, i) => (
                  <div key={i} className="flex justify-between text-xs font-mono text-foreground">
                    <span>{c.email}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">{c.password}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-accent text-foreground border border-border text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBulkGenerate(false)}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl bg-card hover:bg-accent text-foreground border border-border text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Preview in Console'}
              </button>
              <button
                type="button"
                onClick={() => handleBulkGenerate(true)}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? 'Exporting...' : 'Export Badge CSV'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Viewer Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>📜 Security Audit Logs (Append-Only)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-border pr-1">
              {loadingAudit ? (
                <div className="p-8 text-center text-muted-foreground font-medium">Loading audit trail...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-medium">No audit events recorded.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{log.action}</span>
                      <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Actor: <span className="font-medium text-foreground">{log.actor_email || log.user_id}</span>
                    </div>
                    {log.details && (
                      <pre className="text-[11px] font-mono text-muted-foreground bg-muted p-2.5 rounded-lg border border-border overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-accent text-foreground border border-border text-sm font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
