import { redirect } from "next/navigation";

/** Compatibility route: redirects to canonical /admin/event */
export default function AdminEventControlCompatibilityPage() {
  redirect("/admin/event");
}
