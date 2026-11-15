import { Pool } from 'pg';
import { 
  Monitor, 
  CreateMonitorInput,
  CheckResult,
  User,
  UserProfile,
  RefreshToken
} from '@uptime/shared-types';

let pool: Pool | null = null;

export function initDb(connectionString?: string): Pool {
  if (!pool) {
    const url = connectionString || process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/uptime_db';
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    return initDb();
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function formatMonitor(row: any): Monitor {
  let status: 'UP' | 'DEGRADED' | 'DOWN' = 'UP';
  if (row.last_status === 2) status = 'DOWN';
  else if (row.last_status === 1) status = 'DEGRADED';
  else if (row.last_status === 0) status = 'UP';

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    target: row.target,
    interval_seconds: row.interval_seconds,
    timeout_ms: row.timeout_ms,
    regions: row.regions || ['us-east'],
    enabled: row.enabled,
    status,
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : undefined,
    lastResponseTimeMs: row.last_response_time_ms != null ? Number(row.last_response_time_ms) : undefined,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function createMonitor(
  userId: string,
  input: CreateMonitorInput
): Promise<Monitor> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO monitors (user_id, name, target, interval_seconds, timeout_ms, regions, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      input.name,
      input.target,
      input.interval_seconds,
      input.timeout_ms,
      input.regions,
      input.enabled
    ]
  );
  return formatMonitor(res.rows[0]);
}

export async function listMonitors(userId: string): Promise<Monitor[]> {
  const p = getPool();
  const res = await p.query(
    `SELECT 
       m.*,
       cr.status as last_status,
       cr.time as last_checked_at,
       cr.response_time_ms as last_response_time_ms
     FROM monitors m
     LEFT JOIN LATERAL (
       SELECT status, time, response_time_ms 
       FROM check_results 
       WHERE monitor_id = m.id 
       ORDER BY time DESC 
       LIMIT 1
     ) cr ON true
     WHERE m.user_id = $1
     ORDER BY m.created_at DESC`,
    [userId]
  );
  return res.rows.map(formatMonitor);
}

export async function getAllEnabledMonitors(): Promise<Monitor[]> {
  const p = getPool();
  const res = await p.query(`SELECT * FROM monitors WHERE enabled = true`);
  return res.rows.map(formatMonitor);
}

export async function getMonitorById(id: string, userId?: string): Promise<Monitor | null> {
  const p = getPool();
  const query = userId
    ? `SELECT 
         m.*,
         cr.status as last_status,
         cr.time as last_checked_at,
         cr.response_time_ms as last_response_time_ms
       FROM monitors m
       LEFT JOIN LATERAL (
         SELECT status, time, response_time_ms 
         FROM check_results 
         WHERE monitor_id = m.id 
         ORDER BY time DESC 
         LIMIT 1
       ) cr ON true
       WHERE m.id = $1 AND m.user_id = $2`
    : `SELECT 
         m.*,
         cr.status as last_status,
         cr.time as last_checked_at,
         cr.response_time_ms as last_response_time_ms
       FROM monitors m
       LEFT JOIN LATERAL (
         SELECT status, time, response_time_ms 
         FROM check_results 
         WHERE monitor_id = m.id 
         ORDER BY time DESC 
         LIMIT 1
       ) cr ON true
       WHERE m.id = $1`;
  const params = userId ? [id, userId] : [id];
  const res = await p.query(query, params);
  if (res.rows.length === 0) return null;
  return formatMonitor(res.rows[0]);
}

export async function updateMonitor(
  id: string,
  userId: string,
  input: Partial<CreateMonitorInput>
): Promise<Monitor | null> {
  const p = getPool();
  const res = await p.query(
    `UPDATE monitors
     SET name = COALESCE($1, name),
         target = COALESCE($2, target),
         interval_seconds = COALESCE($3, interval_seconds),
         timeout_ms = COALESCE($4, timeout_ms),
         regions = COALESCE($5, regions),
         enabled = COALESCE($6, enabled),
         updated_at = now()
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [
      input.name,
      input.target,
      input.interval_seconds,
      input.timeout_ms,
      input.regions,
      input.enabled,
      id,
      userId
    ]
  );
  if (res.rows.length === 0) return null;
  return formatMonitor(res.rows[0]);
}

export async function deleteMonitor(id: string, userId: string): Promise<boolean> {
  const p = getPool();
  const res = await p.query(`DELETE FROM monitors WHERE id = $1 AND user_id = $2`, [id, userId]);
  return (res.rowCount ?? 0) > 0;
}

export async function insertCheckResult(result: CheckResult): Promise<void> {
  await bulkInsertCheckResults([result]);
}

export async function bulkInsertCheckResults(results: CheckResult[]): Promise<void> {
  if (results.length === 0) return;
  const p = getPool();
  
  const values: any[] = [];
  const placeholders: string[] = [];
  
  let i = 1;
  for (const result of results) {
    placeholders.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    
    const timestamp = typeof result.time === 'number' 
      ? new Date(result.time).toISOString() 
      : (result.time ? new Date(result.time).toISOString() : new Date().toISOString());

    values.push(
      timestamp,
      result.monitorId,
      result.userId,
      result.region || 'us-east',
      result.status,
      result.statusCode || null,
      result.responseTimeMs || 0,
      result.timings?.dns_ms || 0,
      result.timings?.tcp_ms || 0,
      result.timings?.tls_ms || 0,
      result.timings?.ttfb_ms || 0,
      result.timings?.download_ms || 0,
      result.tlsExpiryDays != null ? result.tlsExpiryDays : null,
      result.errorCode || null,
      result.errorMessage || null,
      result.attempt || 1,
      result.workerId || 'worker',
      result.idempotencyKey || result.jobId
    );
  }

  const query = `
    INSERT INTO check_results (
      time, monitor_id, user_id, region, status, status_code, 
      response_time_ms, dns_ms, tcp_ms, tls_ms, ttfb_ms, download_ms, 
      tls_expiry_days, error_code, error_message, attempt, worker_id, idempotency_key
    )
    VALUES ${placeholders.join(', ')}
  `;

  await p.query(query, values);
}

export async function getRecentCheckResults(
  monitorId: string, 
  limit: number = 50,
  userId?: string
): Promise<(CheckResult & { id: string })[]> {
  const p = getPool();
  const query = userId
    ? `SELECT 
         COALESCE(idempotency_key, concat(monitor_id, '-', extract(epoch from time))) AS id,
         * 
       FROM check_results 
       WHERE monitor_id = $1 AND user_id = $2 
       ORDER BY time DESC LIMIT $3`
    : `SELECT 
         COALESCE(idempotency_key, concat(monitor_id, '-', extract(epoch from time))) AS id,
         * 
       FROM check_results 
       WHERE monitor_id = $1 
       ORDER BY time DESC LIMIT $2`;
  const params = userId ? [monitorId, userId, limit] : [monitorId, limit];
  const res = await p.query(query, params);

  return res.rows.map(row => ({
    id: row.id,
    jobId: row.idempotency_key || row.id,
    monitorId: row.monitor_id,
    userId: row.user_id,
    region: row.region,
    status: row.status,
    statusCode: row.status_code,
    responseTimeMs: row.response_time_ms,
    timings: {
      dns_ms: row.dns_ms || 0,
      tcp_ms: row.tcp_ms || 0,
      tls_ms: row.tls_ms || 0,
      ttfb_ms: row.ttfb_ms || 0,
      download_ms: row.download_ms || 0,
      total_ms: row.response_time_ms || 0
    },
    time: new Date(row.time).toISOString(),
    tlsExpiryDays: row.tls_expiry_days != null ? Number(row.tls_expiry_days) : undefined,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    attempt: row.attempt,
    workerId: row.worker_id,
    idempotencyKey: row.idempotency_key || ''
  }));
}

export async function getAnalytics(
  userId: string, 
  hours: number = 24, 
  monitorId?: string
): Promise<any> {
  const p = getPool();
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
    p.query(`
      SELECT 
        COUNT(*) as total_checks,
        SUM(CASE WHEN status != 0 THEN 1 ELSE 0 END) as failed_checks,
        ROUND(AVG(response_time_ms)) as avg_response_time,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_ms,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms) AS p99_ms,
        MIN(tls_expiry_days) as tls_expiry_days
      FROM check_results WHERE ${baseFilter}
    `, params),
    
    p.query(`
      SELECT 
        COUNT(*) as total_checks,
        SUM(CASE WHEN status != 0 THEN 1 ELSE 0 END) as failed_checks,
        ROUND(AVG(response_time_ms)) as avg_response_time
      FROM check_results WHERE ${prevFilter}
    `, params),

    p.query(`
      SELECT 
        time_bucket($1::interval, time) AS time,
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
      GROUP BY 1 ORDER BY 1 ASC
    `, tsParams),

    p.query(`
      SELECT region, ROUND(AVG(response_time_ms)) AS avg_latency
      FROM check_results WHERE ${baseFilter}
      GROUP BY region
    `, params),

    p.query(`
      SELECT 
        COALESCE(idempotency_key, concat(monitor_id, '-', extract(epoch from time))) AS id,
        * 
      FROM check_results WHERE ${baseFilter}
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

  const avgResp = Number(currSum.rows[0]?.avg_response_time || 0);
  const prevAvgResp = Number(prevSum.rows[0]?.avg_response_time || 0);

  return {
    summary: {
      uptimePercentage: Number(uptime.toFixed(2)),
      uptimeDelta: Number((uptime - prevUptime).toFixed(2)),
      avgResponseTime: avgResp,
      latencyDelta: avgResp - prevAvgResp,
      p95Latency: Number(currSum.rows[0]?.p95_ms || 0),
      p99Latency: Number(currSum.rows[0]?.p99_ms || 0),
      totalChecks: total,
      failedChecks: failed,
      tlsExpiryDays: currSum.rows[0]?.tls_expiry_days != null ? Number(currSum.rows[0].tls_expiry_days) : null,
      activeIncidents: failed,
      incidentsDelta: failed - prevFailed,
      // Backwards-compatible fields
      uptime: Number(uptime.toFixed(2)),
      avg_response_time: avgResp,
      p95_ms: Number(currSum.rows[0]?.p95_ms || 0),
      p99_ms: Number(currSum.rows[0]?.p99_ms || 0),
      total_checks: total,
      failed_checks: failed,
      tls_expiry_days: currSum.rows[0]?.tls_expiry_days != null ? Number(currSum.rows[0].tls_expiry_days) : null,
    },
    delta: {
      uptime: Number((uptime - prevUptime).toFixed(2)),
      avg_response_time: avgResp - prevAvgResp,
    },
    aggregated: tsRes.rows.map(r => ({
      ...r,
      total_ms: Number(r.total_ms || 0),
      dns_ms: Number(r.dns_ms || 0),
      tcp_ms: Number(r.tcp_ms || 0),
      tls_ms: Number(r.tls_ms || 0),
      ttfb_ms: Number(r.ttfb_ms || 0),
      download_ms: Number(r.download_ms || 0),
      p95_ms: Number(r.p95_ms || 0),
      p99_ms: Number(r.p99_ms || 0),
      error_count: Number(r.error_count || 0),
    })),
    timeseries: tsRes.rows,
    regionalStats: regRes.rows.map(r => ({
      region: r.region,
      avg_latency: Number(r.avg_latency || 0),
    })),
    regional: regRes.rows,
    rawChecks: rawRes.rows,
    raw_checks: rawRes.rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication & User Model
// ─────────────────────────────────────────────────────────────────────────────

function formatUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    display_name: row.display_name,
    is_verified: row.is_verified,
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function createUser(params: { email: string; passwordHash: string; displayName: string }): Promise<User> {
  const p = getPool();
  const res = await p.query(
    `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING *`,
    [params.email.toLowerCase().trim(), params.passwordHash, params.displayName.trim()]
  );
  return formatUser(res.rows[0]);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const p = getPool();
  const res = await p.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
  if (res.rows.length === 0) return null;
  return formatUser(res.rows[0]);
}

export async function findUserById(id: string): Promise<User | null> {
  const p = getPool();
  const res = await p.query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (res.rows.length === 0) return null;
  return formatUser(res.rows[0]);
}

export async function updateUserProfile(userId: string, fields: { displayName?: string; email?: string }): Promise<User | null> {
  const p = getPool();
  const res = await p.query(
    `UPDATE users 
     SET display_name = COALESCE($1, display_name), 
         email = COALESCE($2, email), 
         updated_at = now() 
     WHERE id = $3 
     RETURNING *`,
    [fields.displayName?.trim() || null, fields.email?.toLowerCase().trim() || null, userId]
  );
  if (res.rows.length === 0) return null;
  return formatUser(res.rows[0]);
}

export async function updateUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
  const p = getPool();
  const res = await p.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [newPasswordHash, userId]);
  return (res.rowCount ?? 0) > 0;
}

export async function updateUserLastLogin(userId: string): Promise<void> {
  const p = getPool();
  await p.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
}

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

export async function findRefreshTokenById(tokenId: string): Promise<RefreshToken | null> {
  const p = getPool();
  const res = await p.query(
    `SELECT * FROM refresh_tokens 
     WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`, 
    [tokenId]
  );
  if (res.rows.length === 0) return null;
  return formatRefreshToken(res.rows[0]);
}

export async function revokeRefreshToken(tokenId: string): Promise<boolean> {
  const p = getPool();
  const res = await p.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [tokenId]);
  return (res.rowCount ?? 0) > 0;
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<number> {
  const p = getPool();
  const res = await p.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
  return res.rowCount ?? 0;
}

export function toUserProfile(user: User): UserProfile {
  const { password_hash, ...profile } = user;
  return profile;
}
