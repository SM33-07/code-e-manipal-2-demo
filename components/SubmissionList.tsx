"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle } from "lucide-react";

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
}

export function SubmissionList({
  submissions,
  onSelectSubmission,
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
    return (
      <p className="text-center py-12 text-sm font-medium text-muted-foreground">
        No submissions match the active filters.
      </p>
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
