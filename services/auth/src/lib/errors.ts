export class AuthError extends Error {
  statusCode: number;
  errorCode: string;
  constructor(message: string, statusCode = 400, errorCode = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = 'Invalid email or password') {
    super(message, 401, 'AUTH_INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message = 'Invalid or expired token') {
    super(message, 401, 'AUTH_INVALID_TOKEN');
    this.name = 'InvalidTokenError';
  }
}

export class TokenRevokedError extends AuthError {
  constructor(message = 'Token has been revoked') {
    super(message, 401, 'AUTH_TOKEN_REVOKED');
    this.name = 'TokenRevokedError';
  }
}

export class EmailAlreadyExistsError extends AuthError {
  constructor(message = 'Email already exists') {
    super(message, 409, 'AUTH_EMAIL_EXISTS');
    this.name = 'EmailAlreadyExistsError';
  }
}

export class IncorrectPasswordError extends AuthError {
  constructor(message = 'Incorrect current password') {
    super(message, 401, 'AUTH_INCORRECT_PASSWORD');
    this.name = 'IncorrectPasswordError';
  }
}
