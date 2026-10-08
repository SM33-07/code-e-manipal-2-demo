import { redirect } from "next/navigation";

/** Compatibility alias route: redirects to canonical /judge */
export default function JudgingPage() {
  redirect("/judge");
}
