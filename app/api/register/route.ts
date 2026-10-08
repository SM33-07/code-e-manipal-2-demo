import { Errors } from "@/lib/utils/response";

/** Provisioning is managed by event administrators; public self-registration is disabled. */
export async function POST() {
  return Errors.NOT_FOUND("Registration endpoint");
}
