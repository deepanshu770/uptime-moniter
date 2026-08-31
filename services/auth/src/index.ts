/**
 * Authentication Service — Entry Point
 *
 * A dedicated Fastify microservice handling user authentication and authorization
 * for the Uptime Monitor platform.
 *
 * ## Architecture
 * - Runs as a standalone service on its own port (default: 4001).
 * - Shares the same PostgreSQL database as the main API via the @uptime/db package.
 * - Stateless JWT access tokens (verified by any service that imports the middleware).
 * - Stateful refresh tokens (stored hashed in PostgreSQL for revocation support).
 *
 * ## Endpoints
 * | Method | Path                       | Auth Required | Description                    |
 * |--------|----------------------------|---------------|--------------------------------|
 * | POST   | /v1/auth/register          | No            | Create account + organization  |
 * | POST   | /v1/auth/login             | No            | Login with email/password      |
 * | POST   | /v1/auth/refresh           | No            | Exchange refresh for new tokens|
 * | POST   | /v1/auth/logout            | No            | Revoke a refresh token         |
 * | POST   | /v1/auth/logout-all        | Yes           | Revoke all user sessions       |
 * | GET    | /v1/auth/me                | Yes           | Get current user profile       |
 * | PATCH  | /v1/auth/me                | Yes           | Update profile                 |
 * | POST   | /v1/auth/change-password   | Yes           | Change password                |
 * | GET    | /health                    | No            | Health check                   |
 *
 * ## Environment Variables
 * | Variable                      | Default                              | Description                        |
 * |-------------------------------|--------------------------------------|------------------------------------|
 * | AUTH_PORT                     | 4001                                 | Port the auth service listens on   |
 * | DATABASE_URL                  | postgres://...localhost:5432/uptime_db | PostgreSQL connection string       |
 * | JWT_SECRET                    | (dev fallback)                       | **MUST** be set in production      |
 * | ACCESS_TOKEN_EXPIRY_SECONDS   | 900 (15 min)                         | Access token lifetime              |
 * | REFRESH_TOKEN_EXPIRY_SECONDS  | 604800 (7 days)                      | Refresh token lifetime             |
 * | BCRYPT_ROUNDS                 | 12                                   | bcrypt cost factor                 |
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { initDatabase, getPool } from '@uptime/db';
import { authRoutes } from './routes/auth.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { AuthError } from './lib/errors.js';

// ─── Configuration ───────────────────────────────────────────────────────────

const AUTH_PORT = parseInt(process.env.AUTH_PORT || '4001', 10);

// Warn if JWT_SECRET is not set (critical for production security)
if (!process.env.JWT_SECRET) {
  console.warn(
    '[AUTH] ⚠️  JWT_SECRET is not set! Using a default development key. ' +
    'This is INSECURE and must be changed before deploying to production.'
  );
}

// ─── Application Builder ─────────────────────────────────────────────────────

/**
 * Constructs and configures the Fastify application with all plugins and routes.
 *
 * @returns The fully configured Fastify instance (not yet listening).
 */
export async function buildAuthApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
    },
  });

  // ── Plugins ──────────────────────────────────────────────────────────────

  // CORS — allow frontend origins (restrict in production)
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true, // Required for httpOnly cookie-based refresh tokens
  });

  // Cookie parsing — enables reading refresh tokens from httpOnly cookies
  await fastify.register(cookie);

  // Rate limiting — protects auth endpoints from brute-force attacks
  await fastify.register(rateLimit, {
    max: 20,          // Max 20 requests per window
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Rate-limit by IP address
      return request.ip;
    },
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts. Please try again later.',
    }),
  });

  // ── Error Handler ────────────────────────────────────────────────────────

  /**
   * Global error handler that formats all errors into a consistent JSON shape.
   * Handles:
   * - Custom AuthError subclasses (with statusCode and errorCode)
   * - Zod validation errors (400 Bad Request with field-level details)
   * - Unexpected errors (500 Internal Server Error)
   */
  fastify.setErrorHandler((error, request, reply) => {
    // Custom auth errors
    if (error instanceof AuthError) {
      fastify.log.warn({ err: error, code: error.errorCode }, error.message);
      return reply.status(error.statusCode).send({
        error: error.name,
        code: error.errorCode,
        message: error.message,
      });
    }

    // Zod validation errors
    if (error instanceof z.ZodError) {
      fastify.log.warn({ err: error }, 'Validation error');
      return reply.status(400).send({
        error: 'Bad Request',
        code: 'AUTH_VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    // PostgreSQL unique constraint violation (duplicate email)
    if ((error as any).code === '23505') {
      return reply.status(409).send({
        error: 'Conflict',
        code: 'AUTH_EMAIL_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    // Unexpected errors — log full details, return sanitized message
    fastify.log.error(error);
    reply.status(500).send({
      error: 'Internal Server Error',
      code: 'AUTH_INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
    });
  });

  // ── Routes ───────────────────────────────────────────────────────────────

  /**
   * GET /health
   * Lightweight health check for load balancers and container orchestrators.
   */
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'auth',
    timestamp: new Date().toISOString(),
  }));

  // Register auth route modules
  await fastify.register(authRoutes);
  await fastify.register(profileRoutes);

  return fastify;
}

// ─── Server Bootstrap ─────────────────────────────────────────────────────────

/**
 * Initializes the database, starts the HTTP server, and configures graceful shutdown.
 */
export async function startAuthServer(): Promise<void> {
  let app: FastifyInstance | null = null;

  try {
    // Initialize shared database (creates tables if they don't exist)
    await initDatabase();
    console.log('[AUTH] Database initialized successfully.');

    // Build and start the Fastify application
    app = await buildAuthApp();
    await app.listen({ port: AUTH_PORT, host: '0.0.0.0' });
    app.log.info(`[AUTH] Authentication service listening on http://localhost:${AUTH_PORT}`);
  } catch (err) {
    console.error('[AUTH] Server startup failed:', err);
    process.exit(1);
  }

  // ── Graceful Shutdown ──────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    console.log(`\n[AUTH] Received ${signal}. Starting graceful shutdown...`);

    if (app) {
      await app.close();
      console.log('[AUTH] HTTP server closed.');
    }

    try {
      const pool = getPool();
      await pool.end();
      console.log('[AUTH] Database connections closed.');
    } catch (e) {
      console.error('[AUTH] Error closing database pool:', e);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ─── Auto-Start ──────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  startAuthServer();
}
