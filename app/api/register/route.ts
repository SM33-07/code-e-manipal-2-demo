import { Errors } from "@/lib/utils/response";
import { isDemoMode } from "@/lib/demo/demoMode";

/** Provisioning is managed by event administrators; public self-registration is disabled. */
export async function POST() {
  if (isDemoMode()) {
    return Errors.FORBIDDEN("Demo Mode Active: Registrations are disabled in this read-only showcase.");
  }
  return Errors.NOT_FOUND("Registration endpoint");
}
