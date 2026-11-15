import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/tokens.js';

export interface AuthUser {
  userId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      code: 'AUTH_MISSING_TOKEN',
      message: 'Authorization header with Bearer token is required',
    });
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return reply.status(401).send({
      error: 'Unauthorized',
      code: 'AUTH_INVALID_TOKEN',
      message: 'Invalid or expired access token',
    });
  }

  request.user = {
    userId: payload.sub,
  };
}
