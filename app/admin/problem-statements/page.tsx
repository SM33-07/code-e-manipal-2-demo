"use client";

import React, { useState, useEffect } from 'react';
import {
  FileQuestion,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Unlock,
  Eye,
  CheckCircle2,
  Tag,
  Clock,
  Download,
  AlertCircle,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProblemStatement {
  id: string;
  title: string;
  track: string;
  description: string;
  requirements: string[];
  deliverables: string[];
  constraints: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface EventConfig {
  problem_statements_published: boolean;
  problem_selection_start: string | null;
  problem_selection_end: string | null;
}

const OFFICIAL_TRACKS = [
  'Artificial Intelligence and Machine Learning (AI/ML)',
  'HealthTech',
  'FinTech and EdTech',
  'Cybersecurity',
  'Generative AI and Large Language Models (LLMs)',
  'Multi-Agent Systems',
  'Gaming and Immersive Technology',
  'Smart City and Infrastructure',
  'Open Innovation',
];

export default function AdminProblemStatementsPage() {
  const [loading, setLoading] = useState(true);
  const [statements, setStatements] = useState<ProblemStatement[]>([]);
  const [config, setConfig] = useState<EventConfig | null>(null);

  // Filters
  const [trackFilter, setTrackFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isWindowModalOpen, setIsWindowModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingStatement, setEditingStatement] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Window form states
  const [windowStart, setWindowStart] = useState('2026-10-15T12:45');
  const [windowEnd, setWindowEnd] = useState('2026-10-15T16:00');

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/problem-statements');
      if (!res.ok) throw new Error('Failed to fetch problem statements');
      const json = await res.json();
      if (json.success) {
        setStatements(json.data.statements);
        setConfig(json.data.config);
        if (json.data.config?.problem_selection_start) {
          setWindowStart(new Date(json.data.config.problem_selection_start).toISOString().slice(0, 16));
        }
        if (json.data.config?.problem_selection_end) {
          setWindowEnd(new Date(json.data.config.problem_selection_end).toISOString().slice(0, 16));
        }
      }
    } catch (err: any) {
      toast.error('Error loading statements: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Publish / Unpublish individual statement
  const handleTogglePublish = async (id: string, currentlyPublished: boolean) => {
    const endpoint = currentlyPublished
      ? `/api/admin/problem-statements/${id}/unpublish`
      : `/api/admin/problem-statements/${id}/publish`;

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Action failed');
      toast.success(currentlyPublished ? 'Statement unpublished' : 'Statement published live');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Save Statement (Create or Update)
  const handleSaveStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStatement?.id || !editingStatement?.title || !editingStatement?.track || !editingStatement?.description) {
      toast.error('ID, Track, Title, and Description are required');
      return;
    }

    try {
      const payload = {
        ...editingStatement,
        requirements: typeof editingStatement.requirements === 'string'
          ? editingStatement.requirements.split('\n').map((s: string) => s.trim()).filter(Boolean)
          : editingStatement.requirements,
        deliverables: typeof editingStatement.deliverables === 'string'
          ? editingStatement.deliverables.split('\n').map((s: string) => s.trim()).filter(Boolean)
          : editingStatement.deliverables,
      };

      const isUpdate = statements.some(s => s.id === editingStatement.id);
      const url = isUpdate
        ? `/api/admin/problem-statements/${editingStatement.id}`
        : `/api/admin/problem-statements`;
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Save failed');

      toast.success(isUpdate ? 'Problem statement updated' : 'Problem statement created');
      setIsEditModalOpen(false);
      setEditingStatement(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Save Selection Window
  const handleSaveWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/event-config/selection-window', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selection_start: new Date(windowStart).toISOString(),
          selection_end: new Date(windowEnd).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Failed to update selection window');
      toast.success('Selection window updated');
      setIsWindowModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Delete Statement
  const handleDeleteStatement = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/problem-statements/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Delete failed');
      toast.success('Problem statement deleted');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Filter statements
  const filteredStatements = statements.filter((s) => {
    const matchesTrack = trackFilter === 'ALL' || s.track === trackFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'published' && s.is_published) ||
      (statusFilter === 'draft' && !s.is_published);
    const matchesSearch =
      !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.track.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTrack && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Problem Statements Management
            </h1>
            {config?.problem_statements_published ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Globe size={12} />
                VAULT OPEN (LIVE)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Lock size={12} />
                VAULT SEALED (DRAFT)
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Author official challenge briefs, attach supporting PDFs, and manage team selection windows.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsWindowModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <Clock size={14} />
            Selection Window
          </button>

          <button
            onClick={() => {
              setEditingStatement({
                id: `PS-${String(statements.length + 1).padStart(2, '0')}`,
                track: OFFICIAL_TRACKS[0],
                title: '',
                description: '',
                requirements: '',
                deliverables: '',
                constraints: '',
                attachment_url: '',
                attachment_name: '',
                is_published: false,
                display_order: statements.length + 1,
              });
              setIsEditModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            Add Problem Statement
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, title, track, keywords..."
            className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="ALL">All Tracks</option>
            {OFFICIAL_TRACKS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="published">Published Only</option>
            <option value="draft">Drafts Only</option>
          </select>
        </div>
      </div>

      {/* Problem Statements List / Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-border bg-muted/40 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Problem Statements Repository ({filteredStatements.length})
          </span>
          <span className="text-xs text-muted-foreground">
            Official Content Status: {statements.filter(s => s.is_published).length} Published / {statements.filter(s => !s.is_published).length} Drafts
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading problem statements...
          </div>
        ) : filteredStatements.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">No problem statements found.</p>
            <p className="text-xs">
              Click &quot;Add Problem Statement&quot; to author a new challenge draft. All content remains private until explicitly published.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredStatements.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-accent/40 transition-colors"
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/30 text-primary">
                      {item.id}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary bg-secondary/15 px-2.5 py-0.5 rounded-full border border-secondary/25">
                      <Tag size={11} />
                      {item.track}
                    </span>
                    {item.is_published ? (
                      <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        PUBLISHED
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        DRAFT
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {item.attachment_url && (
                    <div className="flex items-center gap-1.5 text-xs text-secondary font-medium pt-1">
                      <Download size={13} />
                      <span>Attached: {item.attachment_name || 'Supporting PDF'}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleTogglePublish(item.id, item.is_published)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      item.is_published
                        ? 'border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {item.is_published ? <Lock size={12} /> : <Unlock size={12} />}
                    {item.is_published ? 'Unpublish' : 'Publish Live'}
                  </button>

                  <button
                    onClick={() => {
                      setEditingStatement({
                        ...item,
                        requirements: Array.isArray(item.requirements) ? item.requirements.join('\n') : '',
                        deliverables: Array.isArray(item.deliverables) ? item.deliverables.join('\n') : '',
                      });
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Edit Statement"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="p-2 rounded-lg border border-border bg-card text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Statement"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit / Create Statement Modal */}
      {isEditModalOpen && editingStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">
                {statements.some(s => s.id === editingStatement.id)
                  ? `Edit Problem Statement (${editingStatement.id})`
                  : 'Author New Problem Statement'}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStatement} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Statement ID (e.g. PS-01, PS-AIML-01)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStatement.id || ''}
                    onChange={(e) => setEditingStatement({ ...editingStatement, id: e.target.value.toUpperCase() })}
                    placeholder="e.g. PS-01"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Official Track
                  </label>
                  <select
                    value={editingStatement.track || OFFICIAL_TRACKS[0]}
                    onChange={(e) => setEditingStatement({ ...editingStatement, track: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                  >
                    {OFFICIAL_TRACKS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Challenge Title
                </label>
                <input
                  type="text"
                  required
                  value={editingStatement.title || ''}
                  onChange={(e) => setEditingStatement({ ...editingStatement, title: e.target.value })}
                  placeholder="e.g. Autonomous Multi-Modal Copilot for Rural Diagnostics"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Problem Description / Brief
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingStatement.description || ''}
                  onChange={(e) => setEditingStatement({ ...editingStatement, description: e.target.value })}
                  placeholder="Comprehensive description of the challenge, background, and expected approach..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Core Requirements (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={editingStatement.requirements || ''}
                    onChange={(e) => setEditingStatement({ ...editingStatement, requirements: e.target.value })}
                    placeholder="Requirement 1&#10;Requirement 2&#10;Requirement 3"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Expected Deliverables (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={editingStatement.deliverables || ''}
                    onChange={(e) => setEditingStatement({ ...editingStatement, deliverables: e.target.value })}
                    placeholder="Deliverable 1&#10;Deliverable 2&#10;Deliverable 3"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Constraints & Evaluation Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editingStatement.constraints || ''}
                  onChange={(e) => setEditingStatement({ ...editingStatement, constraints: e.target.value })}
                  placeholder="e.g. Must run on low-bandwidth connections or offline-first..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Attachment URL (Optional PDF/Resource)
                  </label>
                  <input
                    type="url"
                    value={editingStatement.attachment_url || ''}
                    onChange={(e) => setEditingStatement({ ...editingStatement, attachment_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Attachment Display Name
                  </label>
                  <input
                    type="text"
                    value={editingStatement.attachment_name || ''}
                    onChange={(e) => setEditingStatement({ ...editingStatement, attachment_name: e.target.value })}
                    placeholder="e.g. Official Technical Specification.pdf"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="publishCheckbox"
                  checked={Boolean(editingStatement.is_published)}
                  onChange={(e) => setEditingStatement({ ...editingStatement, is_published: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="publishCheckbox" className="text-xs font-semibold text-foreground">
                  Publish immediately (Visible to participants on /problem-statements)
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Save Problem Statement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selection Window Configuration Modal */}
      {isWindowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                Configure Problem Selection Window
              </h3>
              <button onClick={() => setIsWindowModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveWindow} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Selection Release Time (Default: 12:45 PM, 15 Oct 2026)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Selection Cutoff Deadline (Default: 4:00 PM, 15 Oct 2026)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsWindowModalOpen(false)}
                  className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Update Window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Confirm Statement Deletion</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete this problem statement? If any teams have selected it, deletion will be safely rejected.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteStatement(deleteConfirmId)}
                className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Delete Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
