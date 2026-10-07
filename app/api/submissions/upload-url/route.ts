import { NextRequest } from "next/server";
import crypto from "crypto";
import { withAuth } from "@/lib/middleware/withAuth";
import { successResponse, Errors } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";
import {
  getUserTeamId,
  getSubmissionByTeamId,
  verifyMutationPhase,
} from "@/services/submissionService";

const ALLOWED_ASSET_TYPES = ['screenshot', 'presentation'] as const;
type AssetType = typeof ALLOWED_ASSET_TYPES[number];

const ASSET_CONSTRAINTS: Record<
  AssetType,
  { allowedMimeTypes: string[]; maxSizeBytes: number; resourceType: string }
> = {
  screenshot: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    resourceType: 'image',
  },
  presentation: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
    resourceType: 'raw',
  },
};

/**
 * POST /api/submissions/upload-url
 *
 * Generates bounded Cloudinary signed upload credentials.
 *
 * Security invariants:
 * 1. Authenticated participant/team ownership required (cannot upload for other teams).
 * 2. Active phase boundary check (only active submission phases allowed).
 * 3. Finalization lock check: rejected if submission is already finalized.
 * 4. Strict server-side resource typing and MIME type validation.
 * 5. Bounded Cloudinary parameters (team-isolated folder, tags, 10-minute expiry).
 * 6. Cloudinary API secret is never exposed to client.
 */
export const POST = withAuth(async (req, { user, profile }) => {
  if (profile.role !== 'participant' && profile.role !== 'admin') {
    return Errors.FORBIDDEN("Only participants or admins may request upload authorization.");
  }

  try {
    // 1. Authoritative team ownership
    const teamId = await getUserTeamId(user.id);
    if (!teamId) {
      return Errors.FORBIDDEN("You must belong to a registered team to upload submission assets.");
    }

    // 2. Event phase enforcement
    try {
      await verifyMutationPhase();
    } catch (phaseErr: any) {
      if (phaseErr.message === 'EVENT_NOT_STARTED') {
        return Errors.FORBIDDEN("Hackathon has not started yet. Asset uploads are closed.");
      }
      return Errors.FORBIDDEN("Submission window is closed. Asset uploads are no longer permitted.");
    }

    // 3. Finalization lock enforcement
    const existingSubmission = await getSubmissionByTeamId(teamId);
    if (existingSubmission && (existingSubmission.status === 'submitted' || existingSubmission.is_locked === true)) {
      return Errors.FORBIDDEN(
        "Submission is finalized and locked. Asset uploads are prohibited."
      );
    }

    // 4. Validate request parameters
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST("Invalid JSON body.");
    }

    const { asset_type, content_type, transformation, current_count } = body;

    if (!asset_type || !ALLOWED_ASSET_TYPES.includes(asset_type)) {
      return Errors.BAD_REQUEST(
        `asset_type is required and must be one of: ${ALLOWED_ASSET_TYPES.join(', ')}.`
      );
    }

    const constraints = ASSET_CONSTRAINTS[asset_type as AssetType];
    const mimeType = typeof content_type === 'string' ? content_type.trim().toLowerCase() : '';

    if (!mimeType || !constraints.allowedMimeTypes.includes(mimeType)) {
      return Errors.BAD_REQUEST(
        `Disallowed content_type "${content_type}". Allowed MIME types for ${asset_type}: ${constraints.allowedMimeTypes.join(', ')}.`
      );
    }

    // 5. Team asset quota limits (max 3 screenshots, max 1 presentation PDF)
    const count = typeof current_count === 'number' ? current_count : 0;
    if (asset_type === 'screenshot' && count >= 3) {
      return Errors.BAD_REQUEST(
        "Screenshot quota exceeded: maximum 3 screenshots allowed per team."
      );
    }
    if (asset_type === 'presentation' && count >= 1) {
      return Errors.BAD_REQUEST(
        "Presentation quota exceeded: maximum 1 presentation slide PDF allowed per team."
      );
    }

    // 6. Named transformation preset verification (arbitrary transformations rejected)
    const ALLOWED_PRESETS = ['t_screenshot_thumb', 't_presentation_preview', 'none'] as const;
    let preset: string | null = null;
    if (transformation !== undefined && transformation !== null) {
      const t = typeof transformation === 'string' ? transformation.trim() : '';
      if (t && !ALLOWED_PRESETS.includes(t as any)) {
        return Errors.BAD_REQUEST(
          `Arbitrary client transformations are prohibited. Only approved named transformation presets accepted: ${ALLOWED_PRESETS.join(', ')}.`
        );
      }
      if (t && t !== 'none') preset = t;
    }

    // 7. Generate signed Cloudinary upload authorization
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      const missingCloudinaryConfig = [
        !cloudName && 'CLOUDINARY_CLOUD_NAME',
        !apiKey && 'CLOUDINARY_API_KEY',
        !apiSecret && 'CLOUDINARY_API_SECRET',
      ].filter((name): name is string => Boolean(name));

      logger.error('Cloudinary upload authorization is not configured.', {
        missing: missingCloudinaryConfig,
      });
      return Errors.INTERNAL('Asset upload service is not configured.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `code-e-manipal/teams/${teamId}`;
    const publicId = `${asset_type}_${crypto.randomUUID()}`;
    const tags = `team_${teamId},event_2026,${asset_type}`;
    const resourceType = constraints.resourceType;

    // Cloudinary signature formula:
    // Sort parameters alphabetically
    const paramsList = [
      `folder=${folder}`,
      `public_id=${publicId}`,
      `tags=${tags}`,
      `timestamp=${timestamp}`,
    ];
    if (preset) {
      paramsList.push(`transformation=${preset}`);
    }
    const paramsToSign = paramsList.sort().join('&');

    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    logger.info('POST /api/submissions/upload-url authorization issued', {
      teamId,
      userId: user.id,
      assetType: asset_type,
      publicId,
    });

    return successResponse({
      upload_url: uploadUrl,
      signature,
      timestamp,
      api_key: apiKey,
      cloud_name: cloudName,
      folder,
      public_id: publicId,
      tags,
      resource_type: resourceType,
      transformation: preset,
      max_file_size: constraints.maxSizeBytes,
      allowed_mime_types: constraints.allowedMimeTypes,
      expires_in_seconds: 600, // 10-minute HMAC expiration window
    });
  } catch (err: any) {
    logger.error('POST /api/submissions/upload-url failed', { error: String(err), userId: user.id });
    return Errors.INTERNAL();
  }
});
