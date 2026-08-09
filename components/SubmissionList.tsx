"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
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
  teamSize: number;
  judged: boolean;
}

interface Props {
  submissions: JudgeSubmission[];
  onSelectSubmission: (id: string) => void;
}

export function SubmissionList({
  submissions,
  onSelectSubmission,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse w-full max-w-md h-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  if (submissions.length === 0) {
    return (
      <p className="text-center py-12 text-sm font-medium text-[#A08070] dark:text-[#A08070]/60">
        No submissions match the active filters.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {submissions.map((submission) => {
        // Theme variables for full cards
        const cardBg = isDark
          ? "bg-[#1E1208]/80 hover:bg-[#1E1208] border-[#C9A227]/20 hover:border-[#D4732A]"
          : "bg-[#FCF6EF]/70 hover:bg-[#FCF6EF] border-[#EBCFB5] hover:border-[#8F102A]";

        const titleColor = isDark ? "text-[#F5EFE0]" : "text-[#6A4635]";
        const descColor = isDark ? "text-[#A08070]" : "text-[#7A5A4A]";

        return (
          <Card
            key={submission.id}
            className={`
              border rounded-2xl shadow-sm transition-all duration-300
              hover:shadow-md hover:-translate-y-1 flex flex-col justify-between
              ${cardBg}
            `}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-4">
                <CardTitle className={`text-xl font-serif font-bold tracking-tight ${titleColor}`}>
                  {submission.title}
                </CardTitle>
                {submission.judged ? (
                  <CheckCircle className="w-6 h-6 text-[#8F102A] dark:text-[#D4732A] shrink-0" />
                ) : (
                  <Circle className="w-6 h-6 text-[#B89A85] dark:text-[#C9A227]/40 shrink-0" />
                )}
              </div>
              <p className={`text-sm mt-2 line-clamp-2 leading-relaxed ${descColor}`}>
                {submission.description}
              </p>
            </CardHeader>
            <CardContent className="pt-0 pb-5 flex justify-between items-center mt-auto">
              <Badge
                variant="outline"
                className="
                  bg-[#8F102A]/5 text-[#8F102A] border-[#8F102A]/20
                  dark:bg-[#D4732A]/5 dark:text-[#D4732A] dark:border-[#D4732A]/20
                  px-2.5 py-0.5 rounded-full text-xs font-semibold
                "
              >
                {submission.teamSize} members
              </Badge>
              <button
                onClick={() => onSelectSubmission(submission.id)}
                className="
                  px-4 py-1.5 rounded-xl font-bold text-sm transition-all duration-200
                  bg-[#8F102A] text-white hover:bg-[#A61B36] active:translate-y-[1px]
                  dark:bg-[#D4732A] dark:text-[#0F0A05] dark:hover:bg-[#E28945]
                  shadow-sm hover:shadow
                "
              >
                {submission.judged ? "View Score" : "Grade Project"}
              </button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
