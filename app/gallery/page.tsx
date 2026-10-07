"use client";

import { useEffect, useState } from "react";
import FeaturedProjects from "@/components/FeaturedProjects";
import VideoCarousel from "@/components/VideoCarousel";
import ProjectGrid from "@/components/ProjectGrid";
import { Sparkles, Trophy, Users, Cpu } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

export default function Gallery() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen text-foreground relative">
      {/* Hero Section */}
      <section className="pt-6 pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <SpotlightCard className="relative overflow-hidden border-y border-border bg-surface-elevated/90 p-6 sm:p-10">

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary text-xs font-semibold tracking-wider uppercase mb-4">
                <Sparkles className="w-3.5 h-3.5 text-secondary" />
                Hackathon Retrospective &amp; Archives
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight m-0 mb-3">
                Previous Editions Gallery
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed m-0">
                A visual and technical record of previous editions of Code-e-Manipal. Celebrating the teams, prototypes, mentorship sessions, and grand finale moments from Manipal University Jaipur.
              </p>

              {/* Stats */}
              <div className="flex flex-wrap justify-center gap-8 sm:gap-14 mt-8 pt-6 border-t border-border">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-extrabold font-mono text-primary">
                    <Trophy className="w-5 h-5 text-secondary" />
                    8+
                  </div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mt-1">
                    Past Projects Archived
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-extrabold font-mono text-primary">
                    <Users className="w-5 h-5 text-secondary" />
                    25+
                  </div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mt-1">
                    Alumni Participants
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-extrabold font-mono text-primary">
                    <Cpu className="w-5 h-5 text-secondary" />
                    30+
                  </div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mt-1">
                    Tech Stacks Explored
                  </div>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </section>

      {/* Featured Award Winners */}
      <FeaturedProjects />

      {/* Video Demonstration Carousel */}
      <VideoCarousel />

      {/* All Projects Archive Grid */}
      <ProjectGrid />

      {/* Gallery Footer */}
      <footer className="border-t border-border py-8 mt-12 bg-card">
        <div className="max-w-6xl mx-auto px-6 text-center text-muted-foreground text-xs">
          <p className="m-0 font-semibold text-foreground">Code-e-Manipal 2.0 Hackathon Portal</p>
          <p className="mt-1 m-0">Empowering student engineering through innovation and design</p>
        </div>
      </footer>
    </div>
  );
}
