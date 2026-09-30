/**
 * Token generation and verification utilities.
 *
 * Implements a dual-token architecture:
 * - **Access Token**: Short-lived (15 min), stateless JWT containing user claims.
 *   Used by the frontend for API authorization via the `Authorization: Bearer <token>` header.
 * - **Refresh Token**: Long-lived (7 days), stored as a hashed record in the database.
 *   Used to obtain new access tokens without re-entering credentials.
 *
 * Security features:
 * - Refresh tokens are hashed (SHA-256) before storage — raw tokens are never persisted.
 * - Token rotation: each refresh invalidates the old token and issues a new one.
 * - Revocation: tokens can be individually revoked or mass-revoked per user.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtAccessPayload, JwtRefreshPayload, UserRole } from '@uptime/shared-types';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Secret key for signing JWTs. MUST be set via env var in production. */
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_super_secret_key_32chars!';

/** Access token lifetime in seconds (default: 15 minutes). */
const ACCESS_TOKEN_EXPIRY = parseInt(process.env.ACCESS_TOKEN_EXPIRY_SECONDS || '900', 10);

/** Refresh token lifetime in seconds (default: 7 days). */
const REFRESH_TOKEN_EXPIRY = parseInt(process.env.REFRESH_TOKEN_EXPIRY_SECONDS || '604800', 10);

// ─── Access Token ────────────────────────────────────────────────────────────

/**
 * Signs a short-lived access token containing the user's identity and role.
 *
 * @param userId   - The user's UUID (becomes the `sub` claim).
 * @param role     - The user's RBAC role.
 * @returns A signed JWT string.
 */
export function signAccessToken(userId: string, role: UserRole): string {
  const payload: JwtAccessPayload = {
    sub: userId,
    role,
    type: 'access',
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'uptime-auth',
    audience: 'uptime-api',
  });
}

/**
 * Verifies and decodes an access token.
 *
 * @param token - The raw JWT string from the Authorization header.
 * @returns The decoded payload or `null` if invalid/expired.
 */
export function verifyAccessToken(token: string): JwtAccessPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'uptime-auth',
      audience: 'uptime-api',
    }) as JwtAccessPayload & jwt.JwtPayload;

    // Ensure this is actually an access token, not a refresh token
    if (decoded.type !== 'access') return null;
    return decoded;
  } catch {
    return null;
  }
}

// ─── Refresh Token ───────────────────────────────────────────────────────────

/**
 * Signs a long-lived refresh token.
 * The `jti` claim is the database record ID, used for revocation lookup.
 *
 * @param userId  - The user's UUID.
 * @param tokenId - The database row ID for this refresh token (used as `jti`).
 * @returns A signed JWT string.
 */
export function signRefreshToken(userId: string, tokenId: string): string {
  const payload: JwtRefreshPayload = {
    sub: userId,
    jti: tokenId,
    type: 'refresh',
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'uptime-auth',
  });
}

/**
 * Verifies and decodes a refresh token.
 *
 * @param token - The raw JWT string.
 * @returns The decoded payload or `null` if invalid/expired.
 */
export function verifyRefreshToken(token: string): JwtRefreshPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'uptime-auth',
    }) as JwtRefreshPayload & jwt.JwtPayload;

    if (decoded.type !== 'refresh') return null;
    return decoded;
  } catch {
    return null;
  }
}

// ─── Hashing Utilities ───────────────────────────────────────────────────────

/**
 * Produces a SHA-256 hash of a token string.
 * Used to store refresh tokens securely — the raw token is only ever held in-memory
 * or sent to the client, never persisted.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Returns the expiration Date for a refresh token based on REFRESH_TOKEN_EXPIRY.
 */
export function getRefreshTokenExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
}

/**
 * Returns the access token expiry in seconds (for frontend token refresh scheduling).
 */
export function getAccessTokenExpiry(): number {
  return ACCESS_TOKEN_EXPIRY;
}
