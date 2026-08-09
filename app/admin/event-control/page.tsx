"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Radio, Lock, Unlock, Clock, Send, Trash2, 
  Search, ShieldAlert, Sparkles, Megaphone, Loader2 
} from "lucide-react";

interface Team {
  id: string;
  name: string;
  submission_frozen: boolean;
  deadline_extension: string | null;
  member_count: number;
  submitted_at?: string | null;
}

interface Announcement {
  id: string;
  content: string;
  type: "info" | "warning" | "urgent" | "success";
  is_active: boolean;
  created_at: string;
  creator_name?: string;
}

export default function EventControlPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // Broadcaster form state
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementType, setAnnouncementType] = useState<"info" | "warning" | "urgent" | "success">("info");
  
  // Loading states
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  // Hackathon Timer state
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState(48);
  const [isStarted, setIsStarted] = useState(false);
  const [updatingTimer, setUpdatingTimer] = useState(false);
  const [timeRemainingStr, setTimeRemainingStr] = useState("Not Started");

  // Results Publishing state
  const [resultsPublished, setResultsPublished] = useState<"false" | "publishing" | "true">("false");
  const [resultsPublishTime, setResultsPublishTime] = useState("");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishingResults, setPublishingResults] = useState(false);

  useEffect(() => {
    fetchTeams();
    fetchAnnouncements();
    fetchEventConfig();
  }, []);

  const fetchEventConfig = async () => {
    try {
      const res = await fetch("/api/event-config");
      if (res.ok) {
        const json = await res.json();
        const data = json.data || {};
        setStartTime(data.hackathon_start_time || "");
        setDurationHours(parseFloat(data.hackathon_duration_hours || "48"));
        setIsStarted(data.hackathon_is_started === "true");
        setResultsPublished(data.results_published || "false");
        setResultsPublishTime(data.results_publish_time || "");
      }
    } catch (err) {
      console.error("Failed to load event config:", err);
    }
  };

  useEffect(() => {
    if (!isStarted || !startTime) {
      setTimeRemainingStr("Not Started");
      return;
    }

    const calculateRemaining = () => {
      const start = new Date(startTime).getTime();
      const durationMs = durationHours * 60 * 60 * 1000;
      const end = start + durationMs;
      const remainingMs = end - Date.now();

      if (remainingMs <= 0) {
        setTimeRemainingStr("Submissions Closed");
      } else {
        const secs = Math.floor((remainingMs / 1000) % 60);
        const mins = Math.floor((remainingMs / (1000 * 60)) % 60);
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        setTimeRemainingStr(`${hours}h ${mins}m ${secs}s left`);
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);

    return () => clearInterval(interval);
  }, [isStarted, startTime, durationHours]);

  const handleSaveTimer = async (startNow = false) => {
    setUpdatingTimer(true);
    try {
      const targetStartTime = startNow ? new Date().toISOString() : startTime;
      const res = await fetch("/api/event-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hackathon_start_time: targetStartTime,
          hackathon_duration_hours: durationHours,
          hackathon_is_started: "true",
        }),
      });

      if (res.ok) {
        toast.success("Hackathon Timer Started!");
        fetchEventConfig();
        fetchAnnouncements();
      } else {
        toast.error("Failed to update hackathon timer settings.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating timer.");
    } finally {
      setUpdatingTimer(false);
    }
  };

  const handleStopTimer = async () => {
    if (!confirm("Are you sure you want to reset the timer? This will unfreeze portals that were auto-locked by this timer.")) return;
    setUpdatingTimer(true);
    try {
      const res = await fetch("/api/event-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hackathon_is_started: "false",
        }),
      });

      if (res.ok) {
        toast.success("Hackathon Timer Stopped / Reset.");
        fetchEventConfig();
      } else {
        toast.error("Failed to reset timer.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error stopping timer.");
    } finally {
      setUpdatingTimer(false);
    }
  };

  const fetchTeams = async () => {
    setLoadingTeams(true);
    try {
      const res = await fetch("/api/admin/teams");
      if (res.ok) {
        const { data } = await res.json();
        setTeams(data);
      } else {
        toast.error("Failed to load teams.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred loading teams.");
    } finally {
      setLoadingTeams(false);
    }
  };

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const res = await fetch("/api/admin/announcements");
      if (res.ok) {
        const { data } = await res.json();
        setAnnouncements(data);
      } else {
        toast.error("Failed to load announcements.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred loading announcements.");
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const handleGlobalFreeze = async (freeze: boolean) => {
    setTogglingGlobal(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ global: true, submission_frozen: freeze }),
      });
      if (res.ok) {
        toast.success(freeze ? "All submissions frozen!" : "All submissions unfrozen!");
        // Update local state
        setTeams((prev) => prev.map((t) => ({ ...t, submission_frozen: freeze })));
      } else {
        toast.error("Failed to update global freeze status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error toggling global freeze.");
    } finally {
      setTogglingGlobal(false);
    }
  };

  const handleTeamFreeze = async (teamId: string, freeze: boolean) => {
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId, submission_frozen: freeze }),
      });
      if (res.ok) {
        toast.success(freeze ? "Team submission frozen" : "Team submission unfrozen");
        setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, submission_frozen: freeze } : t)));
      } else {
        toast.error("Failed to update team freeze status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating team freeze.");
    }
  };

  const handleTeamExtension = async (teamId: string, extension: string | null) => {
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId, deadline_extension: extension }),
      });
      if (res.ok) {
        const { data } = await res.json();
        toast.success(extension ? "Deadline extension set" : "Deadline extension cleared");
        setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, deadline_extension: data.deadline_extension } : t)));
      } else {
        toast.error("Failed to set extension.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error setting extension.");
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementContent.trim()) return;

    setSubmittingBroadcast(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: announcementContent, type: announcementType }),
      });
      if (res.ok) {
        toast.success("Announcement broadcasted successfully!");
        setAnnouncementContent("");
        fetchAnnouncements();
      } else {
        toast.error("Failed to broadcast announcement.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error broadcasting announcement.");
    } finally {
      setSubmittingBroadcast(false);
    }
  };

  const handleToggleAnnouncement = async (id: string, active: boolean) => {
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: active }),
      });
      if (res.ok) {
        toast.success(active ? "Announcement activated" : "Announcement deactivated");
        fetchAnnouncements();
      } else {
        toast.error("Failed to toggle announcement state.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error toggling announcement.");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" }),
      });
      if (res.ok) {
        toast.success("Announcement deleted.");
        fetchAnnouncements();
      } else {
        toast.error("Failed to delete announcement.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting announcement.");
    }
  };

  const handleStartPublish = async () => {
    setPublishingResults(true);
    try {
      const publishTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const res = await fetch("/api/event-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results_published: "publishing",
          results_publish_time: publishTime,
        }),
      });
      if (res.ok) {
        toast.success("Leaderboard publishing initiated (5-minute countdown started).");
        setShowPublishModal(false);
        fetchEventConfig();
      } else {
        toast.error("Failed to start publishing countdown.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error starting publishing.");
    } finally {
      setPublishingResults(false);
    }
  };

  const handleCancelPublish = async () => {
    setPublishingResults(true);
    try {
      const res = await fetch("/api/event-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results_published: "false",
          results_publish_time: "",
        }),
      });
      if (res.ok) {
        toast.success("Results publishing reset / unpublished.");
        fetchEventConfig();
      } else {
        toast.error("Failed to reset results status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error resetting publishing state.");
    } finally {
      setPublishingResults(false);
    }
  };

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "None";
    const date = new Date(dateStr);
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-2">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#C9A227]/20 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-2">
            <Radio className="text-[#D4732A]" />
            Event Day Control Panel
          </h1>
          <p className="text-sm text-[#A08070] mt-1">
            Real-time management for team submissions, deadline extensions, and system broadcasts.
          </p>
        </div>

        {/* Global Freeze Switch */}
        <div className="bg-[#FCF6EF] dark:bg-[#1E1208] border border-[#EBCFB5] dark:border-[#C9A227]/20 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="text-left">
            <h4 className="text-sm font-bold text-foreground">Global Freeze</h4>
            <p className="text-xs text-[#A08070]">Controls all team portals</p>
          </div>
          {togglingGlobal ? (
            <Loader2 className="animate-spin text-[#D4732A] size-5" />
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleGlobalFreeze(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-950 text-red-200 border border-red-800 hover:bg-red-900 rounded-xl text-xs font-bold transition duration-200 cursor-pointer"
              >
                <Lock size={14} /> Freeze All
              </button>
              <button
                onClick={() => handleGlobalFreeze(false)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-950 text-emerald-200 border border-emerald-800 hover:bg-emerald-900 rounded-xl text-xs font-bold transition duration-200 cursor-pointer"
              >
                <Unlock size={14} /> Unfreeze All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Controls Grid (3 Equal Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Timer Settings Card */}
        <div className="bg-[#FCF6EF] dark:bg-[#1E1208] border border-[#EBCFB5] dark:border-[#C9A227]/20 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Clock size={80} className="text-[#D4732A]" />
            </div>
            
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
              <Clock size={18} className="text-[#D4732A]" />
              Hackathon Event Timer
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-[#C9A227]/10">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A08070]">Status</span>
                  <p className="text-sm font-bold text-foreground">
                    {isStarted ? (
                      <span className="text-emerald-400">● Live Running</span>
                    ) : (
                      <span className="text-[#A08070]">● Not Started</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#A08070]">Time Left</span>
                  <p className="text-sm font-mono font-bold text-[#F0C060]">{timeRemainingStr}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#A08070] mb-2">
                  Hackathon Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime ? new Date(new Date(startTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setStartTime(e.target.value ? new Date(e.target.value).toISOString() : "")}
                  disabled={isStarted}
                  className="w-full bg-black/35 border border-[#C9A227]/20 rounded-xl p-3 text-xs text-foreground focus:ring-1 focus:ring-[#D4732A] focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#A08070] mb-2">
                  Duration (Hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Math.max(1, parseInt(e.target.value) || 0))}
                  disabled={isStarted}
                  className="w-full bg-black/35 border border-[#C9A227]/20 rounded-xl p-3 text-xs text-foreground focus:ring-1 focus:ring-[#D4732A] focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            {!isStarted ? (
              <button
                onClick={() => handleSaveTimer(true)}
                disabled={updatingTimer}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                {updatingTimer ? <Loader2 className="animate-spin size-4" /> : <Clock size={14} />}
                Start Now
              </button>
            ) : (
              <button
                onClick={handleStopTimer}
                disabled={updatingTimer}
                className="flex-1 py-3 rounded-xl bg-red-950 text-red-200 border border-red-800 hover:bg-red-900 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                {updatingTimer ? <Loader2 className="animate-spin size-4" /> : <Lock size={14} />}
                Stop / Reset Timer
              </button>
            )}
            
            {!isStarted && (
              <button
                onClick={() => handleSaveTimer(false)}
                disabled={updatingTimer || !startTime}
                className="flex-1 py-3 rounded-xl bg-[#D4732A] text-[#1E1208] font-bold text-xs hover:bg-[#D4732A]/90 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set Schedule
              </button>
            )}
          </div>
        </div>

        {/* LEADERBOARD & RESULTS PUBLISHING CARD */}
        <div className="bg-[#FCF6EF] dark:bg-[#1E1208] border border-[#EBCFB5] dark:border-[#C9A227]/20 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-[#D4732A]/10 border border-[#D4732A]/30 rounded-xl text-[#D4732A]">
                <Sparkles size={20} />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#F0C060] bg-[#C9A227]/10 px-2.5 py-1 rounded-full border border-[#C9A227]/20">
                Results Control
              </span>
            </div>

            <h3 className="text-xl font-bold font-serif text-foreground mb-1">
              Leaderboard & Results
            </h3>
            <p className="text-xs text-[#A08070] mb-4">
              Publish competition rankings to participants with a 5-minute announcement buffer.
            </p>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-[#C9A227]/10">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A08070]">Publish Status</span>
                  <p className="text-sm font-bold text-foreground">
                    {resultsPublished === "true" ? (
                      <span className="text-emerald-400">● Published Live</span>
                    ) : resultsPublished === "publishing" ? (
                      <span className="text-[#F0C060] animate-pulse">● Publishing (5m Buffer)</span>
                    ) : (
                      <span className="text-[#A08070]">● Unpublished (Hidden)</span>
                    )}
                  </p>
                </div>
                {resultsPublished === "publishing" && resultsPublishTime && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[#A08070]">Goes Live</span>
                    <p className="text-xs font-mono text-[#F0C060]">
                      {new Date(resultsPublishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                {resultsPublished === "false" && (
                  <button
                    onClick={() => setShowPublishModal(true)}
                    disabled={publishingResults}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4732A] to-[#C1440E] text-white font-bold text-xs hover:from-[#E8924A] hover:to-[#D4732A] transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md"
                  >
                    <Sparkles size={16} /> Publish Results (5-Min Buffer)
                  </button>
                )}

                {resultsPublished === "publishing" && (
                  <div className="space-y-2">
                    <button
                      onClick={handleCancelPublish}
                      disabled={publishingResults}
                      className="w-full py-3 rounded-xl bg-red-950 text-red-200 border border-red-800 hover:bg-red-900 font-bold text-xs transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {publishingResults ? <Loader2 className="animate-spin size-4" /> : <Lock size={14} />} Cancel Publishing
                    </button>
                  </div>
                )}

                {resultsPublished === "true" && (
                  <button
                    onClick={handleCancelPublish}
                    disabled={publishingResults}
                    className="w-full py-3 rounded-xl bg-neutral-900 border border-[#C9A227]/30 text-[#A08070] hover:text-foreground font-bold text-xs transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {publishingResults ? <Loader2 className="animate-spin size-4" /> : <Unlock size={14} />} Unpublish Leaderboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Broadcaster Form */}
        <div className="bg-[#FCF6EF] dark:bg-[#1E1208] border border-[#EBCFB5] dark:border-[#C9A227]/20 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Megaphone size={80} className="text-[#D4732A]" />
            </div>
            
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
              <Megaphone size={18} className="text-[#D4732A]" />
              Live Broadcast Alert
            </h3>

            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#A08070] mb-2">
                  Announcement Message
                </label>
                <textarea
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  placeholder="Type message to broadcast to all participants..."
                  className="w-full min-h-[90px] bg-black/35 border border-[#C9A227]/20 rounded-xl p-3 text-sm text-foreground focus:ring-1 focus:ring-[#D4732A] focus:outline-none placeholder-[#A08070]/50"
                  maxLength={250}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#A08070] mb-2">
                  Alert Severity / Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["info", "success", "warning", "urgent"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAnnouncementType(type)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg capitalize border cursor-pointer transition ${
                        announcementType === type
                          ? type === "info" ? "bg-blue-950 text-blue-200 border-blue-600"
                            : type === "success" ? "bg-emerald-950 text-emerald-200 border-emerald-600"
                            : type === "warning" ? "bg-amber-950 text-amber-200 border-amber-600"
                            : "bg-red-950 text-red-200 border-red-600"
                          : "bg-black/20 text-[#A08070] border-transparent hover:border-[#C9A227]/20"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingBroadcast || !announcementContent.trim()}
                className="w-full py-3 rounded-xl bg-[#D4732A] text-[#1E1208] font-bold text-sm hover:bg-[#D4732A]/90 transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md mt-2"
              >
                {submittingBroadcast ? (
                  <Loader2 className="animate-spin size-4" />
                ) : (
                  <Send size={14} />
                )}
                Broadcast Alert
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Operations & Management Grid (Announcement History & Submissions Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Past Announcements */}
        <div className="lg:col-span-1">
          <div className="bg-[#FCF6EF] dark:bg-[#1E1208] border border-[#EBCFB5] dark:border-[#C9A227]/20 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 rounded-2xl p-6 shadow-xl space-y-4 h-full">
            <h3 className="text-lg font-bold text-foreground">Announcement History</h3>
            
            {loadingAnnouncements ? (
              <div className="flex justify-center p-6">
                <Loader2 className="animate-spin text-[#D4732A]" />
              </div>
            ) : announcements.length === 0 ? (
              <p className="text-xs text-[#A08070] text-center py-6">No announcements broadcasted yet.</p>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3 bg-black/20 rounded-xl border border-[#C9A227]/10 flex flex-col gap-2 relative group"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-bold ${
                        ann.type === "info" ? "bg-blue-950 text-blue-300"
                          : ann.type === "success" ? "bg-emerald-950 text-emerald-300"
                          : ann.type === "warning" ? "bg-amber-950 text-amber-300"
                          : "bg-red-950 text-red-300"
                      }`}>
                        {ann.type}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleAnnouncement(ann.id, !ann.is_active)}
                          className={`text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer transition ${
                            ann.is_active ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-[#A08070]/20 text-[#A08070] hover:bg-[#A08070]/30"
                          }`}
                        >
                          {ann.is_active ? "Active" : "Inactive"}
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="text-[#A08070] hover:text-red-400 p-0.5 rounded cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-foreground font-medium line-clamp-3">{ann.content}</p>
                    <div className="flex justify-between text-[9px] text-[#A08070]">
                      <span>By {ann.creator_name || "Admin"}</span>
                      <span>{new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Submission & Deadline Table */}
        <div className="lg:col-span-2">
          <div className="bg-[#FCF6EF] dark:bg-[#1E1208] border border-[#EBCFB5] dark:border-[#C9A227]/20 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 rounded-2xl p-6 shadow-xl space-y-6 h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Team Submissions Manager</h3>
                <p className="text-xs text-[#A08070] mt-0.5">Configure individual grace extensions or locks.</p>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-[#A08070]/60 size-4" />
                <input
                  type="text"
                  placeholder="Search team name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/30 border border-[#C9A227]/20 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:ring-1 focus:ring-[#D4732A] focus:outline-none placeholder-[#A08070]/40 w-full sm:w-60"
                />
              </div>
            </div>

            {loadingTeams ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-[#D4732A]" />
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="text-center py-20 text-[#A08070]">No teams found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#C9A227]/20 text-[#A08070] font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-3 pl-2">Team Details</th>
                      <th className="pb-3">Submission Status</th>
                      <th className="pb-3">Submitted At</th>
                      <th className="pb-3">Deadline Extension (Grace)</th>
                      <th className="pb-3 text-right pr-2">Lock Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((team) => (
                      <tr key={team.id} className="border-b border-[#C9A227]/10 hover:bg-black/10 transition">
                        {/* Team Info */}
                        <td className="py-4 pl-2">
                          <p className="font-semibold text-foreground">{team.name}</p>
                          <span className="text-[10px] text-[#A08070]">{team.member_count} Members</span>
                        </td>
                        
                        {/* Status badge */}
                        <td className="py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            team.submission_frozen 
                              ? "bg-red-950 text-red-300 border border-red-800" 
                              : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          }`}>
                            {team.submission_frozen ? <Lock size={10} /> : <Unlock size={10} />}
                            {team.submission_frozen ? "Frozen" : "Open"}
                          </span>
                        </td>
                        
                        {/* Submitted At */}
                        <td className="py-4">
                          {team.submitted_at ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-[#D4732A]">
                                {formatDateTime(team.submitted_at)}
                              </span>
                              {isStarted && startTime && (
                                <span className="text-[10px] text-[#A08070]">
                                  {(() => {
                                    const subMs = new Date(team.submitted_at).getTime();
                                    const startMs = new Date(startTime).getTime();
                                    const diffMs = subMs - startMs;
                                    if (diffMs < 0) return "Before start";
                                    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                                    const diffMins = Math.floor((diffMs / (1000 * 60)) % 60);
                                    return `+${diffHrs}h ${diffMins}m elapsed`;
                                  })()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#A08070]/60 italic font-medium">Not submitted</span>
                          )}
                        </td>

                        {/* Extensions control */}
                        <td className="py-4">
                          <ExtensionPicker
                            teamId={team.id}
                            deadlineExtension={team.deadline_extension}
                            startTime={startTime}
                            durationHours={durationHours}
                            onSave={handleTeamExtension}
                          />
                        </td>
                        
                        {/* Lock / Unlock button */}
                        <td className="py-4 text-right pr-2">
                          <button
                            onClick={() => handleTeamFreeze(team.id, !team.submission_frozen)}
                            className={`px-3 py-1.5 rounded-lg border font-bold text-[10px] cursor-pointer transition ${
                              team.submission_frozen
                                ? "bg-emerald-950 text-emerald-200 border-emerald-700 hover:bg-emerald-900"
                                : "bg-red-950 text-red-200 border-red-700 hover:bg-red-900"
                            }`}
                          >
                            {team.submission_frozen ? "Unlock Portal" : "Lock Portal"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PUBLISH RESULTS CONFIRMATION MODAL */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#FCF6EF] dark:bg-[#1E1208] border border-[#EBCFB5] dark:border-[#C9A227]/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-[#C9A227]/20 mb-4">
              <h3 className="text-xl font-bold font-serif text-foreground">
                Publish Results Confirmation
              </h3>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="text-muted-foreground hover:text-foreground text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-[#A08070] leading-relaxed mb-6">
              The leaderboard will be published in 5 minutes.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#C9A227]/20">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                disabled={publishingResults}
                className="h-10 px-4 rounded-xl border border-[#C9A227]/30 text-xs font-bold text-[#A08070] hover:bg-[#C9A227]/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartPublish}
                disabled={publishingResults}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#D4732A] to-[#C1440E] text-white text-xs font-bold flex items-center justify-center gap-2 hover:from-[#E8924A] hover:to-[#D4732A] transition-all cursor-pointer"
              >
                {publishingResults ? "Initiating..." : "Confirm & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExtensionPickerProps {
  teamId: string;
  deadlineExtension: string | null;
  startTime: string;
  durationHours: number;
  onSave: (teamId: string, extIso: string | null) => void;
}

function ExtensionPicker({
  teamId,
  deadlineExtension,
  startTime,
  durationHours,
  onSave,
}: ExtensionPickerProps) {
  const getDurations = (teamDeadlineExtension: string | null) => {
    if (!teamDeadlineExtension || !startTime) return { hours: 0, minutes: 0 };
    const start = new Date(startTime).getTime();
    const durationMs = durationHours * 60 * 60 * 1000;
    const baseDeadlineMs = start + durationMs;
    const extMs = new Date(teamDeadlineExtension).getTime() - baseDeadlineMs;
    if (extMs <= 0) return { hours: 0, minutes: 0 };
    const totalMins = Math.round(extMs / (1000 * 60));
    return {
      hours: Math.floor(totalMins / 60),
      minutes: totalMins % 60,
    };
  };

  const initialVal = getDurations(deadlineExtension);
  const [hours, setHours] = useState<string>(initialVal.hours > 0 ? String(initialVal.hours) : "");
  const [minutes, setMinutes] = useState<string>(initialVal.minutes > 0 ? String(initialVal.minutes) : "");

  useEffect(() => {
    const val = getDurations(deadlineExtension);
    setHours(val.hours > 0 ? String(val.hours) : "");
    setMinutes(val.minutes > 0 ? String(val.minutes) : "");
  }, [deadlineExtension, startTime, durationHours]);

  const handleUpdate = (hStr: string, mStr: string) => {
    const h = parseInt(hStr) || 0;
    const m = parseInt(mStr) || 0;

    if (h === 0 && m === 0) {
      onSave(teamId, null);
      return;
    }

    const base = startTime ? new Date(startTime).getTime() : Date.now();
    const baseDeadline = base + durationHours * 3600000;
    const newExt = new Date(baseDeadline + h * 3600000 + m * 60000).toISOString();
    onSave(teamId, newExt);
  };

  if (!startTime) {
    return (
      <span className="text-[10px] font-semibold text-[#A08070]/60 italic">
        Timer not started
      </span>
    );
  }

  const hasExtension = deadlineExtension && startTime && (parseInt(hours) > 0 || parseInt(minutes) > 0);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold text-[#C9A227]">
        {hasExtension
          ? `${parseInt(hours) || 0}h ${parseInt(minutes) || 0}m extension`
          : "No extension"}
      </span>
      <div className="flex gap-1 items-center">
        <div className="flex gap-1 items-center bg-black/30 border border-[#C9A227]/20 rounded px-1.5 py-0.5">
          <input
            type="number"
            min="0"
            placeholder="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            onBlur={() => handleUpdate(hours, minutes)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-7 bg-transparent border-none text-[10px] focus:outline-none text-foreground text-center p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[9px] text-[#A08070] font-bold">h</span>
          <input
            type="number"
            min="0"
            max="59"
            placeholder="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            onBlur={() => handleUpdate(hours, minutes)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-7 bg-transparent border-none text-[10px] focus:outline-none text-foreground text-center p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[9px] text-[#A08070] font-bold">m</span>
        </div>
        {deadlineExtension && (
          <button
            onClick={() => {
              setHours("");
              setMinutes("");
              onSave(teamId, null);
            }}
            className="text-[#A08070] hover:text-red-400 font-bold px-1.5 py-0.5 border border-[#C9A227]/20 rounded hover:border-red-400 cursor-pointer text-[9px]"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
