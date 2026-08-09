"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserPlus, X, RotateCcw } from "lucide-react";

interface ApiSubmission {
  id: string;
  title: string;
  teams?: { name: string };
}

interface ApiJudge {
  id: string;
  name: string;
  email: string;
}

interface ApiAssignment {
  judge_id: string;
  submission_id: string;
  submissions?: { id: string; title: string; teams?: { name: string } };
  profiles?: { id: string; name: string; email: string };
}

export function JudgeAssignment() {
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);
  const [judges, setJudges] = useState<ApiJudge[]>([]);
  const [assignments, setAssignments] = useState<ApiAssignment[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<string>("");
  const [selectedJudge, setSelectedJudge] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subsRes, judgesRes, assignRes] = await Promise.all([
        fetch("/api/submissions?limit=100"),
        fetch("/api/admin/users?role=judge"),
        fetch("/api/admin/assignments"),
      ]);

      const subsJson = await subsRes.json();
      const judgesJson = await judgesRes.json();
      const assignJson = await assignRes.json();

      setSubmissions(Array.isArray(subsJson.data) ? subsJson.data : []);
      setJudges(Array.isArray(judgesJson.data) ? judgesJson.data : []);
      setAssignments(Array.isArray(assignJson.data) ? assignJson.data : []);
    } catch (err) {
      console.error("Failed to load assignment data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedSubmission || !selectedJudge) return;

    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          judge_id: selectedJudge,
          submission_id: selectedSubmission,
        }),
      });

      if (!res.ok) throw new Error("Assign failed");

      setSelectedSubmission("");
      setSelectedJudge("");
      await loadData();
    } catch (err) {
      console.error("Assign error:", err);
    }
  };

  const handleUnassign = async (judgeId: string, submissionId: string) => {
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unassign",
          judge_id: judgeId,
          submission_id: submissionId,
        }),
      });

      if (!res.ok) throw new Error("Unassign failed");

      await loadData();
    } catch (err) {
      console.error("Unassign error:", err);
    }
  };

  const handleAutoAssign = async () => {
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_assign" }),
      });

      if (!res.ok) throw new Error("Auto-assign failed");

      await loadData();
    } catch (err) {
      console.error("Auto-assign error:", err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <p className="text-white/50 text-sm">Loading assignments...</p>
      </div>
    );
  }

  const assignedSubmissionIds = new Set(assignments.map((a) => a.submission_id));
  const availableSubmissions = submissions.filter(
    (s) => !assignedSubmissionIds.has(s.id)
  );

  return (
    <motion.div
      className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserPlus className="text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Judge Assignment</h2>
        </div>
        <button
          onClick={handleAutoAssign}
          className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          <RotateCcw size={16} />
          Auto-Assign (Shuffle)
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <select
          value={selectedSubmission}
          onChange={(e) => setSelectedSubmission(e.target.value)}
          className="bg-black/40 border border-white/10 text-white rounded-lg p-3"
        >
          <option value="" className="bg-[#1E1208] text-[#F5EFE0]">Select Submission</option>
          {availableSubmissions.map((s) => (
            <option key={s.id} value={s.id} className="bg-[#1E1208] text-[#F5EFE0]">
              {s.teams?.name ?? "Unknown Team"} — {s.title}
            </option>
          ))}
        </select>

        <select
          value={selectedJudge}
          onChange={(e) => setSelectedJudge(e.target.value)}
          className="bg-black/40 border border-white/10 text-white rounded-lg p-3"
        >
          <option value="" className="bg-[#1E1208] text-[#F5EFE0]">Select Judge</option>
          {judges.map((j) => (
            <option key={j.id} value={j.id} className="bg-[#1E1208] text-[#F5EFE0]">
              {j.name || j.email}
            </option>
          ))}
        </select>

        <button
          onClick={handleAssign}
          disabled={!selectedSubmission || !selectedJudge}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg px-4 py-3 font-medium hover:opacity-90 transition disabled:opacity-40"
        >
          Assign
        </button>
      </div>

      <div className="space-y-3">
        {assignments.length === 0 && (
          <p className="text-white/40 text-sm text-center py-4">
            No assignments yet. Assign manually or use Auto-Assign.
          </p>
        )}
        {assignments.map((a) => {
          const judge = judges.find((j) => j.id === a.judge_id);
          const sub = submissions.find((s) => s.id === a.submission_id);
          return (
            <motion.div
              key={`${a.judge_id}-${a.submission_id}`}
              className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div>
                <p className="text-white font-medium">
                  {sub?.teams?.name ?? "Unknown"} — {sub?.title ?? "Unknown"}
                </p>
                <p className="text-sm text-white/60">
                  Assigned to: {judge?.name || judge?.email || "Unknown"}
                </p>
              </div>
              <button
                onClick={() => handleUnassign(a.judge_id, a.submission_id)}
                className="text-red-400 hover:text-red-300"
              >
                <X size={18} />
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
