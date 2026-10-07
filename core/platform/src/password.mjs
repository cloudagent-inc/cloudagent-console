import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const COST = { N: 131072, r: 8, p: 1 };
const MAX_MEMORY = 160 * 1024 * 1024;

export function validatePasswordRecord(record) {
  if (!record || record.version !== 1 || record.algorithm !== 'scrypt' ||
      record.N !== COST.N || record.r !== COST.r || record.p !== COST.p ||
      !/^[a-f0-9]{64}$/.test(record.salt || '') ||
      !/^[a-f0-9]{64}$/.test(record.hash || '')) {
    throw new Error('Password settings are damaged or unsupported. Restore settings.json in your local data folder from a backup.');
  }
  return record;
}

export function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 1024) {
    throw Object.assign(new Error('Use a password of at least 12 characters and at most 1024 bytes.'), { status: 400 });
  }
}

export async function hashPassword(password) {
  validateNewPassword(password);
  const salt = randomBytes(32).toString('hex');
  const hash = await scrypt(password, Buffer.from(salt, 'hex'), 32, { ...COST, maxmem: MAX_MEMORY });
  return { version: 1, algorithm: 'scrypt', ...COST, salt, hash: hash.toString('hex') };
}

export async function verifyPassword(password, record) {
  validatePasswordRecord(record);
  if (typeof password !== 'string' || Buffer.byteLength(password) > 1024) return false;
  const derived = await scrypt(password, Buffer.from(record.salt, 'hex'), 32, { ...COST, maxmem: MAX_MEMORY });
  return timingSafeEqual(derived, Buffer.from(record.hash, 'hex'));
}
