import fs from 'fs';

const stagingDbUrl = process.env.STAGING_DATABASE_URL;
if (!stagingDbUrl) {
  console.error('❌ Configuration error: STAGING_DATABASE_URL environment variable is required.');
  process.exit(1);
}

let parsedDbUrl;
try {
  parsedDbUrl = new URL(stagingDbUrl);
} catch {
  console.error('❌ Configuration error: STAGING_DATABASE_URL must be a valid connection URL.');
  process.exit(1);
}

if (!['postgres:', 'postgresql:'].includes(parsedDbUrl.protocol)) {
  console.error('❌ Configuration error: STAGING_DATABASE_URL must be a PostgreSQL connection URL.');
  process.exit(1);
}

if (process.env.DATABASE_URL && stagingDbUrl === process.env.DATABASE_URL) {
  console.error('❌ Safety violation: STAGING_DATABASE_URL matches production DATABASE_URL. Operation blocked.');
  process.exit(1);
}

const stagingServiceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!stagingServiceRoleKey || typeof stagingServiceRoleKey !== 'string' || stagingServiceRoleKey.trim().length === 0) {
  console.error('❌ Configuration error: STAGING_SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
  process.exit(1);
}

const stagingSupabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL || '';
const stagingAnonKey = process.env.STAGING_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const stagingEnvContent = `# Code-e-Manipal 2.0 — Staging Environment Configuration
# ISOLATION GUARANTEE: Dedicated Staging Database + Dedicated Staging Supabase Auth Project

# 1. Staging Database (Isolated Azure PostgreSQL database)
DATABASE_URL=${stagingDbUrl}

# 2. Staging Supabase Auth Project
SUPABASE_URL=${stagingSupabaseUrl}
SUPABASE_ANON_KEY=${stagingAnonKey}
SUPABASE_SERVICE_ROLE_KEY=${stagingServiceRoleKey.trim()}

# 3. Application URLs (Staging Local / Rehearsal)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=test
`;

fs.writeFileSync('.env.staging', stagingEnvContent, 'utf8');
console.log('Successfully written .env.staging from validated staging environment variables.');
