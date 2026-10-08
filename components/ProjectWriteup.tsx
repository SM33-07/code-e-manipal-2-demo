"use client";

import { motion } from "framer-motion";
import Image from "next/image";

import {
  AlertCircle,
  Zap,
  Code2,
  Layers,
  Shield,
  Rocket,
  BookOpen
} from "lucide-react";

interface Props {
  writeup: {
    problemStatement: string;
    solutionOverview: string;
    technicalImplementation: string;
    architecture: string;
    challenges: string;
    futureImprovements: string;
    reflection: string;
  };
}

const sections = [
  { key: "problemStatement", title: "Problem Statement", icon: AlertCircle, color: "text-red-400" },
  { key: "solutionOverview", title: "Solution Overview", icon: Zap, color: "text-yellow-400" },
  { key: "technicalImplementation", title: "Technical Implementation", icon: Code2, color: "text-blue-400" },
  { key: "architecture", title: "Architecture & Tech Stack", icon: Layers, color: "text-purple-400" },
  { key: "challenges", title: "Challenges", icon: Shield, color: "text-orange-400" },
  { key: "futureImprovements", title: "Future Improvements", icon: Rocket, color: "text-green-400" },
  { key: "reflection", title: "Reflection & Learnings", icon: BookOpen, color: "text-cyan-400" },
] as const;

/* ---------- Simple markdown parser ---------- */

function renderMarkdownLite(text: string) {
  const paragraphs = text.split("\n\n");

  return paragraphs.map((p, i) => {
    const trimmed = p.trim();
    if (!trimmed) return null;

    const lines = trimmed.split("\n");
    const isList = lines.every((l) => l.trim().startsWith("-"));

    if (isList) {
      return (
        <ul key={i} className="list-disc list-inside space-y-1 ml-2 my-3">
          {lines.map((line, j) => (
            <li
              key={j}
              dangerouslySetInnerHTML={{
                __html: formatBold(line.replace(/^-\s*/, "")),
              }}
            />
          ))}
        </ul>
      );
    }

    return (
      <p
        key={i}
        className="my-3"
        dangerouslySetInnerHTML={{
          __html: formatBold(trimmed.replace(/\n/g, "<br/>")),
        }}
      />
    );
  });
}

function formatBold(text: string) {
  return text.replace(
    /\*\*(.*?)\*\*/g,
    '<strong class="text-foreground font-semibold">$1</strong>'
  );
}

/* ---------- Main Component ---------- */

export default function ProjectWriteup({ writeup }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass-card p-8 md:p-10 rounded-2xl"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-1 rounded-lg flex items-center justify-center bg-transparent">
          <Image
            src="/logo.png"
            alt="Code-e-Manipal Logo"
            width={32}
            height={16}
            className="object-contain bg-transparent"
          />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Project Write-up
        </h2>
      </div>

      {/* Writeup Sections */}
      <div className="space-y-10">
        {sections.map(({ key, title, icon: Icon, color }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 * i }}
          >
            {/* Section title */}
            <h3 className="flex items-center gap-2 text-foreground font-medium mb-2">
              <Icon className={`w-5 h-5 ${color}`} />
              {title}
            </h3>

            {/* Kaggle-style readable content */}
            <div className="prose dark:prose-invert max-w-none text-foreground/80 dark:text-slate-300">
              {renderMarkdownLite(writeup[key] || "No description provided.")}
            </div>

            {/* divider */}
            {i < sections.length - 1 && (
              <div className="mt-8 border-t border-muted" />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
