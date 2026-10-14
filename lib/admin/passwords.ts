import crypto from 'crypto';

const ALPHANUMERIC_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ADMIN_JUDGE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';

function randomCharacter(charset: string): string {
  const limit = Math.floor(256 / charset.length) * charset.length;
  let value: number;
  do {
    value = crypto.randomBytes(1)[0];
  } while (value >= limit);
  return charset[value % charset.length];
}

function generatePassword(length: number, charset: string): string {
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += randomCharacter(charset);
  }
  return result;
}

/**
 * Generates an event-issued alphanumeric passcode for participant accounts.
 * Must be exactly 8 alphanumeric characters ('a'-'z', 'A'-'Z', '0'-'9'),
 * containing at least one letter and at least one digit.
 */
export function generateParticipantPasscode(length = 8): string {
  while (true) {
    const candidate = generatePassword(length, ALPHANUMERIC_CHARSET);
    if (/[a-zA-Z]/.test(candidate) && /[0-9]/.test(candidate)) {
      return candidate;
    }
  }
}

/**
 * Generates an event-issued password/passcode for judge accounts.
 * Defaults to 8 alphanumeric characters ('a'-'z', 'A'-'Z', '0'-'9'), containing
 * at least one letter and at least one digit (matching participant passcode policy).
 */
export function generateJudgePassword(length = 8): string {
  if (length === 8) {
    return generateParticipantPasscode(8);
  }
  const safeLength = Math.max(8, length);
  while (true) {
    const candidate = generatePassword(safeLength, ADMIN_JUDGE_CHARSET);
    if (/[A-Z]/.test(candidate) && /[a-z]/.test(candidate) && /[0-9]/.test(candidate)) {
      return candidate;
    }
  }
}

/**
 * Generates an 8-character alphanumeric judge passcode.
 */
export function generateJudgePasscode(length = 8): string {
  return generateParticipantPasscode(length);
}

/**
 * Generates a high-entropy password for admin accounts.
 * Must be at least 16 characters (defaults to 18), containing uppercase, lowercase, and numeric characters.
 */
export function generateAdminPassword(length = 18): string {
  const safeLength = Math.max(16, length);
  while (true) {
    const candidate = generatePassword(safeLength, ADMIN_JUDGE_CHARSET);
    if (/[A-Z]/.test(candidate) && /[a-z]/.test(candidate) && /[0-9]/.test(candidate)) {
      return candidate;
    }
  }
}

/**
 * Legacy compatibility helper.
 */
export function generateEventPassword(length = 8): string {
  return generateParticipantPasscode(length);
}
