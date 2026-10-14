import { query } from '@/lib/db';
import type { UserRole } from '@/types';
import { logger } from '@/lib/utils/logger';
import { provisionAccount } from '@/lib/admin/provisioning';
export { generateEventPassword, generateAdminPassword, generateJudgePassword, generateParticipantPasscode } from '@/lib/admin/passwords';

export interface GeneratedCredential {
  id: string;
  name: string;
  email: string;
  role: 'participant' | 'judge';
  password: string;
  team_id?: string | null;
  team_name?: string | null;
}

export interface BulkGenerationFailure {
  index: number;
  name: string;
  reason: string;
}

export interface BulkGenerationResult {
  successful: GeneratedCredential[];
  failed: BulkGenerationFailure[];
}

export interface BulkGenerateParams {
  role: 'participant' | 'judge';
  count: number;
  prefix?: string;
  admin_id: string;
  domain?: string;
}

export function formatCredentialsCSV(records: GeneratedCredential[]): string {
  const header = ['ID', 'Name', 'Email', 'Role', 'Temporary_Password', 'Team_ID', 'Team_Name'];
  const lines = [header.join(',')];
  for (const r of records) {
    lines.push([
      `"${r.id}"`, `"${(r.name || '').replace(/"/g, '""')}"`, `"${(r.email || '').replace(/"/g, '""')}"`,
      `"${r.role}"`, `"${r.password}"`, `"${r.team_id || ''}"`, `"${(r.team_name || '').replace(/"/g, '""')}"`,
    ].join(','));
  }
  return lines.join('\r\n');
}

export async function createBulkCredentials(params: BulkGenerateParams): Promise<BulkGenerationResult> {
  if ((params.role as string) === 'admin') throw new Error('Strict Separation of Admin Accounts: administrative accounts must be provisioned individually.');
  if (!params.role || (params.role !== 'participant' && params.role !== 'judge')) throw new Error("Role must be 'participant' or 'judge'");
  const count = Math.min(Math.max(1, Math.floor(params.count || 1)), 100);
  const prefix = (params.prefix || (params.role === 'judge' ? 'JUDGE' : 'TEAM')).trim().toUpperCase();
  const expectedPrefix = params.role === 'judge' ? 'JUDGE' : 'TEAM';
  if (prefix !== expectedPrefix) throw new Error(`Prefix must be ${expectedPrefix}; canonical identifiers cannot be replaced.`);

  const successful: GeneratedCredential[] = [];
  const failed: BulkGenerationFailure[] = [];
  for (let index = 0; index < count; index += 1) {
    const name = `${params.role === 'judge' ? 'Judge' : 'Team Member'} ${index + 1}`;
    try {
      const account = await provisionAccount({ name, role: params.role }, params.admin_id);
      successful.push({ id: account.id, name: account.name, email: account.email, role: params.role, password: account.password });
    } catch (error) {
      failed.push({
        index: index + 1,
        name,
        reason: error instanceof Error && error.name === 'ProvisioningError' ? error.message : 'Provisioning failed',
      });
    }
  }

  try {
    await query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, details) VALUES ($1, 'BULK_CREDENTIALS_GENERATED', 'profiles', $2)`,
      [params.admin_id, JSON.stringify({ role: params.role, count_requested: count, count_generated: successful.length, count_failed: failed.length, prefix })]
    );
  } catch (auditError) {
    logger.error('Bulk credential audit write failed after provisioning', { adminId: params.admin_id, error: String(auditError) });
  }
  logger.info('Bulk credentials generation completed', { adminId: params.admin_id, role: params.role, count: successful.length, failed: failed.length });
  return { successful, failed };
}

export async function bulkDeactivateEventAccounts(adminId: string): Promise<number> {
  const { rows } = await query(`UPDATE public.profiles SET is_disabled = true, updated_at = NOW() WHERE role IN ('participant', 'judge') AND is_disabled = false RETURNING id`);
  const count = rows.length;
  await query(`INSERT INTO public.audit_logs (user_id, action, target_table, details) VALUES ($1, 'BULK_ACCOUNTS_DEACTIVATED', 'profiles', $2)`, [adminId, JSON.stringify({ count, target_roles: ['participant', 'judge'] })]);
  logger.info('Event accounts bulk deactivated on event conclusion', { adminId, deactivatedCount: count });
  return count;
}
