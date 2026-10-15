'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function ProblemDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Problem statement detail error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
        <AlertCircle size={32} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-serif">
        Failed to Load Challenge Detail
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        The challenge brief details could not be retrieved from the database. Please try again or return to the catalogue.
      </p>
      {error?.digest && (
        <p className="mt-2 text-xs font-mono text-muted-foreground/70">
          Error Digest: {error.digest}
        </p>
      )}
      <div className="mt-8 flex justify-center gap-4">
        <Link
          href="/problem-statements"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Catalogue
        </Link>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={15} />
          Retry
        </button>
      </div>
    </div>
  );
}
