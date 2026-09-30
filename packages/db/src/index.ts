import { Pool } from 'pg';
import {
  Monitor, CreateMonitorInput, CheckResult, Incident, MonitorType,
  User, UserRole, UserProfile, RefreshToken,
} from '@uptime/shared-types';

let pool: Pool | null = null;


export interface AnalyticsSummary {
  avgResponseTime: number;
  uptimePercentage: number;
  totalChecks: number;
  failedChecks: number;
}

export interface AnalyticsTimeseriesPoint {
  time: string;
  avgResponseTime: number;
  p95: number;
  errorCount: number;
}

export interface MonitorAnalyticsMetric {
  monitorId: string;
  name: string;
  value: number; // Can be avgResponseTime or errorCount
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  timeseries: AnalyticsTimeseriesPoint[];
  slowestMonitors: MonitorAnalyticsMetric[];
  flakiestMonitors: MonitorAnalyticsMetric[];
}


export async function getAnalytics(userId: string, hours: number = 24, monitorId?: string): Promise<any> {
  const pool = getPool();
  const interval = `${hours} hours`;
  const bucketSize = hours <= 24 ? '1 hour' : hours <= 168 ? '6 hours' : '1 day';

  const baseFilter = monitorId 
    ? `user_id = $1 AND time > NOW() - $2::interval AND monitor_id = $3`
    : `user_id = $1 AND time > NOW() - $2::interval`;
    
  const prevFilter = monitorId
    ? `user_id = $1 AND time > NOW() - (2 * $2::interval) AND time <= NOW() - $2::interval AND monitor_id = $3`
    : `user_id = $1 AND time > NOW() - (2 * $2::interval) AND time <= NOW() - $2::interval`;

  const params = monitorId ? [userId, interval, monitorId] : [userId, interval];
  const tsParams = monitorId ? [bucketSize, userId, interval, monitorId] : [bucketSize, userId, interval];

  const tsBaseFilter = monitorId
    ? `user_id = $2 AND time > NOW() - $3::interval AND monitor_id = $4`
    : `user_id = $2 AND time > NOW() - $3::interval`;

  const queries = [
    // 0: Current Summary
    pool.query(`
      SELECT 
        COUNT(*) as total_checks,
        SUM(CASE WHEN status != 0 THEN 1 ELSE 0 END) as failed_checks,
        ROUND(AVG(response_time_ms)) as avg_response_time,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_ms,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms) AS p99_ms,
        MIN(tls_expiry_days) as tls_expiry_days
      FROM check_results WHERE ${baseFilter}
    `, params),
    
    // 1: Previous Summary (for deltas)
    pool.query(`
      SELECT 
        COUNT(*) as total_checks,
        SUM(CASE WHEN status != 0 THEN 1 ELSE 0 END) as failed_checks,
        ROUND(AVG(response_time_ms)) as avg_response_time
      FROM check_results WHERE ${prevFilter}
    `, params),

    // 2: Timeseries
    pool.query(`
      SELECT 
        time_bucket($1::interval, time) AS bucket,
        ROUND(AVG(response_time_ms)) AS total_ms,
        ROUND(AVG(dns_ms)) AS dns_ms,
        ROUND(AVG(tcp_ms)) AS tcp_ms,
        ROUND(AVG(tls_ms)) AS tls_ms,
        ROUND(AVG(ttfb_ms)) AS ttfb_ms,
        ROUND(AVG(download_ms)) AS download_ms,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_ms,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms) AS p99_ms,
        SUM(CASE WHEN status != 0 THEN 1 ELSE 0 END) AS error_count
      FROM check_results WHERE ${tsBaseFilter}
      GROUP BY bucket ORDER BY bucket ASC
    `, tsParams),

    // 3: Regional Stats
    pool.query(`
      SELECT region, ROUND(AVG(response_time_ms)) AS avg_latency
      FROM check_results WHERE ${baseFilter}
      GROUP BY region
    `, params),

    // 4: Raw Checks (Last 100)
    pool.query(`
      SELECT * FROM check_results WHERE ${baseFilter}
      ORDER BY time DESC LIMIT 100
    `, params)
  ];

  const [currSum, prevSum, tsRes, regRes, rawRes] = await Promise.all(queries);

  const total = Number(currSum.rows[0]?.total_checks || 0);
  const failed = Number(currSum.rows[0]?.failed_checks || 0);
  const uptime = total > 0 ? ((total - failed) / total) * 100 : 100;

  const prevTotal = Number(prevSum.rows[0]?.total_checks || 0);
  const prevFailed = Number(prevSum.rows[0]?.failed_checks || 0);
  const prevUptime = prevTotal > 0 ? ((prevTotal - prevFailed) / prevTotal) * 100 : 100;
  
  const currAvg = Number(currSum.rows[0]?.avg_response_time || 0);
  const prevAvg = Number(prevSum.rows[0]?.avg_response_time || 0);

  return {
    summary: {
      uptimePercentage: Number(uptime.toFixed(3)),
      uptimeDelta: Number((uptime - prevUptime).toFixed(3)),
      avgResponseTime: currAvg,
      latencyDelta: currAvg - prevAvg,
      p95Latency: Number(currSum.rows[0]?.p95_ms || 0),
      p99Latency: Number(currSum.rows[0]?.p99_ms || 0),
      tlsExpiryDays: currSum.rows[0]?.tls_expiry_days || null,
      activeIncidents: failed,
      incidentsDelta: failed - prevFailed,
      totalChecks: total,
      failedChecks: failed
    },
    aggregated: tsRes.rows.map((r: any) => ({
      time: r.bucket.toISOString(),
      total_ms: Number(r.total_ms || 0),
      dns_ms: Number(r.dns_ms || 0),
      tcp_ms: Number(r.tcp_ms || 0),
      tls_ms: Number(r.tls_ms || 0),
      ttfb_ms: Number(r.ttfb_ms || 0),
      download_ms: Number(r.download_ms || 0),
      p95_ms: Number(r.p95_ms || 0),
      p99_ms: Number(r.p99_ms || 0),
      errorCount: Number(r.error_count || 0)
    })),
    regionalStats: regRes.rows.map((r: any) => ({
      region: r.region,
      avg_latency: Number(r.avg_latency || 0)
    })),
    rawChecks: rawRes.rows.map((r: any) => ({
      id: r.id || (r.monitor_id + r.time.toISOString() + Math.random()),
      time: r.time.toISOString(),
      monitor_id: r.monitor_id,
      user_id: r.user_id,
      region: r.region,
      status: r.status,
      status_code: r.status_code,
      response_time_ms: r.response_time_ms,
      dns_ms: r.dns_ms,
      tcp_ms: r.tcp_ms,
      tls_ms: r.tls_ms,
      ttfb_ms: r.ttfb_ms,
      download_ms: r.download_ms,
      tls_expiry_days: r.tls_expiry_days,
      error_code: r.error_code,
      error_message: r.error_message,
      attempt: r.attempt,
      worker_id: r.worker_id,
      idempotency_key: r.idempotency_key
    }))
  };
}

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

    
    // Escalation policies dummy table
    await client.query(`
      CREATE TABLE IF NOT EXISTS escalation_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Monitors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
        user_id UUID NOT NULL,
        region TEXT NOT NULL,
        status SMALLINT NOT NULL,
        status_code INT,
        response_time_ms INT NOT NULL,
        dns_ms INT NOT NULL DEFAULT 0,
        tcp_ms INT NOT NULL DEFAULT 0,
        tls_ms INT NOT NULL DEFAULT 0,
        ttfb_ms INT NOT NULL DEFAULT 0,
        download_ms INT NOT NULL DEFAULT 0,
        tls_expiry_days INT,
        error_code TEXT,
        error_message TEXT,
        attempt SMALLINT NOT NULL DEFAULT 1,
        worker_id TEXT NOT NULL,
        idempotency_key TEXT
      );
    `);

    // Add new columns if table already exists (for existing instances)
    await client.query(`
      ALTER TABLE check_results
      ADD COLUMN IF NOT EXISTS download_ms INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tls_expiry_days INT;
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
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      CREATE TABLE IF NOT EXISTS notification_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel_type TEXT NOT NULL,
        webhook_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

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
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

export async function createMonitor(userId: string, input: CreateMonitorInput): Promise<Monitor> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO monitors (user_id, name, type, target, interval_seconds, timeout_ms, regions, confirm_quorum, confirm_regions, enabled, config, escalation_policy_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      userId,
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

export async function listMonitors(userId: string): Promise<Monitor[]> {
  const p = getPool();
  const res = await p.query(
    `SELECT * FROM monitors WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
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
    `INSERT INTO check_results (time, monitor_id, user_id, region, status, status_code, response_time_ms, dns_ms, tcp_ms, tls_ms, ttfb_ms, download_ms, tls_expiry_days, error_code, error_message, attempt, worker_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      result.time,
      result.monitorId,
      result.userId,
      result.region,
      result.status,
      result.statusCode || null,
      result.responseTimeMs,
      result.timings.dns_ms,
      result.timings.tcp_ms,
      result.timings.tls_ms,
      result.timings.ttfb_ms,
      result.timings.download_ms,
      result.tlsExpiryDays || null,
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
    userId: row.user_id,
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
      download_ms: row.download_ms,
      total_ms: row.response_time_ms,
    },
    tlsExpiryDays: row.tls_expiry_days,
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
    `INSERT INTO incidents (user_id, monitor_id, status, severity, started_at, root_cause_region, error_summary)
     VALUES ($1, $2, $3, $4, COALESCE($5, now()), $6, $7)
     RETURNING *`,
    [
      incident.user_id,
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

export async function listIncidents(userId: string, limit = 20): Promise<Incident[]> {
  const p = getPool();
  const res = await p.query(
    `SELECT * FROM incidents WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2`,
    [userId, limit]
  );
  return res.rows.map(formatIncident);
}

function formatMonitor(row: any): Monitor {
  return {
    id: row.id,
    user_id: row.user_id,
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
    user_id: row.user_id,
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
 * Creates a new user account in the database.
 * @throws If email is already registered (unique constraint violation).
 */
export async function createUser(params: {
  email: string;
  passwordHash: string;
  displayName: string;
  role?: UserRole;
}): Promise<User> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.email, params.passwordHash, params.displayName, params.role || 'member']
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

export function toUserProfile(user: User): UserProfile {
  const { password_hash, ...profile } = user;
  return profile;
}

export async function getUserNotificationChannels(userId: string) {
  const p = getPool();
  const res = await p.query('SELECT * FROM notification_channels WHERE user_id = $1', [userId]);
  return res.rows;
}

export async function logNotification(incidentId: string, channelType: string, status: string, payload: any, idempotencyKey: string) {
  const p = getPool();
  try {
    await p.query(
      'INSERT INTO notification_logs (incident_id, channel_type, status, payload, idempotency_key) VALUES ($1, $2, $3, $4, $5)',
      [incidentId, channelType, status, JSON.stringify(payload), idempotencyKey]
    );
  } catch(e) {
    console.error('Failed to log notification', e);
  }
}
