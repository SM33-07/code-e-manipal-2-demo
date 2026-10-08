"use client";

import { useEffect, useState } from "react";
import { Trophy, Activity, RefreshCw } from "lucide-react";

export default function ResultsPage() {
  const [mounted, setMounted] = useState(false);
  const [ranked, setRanked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchResults();
    const interval = setInterval(fetchResults, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchResults = async () => {
    try {
      const res = await fetch("/api/admin/results");
      const json = await res.json();
      setRanked(Array.isArray(json.data) ? json.data : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch results:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Trophy size={26} className="text-secondary" />
          <h1 className="text-2xl font-bold text-foreground m-0">
            Admin Results & Standings
          </h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
          <Activity size={14} className="animate-pulse" />
          <span className="text-xs font-semibold">Live Feed</span>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-xs text-muted-foreground mb-5">
          Auto-refreshing every 30s · Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw size={20} className="text-primary animate-spin" />
        </div>
      ) : ranked.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
          <p className="text-xs text-muted-foreground m-0">No reviewed submissions yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ranked.map((entry, i) => (
            <div
              key={entry.id}
              className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Rank badge */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-sm ${
                  i === 0
                    ? "bg-amber-500 text-white shadow-sm"
                    : i === 1
                    ? "bg-neutral-400 text-white shadow-sm"
                    : i === 2
                    ? "bg-amber-700 text-white shadow-sm"
                    : "bg-muted text-muted-foreground border border-border"
                }`}>
                  #{entry.computed?.rank ?? i + 1}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground m-0">
                    {entry.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1 font-medium">
                    {entry.teams?.name ?? "Unknown Team"} · {entry.category}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground/80 m-0">
                    Inno: {entry.computed?.avg_innovation?.toFixed(1) ?? "—"} · Tech: {entry.computed?.avg_technical?.toFixed(1) ?? "—"} · Pres: {entry.computed?.avg_presentation?.toFixed(1) ?? "—"} · Imp: {entry.computed?.avg_impact?.toFixed(1) ?? "—"}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right self-end sm:self-center">
                <p className="font-mono text-xl sm:text-2xl font-black text-primary m-0">
                  {entry.computed?.total_score?.toFixed(2) ?? "0.00"}
                </p>
                <p className="text-[11px] text-muted-foreground m-0 font-medium">
                  {entry.computed?.review_count ?? 0} reviews
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
