"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

export function ProblemStatementsAdminControls({ published }: { published: boolean }) {
  // Publication gate has been removed — problem statements are permanently public.
  return null;
}
