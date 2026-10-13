import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config.js';

describe('Next.js Image Configuration & Hostname Security (Phase 6)', () => {

  test('Remote patterns configure explicit authoritative Supabase hostnames', () => {
    const patterns = nextConfig.images?.remotePatterns || [];
    const hostnames = patterns.map(p => p.hostname);

    // Verifies production and staging hostnames are present
    assert.ok(hostnames.includes('ihnclawnbtkwvbfqwxfe.supabase.co'), 'Production Supabase host must be allowed');
    assert.ok(hostnames.includes('ggmwribwynonpsvsmpyz.supabase.co'), 'Staging Supabase host must be allowed');
  });

  test('Remote patterns reject broad wildcard *.supabase.co (Least Privilege)', () => {
    const patterns = nextConfig.images?.remotePatterns || [];
    const hostnames = patterns.map(p => p.hostname);

    assert.equal(
      hostnames.includes('*.supabase.co'),
      false,
      'Wildcard *.supabase.co must not be used to prevent untrusted tenant image proxying'
    );
  });

  test('Enforces strict pathname isolation to public storage bucket objects', () => {
    const patterns = nextConfig.images?.remotePatterns || [];
    const supabasePatterns = patterns.filter(p => p.hostname.includes('supabase.co'));

    for (const p of supabasePatterns) {
      assert.equal(
        p.pathname,
        '/storage/v1/object/public/**',
        `Pattern for ${p.hostname} must restrict to public storage bucket objects`
      );
    }
  });
});
