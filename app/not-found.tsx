import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center space-y-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary/15 text-secondary">
        <SearchX size={32} />
      </div>
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-secondary">
          404 · Page Not Found
        </span>
        <h1 className="text-3xl font-black text-foreground font-serif">
          Resource Not Located
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          The page or challenge you are looking for does not exist or has been moved.
        </p>
      </div>

      <div className="pt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/problem-statements"
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
        >
          <ArrowLeft size={14} />
          <span>View Problem Statements</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition-all"
        >
          <span>Home</span>
        </Link>
      </div>
    </div>
  );
}
