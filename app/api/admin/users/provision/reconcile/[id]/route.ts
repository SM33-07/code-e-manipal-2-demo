import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { query } from '@/lib/db';
import { Errors, successResponse } from '@/lib/utils/response';

export const POST = withAuth(async (_req: NextRequest, { params }) => {
  const reconciliationId = params?.id;
  if (!reconciliationId) return Errors.BAD_REQUEST('Reconciliation ID is required');

  const { rows } = await query(
    `SELECT id, auth_user_id, profile_id, status, retry_count
     FROM public.provisioning_reconciliation WHERE id = $1 LIMIT 1`,
    [reconciliationId]
  );
  const record = rows[0];
  if (!record) return Errors.NOT_FOUND('Reconciliation record');
  if (record.status === 'AUTH_CLEANUP_RESOLVED') return successResponse({ id: record.id, status: record.status });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(record.auth_user_id);
  if (error && !/not found|does not exist/i.test(error.message)) {
    await query(
      `UPDATE public.provisioning_reconciliation
       SET status = 'MANUAL_REVIEW', retry_count = retry_count + 1,
           error_message = $2 WHERE id = $1`,
      [record.id, error.message.slice(0, 1000)]
    );
    return Errors.INTERNAL('Auth cleanup retry failed; record retained for manual review');
  }

  await query(
    `UPDATE public.provisioning_reconciliation
     SET status = 'AUTH_CLEANUP_RESOLVED', retry_count = retry_count + 1,
         resolved_at = NOW(), error_message = 'Auth cleanup completed'
     WHERE id = $1`,
    [record.id]
  );
  return successResponse({ id: record.id, status: 'AUTH_CLEANUP_RESOLVED' });
}, 'admin');
