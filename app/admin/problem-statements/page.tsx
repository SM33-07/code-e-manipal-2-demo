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
  Check,
  AlertTriangle,
  History,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Cpu,
  Wrench,
  Lightbulb,
  Building,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProblemStatementDraft {
  id: string;
  release_id: string;
  challenge_num: number;
  track_num: string;
  track: string;
  original_ref_id: string;
  proposed_id: string;
  title: string;
  difficulty: string;
  build_type: string;
  review_status: string;
  category_state: 'selected' | 'hold' | 'new_proposal';
  is_approved_for_release: boolean;
  is_official_sih: boolean;
  scope_note?: string | null;
  problem_statement: string;
  implementation_challenge: string;
  minimum_acceptable_prototype: string;
  evaluation_tests: string;
  stretch_differentiator: string;
  suggested_public_sector_relevance?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface ProblemStatementRelease {
  id: string;
  version_number: number;
  label: string;
  status: 'draft' | 'published' | 'archived' | 'withdrawn';
  is_current_published: boolean;
  published_at?: string | null;
  release_notes?: string | null;
  stats?: {
    total_drafts: number;
    approved_drafts: number;
    held_drafts: number;
    new_proposals: number;
  };
}

interface AuditLog {
  id: string;
  action: string;
  actor_name?: string;
  actor_email?: string;
  metadata: any;
  created_at: string;
}

export default function AdminProblemStatementsPage() {
  const [loading, setLoading] = useState(true);
  const [releases, setReleases] = useState<ProblemStatementRelease[]>([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>('');
  const [drafts, setDrafts] = useState<ProblemStatementDraft[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Filter states
  const [trackFilter, setTrackFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // ALL, selected, hold, new_proposal, approved
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<ProblemStatementDraft | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<ProblemStatementDraft | null>(null);
  const [isNewReleaseModalOpen, setIsNewReleaseModalOpen] = useState(false);
  const [newReleaseLabel, setNewReleaseLabel] = useState('');
  const [newReleaseNotes, setNewReleaseNotes] = useState('');
  const [cloneFromId, setCloneFromId] = useState('');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isUnpublishModalOpen, setIsUnpublishModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Expanded card state
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);

  const fetchData = async (releaseId?: string) => {
    try {
      setLoading(true);
      const url = releaseId
        ? `/api/admin/problem-statements?releaseId=${encodeURIComponent(releaseId)}`
        : '/api/admin/problem-statements';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load problem statement data');
      const json = await res.json();
      if (json.success) {
        setReleases(json.data.releases || []);
        setSelectedReleaseId(json.data.selectedReleaseId || '');
        setDrafts(json.data.drafts || []);
        setAuditLogs(json.data.auditLogs || []);
        if (!cloneFromId && json.data.selectedReleaseId) {
          setCloneFromId(json.data.selectedReleaseId);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading statements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectRelease = (relId: string) => {
    setSelectedReleaseId(relId);
    fetchData(relId);
  };

  const currentRelease = releases.find((r) => r.id === selectedReleaseId);
  const publishedRelease = releases.find((r) => r.is_current_published);

  // Toggle approval for a single draft
  const handleToggleApproval = async (draftId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/problem-statements/drafts/${draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved: !currentStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update approval');
      }
      toast.success(
        !currentStatus
          ? `Approved ${json.data.proposed_id} for release`
          : `Removed ${json.data.proposed_id} from approved release`
      );
      // Update local state
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? { ...d, is_approved_for_release: !currentStatus } : d))
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Bulk approve all 13 selected items
  const handleBulkApproveSelected = async () => {
    const selectedDrafts = drafts.filter((d) => d.category_state === 'selected' && !d.is_approved_for_release);
    if (selectedDrafts.length === 0) {
      toast.info('All 13 selected briefs are already approved.');
      return;
    }

    try {
      for (const d of selectedDrafts) {
        await fetch(`/api/admin/problem-statements/drafts/${d.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isApproved: true }),
        });
      }
      toast.success(`Approved ${selectedDrafts.length} selected challenge briefs for release.`);
      fetchData(selectedReleaseId);
    } catch (err: any) {
      toast.error('Bulk approval failed: ' + err.message);
    }
  };

  // Save edited draft
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDraft) return;

    try {
      const res = await fetch(`/api/admin/problem-statements/drafts/${editingDraft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDraft),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save draft');
      }
      toast.success(`Updated ${editingDraft.proposed_id}`);
      setIsEditModalOpen(false);
      setDrafts((prev) => prev.map((d) => (d.id === editingDraft.id ? json.data : d)));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Create new release version
  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReleaseLabel.trim()) {
      toast.error('Release label is required');
      return;
    }

    try {
      const res = await fetch('/api/admin/problem-statements/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newReleaseLabel.trim(),
          sourceReleaseId: cloneFromId || undefined,
          releaseNotes: newReleaseNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create release');
      }
      toast.success(`Created Release v${json.data.version_number}`);
      setIsNewReleaseModalOpen(false);
      setNewReleaseLabel('');
      setNewReleaseNotes('');
      fetchData(json.data.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Publish Release
  const handlePublishRelease = async () => {
    if (!selectedReleaseId) return;
    try {
      const res = await fetch(`/api/admin/problem-statements/releases/${selectedReleaseId}/publish`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to publish release');
      }
      toast.success(`Release v${json.data.version_number} is now LIVE on /problem-statements!`);
      setIsPublishModalOpen(false);
      fetchData(selectedReleaseId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Emergency Unpublish
  const handleUnpublishRelease = async () => {
    if (!selectedReleaseId) return;
    try {
      const res = await fetch(`/api/admin/problem-statements/releases/${selectedReleaseId}/unpublish`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to unpublish release');
      }
      toast.warning('Release withdrawn. /problem-statements is now sealed.');
      setIsUnpublishModalOpen(false);
      fetchData(selectedReleaseId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Filtered drafts list
  const filteredDrafts = drafts.filter((d) => {
    const matchesTrack = trackFilter === 'ALL' || d.track === trackFilter;
    let matchesCategory = true;
    if (categoryFilter === 'approved') {
      matchesCategory = d.is_approved_for_release;
    } else if (categoryFilter !== 'ALL') {
      matchesCategory = d.category_state === categoryFilter;
    }

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      d.proposed_id.toLowerCase().includes(q) ||
      d.original_ref_id.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.track.toLowerCase().includes(q);

    return matchesTrack && matchesCategory && matchesSearch;
  });

  const tracks = Array.from(new Set(drafts.map((d) => d.track))).filter(Boolean);
  const approvedCount = drafts.filter((d) => d.is_approved_for_release).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-2 border-b border-secondary/50 pb-1 text-[11px] font-bold uppercase tracking-wider text-secondary">
            <Tag size={13} />
            Problem Statement CMS & Versioning
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Problem Statement Workflow
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage, approve, version, and publish challenge briefs from the 35-page Technical Review Edition.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <History size={14} />
            Audit Logs
          </button>
          <button
            onClick={() => setIsNewReleaseModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <Plus size={14} />
            New Version
          </button>
          {currentRelease?.is_current_published ? (
            <button
              onClick={() => setIsUnpublishModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
            >
              <Lock size={14} />
              Emergency Unpublish
            </button>
          ) : (
            <button
              onClick={() => setIsPublishModalOpen(true)}
              disabled={approvedCount === 0}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors shadow-sm ${
                approvedCount > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              }`}
            >
              <Globe size={14} />
              Publish Approved ({approvedCount})
            </button>
          )}
        </div>
      </div>

      {/* Release Status & Selection Ribbon */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-secondary/15 text-secondary">
            {currentRelease?.is_current_published ? <Unlock size={20} /> : <Lock size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Working Release:
              </span>
              <select
                value={selectedReleaseId}
                onChange={(e) => handleSelectRelease(e.target.value)}
                className="rounded-xl border border-border bg-surface px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none"
              >
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    v{r.version_number} — {r.label} ({r.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentRelease?.is_current_published
                ? '🟢 This version is currently LIVE on /problem-statements'
                : '🟡 This version is in DRAFT. None of its contents are visible to participants.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="rounded-2xl border border-border bg-surface px-3 py-1.5">
            <span className="text-muted-foreground">Total Briefs: </span>
            <span className="font-bold text-foreground">{drafts.length}</span>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
            Approved: {approvedCount}
          </div>
          <div className="rounded-2xl border border-border bg-surface px-3 py-1.5">
            <span className="text-muted-foreground">On Hold: </span>
            <span className="font-bold text-amber-600">
              {drafts.filter((d) => d.category_state === 'hold').length}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-surface px-3 py-1.5">
            <span className="text-muted-foreground">Proposals: </span>
            <span className="font-bold text-indigo-600">
              {drafts.filter((d) => d.category_state === 'new_proposal').length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID (e.g. SIH26166, HX-AI-01) or title..."
            className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="ALL">All Categories ({drafts.length})</option>
            <option value="selected">Selected for Review ({drafts.filter((d) => d.category_state === 'selected').length})</option>
            <option value="hold">On Hold ({drafts.filter((d) => d.category_state === 'hold').length})</option>
            <option value="new_proposal">New Proposals ({drafts.filter((d) => d.category_state === 'new_proposal').length})</option>
            <option value="approved">Approved for Release ({approvedCount})</option>
          </select>

          {/* Track Filter */}
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="ALL">All Tracks</option>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Bulk Approve Action */}
          <button
            onClick={handleBulkApproveSelected}
            className="rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
          >
            Approve All 13 Selected
          </button>
        </div>
      </div>

      {/* Briefs Grid */}
      <div className="space-y-4">
        {filteredDrafts.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            No briefs match your filter settings.
          </div>
        ) : (
          filteredDrafts.map((d) => {
            const isExpanded = expandedDraftId === d.id;
            return (
              <div
                key={d.id}
                className={`rounded-3xl border transition-all p-5 sm:p-6 bg-card shadow-sm ${
                  d.is_approved_for_release ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'
                }`}
              >
                {/* Header Line */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {d.original_ref_id}
                    </span>
                    <span className="rounded-full bg-surface border border-border px-2.5 py-0.5 text-xs font-mono font-bold text-foreground">
                      {d.proposed_id}
                    </span>
                    {d.category_state === 'hold' && (
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                        HOLD
                      </span>
                    )}
                    {d.category_state === 'new_proposal' && (
                      <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-400">
                        NEW PROPOSAL
                      </span>
                    )}
                    {d.is_official_sih && (
                      <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-400">
                        OFFICIAL SIH
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-medium">
                      Track {d.track_num} &middot; {d.track}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Approve Toggle */}
                    <button
                      onClick={() => handleToggleApproval(d.id, d.is_approved_for_release)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        d.is_approved_for_release
                          ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                          : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      {d.is_approved_for_release ? (
                        <>
                          <Check size={13} /> Approved for Release
                        </>
                      ) : (
                        'Approve for Event'
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setPreviewDraft(d);
                        setIsPreviewModalOpen(true);
                      }}
                      title="Preview Public Card"
                      className="p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <Eye size={15} />
                    </button>

                    <button
                      onClick={() => {
                        setEditingDraft({ ...d });
                        setIsEditModalOpen(true);
                      }}
                      title="Edit Brief"
                      className="p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      onClick={() => setExpandedDraftId(isExpanded ? null : d.id)}
                      className="p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="mt-3 text-lg font-bold text-foreground">
                  {d.title}
                </h3>

                {/* Core Problem Statement */}
                <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
                  {d.problem_statement}
                </p>

                {/* Expanded Technical Criteria */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border/60 space-y-3.5 text-xs">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Cpu size={13} className="text-primary" /> Implementation Challenge:
                      </span>
                      <p className="mt-1 pl-4 text-foreground/90 leading-relaxed">{d.implementation_challenge}</p>
                    </div>

                    <div>
                      <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Wrench size={13} className="text-primary" /> Minimum Acceptable Prototype:
                      </span>
                      <p className="mt-1 pl-4 text-foreground/90 leading-relaxed">{d.minimum_acceptable_prototype}</p>
                    </div>

                    <div>
                      <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle size={13} className="text-primary" /> Evaluation / Failure Tests:
                      </span>
                      <p className="mt-1 pl-4 text-foreground/90 leading-relaxed">{d.evaluation_tests}</p>
                    </div>

                    <div>
                      <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Lightbulb size={13} className="text-primary" /> Stretch / Differentiator:
                      </span>
                      <p className="mt-1 pl-4 text-foreground/90 leading-relaxed">{d.stretch_differentiator}</p>
                    </div>

                    {d.suggested_public_sector_relevance && (
                      <div>
                        <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Building size={13} className="text-primary" /> Public-Sector Relevance:
                        </span>
                        <p className="mt-1 pl-4 text-foreground/90 leading-relaxed">{d.suggested_public_sector_relevance}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Draft Modal */}
      {isEditModalOpen && editingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit Challenge Brief</h3>
                <span className="text-xs text-muted-foreground">
                  {editingDraft.original_ref_id} &middot; {editingDraft.proposed_id}
                </span>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDraft} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Title</label>
                <input
                  type="text"
                  value={editingDraft.title}
                  onChange={(e) => setEditingDraft({ ...editingDraft, title: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-foreground text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Difficulty</label>
                  <input
                    type="text"
                    value={editingDraft.difficulty}
                    onChange={(e) => setEditingDraft({ ...editingDraft, difficulty: e.target.value })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-foreground text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Build Type</label>
                  <input
                    type="text"
                    value={editingDraft.build_type}
                    onChange={(e) => setEditingDraft({ ...editingDraft, build_type: e.target.value })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-foreground text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Problem Statement</label>
                <textarea
                  rows={3}
                  value={editingDraft.problem_statement}
                  onChange={(e) => setEditingDraft({ ...editingDraft, problem_statement: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-foreground text-xs leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Implementation Challenge</label>
                <textarea
                  rows={3}
                  value={editingDraft.implementation_challenge}
                  onChange={(e) => setEditingDraft({ ...editingDraft, implementation_challenge: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-foreground text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Minimum Acceptable Prototype</label>
                <textarea
                  rows={3}
                  value={editingDraft.minimum_acceptable_prototype}
                  onChange={(e) => setEditingDraft({ ...editingDraft, minimum_acceptable_prototype: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-foreground text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Evaluation & Failure Tests</label>
                <textarea
                  rows={3}
                  value={editingDraft.evaluation_tests}
                  onChange={(e) => setEditingDraft({ ...editingDraft, evaluation_tests: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-foreground text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Stretch / Differentiator</label>
                <textarea
                  rows={2}
                  value={editingDraft.stretch_differentiator}
                  onChange={(e) => setEditingDraft({ ...editingDraft, stretch_differentiator: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-foreground text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Public Sector Relevance</label>
                <input
                  type="text"
                  value={editingDraft.suggested_public_sector_relevance || ''}
                  onChange={(e) => setEditingDraft({ ...editingDraft, suggested_public_sector_relevance: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-foreground text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewModalOpen && previewDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-7 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                Public Card Preview (Participant View)
              </span>
              <button onClick={() => setIsPreviewModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {previewDraft.original_ref_id}
                </span>
                <span className="rounded-full bg-surface border border-border px-2.5 py-0.5 text-xs font-mono font-bold text-foreground">
                  {previewDraft.proposed_id}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Track {previewDraft.track_num} &middot; {previewDraft.track}
                </span>
              </div>

              <h2 className="text-xl font-bold text-foreground font-serif">{previewDraft.title}</h2>
              <p className="text-sm text-foreground/80 leading-relaxed">{previewDraft.problem_statement}</p>

              <div className="pt-3 border-t border-border/60 space-y-3 text-xs">
                <div>
                  <span className="font-bold uppercase tracking-wider text-muted-foreground">Implementation Challenge:</span>
                  <p className="mt-0.5 text-foreground/90">{previewDraft.implementation_challenge}</p>
                </div>
                <div>
                  <span className="font-bold uppercase tracking-wider text-muted-foreground">Minimum Prototype:</span>
                  <p className="mt-0.5 text-foreground/90">{previewDraft.minimum_acceptable_prototype}</p>
                </div>
                <div>
                  <span className="font-bold uppercase tracking-wider text-muted-foreground">Evaluation Criteria:</span>
                  <p className="mt-0.5 text-foreground/90">{previewDraft.evaluation_tests}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Release Modal */}
      {isNewReleaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Create New Release Version</h3>
              <button onClick={() => setIsNewReleaseModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRelease} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Release Label</label>
                <input
                  type="text"
                  placeholder="e.g. Official Event Day Release"
                  value={newReleaseLabel}
                  onChange={(e) => setNewReleaseLabel(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-foreground text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Clone Drafts From</label>
                <select
                  value={cloneFromId}
                  onChange={(e) => setCloneFromId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-foreground text-xs"
                >
                  <option value="">Do not clone (Empty release)</option>
                  {releases.map((r) => (
                    <option key={r.id} value={r.id}>
                      v{r.version_number} — {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Release Notes</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of changes in this version..."
                  value={newReleaseNotes}
                  onChange={(e) => setNewReleaseNotes(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-foreground text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewReleaseModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Create Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Confirmation Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Confirm Publication</h3>
                <p className="text-xs text-muted-foreground">This action makes problem statements publicly visible.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Version:</span>
                <span className="font-bold text-foreground">v{currentRelease?.version_number} ({currentRelease?.label})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved Challenges:</span>
                <span className="font-bold text-emerald-600">{approvedCount} challenges</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unapproved / Held Items:</span>
                <span className="font-bold text-amber-600">{drafts.length - approvedCount} items will stay hidden</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Once published, participants accessing <code className="font-mono text-foreground font-semibold">/problem-statements</code> will immediately see the {approvedCount} approved challenge briefs.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishRelease}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                Confirm &amp; Publish Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Unpublish Modal */}
      {isUnpublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-destructive/10 text-destructive">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Emergency Unpublish</h3>
                <p className="text-xs text-muted-foreground">Withdraw active release from public view</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to withdraw the active release? The public route <code className="font-mono text-foreground font-semibold">/problem-statements</code> will immediately return to the locked vault holding page.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsUnpublishModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnpublishRelease}
                className="rounded-xl bg-destructive px-5 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
              >
                Withdraw Immediately
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Drawer / Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <History size={18} className="text-primary" />
                <h3 className="text-base font-bold text-foreground">Problem Statement Audit Trail</h3>
              </div>
              <button onClick={() => setIsAuditModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">No audit logs recorded yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-border bg-surface p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{log.action}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>Actor: {log.actor_name || log.actor_email || 'System'}</span>
                    </div>
                    {log.metadata && (
                      <pre className="mt-1 text-[10px] font-mono bg-card p-2 rounded-xl border border-border/60 overflow-x-auto text-muted-foreground">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
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
