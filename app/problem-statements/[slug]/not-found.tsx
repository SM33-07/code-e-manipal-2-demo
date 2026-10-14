import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function ProblemNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 text-center space-y-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary/15 text-secondary">
        <SearchX size={32} />
      </div>
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-secondary">
          404 · Not Found
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground font-serif">
          Challenge Statement Not Found
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          The requested problem statement could not be located in the current official release. It may have been renumbered or belongs to an unpublished draft.
        </p>
      </div>

      <div className="pt-2">
        <Link
          href="/problem-statements"
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
        >
          <ArrowLeft size={14} />
          <span>Back to Problem Statements Catalogue</span>
        </Link>
      </div>
    </div>
  );
}
