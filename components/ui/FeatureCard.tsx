import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

export function FeatureCard({ index, icon: Icon, title, description, meta, className }: { index?: string; icon?: LucideIcon; title: string; description: string; meta?: string; className?: string }) {
  return <article data-surface="card" data-depth={index === "01" ? "featured" : undefined} className={cn("surface-card group rounded-2xl border border-border bg-card p-6 shadow-sm card-hover-lift", className)}>
    <div className="flex items-start justify-between gap-4">
      {Icon && <span className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary"><Icon size={19} /></span>}
      {index && <span className="font-mono text-xs font-bold tracking-wider text-secondary">{index}</span>}
    </div>
    <h3 className="mt-5 text-lg font-bold text-foreground group-hover:text-primary transition-colors">{title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    {meta && <p className="mt-5 border-t border-border pt-3 text-xs font-semibold text-secondary">{meta}</p>}
  </article>;
}
