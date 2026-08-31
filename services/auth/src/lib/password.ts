/**
 * Password hashing and comparison utilities.
 *
 * Uses bcrypt for password hashing with a configurable cost factor.
 * bcrypt is preferred over SHA/HMAC because:
 * - It's intentionally slow (adaptive cost factor deters brute-force attacks).
 * - It includes a built-in salt, preventing rainbow table attacks.
 * - The cost factor can be increased over time as hardware improves.
 *
 * Default cost factor: 12 rounds (~250ms per hash on modern hardware).
 * This can be tuned via the BCRYPT_ROUNDS environment variable.
 */

import bcrypt from 'bcryptjs';

/** Number of bcrypt salt rounds. Higher = slower but more secure. */
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * Hashes a plaintext password using bcrypt.
 *
 * @param password - The raw plaintext password from user input.
 * @returns A bcrypt hash string (includes algorithm, cost, salt, and hash).
 *
 * @example
 * const hash = await hashPassword('MyP@ssw0rd!');
 * // => '$2a$12$...' (60 characters)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 *
 * @param password - The raw plaintext password from user input.
 * @param hash     - The stored bcrypt hash from the database.
 * @returns `true` if the password matches the hash.
 *
 * @example
 * const isValid = await comparePassword('MyP@ssw0rd!', storedHash);
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
