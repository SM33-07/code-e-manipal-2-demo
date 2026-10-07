/**
 * ADR-009: Account Identifier Normalization & Database Column Specification
 *
 * All user-entered identifiers pass through a strict canonical normalization pipeline:
 *   Raw Input → Trim Whitespace → Uppercase → Regex Validation → Canonical Identifier
 *
 * Prevents edge-case authentication failures caused by leading/trailing spaces
 * or lowercase entries (e.g., "team-001" vs "TEAM-001").
 */

/** Valid identifier formats per ADR-009 */
export const IDENTIFIER_PATTERNS = {
  PARTICIPANT: /^TEAM-[0-9]{3}$/,
  JUDGE: /^JUDGE-[0-9]{2}$/,
  ADMIN: /^ADMIN-[0-9]{2}$/,
} as const;

export type IdentifierRole = 'participant' | 'judge' | 'admin';

export interface NormalizedIdentifier {
  /** The canonical, uppercase, trimmed identifier */
  canonical: string;
  /** The inferred role from the identifier pattern */
  role: IdentifierRole;
}

/**
 * Normalizes and validates a raw identifier input.
 *
 * Pipeline: Trim → Uppercase → Regex Validation
 *
 * @param rawInput - The raw user-entered identifier (e.g., " team-042 ")
 * @returns NormalizedIdentifier if valid, null if invalid
 */
export function normalizeIdentifier(rawInput: string): NormalizedIdentifier | null {
  if (!rawInput || typeof rawInput !== 'string') {
    return null;
  }

  /**
   * Normalize a personalized role login ID while retaining its encoded role.
   */
  export function normalizeLoginId(rawInput: string): NormalizedIdentifier | null {
    const canonical = rawInput.trim().toUpperCase();
    const normalizedIdentifier = normalizeIdentifier(canonical);
    if (normalizedIdentifier) return normalizedIdentifier;

    const match = /^(JUDGE|ADMIN)-([A-Z0-9]+(?:-[A-Z0-9]+)*)$/.exec(canonical);
    if (!match) return null;

    return {
      canonical,
      role: match[1] === 'JUDGE' ? 'judge' : 'admin',
    };
  }

  // Step 1: Trim whitespace
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Step 2: Uppercase
  const canonical = trimmed.toUpperCase();

  // Step 3: Regex validation against known patterns
  if (IDENTIFIER_PATTERNS.PARTICIPANT.test(canonical)) {
    return { canonical, role: 'participant' };
  }

  if (IDENTIFIER_PATTERNS.JUDGE.test(canonical)) {
    return { canonical, role: 'judge' };
  }

  if (IDENTIFIER_PATTERNS.ADMIN.test(canonical)) {
    return { canonical, role: 'admin' };
  }

  // Does not match any valid pattern
  return null;
}

/**
 * Converts a canonical identifier to the synthetic email format
 * used for Supabase GoTrue authentication.
 *
 * Format: `<identifier>@auth.codeemanipal.in`
 * Example: TEAM-042 → team-042@auth.codeemanipal.in
 */
export function identifierToEmail(canonicalIdentifier: string): string {
  return `${canonicalIdentifier.toLowerCase()}@auth.codeemanipal.in`;
}

/**
 * Extracts the canonical identifier from a synthetic email address.
 *
 * Example: team-042@auth.codeemanipal.in → TEAM-042
 * Returns null if the email is not in the expected synthetic format.
 */
export function emailToIdentifier(email: string): string | null {
  if (!email || typeof email !== 'string') return null;

  const domain = '@auth.codeemanipal.in';
  if (!email.endsWith(domain)) return null;

  const localPart = email.slice(0, -domain.length);
  const canonical = localPart.toUpperCase();

  // Validate the extracted identifier
  const result = normalizeIdentifier(canonical);
  return result ? result.canonical : null;
}

/**
 * Validates that a raw identifier string is syntactically valid
 * without returning the normalized form.
 */
export function isValidIdentifier(rawInput: string): boolean {
  return normalizeIdentifier(rawInput) !== null;
}
