"use client";

import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Globe,
  Eye,
  Lock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface TimelineEvent {
  id: string;
  title: string;
  day_label: string;
  time_range: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  card_position: 'left' | 'right';
  display_order: number;
  status: string;
  event_type: string;
  is_published: boolean;
}

interface TimelineConfig {
  is_published: boolean;
  published_at: string | null;
  published_version: number;
}

export default function AdminTimelinePage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<TimelineConfig | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [publishing, setPublishing] = useState(false);

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<TimelineEvent> | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch timeline data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/timeline');
      if (!res.ok) throw new Error('Failed to fetch timeline');
      const json = await res.json();
      if (json.success) {
        setConfig(json.data.config);
        setEvents(json.data.events);
      }
    } catch (err: any) {
      toast.error('Error loading timeline: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Publish / Unpublish actions
  const handlePublish = async () => {
    try {
      setPublishing(true);
      const res = await fetch('/api/admin/timeline/publish', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Publish failed');
      toast.success(`Timeline published live! (Version ${json.data.version})`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!confirm('Are you sure you want to unpublish the timeline? It will be hidden from the public /timeline route.')) return;
    try {
      setPublishing(true);
      const res = await fetch('/api/admin/timeline/unpublish', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Unpublish failed');
      toast.success('Timeline has been unpublished from public view.');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  };

  // Reorder actions
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= events.length) return;

    const newEvents = [...events];
    const temp = newEvents[index];
    newEvents[index] = newEvents[targetIndex];
    newEvents[targetIndex] = temp;

    // Recalculate display_orders
    const items = newEvents.map((e, idx) => ({ id: e.id, display_order: idx + 1 }));
    setEvents(newEvents.map((e, idx) => ({ ...e, display_order: idx + 1 })));

    try {
      const res = await fetch('/api/admin/timeline/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('Failed to persist order');
      toast.success('Order updated');
    } catch (err: any) {
      toast.error(err.message);
      fetchData(); // Rollback
    }
  };

  // Save Event (Create or Update)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent?.title || !editingEvent?.day_label || !editingEvent?.time_range) {
      toast.error('Title, Day Label, and Time Range are required');
      return;
    }

    try {
      if (editingEvent.id) {
        // Update
        const res = await fetch(`/api/admin/timeline/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingEvent),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error?.message || 'Update failed');
        toast.success('Event updated');
      } else {
        // Create
        const res = await fetch('/api/admin/timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingEvent),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error?.message || 'Create failed');
        toast.success('Event created');
      }
      setIsEditModalOpen(false);
      setEditingEvent(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/timeline/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Delete failed');
      toast.success('Event deleted');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Timeline & Schedule Management
            </h1>
            {config?.is_published ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Globe size={12} />
                LIVE (v{config.published_version})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Lock size={12} />
                UNPUBLISHED / DRAFT
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage official hackathon activities, venues, and live publication state on /timeline.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <Eye size={14} />
            Preview
          </button>

          {config?.is_published ? (
            <button
              onClick={handleUnpublish}
              disabled={publishing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 transition-colors"
            >
              <Lock size={14} />
              Unpublish
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <Globe size={14} />
              Publish Live
            </button>
          )}

          <button
            onClick={() => {
              setEditingEvent({
                day_label: 'DAY 1',
                time_range: '',
                title: '',
                venue: '',
                description: '',
                card_position: 'right',
                event_type: 'general',
                status: 'upcoming',
              });
              setIsEditModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            Add Event
          </button>
        </div>
      </div>

      {/* Events Table / List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-border bg-muted/40 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Scheduled Activities ({events.length})
          </span>
          <span className="text-xs text-muted-foreground">
            Initial source: code-e-manipal-timeline (1) new.pdf
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading timeline events...
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No events found. Click &quot;Add Event&quot; to create one.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event, index) => (
              <div
                key={event.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  {/* Reorder Buttons */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === events.length - 1}
                      className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>

                  {/* Day Badge */}
                  <span className="shrink-0 rounded-lg bg-[#7C2D12] px-2.5 py-1 text-[11px] font-black text-white">
                    {event.day_label}
                  </span>

                  {/* Event Details */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#B45309] dark:text-[#FBBF24]">
                        {event.time_range}
                      </span>
                      {event.card_position === 'left' ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Left Card
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Right Card
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                      {event.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {event.venue && (
                        <span className="flex items-center gap-1 text-[#DC2626]">
                          <MapPin size={12} />
                          {event.venue}
                        </span>
                      )}
                      {event.description && (
                        <span className="italic text-muted-foreground">
                          &bull; {event.description}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit & Delete Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      setEditingEvent(event);
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Edit Event"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(event.id)}
                    className="p-2 rounded-lg border border-border bg-card text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit / Create Event Modal */}
      {isEditModalOpen && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">
                {editingEvent.id ? 'Edit Timeline Event' : 'Add New Timeline Event'}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Day Label
                  </label>
                  <select
                    value={editingEvent.day_label || 'DAY 1'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, day_label: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                  >
                    <option value="DAY 1">DAY 1 (15 Oct)</option>
                    <option value="DAY 2">DAY 2 (16 Oct)</option>
                    <option value="ONLINE">ONLINE PHASE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Card Position (PDF Layout)
                  </label>
                  <select
                    value={editingEvent.card_position || 'right'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, card_position: e.target.value as any })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                  >
                    <option value="right">Right Side Card</option>
                    <option value="left">Left Side Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Time Range (e.g. 9:00 AM – 11:00 AM)
                </label>
                <input
                  type="text"
                  required
                  value={editingEvent.time_range || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, time_range: e.target.value })}
                  placeholder="e.g. 9:00 AM – 11:00 AM"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Activity Title
                </label>
                <input
                  type="text"
                  required
                  value={editingEvent.title || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  placeholder="e.g. Opening Ceremony"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Venue (Optional)
                </label>
                <input
                  type="text"
                  value={editingEvent.venue || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                  placeholder="e.g. TMA Pai or Old Mess, AB1"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Supporting Notes / Bullet Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  placeholder="e.g. Problem statement closes at 4:00 PM"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
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
                  Save Event
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
            <h3 className="text-base font-bold text-foreground">Confirm Event Deletion</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete this event? This action will immediately remove it from the schedule.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteEvent(deleteConfirmId)}
                className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-[#FFF9F5] text-[#2C1810] dark:bg-[#120D0A] dark:text-[#F5EBE6] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9A3412]">
                Live Schedule Preview
              </span>
              <button onClick={() => setIsPreviewOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#9A3412]">TIMELINE OF</h2>
              <h1 className="text-3xl font-extrabold text-[#451A03] dark:text-[#FFF7ED]">Code-e-Manipal 2.0</h1>
            </div>

            <div className="space-y-6">
              {events.map((ev) => (
                <div key={ev.id} className="rounded-2xl border border-[#E5D5C5] bg-white dark:bg-[#18120D] p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-[#B45309]">{ev.time_range}</span>
                    <span className="rounded bg-[#7C2D12] px-2 py-0.5 text-[10px] font-bold text-white">{ev.day_label}</span>
                  </div>
                  <h4 className="text-base font-bold text-[#451A03] dark:text-[#FFF7ED]">{ev.title}</h4>
                  {ev.venue && <p className="text-xs text-[#DC2626] font-semibold mt-1">Venue: {ev.venue}</p>}
                  {ev.description && <p className="text-xs text-[#92400E] italic mt-0.5">&bull; {ev.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
