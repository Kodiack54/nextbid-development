-- AI Worker Tables (Chad & Susan)
-- Run this in Supabase SQL Editor
-- Tables use dev_ai_ prefix (part of dev_ schema group)

-- ============================================
-- 1. DEV_AI_SESSIONS - Chad's session dumps
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Source info
    source_type VARCHAR(50),                      -- 'external_claude', 'internal_claude', 'chat_systems'
    source_name VARCHAR(100),                     -- Human-readable source name
    project_path TEXT,                            -- Project this relates to

    -- Content
    raw_content TEXT,                             -- Raw terminal/chat dump
    summary TEXT,                                 -- AI-generated summary

    -- Status
    status VARCHAR(30) DEFAULT 'pending_review',  -- pending_review, processed, archived

    -- Stats
    message_count INT DEFAULT 0,
    items_extracted INT DEFAULT 0,
    conflicts_found INT DEFAULT 0,

    -- Processing info
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by VARCHAR(50),                     -- 'susan', 'manual'

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_sessions_status ON dev_ai_sessions(status);
CREATE INDEX idx_ai_sessions_source ON dev_ai_sessions(source_type);
CREATE INDEX idx_ai_sessions_project ON dev_ai_sessions(project_path);
CREATE INDEX idx_ai_sessions_started ON dev_ai_sessions(started_at DESC);

-- ============================================
-- 2. DEV_AI_MESSAGES - Extracted conversation messages
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES dev_ai_sessions(id) ON DELETE CASCADE,

    -- Message content
    role VARCHAR(20) NOT NULL,                    -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    sequence_num INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_session ON dev_ai_messages(session_id);
CREATE INDEX idx_ai_messages_sequence ON dev_ai_messages(session_id, sequence_num);

-- ============================================
-- 3. DEV_AI_TODOS - Extracted todos
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_todos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_path TEXT NOT NULL,

    -- Todo content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',        -- low, medium, high, critical
    status VARCHAR(20) DEFAULT 'pending',         -- pending, in_progress, completed, cancelled

    -- Assignment
    assigned_to VARCHAR(100),                     -- Worker or user name

    -- Source tracking
    source_session_id UUID REFERENCES dev_ai_sessions(id),

    -- Timestamps
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_todos_project ON dev_ai_todos(project_path);
CREATE INDEX idx_ai_todos_status ON dev_ai_todos(status);
CREATE INDEX idx_ai_todos_priority ON dev_ai_todos(priority);

-- ============================================
-- 4. DEV_AI_KNOWLEDGE - Susan's knowledge base
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_path TEXT,

    -- Knowledge content
    category VARCHAR(50),                         -- architecture, bug-fix, config, workflow, etc.
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    details TEXT,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    importance INT DEFAULT 5,                     -- 1-10 scale

    -- Source tracking
    session_id UUID REFERENCES dev_ai_sessions(id),
    source_session_id UUID REFERENCES dev_ai_sessions(id),

    -- Usage tracking
    reference_count INT DEFAULT 0,
    last_referenced_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_knowledge_project ON dev_ai_knowledge(project_path);
CREATE INDEX idx_ai_knowledge_category ON dev_ai_knowledge(category);
CREATE INDEX idx_ai_knowledge_importance ON dev_ai_knowledge(importance DESC);

-- ============================================
-- 5. DEV_AI_DECISIONS - Architectural decisions
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_path TEXT,
    session_id UUID REFERENCES dev_ai_sessions(id),

    -- Decision content
    title VARCHAR(500) NOT NULL,
    context TEXT,                                 -- Why this decision was needed
    decision TEXT NOT NULL,                       -- What was decided
    alternatives JSONB DEFAULT '[]',              -- Other options considered
    rationale TEXT,                               -- Why this option was chosen

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    supersedes_decision_id UUID REFERENCES dev_ai_decisions(id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_decisions_project ON dev_ai_decisions(project_path);
CREATE INDEX idx_ai_decisions_created ON dev_ai_decisions(created_at DESC);

-- ============================================
-- 6. DEV_AI_SCHEMAS - Database schema storage
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_schemas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Schema info
    database_name VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    schema_definition JSONB,
    description TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(database_name, table_name)
);

CREATE INDEX idx_ai_schemas_database ON dev_ai_schemas(database_name);

-- ============================================
-- 7. DEV_AI_BUGS - Bug tracking
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_bugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_path TEXT NOT NULL,

    -- Bug content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium',        -- low, medium, high, critical
    status VARCHAR(20) DEFAULT 'open',            -- open, investigating, fixed, wont_fix

    -- Location
    file_path TEXT,
    line_number INT,

    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Source tracking
    source_session_id UUID REFERENCES dev_ai_sessions(id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_bugs_project ON dev_ai_bugs(project_path);
CREATE INDEX idx_ai_bugs_status ON dev_ai_bugs(status);
CREATE INDEX idx_ai_bugs_severity ON dev_ai_bugs(severity);

-- ============================================
-- 8. DEV_AI_CODE_CHANGES - Code change tracking
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_code_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_path TEXT NOT NULL,

    -- Change info
    file_path TEXT NOT NULL,
    change_type VARCHAR(20),                      -- created, modified, deleted, renamed
    description TEXT,

    -- Diff info
    lines_added INT DEFAULT 0,
    lines_removed INT DEFAULT 0,

    -- Source tracking
    source_session_id UUID REFERENCES dev_ai_sessions(id),
    commit_hash VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_code_changes_project ON dev_ai_code_changes(project_path);
CREATE INDEX idx_ai_code_changes_file ON dev_ai_code_changes(file_path);

-- ============================================
-- 9. DEV_AI_CONFLICTS - Pending conflicts for user resolution
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_conflicts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_path TEXT,

    -- Conflict info
    conflict_type VARCHAR(50),                    -- 'todo', 'knowledge', 'decision'
    new_item JSONB NOT NULL,                      -- The new item that conflicts
    existing_items JSONB NOT NULL,                -- Existing items it conflicts with
    explanation TEXT,                             -- Why it's a conflict

    -- Status
    status VARCHAR(20) DEFAULT 'pending',         -- pending, resolved, dismissed
    resolution VARCHAR(20),                       -- keep_new, keep_existing, keep_both, merged
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_conflicts_status ON dev_ai_conflicts(status);
CREATE INDEX idx_ai_conflicts_project ON dev_ai_conflicts(project_path);

-- ============================================
-- 10. DEV_AI_NOTIFICATIONS - Susan's messages to user
-- ============================================
CREATE TABLE IF NOT EXISTS dev_ai_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Notification info
    type VARCHAR(50),                             -- 'conflict', 'info', 'warning', 'question'
    from_worker VARCHAR(50),                      -- 'susan', 'chad', etc.
    project_path TEXT,

    -- Content
    title VARCHAR(255),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',

    -- Status
    status VARCHAR(20) DEFAULT 'unread',          -- unread, read, dismissed

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ai_notifications_status ON dev_ai_notifications(status);
CREATE INDEX idx_ai_notifications_worker ON dev_ai_notifications(from_worker);
CREATE INDEX idx_ai_notifications_created ON dev_ai_notifications(created_at DESC);

-- ============================================
-- Done! AI Worker tables created successfully.
-- ============================================
