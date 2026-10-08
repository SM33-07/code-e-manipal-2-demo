import { redirect } from "next/navigation";

/** Compatibility route: redirects to canonical /timeline */
export default function ScheduleRedirectPage() {
  redirect("/timeline");
}
