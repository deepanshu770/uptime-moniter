/**
 * Authentication route handlers.
 *
 * Implements the core auth flows:
 * - POST /v1/auth/register  — Create a new account + organization
 * - POST /v1/auth/login     — Authenticate with email/password, receive tokens
 * - POST /v1/auth/refresh   — Exchange a refresh token for a new access token
 * - POST /v1/auth/logout    — Revoke the current refresh token
 * - POST /v1/auth/logout-all — Revoke ALL refresh tokens for the user
 *
 * All endpoints return consistent JSON responses with appropriate HTTP status codes.
 */

import { FastifyInstance } from 'fastify';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
} from '@uptime/shared-types';
import {
    createUser,
  findUserByEmail,
  updateUserLastLogin,
  toUserProfile,
  createRefreshToken as dbCreateRefreshToken,
  findRefreshTokenById,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  findUserById,
} from '@uptime/db';
import { hashPassword, comparePassword } from '../lib/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiryDate,
  getAccessTokenExpiry,
} from '../lib/tokens.js';
import {
  AuthError,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidTokenError,
  TokenRevokedError,
} from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';

/**
 * Registers all authentication routes on the given Fastify instance.
 * Routes are prefixed with /v1/auth by convention.
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {

  // ─── POST /v1/auth/register ──────────────────────────────────────────────

  /**
   * Creates a new user account and organization.
   *
   * Flow:
   * 1. Validate request body against RegisterSchema.
   * 2. Check for existing email (returns 409 if taken).
   * 3. Create a new tenant (organization) if tenant_name is provided, or use default.
   * 4. Hash the password with bcrypt.
   * 5. Insert the user record.
   * 6. Issue access + refresh tokens.
   * 7. Return the user profile (without password_hash) and tokens.
   *
   * Request body:
   * ```json
   * {
   *   "email": "user@example.com",
   *   "password": "SecureP@ss1",
   *   "display_name": "John Doe",       // optional
   *   "tenant_name": "My Organization"  // optional
   * }
   * ```
   *
   * Success response (201):
   * ```json
   * {
   *   "user": { "id": "...", "email": "...", "display_name": "...", ... },
   *   "access_token": "eyJ...",
   *   "refresh_token": "eyJ...",
   *   "token_type": "Bearer",
   *   "expires_in": 900
   * }
   * ```
   */
  fastify.post('/v1/auth/register', async (request, reply) => {
    const parsed = RegisterSchema.parse(request.body);

    // Check if email is already registered
    const existing = await findUserByEmail(parsed.email);
    if (existing) {
      throw new EmailAlreadyExistsError();
    }

    // Create tenant (organization) for this user
        
    // Hash password with bcrypt
    const passwordHash = await hashPassword(parsed.password);

    // Create user record
    const displayName = parsed.display_name || parsed.email.split('@')[0];
    const user = await createUser({
            email: parsed.email,
      passwordHash,
      displayName,
      role: 'owner', // First user in a tenant is always the owner
    });

    // Generate token pair
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id, user.role, request
    );

    reply.status(201).send({
      user: toUserProfile(user),
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: getAccessTokenExpiry(),
    });
  });

  // ─── POST /v1/auth/login ────────────────────────────────────────────────

  /**
   * Authenticates a user with email and password.
   *
   * Security considerations:
   * - Uses constant-time comparison (bcrypt.compare) to prevent timing attacks.
   * - Returns a generic error message for both "user not found" and "wrong password"
   *   to prevent email enumeration.
   * - Updates last_login_at timestamp on success.
   *
   * Request body:
   * ```json
   * {
   *   "email": "user@example.com",
   *   "password": "SecureP@ss1"
   * }
   * ```
   *
   * Success response (200):
   * ```json
   * {
   *   "user": { "id": "...", "email": "...", ... },
   *   "access_token": "eyJ...",
   *   "refresh_token": "eyJ...",
   *   "token_type": "Bearer",
   *   "expires_in": 900
   * }
   * ```
   */
  fastify.post('/v1/auth/login', async (request, reply) => {
    const parsed = LoginSchema.parse(request.body);

    // Find user by email
    const user = await findUserByEmail(parsed.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    // Verify password using bcrypt constant-time comparison
    const isPasswordValid = await comparePassword(parsed.password, user.password_hash);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // Record login timestamp
    await updateUserLastLogin(user.id);

    // Generate token pair
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id, user.role, request
    );

    
    reply.setCookie('refresh_token', refreshToken, {
      path: '/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60
    });
    reply.status(200).send({
      user: toUserProfile(user),
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: getAccessTokenExpiry(),
    });
  });

  // ─── POST /v1/auth/refresh ──────────────────────────────────────────────

  /**
   * Exchanges a valid refresh token for a new access + refresh token pair.
   *
   * Implements **token rotation**: the old refresh token is revoked and a new one
   * is issued. This limits the window of opportunity if a refresh token is stolen.
   *
   * Request body:
   * ```json
   * {
   *   "refresh_token": "eyJ..."
   * }
   * ```
   *
   * Success response (200):
   * ```json
   * {
   *   "access_token": "eyJ...",
   *   "refresh_token": "eyJ...",
   *   "token_type": "Bearer",
   *   "expires_in": 900
   * }
   * ```
   */
  fastify.post('/v1/auth/refresh', async (request, reply) => {
    const parsed = RefreshTokenSchema.parse(request.body);

    // Verify the refresh token JWT
    const payload = verifyRefreshToken(parsed.refresh_token);
    if (!payload) {
      throw new InvalidTokenError('Invalid or expired refresh token');
    }

    // Look up the token record in the database
    const tokenRecord = await findRefreshTokenById(payload.jti);
    if (!tokenRecord) {
      throw new TokenRevokedError();
    }

    // Verify the hash matches (defense-in-depth)
    const incomingHash = hashToken(parsed.refresh_token);
    if (incomingHash !== tokenRecord.token_hash) {
      // Hash mismatch indicates possible token tampering — revoke all tokens for safety
      await revokeAllUserRefreshTokens(tokenRecord.user_id);
      throw new InvalidTokenError('Token integrity check failed');
    }

    // Revoke the old refresh token (rotation)
    await revokeRefreshToken(payload.jti);

    // Look up user to get current role (may have changed since token was issued)
    const user = await findUserById(payload.sub);
    if (!user) {
      throw new InvalidTokenError('User no longer exists');
    }

    // Issue new token pair
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id, user.role, request
    );

    
    reply.setCookie('refresh_token', refreshToken, {
      path: '/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60
    });
    reply.status(200).send({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: getAccessTokenExpiry(),
    });
  });

  // ─── POST /v1/auth/logout ───────────────────────────────────────────────

  /**
   * Revokes the current refresh token, effectively logging the user out of this session.
   * The access token remains valid until it expires (stateless design), but the
   * refresh token can no longer be used to obtain new access tokens.
   *
   * Request body:
   * ```json
   * {
   *   "refresh_token": "eyJ..."
   * }
   * ```
   *
   * Success response (200):
   * ```json
   * { "message": "Logged out successfully" }
   * ```
   */
  fastify.post('/v1/auth/logout', async (request, reply) => {
    const parsed = RefreshTokenSchema.parse(request.body);

    const payload = verifyRefreshToken(parsed.refresh_token);
    if (payload) {
      await revokeRefreshToken(payload.jti);
    }

    // Always return 200 (don't leak whether the token was valid)
    
    reply.clearCookie('refresh_token', { path: '/v1/auth' });
    reply.status(200).send({ message: 'Logged out successfully' });
  });

  // ─── POST /v1/auth/logout-all ───────────────────────────────────────────

  /**
   * Revokes ALL refresh tokens for the authenticated user.
   * Use this for "Sign out of all devices" functionality.
   *
   * **Requires authentication** — must include a valid access token.
   *
   * Success response (200):
   * ```json
   * { "message": "All sessions revoked", "revoked_count": 3 }
   * ```
   */
  fastify.post('/v1/auth/logout-all', { preHandler: [authenticate] }, async (request, reply) => {
    const revokedCount = await revokeAllUserRefreshTokens(request.user.userId);

    
    reply.clearCookie('refresh_token', { path: '/v1/auth' });
    reply.status(200).send({
      message: 'All sessions revoked',
      revoked_count: revokedCount,
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generates a new access + refresh token pair.
 * Stores the refresh token hash in the database with metadata for audit trail.
 */
async function generateTokenPair(
  userId: string,
  role: string,
  request: any,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Create a placeholder record to get the UUID (used as jti)
  const placeholderHash = 'pending';
  const tokenRecord = await dbCreateRefreshToken({
    userId,
    tokenHash: placeholderHash,
    userAgent: request.headers['user-agent'] || undefined,
    ipAddress: request.ip || undefined,
    expiresAt: getRefreshTokenExpiryDate(),
  });

  // Sign the refresh token with the record's UUID as the jti claim
  const refreshToken = signRefreshToken(userId, tokenRecord.id);

  // Update the record with the actual hash of the signed token
  const { getPool } = await import('@uptime/db');
  await getPool().query(
    `UPDATE refresh_tokens SET token_hash = $1 WHERE id = $2`,
    [hashToken(refreshToken), tokenRecord.id]
  );

  // Sign the short-lived access token
  const accessToken = signAccessToken(userId, role as any);

  return { accessToken, refreshToken };
}
