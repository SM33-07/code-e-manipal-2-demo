import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const GET = withAuth(async (req) => {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Get all non-deleted submissions
    const { data: subs, error: e1 } = await supabase
      .from('submissions')
      .select('id, title, summary, category, status, technologies, github_url, demo_url, docs_url, created_at, team_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (e1) throw e1;

    // 2. Get all teams
    const { data: teams, error: e2 } = await supabase
      .from('teams')
      .select('id, name, hackathon');
    if (e2) throw e2;

    const teamMap = new Map<string, any>((teams ?? []).map((t: any) => [t.id, t]));

    // 3. Build CSV rows
    const headers = 'Rank,Team Name,Project Title,Category,Summary,Technologies,GitHub URL,Status,Submitted At';
    const rows = (subs ?? []).map((s: any) => {
      const team = teamMap.get(s.team_id);
      return [
        '',
        escapeCsv(team?.name),
        escapeCsv(s.title),
        escapeCsv(s.category),
        escapeCsv(s.summary),
        escapeCsv(Array.isArray(s.technologies) ? s.technologies.join('; ') : ''),
        escapeCsv(s.github_url),
        escapeCsv(s.status),
        s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : '',
      ].join(',');
    });

    const csv = [headers, ...rows].join('\r\n');

    logger.info('GET /api/admin/report/export', { count: (subs ?? []).length });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="hackathon_report.csv"',
      },
    });
  } catch (err) {
    console.error('Export CSV error:', err);
    logger.error('GET /api/admin/report/export', { error: err instanceof Error ? err.message : JSON.stringify(err) });
    return new NextResponse(JSON.stringify({ error: 'Export failed' }), { status: 500 });
  }
}, 'admin');
