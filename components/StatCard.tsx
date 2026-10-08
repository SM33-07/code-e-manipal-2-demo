"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  delay?: number;
}

export function StatCard({ title, value, icon: Icon, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="relative overflow-hidden rounded-xl border border-border bg-card p-6"
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/70">{title}</p>
          <Icon className="text-white/80" />
        </div>

        <h2 className="text-3xl font-bold text-white">{value}</h2>
      </div>
    </motion.div>
  );
}
