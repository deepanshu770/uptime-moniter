/**
 * Fastify authentication middleware (preHandler hook).
 *
 * Verifies the `Authorization: Bearer <token>` header on protected routes.
 * On success, decorates the Fastify request with a `user` object containing
 * the authenticated user's ID, tenant ID, and role.
 *
 * ## Usage in routes:
 * ```ts
 * fastify.get('/protected', { preHandler: [authenticate] }, async (request) => {
 *   const { userId, role } = request.user;
 *   // ...
 * });
 * ```
 *
 * ## Usage with role-based access:
 * ```ts
 * fastify.delete('/admin-only', { preHandler: [authenticate, requireRole('admin')] }, handler);
 * ```
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/tokens.js';
import { UserRole } from '@uptime/shared-types';

/** Shape of the decoded user context attached to authenticated requests. */
export interface AuthUser {
  userId: string;
  role: UserRole;
}

// Extend Fastify's request type to include the `user` property
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}

/**
 * Pre-handler that validates the Bearer token and attaches user context.
 * Returns 401 if the token is missing, malformed, or expired.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      code: 'AUTH_MISSING_TOKEN',
      message: 'Authorization header with Bearer token is required',
    });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  const payload = verifyAccessToken(token);

  if (!payload) {
    return reply.status(401).send({
      error: 'Unauthorized',
      code: 'AUTH_INVALID_TOKEN',
      message: 'Invalid or expired access token',
    });
  }

  // Attach decoded user context to the request for downstream handlers
  request.user = {
    userId: payload.sub,
    role: payload.role,
  };
}

/**
 * Factory that creates a pre-handler enforcing a minimum required role.
 *
 * Role hierarchy (highest to lowest): owner > admin > member > viewer
 *
 * @param requiredRole - The minimum role needed to access the route.
 * @returns A Fastify preHandler function.
 *
 * @example
 * // Only owners and admins can access:
 * fastify.delete('/resource', { preHandler: [authenticate, requireRole('admin')] }, handler);
 */
export function requireRole(requiredRole: UserRole) {
  const roleHierarchy: Record<UserRole, number> = {
    viewer: 0,
    member: 1,
    admin: 2,
    owner: 3,
  };

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        code: 'AUTH_MISSING_TOKEN',
        message: 'Authentication required',
      });
    }

    const userLevel = roleHierarchy[request.user.role] ?? 0;
    const requiredLevel = roleHierarchy[requiredRole] ?? 0;

    if (userLevel < requiredLevel) {
      return reply.status(403).send({
        error: 'Forbidden',
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message: `This action requires the '${requiredRole}' role or higher`,
      });
    }
  };
}
