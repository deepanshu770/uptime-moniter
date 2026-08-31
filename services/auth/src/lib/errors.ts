/**
 * Custom error classes for the auth service.
 *
 * These extend the base Error class with HTTP status codes and machine-readable
 * error codes. The global Fastify error handler catches these and formats
 * consistent JSON error responses.
 *
 * Error code naming convention: `AUTH_<CATEGORY>_<SPECIFIC>`
 */

/**
 * Base class for all auth-related errors.
 * Carries an HTTP status code and a machine-readable error code for frontend consumption.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Thrown when registration fails due to a duplicate email.
 * HTTP 409 Conflict.
 */
export class EmailAlreadyExistsError extends AuthError {
  constructor() {
    super('An account with this email already exists', 409, 'AUTH_EMAIL_EXISTS');
    this.name = 'EmailAlreadyExistsError';
  }
}

/**
 * Thrown when login credentials are invalid.
 * Uses a generic message to prevent email enumeration attacks.
 * HTTP 401 Unauthorized.
 */
export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Thrown when a provided token (access or refresh) is invalid or expired.
 * HTTP 401 Unauthorized.
 */
export class InvalidTokenError extends AuthError {
  constructor(message = 'Invalid or expired token') {
    super(message, 401, 'AUTH_INVALID_TOKEN');
    this.name = 'InvalidTokenError';
  }
}

/**
 * Thrown when a user's refresh token has been revoked (e.g., after password change).
 * HTTP 401 Unauthorized.
 */
export class TokenRevokedError extends AuthError {
  constructor() {
    super('Token has been revoked', 401, 'AUTH_TOKEN_REVOKED');
    this.name = 'TokenRevokedError';
  }
}

/**
 * Thrown when the current password doesn't match during password change.
 * HTTP 400 Bad Request.
 */
export class IncorrectPasswordError extends AuthError {
  constructor() {
    super('Current password is incorrect', 400, 'AUTH_INCORRECT_PASSWORD');
    this.name = 'IncorrectPasswordError';
  }
}

/**
 * Thrown when a user lacks the required role for an action.
 * HTTP 403 Forbidden.
 */
export class InsufficientPermissionsError extends AuthError {
  constructor(requiredRole: string) {
    super(`This action requires the '${requiredRole}' role or higher`, 403, 'AUTH_INSUFFICIENT_PERMISSIONS');
    this.name = 'InsufficientPermissionsError';
  }
}
