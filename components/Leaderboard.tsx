"use client";

import { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Trophy, Medal, Award } from "lucide-react";
import { Score } from "@/types/judging";
import { calculateWeightedScore } from "@/utils/scoring";
import { JudgeSubmission } from "./SubmissionList";

interface LeaderboardProps {
  submissions: JudgeSubmission[];
  scores: Score[];
}

export function Leaderboard({ submissions, scores }: LeaderboardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rankings = useMemo(() => {
    const withScores = scores
      .filter((s) => s.isComplete)
      .map((s) => {
        const sub = submissions.find((sub) => sub.id === s.submissionId);
        return {
          submissionId: s.submissionId,
          title: sub?.title ?? "Unknown",
          weightedScore: calculateWeightedScore(s.criteria),
          criteria: s.criteria,
        };
      });

    return withScores.sort((a, b) => b.weightedScore - a.weightedScore);
  }, [scores, submissions]);

  if (!mounted) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse w-full max-w-2xl h-64 bg-muted rounded-2xl" />
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-amber-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-neutral-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-700" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold flex items-center gap-2.5 text-foreground">
            <Trophy className="w-6 h-6 text-secondary" />
            Evaluation Leaderboard
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Your scored submissions ranked by weighted score (out of 10)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rankings.length === 0 ? (
            <p className="text-center py-12 text-sm font-medium text-muted-foreground">
              No submissions scored yet. Start grading to see rankings.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[80px] font-bold text-xs uppercase tracking-wider text-muted-foreground">Rank</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Submission</TableHead>
                    <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Innovation</TableHead>
                    <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Technical</TableHead>
                    <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Presentation</TableHead>
                    <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Impact</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-muted-foreground">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankings.map((r, i) => (
                    <TableRow
                      key={r.submissionId}
                      className="border-border hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-semibold py-3.5">
                        <div className="flex items-center gap-2">
                          {getRankIcon(i + 1)}
                          <span className="text-sm font-bold text-foreground">{i + 1}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="font-semibold text-sm text-foreground">{r.title}</span>
                      </TableCell>
                      <TableCell className="text-center py-3.5 font-mono text-sm text-muted-foreground">{r.criteria.innovation}</TableCell>
                      <TableCell className="text-center py-3.5 font-mono text-sm text-muted-foreground">{r.criteria.technical}</TableCell>
                      <TableCell className="text-center py-3.5 font-mono text-sm text-muted-foreground">{r.criteria.presentation}</TableCell>
                      <TableCell className="text-center py-3.5 font-mono text-sm text-muted-foreground">{r.criteria.impact}</TableCell>
                      <TableCell className="text-right py-3.5">
                        <span className="text-primary font-mono font-bold text-base">
                          {r.weightedScore.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground">Scoring Methodology</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
            <p className="m-0">
              <span className="font-semibold text-foreground">Core Evaluation Pillars:</span> Technical Execution,
              Innovation &amp; Originality, Real-World Feasibility, and Presentation &amp; Demo
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 bg-secondary rounded-full mt-1.5 shrink-0" />
            <p className="m-0">
              <span className="font-semibold text-foreground">Scale:</span> Each criterion is scored on a raw 1–10 scale.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
