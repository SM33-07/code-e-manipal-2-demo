import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/admin/audit-logs
 * Admin only — Secure, paginated, searchable audit log telemetry.
 *
 * Query Params:
 *  - page: number (default: 1)
 *  - limit: number (default: 25, max: 100)
 *  - action: string (exact filter)
 *  - actor: string (search actor name, email, or id)
 *  - search: string (text filter)
 *  - startDate: string (ISO timestamp)
 *  - endDate: string (ISO timestamp)
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const action = searchParams.get('action')?.trim();
    const actor = searchParams.get('actor')?.trim().toLowerCase();
    const search = searchParams.get('search')?.trim().toLowerCase();
    const startDate = searchParams.get('startDate')?.trim();
    const endDate = searchParams.get('endDate')?.trim();

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];

    if (action && action !== 'all') {
      params.push(action);
      whereClauses.push(`al.action = $${params.length}`);
    }

    if (actor) {
      params.push(`%${actor}%`);
      whereClauses.push(`(
        LOWER(COALESCE(p.name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(p.email, '')) LIKE $${params.length}
        OR al.user_id::text LIKE $${params.length}
      )`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(
        LOWER(al.action) LIKE $${params.length}
        OR LOWER(COALESCE(al.target_id, '')) LIKE $${params.length}
        OR LOWER(COALESCE(p.name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(p.email, '')) LIKE $${params.length}
        OR al.details::text LIKE $${params.length}
      )`);
    }

    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) {
        params.push(parsedStart.toISOString());
        whereClauses.push(`al.created_at >= $${params.length}`);
      }
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        params.push(parsedEnd.toISOString());
        whereClauses.push(`al.created_at <= $${params.length}`);
      }
    }

    const whereSql = whereClauses.join(' AND ');

    // 1. Total Count Query
    const countRes = await query(
      `SELECT count(*) as total
       FROM public.audit_logs al
       LEFT JOIN public.profiles p ON p.id = al.user_id
       WHERE ${whereSql}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // 2. Paginated Data Query
    const dataParams = [...params, limit, offset];
    const dataRes = await query(
      `SELECT
         al.id,
         al.user_id,
         al.action,
         al.target_table,
         al.target_id,
         al.details,
         al.ip_hash,
         al.user_agent_summary,
         al.created_at,
         p.name AS actor_name,
         p.email AS actor_email,
         p.role AS actor_role
       FROM public.audit_logs al
       LEFT JOIN public.profiles p ON p.id = al.user_id
       WHERE ${whereSql}
       ORDER BY al.created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    // 3. Available distinct actions for filter dropdown
    const actionsRes = await query(
      `SELECT DISTINCT action FROM public.audit_logs ORDER BY action ASC LIMIT 50`
    );
    const availableActions = actionsRes.rows.map((r) => r.action);

    return successResponse(dataRes.rows, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      availableActions,
    });
  } catch (error) {
    logger.error('GET /api/admin/audit-logs error', { error: String(error) });
    return Errors.INTERNAL('Failed to fetch audit log telemetry');
  }
}, 'admin');
