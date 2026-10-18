/**
 * Local Public Read-Only Demo Launcher
 * File: scripts/run-demo.mjs
 *
 * Starts the Code-e-Manipal 2.0 Hackathon Portal in pure synthetic demo mode.
 * - Enforces DEMO_MODE=true and NEXT_PUBLIC_DEMO_MODE=true
 * - Sets DATABASE_URL='mock' and DEMO_DATA_SOURCE='synthetic' in process.env
 * - Pre-setting these flags prevents Next.js from inheriting production Azure credentials from .env.local
 * - Preserves .env.local untouched without modifying or exposing any credentials
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

process.env.DEMO_MODE = 'true';
process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
process.env.DATABASE_URL = 'postgresql://mock:mock@127.0.0.1:5432/mock';
process.env.DEMO_DATA_SOURCE = 'synthetic';
process.env.SUPABASE_URL = 'https://demo-mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo-mock.supabase.co';
process.env.SUPABASE_ANON_KEY = 'demo-mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'demo-mock-service-role-key';

const port = process.env.PORT || '3000';
console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║   Code-e-Manipal 2.0 — Public Read-Only Portfolio Demo Launcher          ║');
console.log('║   Data Mode: Pure Synthetic Fixtures (35 challenges, 10 timeline events) ║');
console.log(`║   Server URL: http://localhost:${port}                                      ║`);
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

const nextBin = path.resolve('node_modules/next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'dev', '-p', port], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
