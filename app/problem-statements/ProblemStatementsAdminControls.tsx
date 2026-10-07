"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

export function ProblemStatementsAdminControls({ published }: { published: boolean }) {
  const { role } = useAuth();
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  if (role !== "admin") return null;

  const publish = async () => {
    setPublishing(true);
    try {
      const response = await fetch("/api/admin/event-config/problem-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Unable to publish problem statements.");
      toast.success("Problem statements are now live.");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Unable to publish problem statements.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-secondary/40 bg-card p-4 shadow-sm flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {published ? <Unlock className="text-secondary" size={20} /> : <Lock className="text-secondary" size={20} />}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-secondary">Admin release control</p>
          <p className="text-xs text-muted-foreground">{published ? "Problem statements are live." : "The vault is sealed until you publish it."}</p>
        </div>
      </div>
      {!published && (
        <button type="button" onClick={publish} disabled={publishing} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60">
          {publishing ? "Publishing…" : "Publish Problem Statements"}
        </button>
      )}
    </div>
  );
}
