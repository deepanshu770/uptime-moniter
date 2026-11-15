import { z } from 'zod';

export interface Monitor {
  id: string;
  user_id: string;
  name: string;
  target: string;
  interval_seconds: number;
  timeout_ms: number;
  regions: string[];
  enabled: boolean;
  status?: 'UP' | 'DEGRADED' | 'DOWN';
  lastCheckedAt?: string;
  lastResponseTimeMs?: number;
  created_at: string;
  updated_at: string;
}

export interface CheckJob {
  jobId: string;
  monitorId: string;
  userId: string;
  target: string;
  timeoutMs: number;
  region: string;
  scheduledAt: number;
}

export interface PhaseTimings {
  dns_ms: number;
  tcp_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  download_ms: number;
  total_ms: number;
}

export interface CheckResult {
  jobId: string;
  monitorId: string;
  userId: string;
  region: string;
  status: number; // 0 = UP, 1 = DEGRADED, 2 = DOWN
  statusCode?: number;
  responseTimeMs: number;
  timings: PhaseTimings;
  time: string; // ISO string
  tlsExpiryDays?: number;
  errorCode?: string;
  errorMessage?: string;
  attempt: number;
  workerId: string;
  idempotencyKey: string;
}

export type MonitorStatusState = 'UP' | 'DEGRADED' | 'DOWN';

export interface MonitorState {
  monitorId: string;
  userId: string;
  status: MonitorStatusState;
  since: string;
  lastCheckedAt?: string;
}

export const CreateMonitorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  target: z.string().min(1, 'Target URL or host is required').transform((val) => {
    const trimmed = val.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }),
  interval_seconds: z.number().int().min(5).max(86400).default(30),
  timeout_ms: z.number().int().min(1000).max(60000).default(10000),
  regions: z.array(z.string()).min(1).default(['us-east']),
  enabled: z.boolean().default(true),
}).passthrough();

export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>;

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface JwtAccessPayload {
  sub: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

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
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

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

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
