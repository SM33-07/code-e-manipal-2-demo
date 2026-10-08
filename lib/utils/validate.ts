// ── Reusable input validators used across all route handlers ──

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function sanitizeString(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function sanitizeScore(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > 10) return undefined;
  return n;
}

export function sanitizePagination(
  limit: string | null,
  offset: string | null
) {
  return {
    limit:  Math.min(Math.max(parseInt(limit  ?? '12'), 1), 100),
    offset: Math.max(parseInt(offset ?? '0'), 0),
  };
}

export function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .map((v) => (v as string).trim());
}
