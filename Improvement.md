# Project Codebase & Security Review — UptimeMonitor

This document provides a comprehensive architectural assessment, security vulnerability audit, reliability analysis, and prioritized remediation roadmap for the **UptimeMonitor** platform.

---

## 1. Critical Security Vulnerabilities

### 1.1 Insecure Direct Object Reference (IDOR / BOLA) Across All API Mutators & Getters
* **Locations:**
  * `services/api/src/index.ts` (Lines 236–350)
  * `packages/db/src/index.ts` (Lines 250–377)
* **The Vulnerability:**
  The API endpoints `GET /v1/monitors/:id`, `PATCH /v1/monitors/:id`, `DELETE /v1/monitors/:id`, `POST /v1/monitors/:id/check`, `GET /v1/monitors/:id/results`, and `POST /v1/incidents/:id/acknowledge` accept resource IDs directly from URL route parameters and interact with the database using queries like `WHERE id = $1`.
  **None of these endpoints verify that the requested monitor or incident belongs to `request.user.tid` (the caller's tenant ID).**
* **Impact:**
  Any authenticated tenant can read internal endpoints and probe results, mutate configurations, trigger manual probe loops, resolve incidents, or permanently delete monitors belonging to any other tenant in the system.
* **Better Approach:**
  Every SQL query and API route for tenant-scoped resources must enforce tenant isolation:
  ```sql
  SELECT * FROM monitors WHERE id = $1 AND tenant_id = $2
  UPDATE monitors SET ... WHERE id = $1 AND tenant_id = $2
  DELETE FROM monitors WHERE id = $1 AND tenant_id = $2
  ```

---

### 1.2 SSRF Protection Bypass via TOCTOU DNS Rebinding & Open Redirects
* **Locations:**
  * `services/worker/src/ssrf.ts` (Lines 36–68)
  * `services/worker/src/checker.ts` (Lines 15–70)
* **The Vulnerability:**
  1. **Time-Of-Check to Time-Of-Use (TOCTOU) DNS Rebinding:** `validateTargetSSRF` performs an initial `dns.lookup()`. If valid, `executeHttpCheck` later invokes `gotScraping({ url: job.target })`, which performs a *second, independent* DNS lookup. An attacker configuring a domain with a 0-second TTL (or using DNS rebinding tools like `rbndr.us`) can return a public IP on the first lookup and `169.254.169.254` (cloud metadata service) or `127.0.0.1` on the second lookup.
  2. **Unvalidated HTTP 301/302 Redirects:** `got-scraping` follows redirects by default. A public server returning a `302 Found` pointing to `http://169.254.169.254/latest/meta-data/` or internal database ports will bypass `validateTargetSSRF` entirely.
  3. **Incomplete IP Validation:** `isPrivateIp` does not catch IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`, `::ffff:169.254.169.254`), or alternate IP encodings (octal, integer, hex).
* **Impact:**
  Probers can be weaponized to exfiltrate AWS/GCP instance metadata, query private cluster services (Postgres, Redis, Kafka), or perform intranet port scanning.
* **Better Approach:**
  * Pin the resolved IP: resolve DNS *once*, validate the resolved IP against private ranges, and force the HTTP request to connect directly to that resolved IP while preserving the `Host` header.
  * Intercept and validate redirect URLs before following them (`maxRedirects: 0` or custom redirect hook with SSRF checks on each hop).
  * Use a robust CIDR parser (e.g., `ipaddr.js`) to normalize IPv4-mapped IPv6 addresses.

---

### 1.3 CORS Misconfiguration with Credentials Allowed
* **Locations:**
  * `services/auth/src/index.ts` (Lines 79–82)
  * `services/api/src/index.ts` (Lines 63–65)
* **The Vulnerability:**
  In `services/auth`:
  ```typescript
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });
  ```
* **Impact:**
  According to the CORS specification, `Access-Control-Allow-Origin: *` cannot be combined with `Access-Control-Allow-Credentials: true`. Fastify will either reject or reflect any arbitrary `Origin` header sent by an attacker's website, allowing malicious websites to make authenticated credentialed cross-origin requests.
* **Better Approach:**
  Maintain an explicit allowlist of authorized origin domains (e.g., `['https://app.yourdomain.com']`). Never default to `*` when credentials/cookies are accepted.

---

### 1.4 Hardcoded Fallback Secrets in Production Paths
* **Locations:**
  * `services/auth/src/lib/tokens.ts` (Line 23)
  * `services/api/src/index.ts` (Line 25)
* **The Vulnerability:**
  Both services fall back to:
  `'CHANGE_ME_IN_PRODUCTION_super_secret_key_32chars!'`
  If `JWT_SECRET` is unset in an environment or staging container, any attacker who reads this open repository can sign arbitrary JWT tokens with `{ role: 'owner', tid: '<victim-tenant-id>' }` and achieve full account takeover.
* **Better Approach:**
  Crash at startup (`process.exit(1)`) if `process.env.JWT_SECRET` is missing in non-test environments.

---

### 1.5 Missing RBAC Enforcement on Mutating API Routes
* **Locations:**
  * `services/api/src/index.ts` (Lines 83–103)
  * `services/auth/src/middleware/authenticate.ts` (Lines 86–114)
* **The Vulnerability:**
  `services/auth` contains a role hierarchy helper `requireRole` (`viewer` < `member` < `admin` < `owner`), but `services/api` never uses it. The API service only checks token validity (`decoded.type !== 'access'`).
* **Impact:**
  A user with the `viewer` role can create, update, and delete monitors, run probes, and resolve incidents.
* **Better Approach:**
  Port `requireRole` or implement a shared RBAC middleware in `services/api` to restrict POST/PATCH/DELETE endpoints to `member` or `admin`.

---

### 1.6 ReDoS (Regular Expression Denial of Service) in Probe Execution
* **Location:**
  * `services/worker/src/checker.ts` (Lines 107–109)
* **The Vulnerability:**
  ```typescript
  } else if (a.op === 'matches' && !new RegExp(String(a.value)).test(bodyText)) {
  ```
  The regex pattern `a.value` is supplied by the user when configuring the monitor.
* **Impact:**
  A malicious tenant can configure a regex pattern with catastrophic backtracking (e.g., `(a+)+$`). When evaluated against a response body, this completely freezes the Node.js event loop on the worker node.
* **Better Approach:**
  Validate regexes at configuration time with `safe-regex` or evaluate regexes using the V8 `vm` module with a strict execution timeout (e.g., 50ms), or use Google's `re2` engine which guarantees linear-time matching.

---

### 1.7 Memory Exhaustion via Unbounded HTTP Probe Responses
* **Location:**
  * `services/worker/src/checker.ts` (Lines 60–75)
* **The Vulnerability:**
  `gotScraping` buffers the entire HTTP response body into memory (`response.body`).
* **Impact:**
  If a target server serves a multi-gigabyte payload, a continuous stream, or a compression bomb (`gzip` bomb), the worker process will run out of memory (OOM crash), killing all checks running in that worker process.
* **Better Approach:**
  Enforce a hard response body byte limit (e.g., `maxResponseSize = 100 * 1024` / 100KB) and abort the stream once the limit is exceeded.

---

## 2. Concurrency, Reliability & Data-Loss Flaws

### 2.1 Scheduler Job Loss on Failure (Premature ZREM)
* **Location:**
  * `services/scheduler/src/index.ts` (Lines 22–108)
* **The Bug:**
  The Lua script `POP_DUE_LUA` pops due monitors by running `ZRANGEBYSCORE` and immediately `ZREM`s them from the Redis sorted set.
  The monitor is only re-added (`ZADD`) at the end of the loop:
  ```typescript
  await redis.zadd(key, nextDue, member);
  ```
  If the scheduler process crashes, encounters an unhandled exception in `producer.send()`, or fails during `getMonitorById()`, **the monitor is deleted from Redis and permanently stops being monitored** until the 5-minute reconciliation sweep.
* **Better Approach:**
  Do not delete from the sorted set before processing. Instead, update its score atomically using a visibility timeout / processing lease (similar to Redis Streams or SQS), or update `ZADD key (now + interval) member` atomically in the Lua script so the schedule is never blank.

---

### 2.2 Concurrency Race Condition in Evaluator (Lost State Updates)
* **Location:**
  * `services/evaluator/src/index.ts` (Lines 26–146)
* **The Bug:**
  `services/evaluator` reads the monitor state with `redis.hgetall`, computes `consecFail` / `consecOk` in memory, and saves it back via `redis.hmset`.
  When a monitor is probed concurrently from 2 or 3 regions (e.g., `us-east` and `eu-west`), results arrive at the evaluator at virtually the same instant.
* **Impact:**
  A classic **Read-Modify-Write race condition**. The state writes overwrite each other, causing missed state transitions (`UP -> SUSPECT -> DOWN`), inaccurate consecutive failure counters, and duplicate incident creation.
* **Better Approach:**
  Use atomic Lua scripts for counter updates and state transitions, or partition Kafka's `results` topic by `monitorId` and ensure single-threaded consumption per partition key.

---

### 2.3 Broken Quorum Window Logic (Tumbling Window Edge-Case)
* **Location:**
  * `services/evaluator/src/index.ts` (Lines 46–55)
* **The Bug:**
  ```typescript
  const windowId = Math.floor(Date.now() / 60000);
  const confirmKey = `confirm:${monitorId}:${windowId}`;
  await redis.hset(confirmKey, region, 'DOWN');
  ```
  This is a rigid 60-second tumbling window. If `us-east` fails at second 59 (minute `k`) and `eu-west` fails at second 01 of the next minute (minute `k+1`), their reports are written to separate keys (`confirm:<id>:k` and `confirm:<id>:k+1`).
* **Impact:**
  A true multi-region outage that spans a minute boundary will **never register as having reached quorum**, delaying or preventing incident creation.
* **Better Approach:**
  Store region verdicts with timestamps in a Redis Hash or Sorted Set:
  `HSET monitor:<id>:region_status <region> <timestamp>` and count how many regions have a DOWN status within `Date.now() - 60000` (a true sliding window).

---

### 2.4 Token Generation Database Inefficiency & Orphan Records
* **Location:**
  * `services/auth/src/routes/auth.routes.ts` (Lines 323–353)
* **The Bug:**
  To get a `jti` for the refresh token, `generateTokenPair` inserts a row with `tokenHash = 'pending'`, signs the JWT using the generated UUID, and then runs a second query `UPDATE refresh_tokens SET token_hash = ...`.
* **Impact:**
  Two database round-trips for every login, registration, and token refresh. If the process terminates between step 1 and step 2, dangling records with hash `'pending'` remain in the database.
* **Better Approach:**
  Generate the UUID in application memory using `crypto.randomUUID()`:
  ```typescript
  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken(userId, tokenId);
  const tokenHash = hashToken(refreshToken);
  await dbCreateRefreshToken({ id: tokenId, userId, tokenHash, ... });
  ```
  This requires only a single atomic `INSERT`.

---

## 3. Architecture & Design Mistakes / Over-Engineering

### 3.1 Violation of Microservice Boundaries (Tight Coupling in API Service)
* **Location:**
  * `services/api/src/index.ts` (Lines 18–20)
* **The Mistake:**
  The `services/api` service directly imports `@uptime/scheduler`, `@uptime/worker`, and `@uptime/evaluator`:
  ```typescript
  import { scheduleMonitor, unscheduleMonitor } from '@uptime/scheduler';
  import { executeSingleJob } from '@uptime/worker';
  import { processCheckResult } from '@uptime/evaluator';
  ```
  In `POST /v1/monitors` and `POST /v1/monitors/:id/check`, the API server itself runs probe execution and evaluation logic.
* **Why it's wrong:**
  If you build microservices connected via Kafka and Redis, having the API service import the heavy dependencies of workers (like `got-scraping`) and run network probes inside the API web server defeats the purpose of distributed workers. If a user triggers a manual check on a slow host, the API request handler blocks.
* **Better Approach:**
  The API service should publish a command to Kafka (e.g. `jobs.ad-hoc`) or Redis, and the workers should consume and execute it. If running in a monolith mode, embrace a clean modular monolith instead of half-microservice / half-in-process execution.

---

### 3.2 Non-Existent Cookie Implementation Despite Docs and Middleware
* **Locations:**
  * `services/auth/src/index.ts` (Lines 84–86)
  * `services/auth/src/routes/auth.routes.ts` (Lines 122–220)
  * `apps/web/src/contexts/AuthContext.tsx` (Line 61)
* **The Mistake:**
  The auth documentation and code comments repeatedly state that refresh tokens are stored in `httpOnly` secure cookies. `@fastify/cookie` is registered.
  **However, the route handlers never call `reply.setCookie()`**. The refresh token is only sent in the JSON body.
  In `apps/web/src/contexts/AuthContext.tsx`, the frontend stores `refresh_token` in `localStorage`:
  ```typescript
  localStorage.setItem('refresh_token', data.refresh_token);
  ```
* **Why it's wrong:**
  Storing long-lived refresh tokens in browser `localStorage` exposes them to any cross-site scripting (XSS) vulnerability. Furthermore, the frontend never actually calls `/v1/auth/refresh`. Once the 15-minute access token expires, all requests fail with 401 and the user is locked out.
* **Better Approach:**
  Either implement `httpOnly`, `SameSite=Lax/Strict`, `Secure` cookies properly in Fastify for refresh tokens, or implement a memory-only access token pattern with an automated refresh interceptor in the frontend.

---

### 3.3 Multi-Tenant Leak in Notifier Service
* **Location:**
  * `services/notifier/src/index.ts` (Lines 24–40)
* **The Mistake:**
  The `services/notifier` service dispatches alert webhooks and Slack notifications to globally defined environment variables:
  `process.env.WEBHOOK_URL` and `process.env.SLACK_WEBHOOK_URL`.
* **Why it's wrong:**
  Every alert for *every tenant* in the system is broadcast to the single global webhook URL. There is no tenant-level notification channel routing or configuration.
  Additionally, the `notification_logs` table designed in `packages/db` is completely unused.
* **Better Approach:**
  Store notification channels in the database per tenant (`tenant_id`, `channel_type`, `webhook_url`), look up the target channels when processing an incident event, and record delivery attempts in `notification_logs`.

---

## 4. Performance & Scalability Bottlenecks

### 4.1 N+1 Query Cascade in Dashboard Stats Endpoint
* **Location:**
  * `services/api/src/index.ts` (Lines 128–148)
* **The Bottleneck:**
  In `GET /v1/stats`, the API retrieves all monitors for a tenant, and then loops over them with `monitors.map(async (m) => ...)`:
  ```typescript
  const state = await redis.hgetall(`state:${m.id}`);
  const recent = await getRecentCheckResults(m.id, 10);
  ```
  If a tenant has 50 monitors, one single request to `/v1/stats` performs:
  * 50 individual `redis.hgetall` network requests.
  * 50 individual `SELECT * FROM check_results ...` database queries!
* **Frontend Aggravation:**
  In `useDashboardData.ts` (Line 42), the frontend polls `/v1/stats` every 5 seconds. A single open browser tab generates hundreds of database queries every minute.
* **Better Approach:**
  * Aggregate recent check results with a single SQL query using `WINDOW` or `LATERAL JOIN`.
  * Fetch Redis states using a pipeline or `MGET`.
  * Compute and cache summary stats in Redis, or replace 5-second polling with Server-Sent Events (SSE) or WebSockets.

---

### 4.2 Scheduler Shard Collision & Inefficient DB Polling
* **Location:**
  * `services/scheduler/src/index.ts` (Lines 69–146)
* **The Bottleneck:**
  1. Every 1 second, the tick loop runs over all 16 shards. For every due monitor, it queries PostgreSQL with `await getMonitorById(monitorId)`.
  2. If multiple scheduler replicas are deployed for high availability, **both instances execute the tick loop on all 16 shards simultaneously** with no leader election or partition assignment.
  3. `unscheduleMonitor` uses `redis.zrange(key, 0, -1)` to pull every member of the shard into Node.js memory just to filter by string prefix.
* **Better Approach:**
  Cache monitor configuration (target, timeout, interval, headers) in Redis so the scheduler doesn't query PostgreSQL on every tick. Use Redis cluster / Redlock leader election or assign specific shards to specific scheduler instances.

---

## 5. Broken Scripts & Runtime Errors

### 5.1 Broken Test Script: `scripts/test-phase1.ts`
* **Location:**
  * `scripts/test-phase1.ts` (Line 18)
* **The Bug:**
  `createMonitor` in `packages/db` requires 3 parameters: `(tenantId: string, userId: string, input: CreateMonitorInput)`.
  `test-phase1.ts` calls it with 2 arguments:
  ```typescript
  const monitor1 = await createMonitor(tenantId, { name: '...', ... });
  ```
  `userId` receives the config object, and `input` is `undefined`. Running `pnpm test:phase1` throws:
  `TypeError: Cannot read properties of undefined (reading 'name')`.
* **Fix:** Pass a dummy or admin `userId` (e.g., `'00000000-0000-0000-0000-000000000001'`).

---

### 5.2 Missing Proxy Configuration & Unhandled API Responses in Frontend
* **Locations:**
  * `apps/web/src/components/MonitorDrawer.tsx` (Lines 43–47)
  * `apps/web/src/pages/Register.tsx` (Lines 97–105)
* **The Issues:**
  1. In `MonitorDrawer.tsx`:
     ```typescript
     fetch(`/v1/monitors/${monitor.id}/results?limit=25`)
       .then(res => res.json())
       .then(data => { setRecentResults(data); })
     ```
     If the API returns a 401 or 500 error object (`{ error: '...', message: '...' }`), `recentResults` is set to a non-array object. Later, `[...recentResults].reverse().map(...)` crashes with a fatal React unhandled exception (`TypeError: recentResults.reverse is not a function`).
  2. In `Register.tsx`: The password input shows `placeholder="Min 8 characters"` with `minLength={8}`. The backend Zod schema requires uppercase, lowercase, number, and special character. Users entering `password123` are rejected without clear inline validation guidance.

---

## 6. Prioritized Remediation Roadmap

| Priority | Area | Action Items |
| :--- | :--- | :--- |
| **P0 (Immediate)** | **Authorization & IDOR** | Enforce `tenant_id = request.user.tid` on all monitor/incident operations in `services/api` and `packages/db`. |
| **P0 (Immediate)** | **SSRF Prevention** | Fix TOCTOU DNS rebinding in `services/worker`: resolve DNS once, validate IP, pin IP in request, disable automatic redirects. |
| **P0 (Immediate)** | **Secrets & CORS** | Remove hardcoded fallback secrets. Fix CORS credentials/wildcard configuration in `services/auth` and `services/api`. |
| **P1 (High)** | **Scheduler & Evaluator Data Integrity** | Fix premature `ZREM` in scheduler Lua script. Replace tumbling quorum window with a sliding window in `services/evaluator`. Atomize state updates. |
| **P1 (High)** | **Auth & Session Handling** | Implement token refresh cycle in frontend (`useAuth`). Set up httpOnly cookie support or automatic Axios/Fetch 401 refresh interceptors. |
| **P2 (Medium)** | **Performance Optimization** | Eliminate N+1 DB/Redis queries in `/v1/stats`. Cache monitor configs in Redis for the scheduler. |
| **P2 (Medium)** | **Input Validation & Worker Hardening** | Add Zod schema to `PATCH /v1/monitors/:id`. Sanitize regex assertions and limit HTTP response body sizes. |
| **P3 (Cleanup)** | **DX & Scripts** | Fix signature in `scripts/test-phase1.ts`. Clean up direct service-to-service imports in `services/api`. |
