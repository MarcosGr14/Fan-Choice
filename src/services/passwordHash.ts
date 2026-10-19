// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: PASSWORD HASHING (scrypt nativo de Node)
// ==============================================================================
// Formato guardado: scrypt$N$r$p$salt(base64)$hash(base64)
// No necesita dependencias externas. Cada contraseña lleva su propia sal.

import crypto from 'crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_N = 65536; // tope por seguridad si alguien manipula el hash guardado

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, KEY_LENGTH, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

/**
 * Devuelve true solo si la contraseña coincide con un hash scrypt válido.
 * Cualquier otro valor guardado (por ejemplo '!SIN_CONTRASENA') devuelve false.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  try {
    if (typeof plain !== 'string' || typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const n = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    if (![n, r, p].every(Number.isFinite) || n < 2 || n > MAX_N || r < 1 || p < 1) return false;

    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = crypto.scryptSync(plain, salt, expected.length, { N: n, r, p });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}