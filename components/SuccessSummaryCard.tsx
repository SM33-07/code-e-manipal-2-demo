"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Medal, Award, CheckCircle2, ArrowRight } from "lucide-react";

interface RankedItem {
  id: string;
  title: string;
  score: number;
}

interface Props {
  topThree: RankedItem[];
  onClose: () => void;
  onGoToLeaderboard: () => void;
}

export function SuccessSummaryCard({ topThree, onGoToLeaderboard }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const getBadgeIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-500">
            <Trophy className="w-5 h-5 animate-bounce" />
          </div>
        );
      case 2:
        return (
          <div className="p-2.5 rounded-full bg-neutral-400/10 text-neutral-400">
            <Medal className="w-5 h-5" />
          </div>
        );
      case 3:
        return (
          <div className="p-2.5 rounded-full bg-amber-700/10 text-amber-700">
            <Award className="w-5 h-5" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-[200] flex items-start justify-center p-4 pt-28 overflow-y-auto">
      <Card className="max-w-md w-full border border-border bg-card rounded-2xl shadow-2xl relative">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-extrabold text-foreground">
            All Projects Evaluated!
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Thank you for completing your judging assignments. Here are your top ranked submissions:
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2.5">
            {topThree.length === 0 ? (
              <p className="text-center text-xs py-4 text-muted-foreground">
                No submissions scored yet.
              </p>
            ) : (
              topThree.map((item, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 p-3 rounded-xl border border-border bg-muted/30"
                  >
                    {getBadgeIcon(rank)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        Rank #{rank}
                      </div>
                      <h4 className="text-sm font-bold truncate text-foreground m-0">
                        {item.title}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-primary">
                        {item.score.toFixed(2)}
                      </span>
                      <span className="text-[10px] block text-muted-foreground">pts</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onGoToLeaderboard}
              className="w-full h-11 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:opacity-95 flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
            >
              Go to Leaderboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
