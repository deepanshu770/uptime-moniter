/**
 * User profile route handlers.
 *
 * All routes in this module require authentication.
 *
 * Implements:
 * - GET  /v1/auth/me              — Get current user profile
 * - PATCH /v1/auth/me             — Update profile (display_name, email)
 * - POST /v1/auth/change-password — Change password (requires current password verification)
 */

import { FastifyInstance } from 'fastify';
import {
  UpdateProfileSchema,
  ChangePasswordSchema,
} from '@uptime/shared-types';
import {
  findUserById,
  toUserProfile,
  updateUserProfile as dbUpdateProfile,
  updateUserPassword,
  revokeAllUserRefreshTokens,
  findUserByEmail,
} from '@uptime/db';
import { hashPassword, comparePassword } from '../lib/password.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  AuthError,
  IncorrectPasswordError,
  EmailAlreadyExistsError,
} from '../lib/errors.js';

/**
 * Registers all user profile routes on the given Fastify instance.
 */
export async function profileRoutes(fastify: FastifyInstance): Promise<void> {

  // ─── GET /v1/auth/me ────────────────────────────────────────────────────

  /**
   * Returns the authenticated user's profile.
   *
   * **Requires authentication.**
   *
   * Success response (200):
   * ```json
   * {
   *   "id": "uuid",
   *   "tenant_id": "uuid",
   *   "email": "user@example.com",
   *   "display_name": "John Doe",
   *   "role": "owner",
   *   "is_verified": false,
   *   "last_login_at": "2026-08-30T12:00:00.000Z",
   *   "created_at": "2026-08-30T12:00:00.000Z",
   *   "updated_at": "2026-08-30T12:00:00.000Z"
   * }
   * ```
   */
  fastify.get('/v1/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await findUserById(request.user.userId);
    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        code: 'AUTH_USER_NOT_FOUND',
        message: 'User no longer exists',
      });
    }

    return toUserProfile(user);
  });

  // ─── PATCH /v1/auth/me ──────────────────────────────────────────────────

  /**
   * Updates the authenticated user's profile.
   *
   * **Requires authentication.**
   *
   * Request body (all fields optional):
   * ```json
   * {
   *   "display_name": "Jane Doe",
   *   "email": "newemail@example.com"
   * }
   * ```
   *
   * Success response (200): Updated user profile object.
   */
  fastify.patch('/v1/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = UpdateProfileSchema.parse(request.body);

    // If changing email, verify it's not already taken
    if (parsed.email) {
      const emailUser = await findUserByEmail(parsed.email);
      if (emailUser && emailUser.id !== request.user.userId) {
        throw new EmailAlreadyExistsError();
      }
    }

    const updated = await dbUpdateProfile(request.user.userId, {
      displayName: parsed.display_name,
      email: parsed.email,
    });

    if (!updated) {
      return reply.status(404).send({
        error: 'Not Found',
        code: 'AUTH_USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    return toUserProfile(updated);
  });

  // ─── POST /v1/auth/change-password ──────────────────────────────────────

  /**
   * Changes the authenticated user's password.
   *
   * **Requires authentication.**
   *
   * Security:
   * - Verifies the current password before allowing the change.
   * - Revokes ALL existing refresh tokens to force re-authentication on all devices.
   * - New password must meet the same strength requirements as registration.
   *
   * Request body:
   * ```json
   * {
   *   "current_password": "OldP@ssw0rd!",
   *   "new_password": "NewSecureP@ss1!"
   * }
   * ```
   *
   * Success response (200):
   * ```json
   * { "message": "Password changed successfully. All sessions have been revoked." }
   * ```
   */
  fastify.post('/v1/auth/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = ChangePasswordSchema.parse(request.body);

    // Fetch full user record (need password_hash)
    const user = await findUserById(request.user.userId);
    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        code: 'AUTH_USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Verify current password
    const isCurrentValid = await comparePassword(parsed.current_password, user.password_hash);
    if (!isCurrentValid) {
      throw new IncorrectPasswordError();
    }

    // Hash and store new password
    const newHash = await hashPassword(parsed.new_password);
    await updateUserPassword(user.id, newHash);

    // Revoke all refresh tokens — force re-login everywhere
    await revokeAllUserRefreshTokens(user.id);

    reply.status(200).send({
      message: 'Password changed successfully. All sessions have been revoked.',
    });
  });
}
