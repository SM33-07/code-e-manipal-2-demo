"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  CheckCircle2,
  FileText,
  Download,
  Tag,
  ArrowRight,
  Filter,
} from 'lucide-react';

export interface ProblemStatementItem {
  id: string;
  title: string;
  track: string;
  description: string;
  requirements: string[];
  deliverables: string[];
  constraints: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  display_order: number;
}

export function ProblemStatementsList({
  statements,
  tracks,
}: {
  statements: ProblemStatementItem[];
  tracks: string[];
}) {
  const [selectedTrack, setSelectedTrack] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = statements.filter((item) => {
    const matchesTrack = selectedTrack === 'ALL' || item.track === selectedTrack;
    const matchesSearch =
      !searchQuery ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.track.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTrack && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search and Track Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search problem statements by ID, title, keyword..."
            className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="ALL">All Tracks ({statements.length})</option>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {filtered.length} of {statements.length} problem statements</span>
      </div>

      {/* Statement Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No problem statements match your current search or track filter.
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow space-y-5"
            >
              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary">
                    {item.id}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary bg-secondary/15 px-3 py-1 rounded-full border border-secondary/25">
                    <Tag size={12} />
                    {item.track}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>

              {/* Constraints (if any) */}
              {item.constraints && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  <span className="font-bold uppercase tracking-wider block mb-1">Constraints:</span>
                  {item.constraints}
                </div>
              )}

              {/* Requirements & Deliverables */}
              <div className="grid gap-6 sm:grid-cols-2 pt-2 border-t border-border">
                {Array.isArray(item.requirements) && item.requirements.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                      Core Requirements
                    </h3>
                    <ul className="space-y-2">
                      {item.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                          <CheckCircle2 size={14} className="text-secondary shrink-0 mt-0.5" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(item.deliverables) && item.deliverables.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                      Expected Deliverables
                    </h3>
                    <ul className="space-y-2">
                      {item.deliverables.map((del, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                          <CheckCircle2 size={14} className="text-primary shrink-0 mt-0.5" />
                          <span>{del}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer Actions & Attachment */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                {item.attachment_url ? (
                  <a
                    href={item.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:underline"
                  >
                    <Download size={14} />
                    Download Official Brief ({item.attachment_name || 'PDF Attachment'})
                  </a>
                ) : (
                  <span />
                )}

                <Link
                  href="/submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                >
                  Submit Solution
                  <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
