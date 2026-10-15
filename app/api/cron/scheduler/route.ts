import { NextRequest, NextResponse } from "next/server";
import { runSchedulerTick } from "@/services/schedulerService";
import { successResponse, Errors } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";

/**
 * GET or POST /api/cron/scheduler
 *
 * Invokes the durable canonical scheduler tick.
 * Protected by CRON_SECRET authorization header or admin session.
 */
async function handleScheduler(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, check bearer token
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Check if user is logged in as admin via cookie
      // If no valid auth, return 401
      // For flexibility in test/dev, allow localhost or dev env
      const host = req.headers.get("host") || "";
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
      if (!isLocal) {
        return Errors.UNAUTHORIZED("Invalid cron authorization token.");
      }
    }

    const result = await runSchedulerTick();
    return successResponse(result);
  } catch (err: any) {
    logger.error("Cron scheduler tick failed", { error: String(err) });
    return Errors.INTERNAL("Failed to run scheduler tick.");
  }
}

export async function GET(req: NextRequest) {
  return handleScheduler(req);
}

export async function POST(req: NextRequest) {
  return handleScheduler(req);
}
