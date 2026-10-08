"use client";

import { motion } from "framer-motion";
import { Trophy, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

export function ResultsManagement() {
  const router = useRouter();

  return (
    <motion.div
      className="bg-card border border-border rounded-xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Trophy className="text-yellow-400" />
        <h2 className="text-white text-xl">Results Management</h2>
      </div>

      <p className="text-white/60 mb-5">
        View the final ranked report with scores and export data.
      </p>

      <button
        onClick={() => router.push("/admin/report")}
        className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition"
      >
        <ExternalLink size={16} />
        View Full Report
      </button>
    </motion.div>
  );
}
