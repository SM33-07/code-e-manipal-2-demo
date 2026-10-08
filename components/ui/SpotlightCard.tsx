"use client";

import React from "react";
import { cn } from "./utils";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function SpotlightCard({
  children,
  className,
  ...props
}: SpotlightCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border border-border bg-card text-card-foreground transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-secondary/50 motion-reduce:transform-none motion-reduce:transition-none focus-within:ring-2 focus-within:ring-primary/30",
        "surface-card",
        className
      )}
      data-surface="card"
      {...props}
    >
      {children}
    </div>
  );
}

export default SpotlightCard;
