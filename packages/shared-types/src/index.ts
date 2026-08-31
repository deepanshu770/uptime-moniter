import { z } from 'zod';

export type MonitorType = 'http' | 'tcp' | 'icmp' | 'dns' | 'port' | 'api' | 'heartbeat';

export interface Assertion {
  type: 'status' | 'body' | 'header' | 'jsonpath' | 'latency';
  op: 'equals' | 'contains' | 'matches' | 'exists' | 'lt' | 'gt';
  path?: string;
  name?: string;
  value?: any;
  value_ms?: number;
}

export interface MonitorConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  assertions?: Assertion[];
  expected_dns_ip?: string;
  port?: number;
}

export interface Monitor {
  id: string;
  tenant_id: string;
  name: string;
  type: MonitorType;
  target: string;
  interval_seconds: number;
  timeout_ms: number;
  regions: string[];
  confirm_quorum: number;
  confirm_regions: number;
  enabled: boolean;
  config: MonitorConfig;
  escalation_policy_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckJob {
  jobId: string;
  monitorId: string;
  tenantId: string;
  region: string;
  type: MonitorType;
  target: string;
  timeoutMs: number;
  config: MonitorConfig;
  scheduledAt: number;
  idempotencyKey: string;
}

export type StatusValue = 0 | 1 | 2; // 0: UP, 1: DEGRADED, 2: DOWN

export interface PhaseTimings {
  dns_ms: number;
  tcp_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  total_ms: number;
}

export interface CheckResult {
  jobId: string;
  monitorId: string;
  tenantId: string;
  region: string;
  time: string; // ISO String
  status: StatusValue;
  statusCode?: number | null;
  responseTimeMs: number;
  timings: PhaseTimings;
  errorCode?: string | null;
  errorMessage?: string | null;
  failedAssertions?: string[];
  attempt: number;
  workerId: string;
  idempotencyKey: string;
}

export type MonitorStatusState = 'UP' | 'SUSPECT' | 'DOWN' | 'DEGRADED' | 'RECOVERING' | 'MAINTENANCE';

export interface MonitorState {
  monitorId: string;
  tenantId: string;
  status: MonitorStatusState;
  since: string;
  consecFail: number;
  consecOk: number;
  incidentId?: string | null;
  lastCheckedAt?: string;
}

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

export interface Incident {
  id: string;
  tenant_id: string;
  monitor_id: string;
  status: IncidentStatus;
  severity: 'warning' | 'critical';
  started_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  root_cause_region?: string | null;
  error_summary?: string | null;
}

export interface AlertEvent {
  eventId: string;
  tenantId: string;
  monitorId: string;
  incidentId: string;
  eventType: 'incident.opened' | 'incident.resolved' | 'incident.acknowledged';
  severity: 'warning' | 'critical';
  timestamp: string;
  monitorName: string;
  target: string;
  regions: {
    down: string[];
    up: string[];
  };
  summary: string;
}

export const CreateMonitorSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['http', 'tcp', 'icmp', 'dns', 'port', 'api', 'heartbeat']),
  target: z.string().min(1),
  interval_seconds: z.number().int().min(5).max(86400).default(30),
  timeout_ms: z.number().int().min(1000).max(60000).default(10000),
  regions: z.array(z.string()).min(1).default(['us-east']),
  confirm_quorum: z.number().int().min(1).default(2),
  confirm_regions: z.number().int().min(1).default(3),
  enabled: z.boolean().default(true),
  config: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH']).optional(),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
    assertions: z.array(z.object({
      type: z.enum(['status', 'body', 'header', 'jsonpath', 'latency']),
      op: z.enum(['equals', 'contains', 'matches', 'exists', 'lt', 'gt']),
      path: z.string().optional(),
      name: z.string().optional(),
      value: z.any().optional(),
      value_ms: z.number().optional()
    })).optional(),
    expected_dns_ip: z.string().optional(),
    port: z.number().optional()
  }).default({}),
  escalation_policy_id: z.string().uuid().nullable().optional()
});

export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Authentication & Authorization Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported user roles for RBAC (Role-Based Access Control). */
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

/** Internal user record stored in the database (never expose password_hash to clients). */
export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Safe user profile returned to clients (excludes password_hash). */
export interface UserProfile {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Refresh token record stored in the database. */
export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

/** JWT access token payload. */
export interface JwtAccessPayload {
  sub: string;        // user ID
  tid: string;        // tenant ID
  role: UserRole;
  type: 'access';
}

/** JWT refresh token payload. */
export interface JwtRefreshPayload {
  sub: string;        // user ID
  jti: string;        // unique token ID for revocation
  type: 'refresh';
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod Validation Schemas for Auth Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registration request body.
 * - Email must be valid format.
 * - Password must be ≥8 chars with at least one uppercase, one lowercase, one digit, and one special character.
 * - Display name is optional (defaults to email local part on the server side).
 */
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  display_name: z.string().min(1).max(100).optional(),
  tenant_name: z.string().min(1).max(200).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Login request body.
 * - Only email + password, no extra fields.
 */
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Token refresh request body.
 * - Accepts either a refresh_token in the body or via httpOnly cookie.
 */
export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

/**
 * Change password request body.
 * - Requires current password for verification.
 * - New password must pass same strength rules as registration.
 */
export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/**
 * Update profile request body.
 * - All fields are optional; only provided fields are updated.
 */
export const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
