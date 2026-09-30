-- =============================================================================
-- UptimeMonitor Database Schema
-- Database: PostgreSQL 16+ with TimescaleDB Extension
-- Target Schema: public
-- Generated from current live database state
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TimescaleDB is used for partitioning time-series check results into hypertables.
-- Fallback is provided below if timescaledb is not available in the target environment.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'TimescaleDB extension not available, falling back to standard PostgreSQL partitioning/indexing.';
END $$;

-- -----------------------------------------------------------------------------
-- 2. USERS TABLE
-- Stores user accounts, authentication credentials, and workspace role assignments.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    is_verified   BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for rapid email lookups during login/registration
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);

-- -----------------------------------------------------------------------------
-- 3. REFRESH TOKENS TABLE
-- Stores hashed refresh tokens for session rotation, client tracking, and revocation.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying active tokens and bulk revocation per user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);

-- -----------------------------------------------------------------------------
-- 4. ESCALATION POLICIES TABLE
-- Defines alert escalation procedures and notification escalation chains.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escalation_policies (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. MONITORS TABLE
-- Defines synthetic monitoring configurations (HTTP, TCP, DNS, Port, API, Heartbeat).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monitors (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    type                 TEXT NOT NULL,
    target               TEXT NOT NULL,
    interval_seconds     INTEGER NOT NULL DEFAULT 30,
    timeout_ms           INTEGER NOT NULL DEFAULT 10000,
    regions              TEXT[] NOT NULL DEFAULT '{"us-east"}'::TEXT[],
    confirm_quorum       INTEGER NOT NULL DEFAULT 2,
    confirm_regions      INTEGER NOT NULL DEFAULT 3,
    enabled              BOOLEAN NOT NULL DEFAULT true,
    config               JSONB NOT NULL DEFAULT '{}'::JSONB,
    escalation_policy_id UUID REFERENCES public.escalation_policies(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for querying monitors by user and status
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON public.monitors USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_enabled ON public.monitors USING btree (enabled);

-- -----------------------------------------------------------------------------
-- 6. CHECK RESULTS TABLE (TimescaleDB Hypertable)
-- Stores high-volume chronological probe executions and phase-level network timings.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.check_results (
    time             TIMESTAMPTZ NOT NULL DEFAULT now(),
    monitor_id       UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    region           TEXT NOT NULL,
    status           SMALLINT NOT NULL, -- 0: UP, 1: DEGRADED, 2: DOWN
    status_code      INTEGER,
    response_time_ms INTEGER NOT NULL,
    dns_ms           INTEGER NOT NULL DEFAULT 0,
    tcp_ms           INTEGER NOT NULL DEFAULT 0,
    tls_ms           INTEGER NOT NULL DEFAULT 0,
    ttfb_ms          INTEGER NOT NULL DEFAULT 0,
    download_ms      INTEGER NOT NULL DEFAULT 0,
    tls_expiry_days  INTEGER,
    error_code       TEXT,
    error_message    TEXT,
    attempt          SMALLINT NOT NULL DEFAULT 1,
    worker_id        TEXT NOT NULL,
    idempotency_key  TEXT
);

-- Primary time-series index
CREATE INDEX IF NOT EXISTS check_results_time_idx ON public.check_results USING btree ("time" DESC);
CREATE INDEX IF NOT EXISTS idx_check_results_monitor_time ON public.check_results USING btree (monitor_id, "time" DESC);
CREATE INDEX IF NOT EXISTS idx_check_results_user_time ON public.check_results USING btree (user_id, "time" DESC);

-- Convert check_results into a TimescaleDB Hypertable partitioned by time
DO $$
BEGIN
  PERFORM create_hypertable('public.check_results', 'time', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Hypertable creation skipped (TimescaleDB not available or already converted).';
END $$;

-- -----------------------------------------------------------------------------
-- 7. INCIDENTS TABLE
-- Tracks active and historical outages, quorum root causes, and resolution states.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    monitor_id        UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
    status            TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'resolved')),
    severity          TEXT NOT NULL DEFAULT 'critical',
    started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at   TIMESTAMPTZ,
    resolved_at       TIMESTAMPTZ,
    root_cause_region TEXT,
    error_summary     TEXT
);

-- Indexes for querying incidents by user and monitor
CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON public.incidents USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id ON public.incidents USING btree (monitor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents USING btree (status);

-- -----------------------------------------------------------------------------
-- 8. NOTIFICATION LOGS TABLE
-- Records multi-channel alert delivery audits (Slack, Webhook, Email, PagerDuty).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    channel_type    TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL,
    payload         JSONB,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for incident notification history
CREATE INDEX IF NOT EXISTS idx_notification_logs_incident ON public.notification_logs USING btree (incident_id);

