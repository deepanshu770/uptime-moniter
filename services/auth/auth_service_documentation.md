# 🔐 Authentication Service — Frontend Integration Guide

Complete API reference for integrating the UptimeMonitor authentication backend with your frontend application.

## Quick Start

```bash
# Start infrastructure
docker compose up -d

# Start the auth service (port 4001)
cd services/auth && pnpm run dev

# Start the main API (port 4000)
cd services/api && pnpm run dev
```

> [!IMPORTANT]
> Set `JWT_SECRET` environment variable in production. The development fallback key is **not secure**.

---

## Architecture Overview

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant Auth as Auth Service :4001
    participant API as API Service :4000
    participant DB as PostgreSQL

    FE->>Auth: POST /v1/auth/register or /login
    Auth->>DB: Create/verify user
    Auth-->>FE: access_token + refresh_token

    FE->>API: GET /v1/monitors (Authorization: Bearer <access_token>)
    API-->>FE: Protected data

    Note over FE: Access token expires (15 min)

    FE->>Auth: POST /v1/auth/refresh
    Auth->>DB: Rotate refresh token
    Auth-->>FE: New access_token + refresh_token
```

### Token Architecture

| Token          | Lifetime  | Storage              | Purpose                     |
|----------------|-----------|----------------------|-----------------------------|
| Access Token   | 15 min    | Memory (JS variable) | API authorization            |
| Refresh Token  | 7 days    | Memory or httpOnly cookie | Obtain new access tokens |

> [!TIP]
> Store the access token in a JavaScript variable (NOT localStorage) for XSS protection. Store the refresh token in an httpOnly cookie or in-memory.

---

## API Reference

**Base URL:** `http://localhost:4001`

All responses follow this error format:
```json
{
  "error": "Human-readable error name",
  "code": "MACHINE_READABLE_CODE",
  "message": "Detailed explanation"
}
```

---

### 1. Register — `POST /v1/auth/register`

Creates a new user account and organization.

**Auth Required:** No

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss1!",
  "display_name": "John Doe",
  "tenant_name": "My Organization"
}
```

| Field          | Type   | Required | Validation                                           |
|----------------|--------|----------|------------------------------------------------------|
| `email`        | string | ✅       | Valid email format                                    |
| `password`     | string | ✅       | ≥8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special |
| `display_name` | string | ❌       | 1–100 chars (defaults to email local part)            |
| `tenant_name`  | string | ❌       | 1–200 chars (defaults to `"{name}'s Organization"`)   |

**Success Response** `201 Created`:
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "660e8400-e29b-41d4-a716-446655440001",
    "email": "user@example.com",
    "display_name": "John Doe",
    "role": "owner",
    "is_verified": false,
    "last_login_at": null,
    "created_at": "2026-08-30T12:00:00.000Z",
    "updated_at": "2026-08-30T12:00:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

**Error Responses:**

| Status | Code                   | Cause                    |
|--------|------------------------|--------------------------|
| 400    | `AUTH_VALIDATION_ERROR` | Invalid email/password format |
| 409    | `AUTH_EMAIL_EXISTS`     | Email already registered |
| 429    | `AUTH_RATE_LIMIT`       | Too many requests        |

**Frontend Example:**
```typescript
async function register(email: string, password: string, displayName?: string) {
  const res = await fetch('http://localhost:4001/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message);
  }

  const data = await res.json();
  // Store tokens
  setAccessToken(data.access_token);
  scheduleTokenRefresh(data.expires_in);
  return data;
}
```

---

### 2. Login — `POST /v1/auth/login`

Authenticates with email and password.

**Auth Required:** No

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss1!"
}
```

**Success Response** `200 OK`:
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "660e8400-e29b-41d4-a716-446655440001",
    "email": "user@example.com",
    "display_name": "John Doe",
    "role": "owner",
    "is_verified": false,
    "last_login_at": "2026-08-30T11:30:00.000Z",
    "created_at": "2026-08-30T10:00:00.000Z",
    "updated_at": "2026-08-30T10:00:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

**Error Responses:**

| Status | Code                       | Cause                   |
|--------|----------------------------|-------------------------|
| 401    | `AUTH_INVALID_CREDENTIALS` | Wrong email or password |
| 429    | `AUTH_RATE_LIMIT`          | Too many attempts       |

> [!NOTE]
> The error message is intentionally generic ("Invalid email or password") for both non-existent users and wrong passwords to prevent email enumeration attacks.

**Frontend Example:**
```typescript
async function login(email: string, password: string) {
  const res = await fetch('http://localhost:4001/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    if (err.code === 'AUTH_INVALID_CREDENTIALS') {
      // Show "Invalid email or password" to user
    }
    throw new Error(err.message);
  }

  const data = await res.json();
  setAccessToken(data.access_token);
  setRefreshToken(data.refresh_token);
  scheduleTokenRefresh(data.expires_in);
  return data.user;
}
```

---

### 3. Refresh Token — `POST /v1/auth/refresh`

Exchanges a valid refresh token for a new access + refresh token pair.

**Auth Required:** No

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response** `200 OK`:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

**Error Responses:**

| Status | Code                  | Cause                        |
|--------|-----------------------|------------------------------|
| 401    | `AUTH_INVALID_TOKEN`  | Invalid or expired token     |
| 401    | `AUTH_TOKEN_REVOKED`  | Token was revoked            |

> [!WARNING]
> **Token Rotation:** Each refresh call invalidates the old refresh token and issues a new one. Always store the new refresh token from the response. If a revoked token is reused, ALL of the user's sessions are invalidated for security.

**Frontend Example (Auto-Refresh):**
```typescript
let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshTimer: number | null = null;

function setAccessToken(token: string) {
  accessToken = token;
}

function setRefreshToken(token: string) {
  refreshToken = token;
}

function scheduleTokenRefresh(expiresIn: number) {
  // Refresh 60 seconds before expiry
  const refreshMs = (expiresIn - 60) * 1000;

  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(async () => {
    try {
      await refreshTokens();
    } catch {
      // Refresh failed — redirect to login
      window.location.href = '/login';
    }
  }, refreshMs);
}

async function refreshTokens() {
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch('http://localhost:4001/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) throw new Error('Token refresh failed');

  const data = await res.json();
  setAccessToken(data.access_token);
  setRefreshToken(data.refresh_token);
  scheduleTokenRefresh(data.expires_in);
}
```

---

### 4. Logout — `POST /v1/auth/logout`

Revokes the current refresh token (single-session logout).

**Auth Required:** No

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response** `200 OK`:
```json
{
  "message": "Logged out successfully"
}
```

---

### 5. Logout All — `POST /v1/auth/logout-all`

Revokes ALL refresh tokens for the authenticated user (sign out everywhere).

**Auth Required:** ✅ Yes (Bearer token)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response** `200 OK`:
```json
{
  "message": "All sessions revoked",
  "revoked_count": 3
}
```

---

### 6. Get Profile — `GET /v1/auth/me`

Returns the authenticated user's profile.

**Auth Required:** ✅ Yes (Bearer token)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response** `200 OK`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "660e8400-e29b-41d4-a716-446655440001",
  "email": "user@example.com",
  "display_name": "John Doe",
  "role": "owner",
  "is_verified": false,
  "last_login_at": "2026-08-30T12:00:00.000Z",
  "created_at": "2026-08-30T10:00:00.000Z",
  "updated_at": "2026-08-30T10:00:00.000Z"
}
```

---

### 7. Update Profile — `PATCH /v1/auth/me`

Updates the authenticated user's profile.

**Auth Required:** ✅ Yes (Bearer token)

**Request** (all fields optional):
```json
{
  "display_name": "Jane Doe",
  "email": "newemail@example.com"
}
```

**Success Response** `200 OK`: Returns the updated user profile.

**Error Responses:**

| Status | Code               | Cause                   |
|--------|--------------------|-------------------------|
| 409    | `AUTH_EMAIL_EXISTS` | New email already taken |

---

### 8. Change Password — `POST /v1/auth/change-password`

Changes the authenticated user's password.

**Auth Required:** ✅ Yes (Bearer token)

**Request:**
```json
{
  "current_password": "OldP@ssw0rd!",
  "new_password": "NewSecureP@ss1!"
}
```

**Success Response** `200 OK`:
```json
{
  "message": "Password changed successfully. All sessions have been revoked."
}
```

> [!CAUTION]
> Changing the password **revokes all refresh tokens**, forcing re-login on all devices. The frontend should redirect to the login page after a successful password change.

**Error Responses:**

| Status | Code                       | Cause                    |
|--------|----------------------------|--------------------------|
| 400    | `AUTH_INCORRECT_PASSWORD`  | Current password wrong   |
| 400    | `AUTH_VALIDATION_ERROR`    | New password too weak    |

---

### 9. Health Check — `GET /health`

**Auth Required:** No

```json
{
  "status": "ok",
  "service": "auth",
  "timestamp": "2026-08-30T12:00:00.000Z"
}
```

---

## Frontend Integration Patterns

### Authenticated API Calls

Use this pattern for all calls to the main API service (port 4000):

```typescript
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  // Attach the access token if available
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`http://localhost:4000${endpoint}`, {
    ...options,
    headers,
  });

  // If 401, try to refresh the token and retry once
  if (res.status === 401 && refreshToken) {
    try {
      await refreshTokens();
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retryRes = await fetch(`http://localhost:4000${endpoint}`, {
        ...options,
        headers,
      });
      if (!retryRes.ok) throw new Error('Retry failed');
      return retryRes.json();
    } catch {
      // Redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message);
  }

  return res.json();
}

// Usage:
const monitors = await apiCall<Monitor[]>('/v1/monitors');
```

### React Hook Example

```typescript
import { useState, useEffect, useCallback, createContext, useContext } from 'react';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Try to restore session on mount
  useEffect(() => {
    refreshTokens()
      .then(() => fetchProfile())
      .catch(() => setState(s => ({ ...s, isLoading: false })));
  }, []);

  const fetchProfile = useCallback(async () => {
    const res = await fetch('http://localhost:4001/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const user = await res.json();
      setState({ user, isLoading: false, isAuthenticated: true });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('http://localhost:4001/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message);
    }
    const data = await res.json();
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    scheduleTokenRefresh(data.expires_in);
    setState({ user: data.user, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    const res = await fetch('http://localhost:4001/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message);
    }
    const data = await res.json();
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    scheduleTokenRefresh(data.expires_in);
    setState({ user: data.user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    if (refreshToken) {
      await fetch('http://localhost:4001/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {}); // Best-effort
    }
    setAccessToken(null as any);
    setRefreshToken(null as any);
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

---

## Protecting the Main API Service

To protect routes in your existing API service (port 4000), copy the authenticate middleware:

```typescript
// In services/api/src/index.ts
import { verifyAccessToken } from '@uptime/auth/lib/tokens'; // or copy the function

// Add to routes that need protection:
fastify.get('/v1/monitors', { preHandler: [authenticate] }, async (request) => {
  const { userId, tenantId } = request.user;
  const monitors = await listMonitors(tenantId);
  return monitors;
});
```

Or better yet, share the middleware via a new `@uptime/auth-middleware` package.

---

## Error Code Reference

| Code                           | HTTP | Description                          |
|--------------------------------|------|--------------------------------------|
| `AUTH_VALIDATION_ERROR`        | 400  | Request body failed validation       |
| `AUTH_INCORRECT_PASSWORD`      | 400  | Current password wrong (change pwd)  |
| `AUTH_INVALID_CREDENTIALS`     | 401  | Wrong email or password              |
| `AUTH_MISSING_TOKEN`           | 401  | No Authorization header              |
| `AUTH_INVALID_TOKEN`           | 401  | Token expired or malformed           |
| `AUTH_TOKEN_REVOKED`           | 401  | Refresh token was revoked            |
| `AUTH_INSUFFICIENT_PERMISSIONS`| 403  | User role too low                    |
| `AUTH_EMAIL_EXISTS`            | 409  | Email already registered             |
| `AUTH_RATE_LIMIT`              | 429  | Too many requests                    |
| `AUTH_INTERNAL_ERROR`          | 500  | Unexpected server error              |

---

## Environment Variables

| Variable                       | Default                                        | Description                          |
|--------------------------------|------------------------------------------------|--------------------------------------|
| `AUTH_PORT`                    | `4001`                                         | Auth service port                    |
| `DATABASE_URL`                 | `postgres://postgres:postgrespassword@localhost:5432/uptime_db` | PostgreSQL connection     |
| `JWT_SECRET`                   | Dev fallback (unsafe)                          | **MUST** set in production           |
| `ACCESS_TOKEN_EXPIRY_SECONDS`  | `900` (15 min)                                 | Access token lifetime                |
| `REFRESH_TOKEN_EXPIRY_SECONDS` | `604800` (7 days)                              | Refresh token lifetime               |
| `BCRYPT_ROUNDS`                | `12`                                           | bcrypt cost factor                   |
| `CORS_ORIGIN`                  | `*`                                            | Allowed CORS origins                 |

---

## Files Created / Modified

### New Files
| File | Purpose |
|------|---------|
| `services/auth/package.json` | Auth service package config |
| `services/auth/tsconfig.json` | TypeScript config |
| `services/auth/src/index.ts` | Service entry point |
| `services/auth/src/routes/auth.routes.ts` | Register, login, refresh, logout |
| `services/auth/src/routes/profile.routes.ts` | Profile, change password |
| `services/auth/src/middleware/authenticate.ts` | JWT verification middleware |
| `services/auth/src/lib/tokens.ts` | JWT sign/verify utilities |
| `services/auth/src/lib/password.ts` | bcrypt hashing |
| `services/auth/src/lib/errors.ts` | Custom error classes |

### Modified Files
| File | Changes |
|------|---------|
| `packages/shared-types/src/index.ts` | Added auth types, Zod schemas |
| `packages/db/src/index.ts` | Added users/refresh_tokens tables + query functions |

---

## Security Checklist

- [x] Passwords hashed with bcrypt (12 rounds)
- [x] Refresh tokens hashed (SHA-256) before database storage
- [x] Token rotation on refresh (old token revoked)
- [x] Generic error messages prevent email enumeration
- [x] Rate limiting on auth endpoints (20 req/min)
- [x] Password change revokes all sessions
- [x] Role-based access control (RBAC) middleware
- [x] SQL injection prevention (parameterized queries)
- [x] Never expose password_hash to clients
