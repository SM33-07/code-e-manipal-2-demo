'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ProblemStatementsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Problem statements page error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
        <AlertCircle size={32} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-serif">
        Failed to Load Problem Statements
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        The challenge briefs could not be loaded from the database server. This may be due to a temporary database connection or authentication error.
      </p>
      {error?.digest && (
        <p className="mt-2 text-xs font-mono text-muted-foreground/70">
          Error Digest: {error.digest}
        </p>
      )}
      <div className="mt-8 flex justify-center gap-4">
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
