import pg, { type QueryResultRow } from 'pg';
import { isDemoMode, assertDemoModeSafety, getDemoDataSourceMode } from '@/lib/demo/demoMode';
const { Pool } = pg;

function createRealPool(databaseUrl: string): pg.Pool {
  const p = new Pool({
    connectionString: databaseUrl,
    ssl: {
      // Azure Flexible Server forces SSL by default.
      // We set rejectUnauthorized to false to allow SSL connection without configuring a custom CA certificate locally.
      rejectUnauthorized: false,
    },
    max: 10,                        // Suitable for serverless / dev concurrency
    idleTimeoutMillis: 30000,       // Keep connections open for 30s
    connectionTimeoutMillis: 30000, // Allow 30s for Azure SSL handshakes and connection spikes
  });

  p.on('error', (err) => {
    console.error('Unexpected PG pool error:', err.message);
  });

  return p;
}

const mockPool: pg.Pool = {
  query: async () => ({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
  connect: async () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => {},
  }),
  on: () => {},
  end: async () => {},
} as unknown as pg.Pool;

let realPoolInstance: pg.Pool | null = null;
let currentDbUrl: string | undefined = undefined;

function getActivePool(): pg.Pool {
  if (isDemoMode()) {
    assertDemoModeSafety();
    if (getDemoDataSourceMode() === 'synthetic') {
      return mockPool;
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (isDemoMode()) {
      return mockPool;
    }
    throw new Error('❌ Missing DATABASE_URL environment variable');
  }

  if (!realPoolInstance || currentDbUrl !== databaseUrl) {
    realPoolInstance = createRealPool(databaseUrl);
    currentDbUrl = databaseUrl;
  }
  return realPoolInstance;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    const active = getActivePool();
    const val = (active as any)[prop];
    return typeof val === 'function' ? val.bind(active) : val;
  },
});

/**
 * Execute a query against the Postgres database
 */
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  if (isDemoMode()) {
    assertDemoModeSafety();
    if (getDemoDataSourceMode() === 'synthetic') {
      return { rows: [] as T[], rowCount: 0, command: 'SELECT', oid: 0, fields: [] } as any;
    }
  }
  return pool.query<T>(text, params);
}
