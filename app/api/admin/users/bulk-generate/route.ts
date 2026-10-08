import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { Errors, successResponse } from '@/lib/utils/response';
import { createBulkCredentials, formatCredentialsCSV } from '@/lib/admin/credentials';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/users/bulk-generate
 * Admin only — Bulk generate 6-character event credentials for teams/judges.
 *
 * Security Requirements:
 * - Strict Separation of Admin Accounts: produces credentials strictly for participants and judges
 * - Zero Plaintext Persistence: passwords returned ONCE in this response, never stored in DB
 * - Zero Telemetry Leakage: passwords never logged to application logs or audit logs
 * - Sensitive Export Controls: delivered via non-cached response headers (Cache-Control: no-store)
 * - Supports CSV format for badge printing and JSON for administrative interfaces
 */
export const POST = withAuth(async (req, { user: adminUser }) => {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid JSON request body');
    }

    const { role, count, prefix, format } = body;

    // Strict Separation of Admin Accounts (Baseline Line 603)
    if (role === 'admin') {
      return Errors.BAD_REQUEST(
        'Strict Separation of Admin Accounts: The bulk generator produces 6-character credentials only for participants and judges. Administrative accounts must be provisioned with high-entropy credentials via secure management.'
      );
    }

    if (!role || (role !== 'participant' && role !== 'judge')) {
      return Errors.BAD_REQUEST("Role must be 'participant' or 'judge'");
    }

    const numericCount = count !== undefined ? Number(count) : 10;
    if (isNaN(numericCount) || numericCount < 1 || numericCount > 100) {
      return Errors.BAD_REQUEST('Count must be an integer between 1 and 100');
    }

    const result = await createBulkCredentials({
      role,
      count: numericCount,
      prefix: typeof prefix === 'string' ? prefix : undefined,
      admin_id: adminUser.id,
    });

    if (format === 'csv' && result.failed.length === 0) {
      const csvContent = formatCredentialsCSV(result.successful);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `badge-credentials-${role}-${timestamp}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          'Pragma': 'no-cache',
        },
      });
    }

    const response = successResponse(
      result.failed.length === 0 ? result.successful : result,
      {
        total_generated: result.successful.length,
        total_failed: result.failed.length,
        role,
        notice: 'Zero Plaintext Persistence: Passwords returned ONCE; store or export immediately.',
      },
      result.failed.length === 0 ? 201 : 207
    );

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (err: any) {
    logger.error('POST /api/admin/users/bulk-generate', {
      error: err instanceof Error ? err.message : String(err),
    });
    return Errors.BAD_REQUEST(err.message || 'Bulk generation failed');
  }
}, 'admin');
