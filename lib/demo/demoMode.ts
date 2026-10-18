/**
 * Centralized Demo Mode Configuration & Production Safety Guard
 * File: lib/demo/demoMode.ts
 *
 * Implements:
 * 1. Explicit demo mode toggle via NEXT_PUBLIC_DEMO_MODE / DEMO_MODE.
 * 2. Fail-closed production safety guard: Throws immediately if production
 *    Azure PostgreSQL or Supabase credentials/endpoints are detected.
 * 3. Data source mode discriminator: 'synthetic' fixtures vs 'isolated_db'.
 */

export class ProductionSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionSafetyError';
  }
}

/**
 * Production host and project patterns that are strictly prohibited in Demo Mode.
 * If any of these are present in connection strings or environment URLs while
 * Demo Mode is enabled, the system halts with a fatal ProductionSafetyError.
 */
export const PROHIBITED_PRODUCTION_PATTERNS = [
  'code-e-manipal-db.postgres.database.azure.com',
  'code-e-manipal-db',
  'ihnclawnbtkwvbfqwxfe.supabase.co',
  'ihnclawnbtkwvbfqwxfe',
];

/**
 * Returns true if the application is running in Public Demo Mode.
 * Safe for use in both server-side and client-side components.
 */
export function isDemoMode(): boolean {
  const nextPublic = String(process.env.NEXT_PUBLIC_DEMO_MODE || '').trim().toLowerCase();
  const serverDemo = String(process.env.DEMO_MODE || '').trim().toLowerCase();
  return (
    nextPublic === 'true' ||
    nextPublic === '1' ||
    serverDemo === 'true' ||
    serverDemo === '1'
  );
}

/**
 * Fail-Closed Production Safety Invariant:
 * Verifies that the demo environment is strictly isolated from production Azure
 * PostgreSQL and production Supabase. If any production identifier is found in
 * DATABASE_URL, SUPABASE_URL, or NEXT_PUBLIC_SUPABASE_URL, an error is thrown.
 */
export function assertDemoModeSafety(): void {
  if (!isDemoMode()) return;

  const dbUrl = process.env.DATABASE_URL || '';
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  for (const pattern of PROHIBITED_PRODUCTION_PATTERNS) {
    if (dbUrl.toLowerCase().includes(pattern.toLowerCase())) {
      throw new ProductionSafetyError(
        `[FATAL PRODUCTION GUARD] Demo Mode is enabled, but DATABASE_URL points to production database (${pattern}). Public demo must never connect to production Azure PostgreSQL!`
      );
    }
    if (supabaseUrl.toLowerCase().includes(pattern.toLowerCase()) || publicSupabaseUrl.toLowerCase().includes(pattern.toLowerCase())) {
      throw new ProductionSafetyError(
        `[FATAL PRODUCTION GUARD] Demo Mode is enabled, but SUPABASE_URL points to production Supabase project (${pattern}). Public demo must never connect to production Supabase!`
      );
    }
  }
}

export type DemoDataSourceMode = 'synthetic' | 'isolated_db';

/**
 * Determines whether Demo Mode operates against pure synthetic fixtures
 * or a verified, isolated demo database.
 *
 * In Demo Mode, synthetic data is selected by default even if an inherited
 * DATABASE_URL exists, ensuring local demo runs cannot inadvertently connect
 * to staging or local databases.
 *
 * The production safety guard (assertDemoModeSafety) is always executed first
 * to reject unsafe production configurations rather than silently bypassing them.
 */
export function getDemoDataSourceMode(): DemoDataSourceMode {
  if (!isDemoMode()) {
    throw new Error('getDemoDataSourceMode() called when demo mode is not active');
  }

  // 1. Unsafe production configuration MUST be rejected immediately
  assertDemoModeSafety();

  // 2. Only select isolated_db if explicitly configured
  if (process.env.DEMO_DATA_SOURCE === 'isolated_db') {
    return 'isolated_db';
  }

  // 3. Default to synthetic data even if an inherited DATABASE_URL exists
  return 'synthetic';
}
