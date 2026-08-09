"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Medal, Award, CheckCircle2, ArrowRight, X } from "lucide-react";

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

export function SuccessSummaryCard({ topThree, onClose, onGoToLeaderboard }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  // Palette styling
  const cardBg = isDark ? "bg-[#1E1208] border-[#C9A227]/30 shadow-2xl" : "bg-[#FCF6EF] border-[#EBCFB5] shadow-xl";
  const titleClass = isDark ? "text-[#F5EFE0]" : "text-[#8F102A]";
  const subClass = isDark ? "text-[#A08070]" : "text-[#7A5A4A]";
  const itemBg = isDark ? "bg-[#0F0A05]/60 border-[#C9A227]/10" : "bg-[#FCF6EF]/40 border-[#EBCFB5]/50";

  const getBadgeIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="p-2.5 rounded-full bg-yellow-500/10 text-yellow-500 dark:text-yellow-400">
            <Trophy className="w-6 h-6 animate-bounce" />
          </div>
        );
      case 2:
        return (
          <div className="p-2.5 rounded-full bg-neutral-400/10 text-neutral-400 dark:text-neutral-300">
            <Medal className="w-6 h-6" />
          </div>
        );
      case 3:
        return (
          <div className="p-2.5 rounded-full bg-amber-600/10 text-amber-600 dark:text-amber-500">
            <Award className="w-6 h-6" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-start justify-center p-4 pt-28 overflow-y-auto">
      <Card className={`max-w-md w-full border rounded-2xl transform scale-100 transition-all relative ${cardBg}`}>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <CardTitle className={`text-2xl sm:text-3xl font-serif font-black ${titleClass}`}>
            All Projects Evaluated!
          </CardTitle>
          <CardDescription className={`text-sm mt-1.5 ${subClass}`}>
            Thank you for completing your judging assignments. Here is how you ranked your top submissions:
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="space-y-3">
            {topThree.length === 0 ? (
              <p className={`text-center text-sm py-4 ${subClass}`}>
                No submissions scored yet.
              </p>
            ) : (
              topThree.map((item, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-3 rounded-xl border ${itemBg}`}
                  >
                    {getBadgeIcon(rank)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase font-bold text-[#B89A85] tracking-wider">
                        Rank #{rank}
                      </div>
                      <h4 className={`text-sm font-bold truncate ${titleClass}`}>
                        {item.title}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold font-serif text-[#8F102A] dark:text-[#F0C060]">
                        {item.score.toFixed(2)}
                      </span>
                      <span className="text-[10px] block text-[#B89A85]">pts</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <button
              type="button"
              onClick={onGoToLeaderboard}
              className="
                w-full h-12 rounded-xl font-bold text-sm transition-all duration-200
                bg-[#8F102A] text-white hover:bg-[#A61B36] active:translate-y-[1px]
                dark:bg-[#D4732A] dark:text-[#0F0A05] dark:hover:bg-[#E28945]
                flex items-center justify-center gap-2 shadow-md
              "
            >
              Go to Leaderboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
