import pg from 'pg';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

function calculateStats(latencies) {
  if (latencies.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = Math.round(sum / sorted.length);
  const p = (pct) => sorted[Math.min(Math.floor((pct / 100) * sorted.length), sorted.length - 1)];

  return {
    count: sorted.length,
    min: Math.round(sorted[0]),
    max: Math.round(sorted[sorted.length - 1]),
    avg,
    p50: Math.round(p(50)),
    p90: Math.round(p(90)),
    p95: Math.round(p(95)),
    p99: Math.round(p(99)),
  };
}

async function benchmarkHttp(endpoint, runs = 30) {
  const url = `${BASE_URL}${endpoint}`;
  const latencies = [];
  let statusCodes = {};
  let cacheHeaders = [];

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    try {
      const res = await fetch(url, { headers: { 'Accept': 'text/html,application/json' } });
      const duration = performance.now() - start;
      latencies.push(duration);
      statusCodes[res.status] = (statusCodes[res.status] || 0) + 1;
      if (i === 0) {
        cacheHeaders.push({
          'cache-control': res.headers.get('cache-control'),
          'x-matched-path': res.headers.get('x-matched-path'),
          'content-type': res.headers.get('content-type'),
        });
      }
      await res.text(); // consume body
    } catch (e) {
      statusCodes['ERROR'] = (statusCodes['ERROR'] || 0) + 1;
    }
  }

  return {
    endpoint,
    stats: calculateStats(latencies),
    statusCodes,
    sampleHeaders: cacheHeaders[0] || {},
  };
}

async function benchmarkDbQuery(name, queryFn, runs = 25) {
  const latencies = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    try {
      await queryFn();
      latencies.push(performance.now() - start);
    } catch (e) {
      console.error(`DB Query error in ${name}:`, e.message);
    }
  }
  return {
    queryName: name,
    stats: calculateStats(latencies),
  };
}

async function run() {
  console.log('================================================================');
  console.log('   Code-e-Manipal 2.0 — Phase 5 Baseline Performance Profiling');
  console.log('================================================================');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log(`Database Target: ${dbUrl.replace(/:[^:]*@/, ':***@')}`);
  console.log('----------------------------------------------------------------\n');

  // 1. HTTP Endpoint Latency Benchmarks
  console.log('📊 1. Measuring Server HTTP Response Times (p50/p95/p99)...');
  const httpEndpoints = [
    '/',
    '/timeline',
    '/problem-statements',
    '/api/timeline',
    '/api/problem-statements',
    '/login',
    '/dashboard',
    '/submit',
  ];

  const httpResults = [];
  for (const ep of httpEndpoints) {
    const res = await benchmarkHttp(ep, 25);
    httpResults.push(res);
    console.log(`   ${ep.padEnd(26)}: avg=${res.stats.avg}ms | p50=${res.stats.p50}ms | p95=${res.stats.p95}ms | p99=${res.stats.p99}ms (status: ${JSON.stringify(res.statusCodes)})`);
  }

  // 2. Database Core Query Latency Benchmarks
  console.log('\n🗄️  2. Measuring Database Query Execution Latencies...');
  const dbBenchmarks = [
    {
      name: 'Read Published Timeline Events',
      fn: async () => {
        const client = await pool.connect();
        try {
          return await client.query(`
            SELECT id, title, start_timestamp, end_timestamp, venue, display_order, event_type, is_published
            FROM public.timeline_events
            WHERE is_published = true
            ORDER BY display_order ASC;
          `);
        } finally {
          client.release();
        }
      },
    },
    {
      name: 'Read Approved Problem Statements',
      fn: async () => {
        const client = await pool.connect();
        try {
          return await client.query(`
            SELECT d.id, d.proposed_id, d.title, d.difficulty, d.track, d.problem_statement
            FROM public.problem_statement_drafts d
            JOIN public.problem_statement_releases r ON d.release_id = r.id
            WHERE r.is_current_published = true AND d.is_approved_for_release = true
            ORDER BY d.display_order ASC;
          `);
        } finally {
          client.release();
        }
      },
    },
    {
      name: 'Verify Submission Gate & Event Phase',
      fn: async () => {
        const client = await pool.connect();
        try {
          return await client.query(`
            SELECT event_phase, global_freeze, submission_open, end_time, buffer_minutes
            FROM public.event_config
            WHERE id = 1;
          `);
        } finally {
          client.release();
        }
      },
    },
    {
      name: 'Team Active Sessions Count (Session Enforcement)',
      fn: async () => {
        const client = await pool.connect();
        try {
          return await client.query(`
            SELECT COUNT(*)::int as count
            FROM public.team_active_sessions
            WHERE team_id = '98e48fb9-ea5c-438b-bc73-5cb0ea76af80' AND is_revoked = FALSE AND expires_at >= NOW();
          `);
        } finally {
          client.release();
        }
      },
    },
    {
      name: 'Fetch Team Submissions with Category & Review Status',
      fn: async () => {
        const client = await pool.connect();
        try {
          return await client.query(`
            SELECT s.id, s.team_id, s.title, s.category, s.status, s.is_locked, s.final_submitted_at
            FROM public.submissions s
            WHERE s.team_id = '98e48fb9-ea5c-438b-bc73-5cb0ea76af80' AND s.deleted_at IS NULL;
          `);
        } finally {
          client.release();
        }
      },
    },
    {
      name: 'Admin Dashboard Summary Aggregates (Teams, Submissions, Config)',
      fn: async () => {
        const client = await pool.connect();
        try {
          return await client.query(`
            SELECT 
              (SELECT COUNT(*) FROM public.teams) as total_teams,
              (SELECT COUNT(*) FROM public.submissions WHERE status = 'submitted') as submitted_count,
              (SELECT COUNT(*) FROM public.profiles WHERE role = 'participant') as participant_count,
              (SELECT COUNT(*) FROM public.timeline_events WHERE is_published = true) as live_events;
          `);
        } finally {
          client.release();
        }
      },
    },
  ];

  const dbResults = [];
  for (const b of dbBenchmarks) {
    const res = await benchmarkDbQuery(b.name, b.fn, 25);
    dbResults.push(res);
    console.log(`   ${b.name.padEnd(52)}: avg=${res.stats.avg}ms | p50=${res.stats.p50}ms | p95=${res.stats.p95}ms | max=${res.stats.max}ms`);
  }

  // 3. Pool & Connection Metrics
  console.log('\n🔌 3. Connection Pool Diagnostics:');
  console.log(`   Total pool capacity:    ${pool.totalCount}`);
  console.log(`   Idle connections:       ${pool.idleCount}`);
  console.log(`   Waiting queries:        ${pool.waitingCount}`);

  // 4. Output Summary JSON for report generation
  const summary = {
    timestamp: new Date().toISOString(),
    environment: 'staging',
    http: httpResults,
    database: dbResults,
    pool: {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
  };

  const outputPath = path.resolve(process.cwd(), 'benchmark_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\n✅ Benchmark metrics written to: ${outputPath}`);

  await pool.end();
}

run().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
