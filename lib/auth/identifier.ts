/**
 * ADR-009: Account Identifier Normalization & Database Column Specification
 *
 * Canonical identifiers remain stable for event operations:
 *   TEAM-XXX, JUDGE-XX, ADMIN-XX
 * Personalized judge/admin login IDs are stored separately in profiles.login_id.
 */

export const IDENTIFIER_PATTERNS = {
  PARTICIPANT: /^TEAM-[0-9]{3}$/,
  JUDGE: /^JUDGE-[0-9]{2}$/,
  ADMIN: /^ADMIN-[0-9]{2}$/,
} as const;

export type IdentifierRole = 'participant' | 'judge' | 'admin';

export interface NormalizedIdentifier {
  canonical: string;
  role: IdentifierRole;
}

const LOGIN_ID_PATTERN = /^(JUDGE|ADMIN)-([A-Z0-9]+(?:-[A-Z0-9]+)*)$/;

/** Normalize and validate a canonical event identifier. */
export function normalizeIdentifier(rawInput: string): NormalizedIdentifier | null {
  if (!rawInput || typeof rawInput !== 'string') return null;

  const canonical = rawInput.trim().toUpperCase();
  if (!canonical) return null;

  if (IDENTIFIER_PATTERNS.PARTICIPANT.test(canonical)) {
    return { canonical, role: 'participant' };
  }
  if (IDENTIFIER_PATTERNS.JUDGE.test(canonical)) {
    return { canonical, role: 'judge' };
  }
  if (IDENTIFIER_PATTERNS.ADMIN.test(canonical)) {
    return { canonical, role: 'admin' };
  }

  // Flexible normalization for team identifiers (e.g. TEAM001, team001, Team001, TEAM-001)
  const teamMatch = canonical.match(/^TEAM-?([0-9]{1,3})$/);
  if (teamMatch && teamMatch[1] !== '000' && teamMatch[1] !== '0') {
    return { canonical: `TEAM-${teamMatch[1].padStart(3, '0')}`, role: 'participant' };
  }

  // Flexible normalization for judge badges (e.g. JUDGE01, judge01, JUDGE-01)
  const judgeMatch = canonical.match(/^JUDGE-?([0-9]{1,2})$/);
  if (judgeMatch && judgeMatch[1] !== '00' && judgeMatch[1] !== '0') {
    return { canonical: `JUDGE-${judgeMatch[1].padStart(2, '0')}`, role: 'judge' };
  }

  // Flexible normalization for admin badges (e.g. ADMIN01, admin01, ADMIN-01)
  const adminMatch = canonical.match(/^ADMIN-?([0-9]{1,2})$/);
  if (adminMatch && adminMatch[1] !== '00' && adminMatch[1] !== '0') {
    return { canonical: `ADMIN-${adminMatch[1].padStart(2, '0')}`, role: 'admin' };
  }

  return null;
}

/** Normalize a personalized JUDGE-* or ADMIN-* login identifier. */
export function normalizeLoginId(rawInput: string): NormalizedIdentifier | null {
  if (!rawInput || typeof rawInput !== 'string') return null;

  const canonical = rawInput.trim().toUpperCase();
  const canonicalIdentifier = normalizeIdentifier(canonical);
  if (canonicalIdentifier) return canonicalIdentifier;

  const match = LOGIN_ID_PATTERN.exec(canonical);
  if (!match) return null;

  return {
    canonical,
    role: match[1] === 'JUDGE' ? 'judge' : 'admin',
  };
}

/** Convert a name into the stable token used by personalized login IDs. */
export function nameToken(name: string): string {
  const token = (name || '')
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return token || 'USER';
}

export function personalizedLoginId(role: 'judge' | 'admin', name: string, suffix?: number): string {
  const base = `${role.toUpperCase()}-${nameToken(name)}`;
  return suffix && suffix > 1 ? `${base}-${suffix}` : base;
}

export function identifierToEmail(canonicalIdentifier: string): string {
  return `${canonicalIdentifier.toLowerCase()}@auth.codeemanipal.in`;
}

export function emailToIdentifier(email: string): string | null {
  if (!email || typeof email !== 'string') return null;

  const domain = '@auth.codeemanipal.in';
  if (!email.toLowerCase().endsWith(domain)) return null;

  const localPart = email.slice(0, -domain.length);
  const canonical = localPart.toUpperCase();
  const result = normalizeIdentifier(canonical);
  return result ? result.canonical : null;
}

export function isValidIdentifier(rawInput: string): boolean {
  return normalizeIdentifier(rawInput) !== null;
}

export function isValidLoginId(rawInput: string): boolean {
  return normalizeLoginId(rawInput) !== null;
}
