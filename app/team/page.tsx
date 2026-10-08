import { redirect } from "next/navigation";

/**
 * Compatibility route: Participant Team management has been consolidated
 * into the canonical Participant / Team Leader Workspace at /dashboard.
 */
export default function TeamCompatibilityPage() {
  redirect("/dashboard");
}
