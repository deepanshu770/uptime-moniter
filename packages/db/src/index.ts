import { Pool } from 'pg';
import {
  Monitor, CreateMonitorInput, CheckResult, Incident, MonitorType,
  User, UserRole, UserProfile, RefreshToken,
} from '@uptime/shared-types';

let pool: Pool | null = null;

export function getPool(connectionString?: string): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/uptime_db',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function initDatabase(connectionString?: string): Promise<void> {
  const client = await getPool(connectionString).connect();
  try {
    await client.query('BEGIN');

    // Create extensions if supported
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);
    } catch (e) {
      console.warn('TimescaleDB extension not available, using standard PostgreSQL tables.');
    }

    // Tenants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Ensure default tenant
    await client.query(`
      INSERT INTO tenants (id, name, plan)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'pro')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Escalation policies dummy table
    await client.query(`
      CREATE TABLE IF NOT EXISTS escalation_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Monitors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        target TEXT NOT NULL,
        interval_seconds INT NOT NULL DEFAULT 30,
        timeout_ms INT NOT NULL DEFAULT 10000,
        regions TEXT[] NOT NULL DEFAULT '{"us-east"}',
        confirm_quorum INT NOT NULL DEFAULT 2,
        confirm_regions INT NOT NULL DEFAULT 3,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        config JSONB NOT NULL DEFAULT '{}',
        escalation_policy_id UUID REFERENCES escalation_policies(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Check Results table
    await client.query(`
      CREATE TABLE IF NOT EXISTS check_results (
        time TIMESTAMPTZ NOT NULL DEFAULT now(),
        monitor_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        region TEXT NOT NULL,
        status SMALLINT NOT NULL,
        status_code INT,
        response_time_ms INT NOT NULL,
        dns_ms INT NOT NULL DEFAULT 0,
        tcp_ms INT NOT NULL DEFAULT 0,
        tls_ms INT NOT NULL DEFAULT 0,
        ttfb_ms INT NOT NULL DEFAULT 0,
        error_code TEXT,
        error_message TEXT,
        attempt SMALLINT NOT NULL DEFAULT 1,
        worker_id TEXT NOT NULL,
        idempotency_key TEXT
      );
    `);

    // Convert check_results into Hypertable if TimescaleDB is present
    try {
      await client.query(`
        SELECT create_hypertable('check_results', 'time', if_not_exists => TRUE);
      `);
    } catch (e) {
      // standard postgres fallback indexing
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_check_results_monitor_time ON check_results (monitor_id, time DESC);
      `);
    }

    // Incidents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'resolved')),
        severity TEXT NOT NULL DEFAULT 'critical',
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        acknowledged_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        root_cause_region TEXT,
        error_summary TEXT
      );
    `);

    // Notification Log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        channel_type TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        payload JSONB,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Users table — stores credentials and profile for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (email)
      );
    `);

    // Index for fast email lookups during login
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    `);

    // Refresh tokens table — stores hashed tokens for secure rotation & revocation
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Index for efficient refresh token lookup by user
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createMonitor(tenantId: string, input: CreateMonitorInput): Promise<Monitor> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO monitors (tenant_id, name, type, target, interval_seconds, timeout_ms, regions, confirm_quorum, confirm_regions, enabled, config, escalation_policy_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      tenantId,
      input.name,
      input.type,
      input.target,
      input.interval_seconds,
      input.timeout_ms,
      input.regions,
      input.confirm_quorum,
      input.confirm_regions,
      input.enabled,
      JSON.stringify(input.config || {}),
      input.escalation_policy_id || null,
    ]
  );
  return formatMonitor(res.rows[0]);
}

export async function listMonitors(tenantId: string): Promise<Monitor[]> {
  const p = getPool();
  const res = await p.query(
    `SELECT * FROM monitors WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return res.rows.map(formatMonitor);
}

export async function getAllEnabledMonitors(): Promise<Monitor[]> {
  const p = getPool();
  const res = await p.query(`SELECT * FROM monitors WHERE enabled = true`);
  return res.rows.map(formatMonitor);
}

export async function getMonitorById(id: string): Promise<Monitor | null> {
  const p = getPool();
  const res = await p.query(`SELECT * FROM monitors WHERE id = $1`, [id]);
  if (res.rows.length === 0) return null;
  return formatMonitor(res.rows[0]);
}

export async function updateMonitor(id: string, input: Partial<CreateMonitorInput>): Promise<Monitor | null> {
  const existing = await getMonitorById(id);
  if (!existing) return null;

  const p = getPool();
  const res = await p.query(
    `UPDATE monitors
     SET name = COALESCE($1, name),
         target = COALESCE($2, target),
         interval_seconds = COALESCE($3, interval_seconds),
         timeout_ms = COALESCE($4, timeout_ms),
         regions = COALESCE($5, regions),
         enabled = COALESCE($6, enabled),
         config = COALESCE($7, config),
         updated_at = now()
     WHERE id = $8
     RETURNING *`,
    [
      input.name,
      input.target,
      input.interval_seconds,
      input.timeout_ms,
      input.regions,
      input.enabled,
      input.config ? JSON.stringify(input.config) : null,
      id,
    ]
  );
  return formatMonitor(res.rows[0]);
}

export async function deleteMonitor(id: string): Promise<boolean> {
  const p = getPool();
  const res = await p.query(`DELETE FROM monitors WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function insertCheckResult(result: CheckResult): Promise<void> {
  const p = getPool();
  await p.query(
    `INSERT INTO check_results (time, monitor_id, tenant_id, region, status, status_code, response_time_ms, dns_ms, tcp_ms, tls_ms, ttfb_ms, error_code, error_message, attempt, worker_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      result.time,
      result.monitorId,
      result.tenantId,
      result.region,
      result.status,
      result.statusCode || null,
      result.responseTimeMs,
      result.timings.dns_ms,
      result.timings.tcp_ms,
      result.timings.tls_ms,
      result.timings.ttfb_ms,
      result.errorCode || null,
      result.errorMessage || null,
      result.attempt,
      result.workerId,
      result.idempotencyKey,
    ]
  );
}

export async function getRecentCheckResults(monitorId: string, limit = 50): Promise<CheckResult[]> {
  const p = getPool();
  const res = await p.query(
    `SELECT * FROM check_results WHERE monitor_id = $1 ORDER BY time DESC LIMIT $2`,
    [monitorId, limit]
  );
  return res.rows.map((row) => ({
    jobId: row.idempotency_key || '',
    monitorId: row.monitor_id,
    tenantId: row.tenant_id,
    region: row.region,
    time: row.time.toISOString(),
    status: row.status,
    statusCode: row.status_code,
    responseTimeMs: row.response_time_ms,
    timings: {
      dns_ms: row.dns_ms,
      tcp_ms: row.tcp_ms,
      tls_ms: row.tls_ms,
      ttfb_ms: row.ttfb_ms,
      total_ms: row.response_time_ms,
    },
    errorCode: row.error_code,
    errorMessage: row.error_message,
    attempt: row.attempt,
    workerId: row.worker_id,
    idempotencyKey: row.idempotency_key,
  }));
}

export async function createIncident(incident: Partial<Incident>): Promise<Incident> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO incidents (tenant_id, monitor_id, status, severity, started_at, root_cause_region, error_summary)
     VALUES ($1, $2, $3, $4, COALESCE($5, now()), $6, $7)
     RETURNING *`,
    [
      incident.tenant_id,
      incident.monitor_id,
      incident.status || 'open',
      incident.severity || 'critical',
      incident.started_at ? new Date(incident.started_at) : new Date(),
      incident.root_cause_region || null,
      incident.error_summary || null,
    ]
  );
  return formatIncident(res.rows[0]);
}

export async function resolveIncident(incidentId: string): Promise<Incident | null> {
  const p = getPool();
  const res = await p.query(
    `UPDATE incidents SET status = 'resolved', resolved_at = now() WHERE id = $1 RETURNING *`,
    [incidentId]
  );
  if (res.rows.length === 0) return null;
  return formatIncident(res.rows[0]);
}

export async function listIncidents(tenantId: string, limit = 20): Promise<Incident[]> {
  const p = getPool();
  const res = await p.query(
    `SELECT * FROM incidents WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2`,
    [tenantId, limit]
  );
  return res.rows.map(formatIncident);
}

function formatMonitor(row: any): Monitor {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    type: row.type as MonitorType,
    target: row.target,
    interval_seconds: row.interval_seconds,
    timeout_ms: row.timeout_ms,
    regions: row.regions,
    confirm_quorum: row.confirm_quorum,
    confirm_regions: row.confirm_regions,
    enabled: row.enabled,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
    escalation_policy_id: row.escalation_policy_id,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

function formatIncident(row: any): Incident {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    monitor_id: row.monitor_id,
    status: row.status,
    severity: row.severity,
    started_at: row.started_at ? new Date(row.started_at).toISOString() : new Date().toISOString(),
    acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
    resolved_at: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    root_cause_region: row.root_cause_region,
    error_summary: row.error_summary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User / Auth Database Operations
// ─────────────────────────────────────────────────────────────────────────────

function formatUser(row: any): User {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    email: row.email,
    password_hash: row.password_hash,
    display_name: row.display_name,
    role: row.role as UserRole,
    is_verified: row.is_verified,
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Strips password_hash from a User record to produce a safe UserProfile.
 */
export function toUserProfile(user: User): UserProfile {
  const { password_hash, ...profile } = user;
  return profile;
}

/**
 * Creates a new tenant for user registration (new organization).
 * @returns The ID of the created tenant.
 */
export async function createTenant(name: string): Promise<string> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO tenants (name, plan) VALUES ($1, 'free') RETURNING id`,
    [name]
  );
  return res.rows[0].id;
}

/**
 * Creates a new user account in the database.
 * @throws If email is already registered (unique constraint violation).
 */
export async function createUser(params: {
  tenantId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role?: UserRole;
}): Promise<User> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO users (tenant_id, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.tenantId, params.email, params.passwordHash, params.displayName, params.role || 'member']
  );
  return formatUser(res.rows[0]);
}

/**
 * Finds a user by their email address.
 * Used during login to verify credentials.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const p = getPool();
  const res = await p.query(`SELECT * FROM users WHERE email = $1`, [email]);
  if (res.rows.length === 0) return null;
  return formatUser(res.rows[0]);
}

/**
 * Finds a user by their UUID.
 * Used for session validation and profile retrieval.
 */
export async function findUserById(id: string): Promise<User | null> {
  const p = getPool();
  const res = await p.query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (res.rows.length === 0) return null;
  return formatUser(res.rows[0]);
}

/**
 * Updates user profile fields (display_name, email).
 * Only provided fields are updated via COALESCE.
 */
export async function updateUserProfile(
  userId: string,
  fields: { displayName?: string; email?: string }
): Promise<User | null> {
  const p = getPool();
  const res = await p.query(
    `UPDATE users
     SET display_name = COALESCE($1, display_name),
         email = COALESCE($2, email),
         updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [fields.displayName || null, fields.email || null, userId]
  );
  if (res.rows.length === 0) return null;
  return formatUser(res.rows[0]);
}

/**
 * Updates the user's password hash.
 * Should be called after bcrypt.hash() on the new password.
 */
export async function updateUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
  const p = getPool();
  const res = await p.query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [newPasswordHash, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Records the last login timestamp for a user.
 */
export async function updateUserLastLogin(userId: string): Promise<void> {
  const p = getPool();
  await p.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Token Database Operations
// ─────────────────────────────────────────────────────────────────────────────

function formatRefreshToken(row: any): RefreshToken {
  return {
    id: row.id,
    user_id: row.user_id,
    token_hash: row.token_hash,
    user_agent: row.user_agent,
    ip_address: row.ip_address,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : '',
    revoked_at: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Persists a new hashed refresh token with metadata for audit trail.
 */
export async function createRefreshToken(params: {
  userId: string;
  tokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}): Promise<RefreshToken> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.userId, params.tokenHash, params.userAgent || null, params.ipAddress || null, params.expiresAt]
  );
  return formatRefreshToken(res.rows[0]);
}

/**
 * Finds a refresh token by its ID (jti claim in the JWT).
 * Only returns non-revoked, non-expired tokens.
 */
export async function findRefreshTokenById(tokenId: string): Promise<RefreshToken | null> {
  const p = getPool();
  const res = await p.query(
    `SELECT * FROM refresh_tokens WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [tokenId]
  );
  if (res.rows.length === 0) return null;
  return formatRefreshToken(res.rows[0]);
}

/**
 * Revokes a single refresh token (e.g., during token rotation).
 */
export async function revokeRefreshToken(tokenId: string): Promise<boolean> {
  const p = getPool();
  const res = await p.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
    [tokenId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Revokes all refresh tokens for a user (e.g., on password change or "logout everywhere").
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<number> {
  const p = getPool();
  const res = await p.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  return res.rowCount ?? 0;
}
