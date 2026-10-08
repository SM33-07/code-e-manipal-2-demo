"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/AuthProvider";

const JudgeDashboard = dynamic(
  () => import("@/components/JudgeDashboard").then((m) => m.JudgeDashboard),
  { ssr: false }
);

/**
 * Dedicated Judge Evaluation Workspace.
 * Canonical destination for assigned teams and scoring queues.
 */
export default function JudgePage() {
  const { logout, user, role, isAuthenticated } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground text-sm">
        Verifying judge authentication...
      </div>
    );
  }

  if (role !== "judge" && role !== "admin") {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <JudgeDashboard
        judgeId={user?.id || ""}
        judgeName={user?.email || "Judge"}
        onLogout={handleLogout}
      />
    </div>
  );
}
