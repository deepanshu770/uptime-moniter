-- =============================================================================
-- API Pulse Database Schema
-- Database: PostgreSQL 16+ with TimescaleDB Extension (or standard PostgreSQL)
-- Target Schema: public
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

-- Fallback function if TimescaleDB extension is not available in environment
CREATE OR REPLACE FUNCTION time_bucket(bucket_width INTERVAL, ts TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN to_timestamp(floor(extract(epoch FROM ts) / extract(epoch FROM bucket_width)) * extract(epoch FROM bucket_width));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------------------------------
-- 2. USERS TABLE
-- Stores user accounts, authentication credentials, and workspace role assignments.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
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
-- 4. MONITORS TABLE
-- Defines synthetic monitoring configurations.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monitors (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    target               TEXT NOT NULL,
    interval_seconds     INTEGER NOT NULL DEFAULT 30,
    timeout_ms           INTEGER NOT NULL DEFAULT 10000,
    regions              TEXT[] NOT NULL DEFAULT '{"us-east"}'::TEXT[],
    enabled              BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for querying monitors by user and status
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON public.monitors USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_enabled ON public.monitors USING btree (enabled);

-- -----------------------------------------------------------------------------
-- 5. CHECK RESULTS TABLE (TimescaleDB Hypertable / Standard Partition)
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

-- Primary time-series indexes
CREATE INDEX IF NOT EXISTS check_results_time_idx ON public.check_results USING btree ("time" DESC);
CREATE INDEX IF NOT EXISTS idx_check_results_monitor_time ON public.check_results USING btree (monitor_id, "time" DESC);
CREATE INDEX IF NOT EXISTS idx_check_results_user_time ON public.check_results USING btree (user_id, "time" DESC);

-- Convert check_results into a TimescaleDB Hypertable partitioned by time if available
DO $$
BEGIN
  PERFORM create_hypertable('public.check_results', 'time', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Hypertable creation skipped (TimescaleDB not available or already converted).';
END $$;
