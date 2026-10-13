import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/admin/audit-logs/export
 * Admin only — Secure CSV export of audit logs.
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action')?.trim();

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];

    if (action && action !== 'all') {
      params.push(action);
      whereClauses.push(`al.action = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT
         al.id,
         al.created_at,
         al.action,
         al.target_table,
         al.target_id,
         al.details,
         p.name AS actor_name,
         p.email AS actor_email,
         p.role AS actor_role
       FROM public.audit_logs al
       LEFT JOIN public.profiles p ON p.id = al.user_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT 1000`,
      params
    );

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = typeof str === 'object' ? JSON.stringify(str) : String(str);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Event ID',
      'Timestamp (UTC)',
      'Action',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Target Entity',
      'Target ID',
      'Details Summary',
    ];

    const lines = [headers.join(',')];

    for (const r of rows) {
      lines.push([
        escapeCsv(r.id),
        escapeCsv(r.created_at),
        escapeCsv(r.action),
        escapeCsv(r.actor_name || 'System / Unregistered'),
        escapeCsv(r.actor_email || '—'),
        escapeCsv(r.actor_role || '—'),
        escapeCsv(r.target_table || '—'),
        escapeCsv(r.target_id || '—'),
        escapeCsv(r.details || {}),
      ].join(','));
    }

    const csvContent = lines.join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="code_e_manipal_audit_logs_${Date.now()}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  } catch (error) {
    logger.error('GET /api/admin/audit-logs/export error', { error: String(error) });
    return Errors.INTERNAL('Failed to export audit logs');
  }
}, 'admin');
