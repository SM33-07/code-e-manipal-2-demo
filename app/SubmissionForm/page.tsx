import { redirect } from "next/navigation";

/** Compatibility route: redirects to canonical lowercase /submit */
export default function SubmissionFormCompatibilityPage() {
  redirect("/submit");
}
