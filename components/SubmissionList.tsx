"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, Award } from "lucide-react";

export interface JudgeSubmission {
  id: string;
  title: string;
  description: string;
  writeup: string;
  reflection: string;
  demoUrl: string;
  teamName: string;
  track: string;
  reviewStatus: "not_started" | "in_progress" | "submitted";
  reviewVersion: number | null;
}

interface Props {
  submissions: JudgeSubmission[];
  onSelectSubmission: (id: string) => void;
  totalAssigned?: number;
  onResetFilters?: () => void;
  onRefresh?: () => void;
}

export function SubmissionList({
  submissions,
  onSelectSubmission,
  totalAssigned = 0,
  onResetFilters,
  onRefresh,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse w-full max-w-md h-24 bg-muted rounded-xl" />
      </div>
    );
  }

  if (submissions.length === 0) {
    if (totalAssigned === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border bg-card/50">
          <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-4">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            Evaluation Queue Ready &bull; No Projects Assigned
          </h3>
          <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            You currently have no project submissions assigned to your evaluation queue.
            If you are serving as a backup judge or project distribution is currently underway, your assignments will automatically appear here once released.
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="mt-5 min-h-11 px-4 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
            >
              Check for Assignments
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-border bg-card/50">
        <p className="text-sm font-medium text-muted-foreground">
          No submissions match the active search or filters.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            Clear Search &amp; Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {submissions.map((submission) => {
        const isSubmitted = submission.reviewStatus === "submitted";
        const statusLabel = isSubmitted
          ? "Submitted"
          : submission.reviewStatus === "in_progress"
            ? "In progress"
            : "Not started";
        return (
          <Card
            key={submission.id}
            className="border border-border bg-card rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/50 flex min-w-0 flex-col justify-between"
          >
            <CardHeader className="pb-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="break-words text-lg font-bold tracking-tight text-foreground">
                    {submission.teamName}
                  </CardTitle>
                  <p className="mt-1 break-words text-sm font-semibold text-muted-foreground">
                    {submission.title}
                  </p>
                </div>
                {isSubmitted ? (
                  <CheckCircle aria-hidden="true" className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle aria-hidden="true" className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                {submission.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="max-w-full truncate border-border text-muted-foreground">
                  {statusLabel}
                </Badge>
                {submission.track && (
                  <Badge variant="outline" className="max-w-full truncate border-primary/20 bg-primary/10 text-primary">
                    {submission.track}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-5 flex justify-end items-center mt-auto">
              <button
                onClick={() => onSelectSubmission(submission.id)}
                className={`min-h-11 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  isSubmitted
                    ? "bg-muted text-foreground hover:bg-muted/80 border border-border"
                    : "bg-primary text-primary-foreground hover:opacity-95 shadow-sm"
                }`}
              >
                {isSubmitted ? "Edit Submitted Review" : submission.reviewStatus === "in_progress" ? "Continue Review" : "Start Review"}
              </button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
