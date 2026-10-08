"use client";

import { motion } from "framer-motion";
import { Download } from "lucide-react";

export function DataExport() {
  return (
    <motion.div
      className="bg-card border border-border rounded-xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Download className="text-cyan-400" />
        <h2 className="text-white text-xl">Data Export</h2>
      </div>

      <p className="text-white/60 mb-5">
        Download hackathon data including teams, submissions and scores as CSV.
      </p>

      <a
        href="/api/admin/report/export"
        className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition"
      >
        <Download size={16} />
        Export CSV
      </a>
    </motion.div>
  );
}
