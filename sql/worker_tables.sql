-- Worker State Table
-- Tracks background worker progress
-- Run this in Supabase SQL Editor

-- ============================================
-- DEV_WORKER_STATE - Track worker progress
-- ============================================
CREATE TABLE IF NOT EXISTS dev_worker_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_key VARCHAR(100) UNIQUE NOT NULL,    -- 'cataloger_worker_state', etc.
    state JSONB DEFAULT '{}',                   -- Worker-specific state data
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    run_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_worker_state_key ON dev_worker_state(worker_key);

-- ============================================
-- Update trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_worker_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.run_count = OLD.run_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_worker_state_updated ON dev_worker_state;
CREATE TRIGGER trigger_worker_state_updated
    BEFORE UPDATE ON dev_worker_state
    FOR EACH ROW
    EXECUTE FUNCTION update_worker_state_timestamp();

-- ============================================
-- Helpful view for monitoring workers
-- ============================================
CREATE OR REPLACE VIEW dev_worker_status AS
SELECT
    worker_key,
    last_run_at,
    run_count,
    EXTRACT(EPOCH FROM (NOW() - last_run_at)) AS seconds_since_last_run,
    CASE
        WHEN last_run_at IS NULL THEN 'never_run'
        WHEN NOW() - last_run_at > INTERVAL '5 minutes' THEN 'stale'
        WHEN NOW() - last_run_at > INTERVAL '2 minutes' THEN 'warning'
        ELSE 'healthy'
    END AS health_status,
    last_error
FROM dev_worker_state;

-- ============================================
-- Done!
-- ============================================
