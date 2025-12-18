-- Kodiack Studios Dev Tables Migration
-- Migration 003 - Human/Studio tables for local PostgreSQL (kodiack_ai)
-- Run this in: psql -U kodiack_admin -d kodiack_ai -f migration-003-dev-tables.sql

-- ============================================
-- 1. DEV_USERS - User accounts
-- ============================================
CREATE TABLE IF NOT EXISTS dev_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'developer',
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_users_email ON dev_users(email);

-- ============================================
-- 2. DEV_CHAT_SESSIONS - Chat history
-- ============================================
CREATE TABLE IF NOT EXISTS dev_chat_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES dev_users(id),
    project_id UUID REFERENCES dev_projects(id),
    title VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active',
    summary TEXT,
    summary_generated_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_chat_sessions_user ON dev_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_dev_chat_sessions_project ON dev_chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_dev_chat_sessions_status ON dev_chat_sessions(status);

-- ============================================
-- 3. DEV_CHAT_MESSAGES - Chat messages
-- ============================================
CREATE TABLE IF NOT EXISTS dev_chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES dev_chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    model VARCHAR(100),
    code_blocks JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_chat_messages_session ON dev_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_dev_chat_messages_created ON dev_chat_messages(created_at);

-- ============================================
-- 4. DEV_CHAT_CHANNELS - Team chat channels
-- ============================================
CREATE TABLE IF NOT EXISTS dev_chat_channels (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    channel_type VARCHAR(20) DEFAULT 'public',
    created_by UUID REFERENCES dev_users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_chat_channels_name ON dev_chat_channels(name);

-- ============================================
-- 5. DEV_SESSION_SUMMARIES - Session summaries
-- ============================================
CREATE TABLE IF NOT EXISTS dev_session_summaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES dev_chat_sessions(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    key_topics JSONB DEFAULT '[]',
    decisions_made JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_session_summaries_session ON dev_session_summaries(session_id);

-- ============================================
-- 6. DEV_SESSION_SCRUBBING - Scrub status tracking
-- ============================================
CREATE TABLE IF NOT EXISTS dev_session_scrubbing (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID,
    project_path TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    messages_processed INT DEFAULT 0,
    knowledge_extracted INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_session_scrubbing_session ON dev_session_scrubbing(session_id);
CREATE INDEX IF NOT EXISTS idx_dev_session_scrubbing_status ON dev_session_scrubbing(status);

-- ============================================
-- 7. DEV_PROJECT_PATHS - Project file paths
-- ============================================
CREATE TABLE IF NOT EXISTS dev_project_paths (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES dev_projects(id),
    path_type VARCHAR(50) NOT NULL,
    path TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_project_paths_project ON dev_project_paths(project_id);
CREATE INDEX IF NOT EXISTS idx_dev_project_paths_type ON dev_project_paths(path_type);

-- ============================================
-- 8. DEV_PROJECT_KNOWLEDGE - Old knowledge system (legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS dev_project_knowledge (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES dev_projects(id),
    project_path TEXT,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    summary TEXT,
    category VARCHAR(50),
    source VARCHAR(100),
    confidence DECIMAL(3,2) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_project_knowledge_project ON dev_project_knowledge(project_id);
CREATE INDEX IF NOT EXISTS idx_dev_project_knowledge_path ON dev_project_knowledge(project_path);
CREATE INDEX IF NOT EXISTS idx_dev_project_knowledge_category ON dev_project_knowledge(category);

-- ============================================
-- 9. DEV_PROJECT_DOCS - Old docs system (legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS dev_project_docs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES dev_projects(id),
    project_path TEXT,
    doc_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    file_path TEXT,
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_project_docs_project ON dev_project_docs(project_id);
CREATE INDEX IF NOT EXISTS idx_dev_project_docs_type ON dev_project_docs(doc_type);

-- ============================================
-- 10. DEV_ACTIVE_LOCKS - View for current locks
-- ============================================
CREATE TABLE IF NOT EXISTS dev_active_locks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES dev_projects(id),
    locked_by UUID REFERENCES dev_users(id),
    branch VARCHAR(100),
    purpose TEXT,
    environment VARCHAR(20),
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_active_locks_project ON dev_active_locks(project_id);

-- ============================================
-- 11. DEV_PROJECT_LOCKS - Lock history
-- ============================================
CREATE TABLE IF NOT EXISTS dev_project_locks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES dev_projects(id),
    locked_by UUID REFERENCES dev_users(id),
    branch VARCHAR(100) DEFAULT 'dev',
    purpose TEXT,
    environment VARCHAR(20) DEFAULT 'dev',
    is_active BOOLEAN DEFAULT TRUE,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unlocked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_dev_project_locks_project ON dev_project_locks(project_id);
CREATE INDEX IF NOT EXISTS idx_dev_project_locks_active ON dev_project_locks(is_active);

-- ============================================
-- 12. DEV_PROJECT_UNLOCK_HISTORY - Unlock audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS dev_project_unlock_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES dev_projects(id),
    lock_id UUID REFERENCES dev_project_locks(id),
    unlocked_by UUID REFERENCES dev_users(id),
    patch_notes TEXT NOT NULL,
    changes_summary TEXT,
    commit_hash VARCHAR(100),
    change_type VARCHAR(50) DEFAULT 'feature',
    lock_duration_minutes INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_unlock_history_project ON dev_project_unlock_history(project_id);
CREATE INDEX IF NOT EXISTS idx_dev_unlock_history_created ON dev_project_unlock_history(created_at DESC);

-- ============================================
-- 13. DEV_WORKER_STATE - AI Worker status
-- ============================================
CREATE TABLE IF NOT EXISTS dev_worker_state (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    worker_name VARCHAR(100) NOT NULL,
    worker_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'idle',
    current_task TEXT,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dev_worker_state_name ON dev_worker_state(worker_name);

-- ============================================
-- 14. DEV_SYSTEM_TICKETS - System tickets
-- ============================================
CREATE TABLE IF NOT EXISTS dev_system_tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    ticket_type VARCHAR(50) DEFAULT 'bug',
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    assigned_to UUID REFERENCES dev_users(id),
    created_by UUID REFERENCES dev_users(id),
    project_id UUID REFERENCES dev_projects(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_system_tickets_status ON dev_system_tickets(status);
CREATE INDEX IF NOT EXISTS idx_dev_system_tickets_project ON dev_system_tickets(project_id);

-- ============================================
-- 15. DEV_INCIDENTS - Incident logs
-- ============================================
CREATE TABLE IF NOT EXISTS dev_incidents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    project_id UUID REFERENCES dev_projects(id),
    affected_services JSONB DEFAULT '[]',
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_incidents_status ON dev_incidents(status);
CREATE INDEX IF NOT EXISTS idx_dev_incidents_severity ON dev_incidents(severity);

-- ============================================
-- 16. DEV_TIME_PUNCHES - Time clock entries
-- ============================================
CREATE TABLE IF NOT EXISTS dev_time_punches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES dev_users(id),
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    total_hours DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_time_punches_user ON dev_time_punches(user_id);
CREATE INDEX IF NOT EXISTS idx_dev_time_punches_clock_in ON dev_time_punches(clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_dev_time_punches_status ON dev_time_punches(status);

-- ============================================
-- 17. DEV_BREAK_PERIODS - Break tracking
-- ============================================
CREATE TABLE IF NOT EXISTS dev_break_periods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    time_punch_id UUID REFERENCES dev_time_punches(id) ON DELETE CASCADE,
    break_start TIMESTAMP WITH TIME ZONE NOT NULL,
    break_end TIMESTAMP WITH TIME ZONE,
    break_type VARCHAR(20) DEFAULT 'break',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_break_periods_punch ON dev_break_periods(time_punch_id);

-- ============================================
-- Update triggers for updated_at columns
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_dev_users_updated_at ON dev_users;
CREATE TRIGGER update_dev_users_updated_at
    BEFORE UPDATE ON dev_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dev_project_knowledge_updated_at ON dev_project_knowledge;
CREATE TRIGGER update_dev_project_knowledge_updated_at
    BEFORE UPDATE ON dev_project_knowledge
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dev_project_docs_updated_at ON dev_project_docs;
CREATE TRIGGER update_dev_project_docs_updated_at
    BEFORE UPDATE ON dev_project_docs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dev_worker_state_updated_at ON dev_worker_state;
CREATE TRIGGER update_dev_worker_state_updated_at
    BEFORE UPDATE ON dev_worker_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dev_system_tickets_updated_at ON dev_system_tickets;
CREATE TRIGGER update_dev_system_tickets_updated_at
    BEFORE UPDATE ON dev_system_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Done! 17 dev_* tables created
-- ============================================
-- dev_users                  - User accounts
-- dev_chat_sessions          - Chat history
-- dev_chat_messages          - Chat messages
-- dev_chat_channels          - Team channels
-- dev_session_summaries      - Session summaries
-- dev_session_scrubbing      - Scrub tracking
-- dev_project_paths          - Project file paths
-- dev_project_knowledge      - Legacy knowledge
-- dev_project_docs           - Legacy docs
-- dev_active_locks           - Current locks
-- dev_project_locks          - Lock history
-- dev_project_unlock_history - Unlock audit
-- dev_worker_state           - Worker status
-- dev_system_tickets         - System tickets
-- dev_incidents              - Incident logs
-- dev_time_punches           - Time clock
-- dev_break_periods          - Break tracking
