ALTER TABLE check_results
  ADD COLUMN download_ms INT NOT NULL DEFAULT 0,
  ADD COLUMN tls_expiry_days INT;

