"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Migration & Compatibility Redirect (Phase 2 Requirement G)
 *
 * Schedule editing has been consolidated into the canonical admin operations dashboard (/admin/event).
 * This route automatically redirects authorized administrators to /admin/event?tab=schedule.
 */
export default function AdminTimelineRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/event?tab=schedule");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
      <Loader2 className="animate-spin size-6 text-primary" />
      <p className="text-sm font-medium">Redirecting to consolidated Event Control schedule...</p>
    </div>
  );
}
