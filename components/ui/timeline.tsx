"use client";

import React, { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

export interface TimelineEntry {
  title: string;
  subtitle?: string;
  badge?: string;
  content: React.ReactNode;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, []);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref, data]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 80%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div
      className="w-full font-sans bg-transparent"
      ref={containerRef}
    >
      <div ref={ref} className="relative max-w-5xl mx-auto pb-16 sm:pb-24">
        {data.map((item, index) => (
          <div
            key={index}
            className="flex min-w-0 flex-col justify-start pt-8 sm:pt-10 md:flex-row md:pt-16 md:gap-10"
          >
            {/* Sticky Header / Date Node (Desktop left column) */}
            <div className="relative flex min-h-9 flex-col md:sticky md:flex-row z-40 items-start md:items-center top-28 self-start max-w-xs lg:max-w-sm md:w-full">
              <div className="h-9 absolute left-3 md:left-3 w-9 rounded-full bg-card border-2 border-secondary/50 flex items-center justify-center shadow-sm">
                <div className="h-3.5 w-3.5 rounded-full bg-primary ring-2 ring-primary/20" />
              </div>
              <div className="hidden md:block md:pl-16">
                {item.badge && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary/15 text-secondary border border-secondary/30 mb-1.5">
                    {item.badge}
                  </span>
                )}
                <h3 className="text-xl lg:text-2xl font-extrabold text-foreground tracking-tight">
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {item.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Content Column (Right on desktop, below left rail on mobile) */}
            <div className="relative min-w-0 pl-14 pr-0 md:pl-4 w-full">
              {/* Mobile Phase Header */}
              <div className="md:hidden block mb-4">
                {item.badge && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary/15 text-secondary border border-secondary/30 mb-1">
                    {item.badge}
                  </span>
                )}
                <h3 className="text-lg font-bold text-foreground">
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground">
                    {item.subtitle}
                  </p>
                )}
              </div>

              {item.content}
            </div>
          </div>
        ))}

        {/* Continuous Vertical Rail (Antique Brass) */}
        <div
          style={{
            height: height + "px",
          }}
          className="absolute md:left-7 left-7 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-secondary to-transparent to-[99%] [mask-image:linear-gradient(to_bottom,transparent_0%,black_5%,black_95%,transparent_100%)]"
        >
          {prefersReducedMotion ? (
            <div
              style={{ height: height + "px" }}
              className="absolute inset-x-0 top-0 w-[2px] bg-gradient-to-t from-primary via-secondary to-transparent rounded-full opacity-60"
            />
          ) : (
            <motion.div
              style={{
                height: heightTransform,
                opacity: opacityTransform,
              }}
              className="absolute inset-x-0 top-0 w-[2px] bg-gradient-to-t from-primary via-secondary to-transparent rounded-full"
            />
          )}
        </div>
      </div>
    </div>
  );
};
