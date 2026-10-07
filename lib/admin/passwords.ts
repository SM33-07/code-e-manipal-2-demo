import crypto from 'crypto';

const EVENT_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ADMIN_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';

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

export function generateEventPassword(length = 8): string {
  return generatePassword(length, EVENT_CHARSET);
}

export function generateAdminPassword(length = 18): string {
  return generatePassword(length, ADMIN_CHARSET);
}
