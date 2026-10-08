"use client";

import { useEffect, useState } from "react";
import { BarChart3, Users, FileText, Scale } from "lucide-react";

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>({
    total_submissions: 0,
    submitted_count: 0,
    reviewed_count: 0,
    total_teams: 0,
    category_breakdown: {},
    avg_scores: {},
  });

  useEffect(() => {
    setMounted(true);
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      if (json.data) setStats(json.data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  };

  const avgScores = (stats.avg_scores as Record<string, number>) || {};
  const categories = (stats.category_breakdown as Record<string, number>) || {};
  const avgAll = Object.values(avgScores).filter((v) => v > 0);
  const overallAvg = avgAll.length ? avgAll.reduce((a, b) => a + b, 0) / avgAll.length : 0;

  const topStats = [
    { label: "Total Submissions", value: stats.total_submissions, Icon: FileText },
    { label: "Reviewed", value: stats.reviewed_count, Icon: Scale },
    { label: "Teams", value: stats.total_teams, Icon: Users },
    { label: "Avg Score", value: overallAvg.toFixed(2), Icon: BarChart3 },
  ];

  if (!mounted) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-primary" />
          <h1 className="text-2xl font-bold text-foreground m-0">
            Hackathon Analytics & Metrics
          </h1>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {topStats.map(({ label, value, Icon }) => (
          <div
            key={label}
            className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon size={16} />
              </div>
            </div>
            <p className="text-3xl font-extrabold font-mono text-foreground m-0 leading-tight">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
            Average Scores by Criterion
          </h2>
          {Object.entries(avgScores).length === 0 ? (
            <p className="text-xs text-muted-foreground">No reviews recorded yet</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {Object.entries(avgScores).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center py-2.5">
                  <span className="text-xs text-muted-foreground capitalize">
                    {key.replace("score_", "")}
                  </span>
                  <span className="text-xs font-mono font-bold text-primary">
                    {(val as number).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
            Category Distribution
          </h2>
          {Object.entries(categories).length === 0 ? (
            <p className="text-xs text-muted-foreground">No submissions recorded yet</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {Object.entries(categories).map(([cat, count]) => (
                <div key={cat} className="flex justify-between items-center py-2.5">
                  <span className="text-xs text-muted-foreground">{cat}</span>
                  <span className="text-xs font-mono font-bold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
