"use client";

import { projects } from "@/data/projects";
import { Trophy } from "lucide-react";
import { AwardCard } from "@/components/ui/AwardCard";

export default function FeaturedProjects() {
  const p1 = projects.find((p) => p.placement === "1st");
  const p2 = projects.find((p) => p.placement === "2nd");
  const p3 = projects.find((p) => p.placement === "3rd");

  const orderedWinners = [
    { p: p2, place: "2nd", medal: "🥈 2nd Place", badge: "Runner Up" },
    { p: p1, place: "1st", medal: "🥇 1st Place", badge: "Grand Winner", featured: true },
    { p: p3, place: "3rd", medal: "🥉 3rd Place", badge: "Finalist" },
  ];

  return (
    <section className="py-16 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary text-xs font-semibold tracking-wider uppercase mb-3">
            <Trophy className="w-3.5 h-3.5 text-secondary" />
            Previous Editions Retrospective
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight m-0">
            Featured Award Winners
          </h2>

          <p className="text-sm text-muted-foreground max-w-xl mx-auto mt-2 mb-0 leading-relaxed">
            The highest scoring technical innovations selected by our evaluation juries across previous hackathons.
          </p>
        </div>

        {/* 3-Column Podium Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {orderedWinners.map(({ p, medal, badge, featured }) => {
            if (!p) return null;

            return (
              <AwardCard key={p.id} href={`/project/${p.id}`} image={p.videoThumbnail} title={p.title} team={p.teamName} description={p.shortIdea} placement={medal} label={badge} featured={featured} />
            );
          })}
        </div>
      </div>
    </section>
  );
}
