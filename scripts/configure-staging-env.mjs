import fs from 'fs';

const prodUrl = process.env.DATABASE_URL;
const parsed = new URL(prodUrl);
parsed.pathname = '/cem_staging';
const stagingDbUrl = parsed.toString();

const stagingEnvContent = `# Code-e-Manipal 2.0 — Staging Environment Configuration
# ISOLATION GUARANTEE: Dedicated Staging Database + Dedicated Staging Supabase Auth Project

# 1. Staging Database (Isolated Azure PostgreSQL database: cem_staging)
DATABASE_URL=${stagingDbUrl}

# 2. Staging Supabase Auth Project (Dedicated staging project: ggmwribwynonpsvsmpyz)
NEXT_PUBLIC_SUPABASE_URL=https://ggmwribwynonpsvsmpyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbXdyaWJ3eW5vbnBzdnNtcHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4Mjc4NDEsImV4cCI6MjEwNzQwMzg0MX0.gYn-gr3Sf6M22cTYjT9id2LvgfofIwMrgfPa_WEcB2c
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbXdyaWJ3eW5vbnBzdnNtcHl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTgyNzg0MSwiZXhwIjoyMTA3NDAzODQxfQ.aSWIwHcgNrk3xA90GyoRp4P1HZq1pprLj0fnvKVOE-g

# 3. Application URLs (Staging Local / Rehearsal)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=test
`;

fs.writeFileSync('.env.staging', stagingEnvContent, 'utf8');
console.log('Successfully written .env.staging with valid staging credentials.');
