"use client";

import { useEffect, useState } from "react";
import { FileDown, FileText, Search, Trophy } from "lucide-react";

export default function ReportPage() {
  const [mounted, setMounted] = useState(false);
  const [ranked, setRanked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/results");
      const json = await res.json();
      setRanked(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  };

  const qualified = ranked.filter((r) => {
    const score = r.computed?.total_score ?? 0;
    const matchesSearch = search
      ? r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.teams?.name?.toLowerCase().includes(search.toLowerCase())
      : true;
    return score >= minScore && matchesSearch;
  });

  if (!mounted) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy size={24} className="text-secondary" />
          <h1 className="text-2xl font-bold text-foreground m-0">
            Final Evaluation Report
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/api/admin/report/export"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold hover:opacity-95 shadow-sm transition-all"
          >
            <FileDown size={14} />
            Export CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4 flex items-center gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Min Score:</label>
          <input
            type="number"
            min={0}
            max={40}
            step={0.5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-20 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>
        <div className="flex items-center flex-1 gap-2 min-w-[200px]">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search by project or team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
          Loading report…
        </div>
      ) : qualified.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
          <FileText size={32} className="text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground m-0">
            {ranked.length === 0 ? "No reviewed submissions yet." : "No submissions match the current filters."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  {["Rank", "Team", "Project", "Category", "Status", "Innovation", "Technical", "Presentation", "Impact", "Reviews", "Total"].map((h) => (
                    <th
                      key={h}
                      className={`px-3.5 py-3 ${
                        h === "Total"
                          ? "text-right"
                          : ["Innovation", "Technical", "Presentation", "Impact", "Reviews", "Status"].includes(h)
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualified.map((entry: any) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3.5 py-3 font-bold text-primary text-xs">#{entry.computed?.rank}</td>
                    <td className="px-3.5 py-3 font-semibold text-foreground text-xs">{entry.teams?.name ?? "—"}</td>
                    <td className="px-3.5 py-3 text-foreground text-xs">{entry.title}</td>
                    <td className="px-3.5 py-3 text-muted-foreground text-xs">{entry.category}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        entry.status === "reviewed"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                    {["avg_innovation", "avg_technical", "avg_presentation", "avg_impact"].map((k) => (
                      <td key={k} className="px-3.5 py-3 text-center font-mono text-xs text-muted-foreground">
                        {entry.computed?.[k]?.toFixed(1) ?? "—"}
                      </td>
                    ))}
                    <td className="px-3.5 py-3 text-center font-mono text-xs text-muted-foreground">{entry.computed?.review_count ?? 0}</td>
                    <td className="px-3.5 py-3 text-right font-mono font-bold text-foreground text-sm">
                      {entry.computed?.total_score?.toFixed(2) ?? "0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground m-0">
              Showing {qualified.length} of {ranked.length} submissions
              {minScore > 0 && ` · min score: ${minScore}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
