"use client";

import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { Award, LogOut, CheckCircle2 } from "lucide-react";

interface JudgeHeaderProps {
  judgeName?: string;
  onLogout: () => void;
  activeSubmissionTitle?: string;
  onBackToAssignments?: () => void;
}

export function JudgeHeader({
  judgeName,
  onLogout,
  activeSubmissionTitle,
  onBackToAssignments,
}: JudgeHeaderProps) {
  const { user } = useAuth();
  const displayName = judgeName || user?.email || "Judge Workspace";

  return (
    <header className="sticky top-0 z-40 w-full h-16 border-b border-border bg-card text-foreground flex items-center justify-between px-4 md:px-8 shadow-sm transition-colors">
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <BrandLogo
          href="/judging"
          size="sm"
          subtitle="Evaluation Workspace"
          badge="Judge"
        />

        {activeSubmissionTitle && (
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-border text-xs text-muted-foreground">
            {onBackToAssignments && (
              <button
                type="button"
                onClick={onBackToAssignments}
                className="hover:text-primary transition-colors cursor-pointer font-medium"
              >
                Submissions
              </button>
            )}
            <span>/</span>
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              {activeSubmissionTitle}
            </span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Judge identification badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-accent/40 text-xs text-foreground">
          <Award size={14} className="text-secondary" />
          <span className="font-medium truncate max-w-[150px]">{displayName}</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/15 text-secondary text-[10px] font-bold uppercase tracking-wider">
            Evaluation
          </span>
        </div>

        {/* Theme switcher */}
        <ThemeToggle />

        {/* Logout */}
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors cursor-pointer"
          title="Sign out of Judge Workspace"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
