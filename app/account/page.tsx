"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/components/AuthProvider";

export default function AccountPage() {
  const { user, role } = useAuth();

  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Portal account</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Account</h1>
          <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
            <div className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium text-foreground sm:col-span-2">{user?.email || "Unavailable"}</dd>
            </div>
            <div className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm text-muted-foreground">Portal role</dt>
              <dd className="text-sm font-medium capitalize text-foreground sm:col-span-2">{role}</dd>
            </div>
          </dl>
        </section>
      </main>
    </ProtectedRoute>
  );
}
