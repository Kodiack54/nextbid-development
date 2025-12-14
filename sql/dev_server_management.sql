-- Dev Server Management Schema
-- Run this in Supabase SQL Editor

-- 1. Add server status columns to dev_projects
ALTER TABLE dev_projects
ADD COLUMN IF NOT EXISTS dev_server_status VARCHAR(20) DEFAULT 'stopped',
ADD COLUMN IF NOT EXISTS dev_server_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dev_server_started_by UUID,
ADD COLUMN IF NOT EXISTS dev_server_error TEXT,
ADD COLUMN IF NOT EXISTS pm2_process_name VARCHAR(100);

-- 2. Add server_path_test column for test environment paths
ALTER TABLE dev_projects
ADD COLUMN IF NOT EXISTS server_path_test VARCHAR(500);

-- 3. Insert project seed data (if not exists)
INSERT INTO dev_projects (name, slug, droplet_name, droplet_ip, server_path, server_path_test, port_dev, port_test, port_prod, is_active, sort_order)
VALUES
  ('NextBid Engine', 'engine', 'Dev', '161.35.229.220', '/var/www/NextBid_Dev/engine-dev-5101', '/var/www/NextBid_Dev/engine-test-5001', 5101, 5001, 31001, true, 1),
  ('NextSource', 'source', 'Dev', '161.35.229.220', '/var/www/NextBid_Dev/source-dev-5102', '/var/www/NextBid_Dev/source-test-5002', 5102, 5002, 8002, true, 2),
  ('NextBidder', 'bidder', 'Dev', '161.35.229.220', '/var/www/NextBid_Dev/bidder-dev-5103', '/var/www/NextBid_Dev/bidder-test-5003', 5103, 5003, 8003, true, 3),
  ('NextBid Portal', 'portal', 'Dev', '161.35.229.220', '/var/www/NextBid_Dev/portal-dev-5104', '/var/www/NextBid_Dev/portal-test-5004', 5104, 5004, 8004, true, 4),
  ('NextTech', 'tech', 'Dev', '161.35.229.220', '/var/www/NextBid_Dev/tech-dev-5105', '/var/www/NextBid_Dev/tech-test-5005', 5105, 5005, 8005, true, 5),
  ('NextTask', 'task', 'Dev', '161.35.229.220', '/var/www/NextBid_Dev/task-dev-5106', '/var/www/NextBid_Dev/task-test-5006', 5106, 5006, 8006, true, 6)
ON CONFLICT (slug) DO UPDATE SET
  server_path = EXCLUDED.server_path,
  server_path_test = EXCLUDED.server_path_test,
  port_dev = EXCLUDED.port_dev,
  port_test = EXCLUDED.port_test,
  port_prod = EXCLUDED.port_prod;

-- 4. Create index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_dev_projects_server_status ON dev_projects(dev_server_status);
