"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  X,
  Copy,
  Check,
  Code,
  Cpu,
  Compass,
  Workflow,
  Layers,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  Activity,
  Landmark,
  ShieldCheck,
  Sparkles,
  Network,
  Gamepad2,
  Building2,
  FileText,
} from 'lucide-react';
import type { PublicProblemStatement } from '@/services/problemStatementService';

function getTrackIcon(track: string) {
  const t = track.toLowerCase();
  if (t.includes('earth') || t.includes('ai/ml')) return Activity;
  if (t.includes('health')) return Activity;
  if (t.includes('fintech') || t.includes('edtech') || t.includes('legal')) return Landmark;
  if (t.includes('cyber')) return ShieldCheck;
  if (t.includes('generative') || t.includes('llm')) return Sparkles;
  if (t.includes('multi-agent') || t.includes('logistics')) return Network;
  if (t.includes('gaming')) return Gamepad2;
  if (t.includes('smart city') || t.includes('infrastructure')) return Building2;
  if (t.includes('hardware')) return Cpu;
  return Layers;
}

function getBuildTypeIcon(buildType: string) {
  const b = buildType.toLowerCase();
  if (b.includes('hardware')) return Cpu;
  if (b.includes('geospatial')) return Compass;
  if (b.includes('simulation')) return Workflow;
  return Code;
}

const BUILD_TYPE_PRESETS = [
  { label: 'All Build Types', value: 'ALL' },
  { label: 'Software', value: 'Software' },
  { label: 'Hardware + Software', value: 'Hardware + Software' },
  { label: 'Geospatial', value: 'Geospatial' },
  { label: 'Simulation', value: 'Simulation' },
  { label: 'Hardware Optional', value: 'Optional' },
];

export function ProblemStatementsList({
  statements,
  tracks,
}: {
  statements: PublicProblemStatement[];
  tracks: string[];
}) {
  const router = useRouter();
  const [selectedTrack, setSelectedTrack] = useState<string>('ALL');
  const [selectedBuildType, setSelectedBuildType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'official' | 'id_desc' | 'title_asc' | 'title_desc'>('official');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearFilters = () => {
    setSelectedTrack('ALL');
    setSelectedBuildType('ALL');
    setSearchQuery('');
    setSortBy('official');
  };

  const isFilteringActive =
    selectedTrack !== 'ALL' ||
    selectedBuildType !== 'ALL' ||
    searchQuery.trim() !== '' ||
    sortBy !== 'official';

  const filteredAndSorted = useMemo(() => {
    let result = statements.filter((item) => {
      // Track filter
      if (selectedTrack !== 'ALL' && item.track.toLowerCase() !== selectedTrack.toLowerCase()) {
        return false;
      }

      // Build type filter
      if (selectedBuildType !== 'ALL') {
        const b = item.build_type.toLowerCase();
        if (selectedBuildType === 'Hardware + Software') {
          if (!b.includes('hardware') || !b.includes('software')) return false;
        } else if (selectedBuildType === 'Geospatial') {
          if (!b.includes('geospatial')) return false;
        } else if (selectedBuildType === 'Simulation') {
          if (!b.includes('simulation')) return false;
        } else if (selectedBuildType === 'Optional') {
          if (!b.includes('optional')) return false;
        } else if (selectedBuildType === 'Software') {
          // Pure software or starting with software
          if (b.includes('hardware') && !b.includes('optional')) return false;
        } else {
          if (!b.includes(selectedBuildType.toLowerCase())) return false;
        }
      }

      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesId =
          item.id.toLowerCase().includes(q) ||
          item.id.replace(/[^a-z0-9]/gi, '').toLowerCase().includes(q.replace(/[^a-z0-9]/gi, ''));
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesTrack = item.track.toLowerCase().includes(q) || (item.track_num && item.track_num.toLowerCase().includes(q));
        const matchesDescription = item.problem_statement.toLowerCase().includes(q);
        const matchesBuildType = item.build_type.toLowerCase().includes(q);
        const matchesDeliverables = (item.deliverables || '').toLowerCase().includes(q);

        if (!matchesId && !matchesTitle && !matchesTrack && !matchesDescription && !matchesBuildType && !matchesDeliverables) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'official') {
        return a.display_order - b.display_order;
      }
      if (sortBy === 'id_desc') {
        return b.display_order - a.display_order;
      }
      if (sortBy === 'title_asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'title_desc') {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });

    return result;
  }, [statements, selectedTrack, selectedBuildType, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* Search, Filter & Sort Control Bar */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-sm">
        {/* Top Search & Filter Dropdowns */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID (e.g. PS 01, PS 28), title, track, or keywords..."
              className="w-full rounded-2xl border border-border bg-surface pl-10 pr-10 py-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Secondary Controls (Build Type & Sort) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Build Type Selector */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-1.5 text-xs">
              <SlidersHorizontal size={13} className="text-muted-foreground shrink-0" />
              <label htmlFor="build-type-select" className="text-muted-foreground font-medium hidden sm:inline">Build:</label>
              <select
                id="build-type-select"
                value={selectedBuildType}
                onChange={(e) => setSelectedBuildType(e.target.value)}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                {BUILD_TYPE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value} className="bg-card text-foreground">
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-1.5 text-xs">
              <label htmlFor="sort-select" className="text-muted-foreground font-medium hidden sm:inline">Sort:</label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                <option value="official" className="bg-card text-foreground">Official PS Order (01–35)</option>
                <option value="id_desc" className="bg-card text-foreground">Problem ID (35–01)</option>
                <option value="title_asc" className="bg-card text-foreground">Title (A – Z)</option>
                <option value="title_desc" className="bg-card text-foreground">Title (Z – A)</option>
              </select>
            </div>

            {/* Reset Filters Action */}
            {isFilteringActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border/80 bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Track Navigation Pills */}
        <div className="pt-2 border-t border-border/60">
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Filter size={12} /> Filter By Track ({tracks.length})
            </span>
            <span>{selectedTrack === 'ALL' ? 'Showing All Tracks' : selectedTrack}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSelectedTrack('ALL')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedTrack === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              All Tracks ({statements.length})
            </button>
            {tracks.map((t) => {
              const count = statements.filter((s) => s.track === t).length;
              const isSelected = selectedTrack.toLowerCase() === t.toLowerCase();
              const TrackIcon = getTrackIcon(t);

              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTrack(isSelected ? 'ALL' : t)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <TrackIcon size={12} className={isSelected ? 'text-primary-foreground' : 'text-secondary'} />
                  <span>{t}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary/15 text-secondary'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <div>
          Showing <span className="font-bold text-foreground">{filteredAndSorted.length}</span> of{' '}
          <span className="font-bold text-foreground">{statements.length}</span> published challenges
          {selectedTrack !== 'ALL' && (
            <span> &middot; Track: <strong className="text-foreground">{selectedTrack}</strong></span>
          )}
          {selectedBuildType !== 'ALL' && (
            <span> &middot; Build: <strong className="text-foreground">{selectedBuildType}</strong></span>
          )}
        </div>
        {isFilteringActive && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-primary font-semibold hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Challenge Catalogue Cards Grid */}
      {filteredAndSorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
            <Search size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground font-serif">No challenge briefs match your criteria</h3>
            <p className="mx-auto max-w-md text-xs text-muted-foreground leading-relaxed">
              No problem statements matched your current search and filter selections. Try relaxing your filters or searching for alternate terms.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
          >
            <RotateCcw size={13} />
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredAndSorted.map((item) => {
            const TrackIcon = getTrackIcon(item.track);
            const BuildIcon = getBuildTypeIcon(item.build_type);
            const deliverablesCount =
              Array.isArray(item.deliverables_bullets) && item.deliverables_bullets.length > 0
                ? item.deliverables_bullets.length
                : (item.deliverables || '').split('\n').filter((l) => l.trim().length > 0).length || 3;

            return (
              <article
                key={item.id}
                onClick={() => router.push(`/problem-statements/${item.slug}`)}
                className="group relative flex flex-col justify-between rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer"
              >
                {/* Top Metadata Badges */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Problem Identifier */}
                      <span className="inline-flex items-center rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-mono font-black text-primary">
                        {item.id}
                      </span>

                      {/* Build Type Badge */}
                      <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/80">
                        <BuildIcon size={12} className="text-secondary" />
                        <span>{item.build_type}</span>
                      </span>
                    </div>

                    {/* Copy Reference ID button */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(e, item.id)}
                      title={`Copy ${item.id}`}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      aria-label={`Copy ID ${item.id}`}
                    >
                      {copiedId === item.id ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>

                  {/* Track Label */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
                    <TrackIcon size={13} className="shrink-0" />
                    <span>{item.track_num} &middot; {item.track}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight leading-snug group-hover:text-primary transition-colors font-serif">
                    {item.title}
                  </h3>

                  {/* Excerpt / Summary */}
                  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                    {item.problem_statement}
                  </p>
                </div>

                {/* Footer Action & Highlights */}
                <div className="mt-5 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs">
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <CheckCircle2 size={13} className="text-secondary" />
                    <span>{deliverablesCount} Deliverables</span>
                  </div>

                  <Link
                    href={`/problem-statements/${item.slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>View Full Brief</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
