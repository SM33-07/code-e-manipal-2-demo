export default function Loading() {
  return (
    <main className="min-h-screen bg-background px-4 py-24 text-foreground">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-7 w-52 rounded bg-muted" />
        <div className="h-4 w-80 max-w-full rounded bg-muted" />
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-44 rounded-2xl border border-border bg-card" />)}
        </div>
        <div className="h-64 rounded-2xl border border-border bg-card" />
      </div>
    </main>
  );
}
