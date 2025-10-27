-- Create observability schema for Claude Code hook event tracking
-- This schema is separate from public to keep observability data isolated

-- Create the observability schema
CREATE SCHEMA IF NOT EXISTS observability;

-- Enable Row Level Security on all tables (will add policies later)
-- For now, we'll keep it simple without RLS since this is internal tooling

-- ============================================================================
-- Events Table
-- Stores all Claude Code hook events (PreToolUse, PostToolUse, etc.)
-- ============================================================================
CREATE TABLE observability.events (
    id BIGSERIAL PRIMARY KEY,
    source_app TEXT NOT NULL,                    -- e.g., 'orchestrator-ai', 'claude-code'
    session_id TEXT NOT NULL,                    -- Claude Code session identifier
    hook_event_type TEXT NOT NULL,               -- e.g., 'PreToolUse', 'PostToolUse', 'SessionStart'
    payload JSONB NOT NULL,                      -- Full event payload (flexible structure)
    chat JSONB,                                  -- Chat transcript (array of messages)
    summary TEXT,                                -- AI-generated summary of the event
    timestamp BIGINT NOT NULL,                   -- Event timestamp (milliseconds since epoch)
    human_in_the_loop JSONB,                     -- HITL request data if applicable
    human_in_the_loop_status JSONB,              -- HITL response status and data
    model_name TEXT,                             -- LLM model name (e.g., 'claude-3-5-sonnet')
    created_at TIMESTAMPTZ DEFAULT NOW()         -- Row creation timestamp
);

-- Indexes for efficient querying
CREATE INDEX idx_events_source_app ON observability.events(source_app);
CREATE INDEX idx_events_session_id ON observability.events(session_id);
CREATE INDEX idx_events_hook_event_type ON observability.events(hook_event_type);
CREATE INDEX idx_events_timestamp ON observability.events(timestamp DESC);
CREATE INDEX idx_events_created_at ON observability.events(created_at DESC);
CREATE INDEX idx_events_model_name ON observability.events(model_name) WHERE model_name IS NOT NULL;

-- GIN index for JSONB payload searches (if needed later)
CREATE INDEX idx_events_payload_gin ON observability.events USING GIN(payload);

-- ============================================================================
-- Themes Table
-- Stores custom color themes for the observability UI
-- ============================================================================
CREATE TABLE observability.themes (
    id TEXT PRIMARY KEY,                         -- UUID
    name TEXT NOT NULL UNIQUE,                   -- Unique theme identifier (kebab-case)
    display_name TEXT NOT NULL,                  -- Human-readable name
    description TEXT,                            -- Theme description
    colors JSONB NOT NULL,                       -- Color configuration object
    is_public BOOLEAN DEFAULT FALSE,             -- Public/private flag
    author_id TEXT,                              -- Creator user ID
    author_name TEXT,                            -- Creator display name
    created_at TIMESTAMPTZ NOT NULL,             -- Creation timestamp
    updated_at TIMESTAMPTZ NOT NULL,             -- Last update timestamp
    tags JSONB DEFAULT '[]'::JSONB,              -- Array of tags
    download_count INTEGER DEFAULT 0,            -- Number of times downloaded
    rating DECIMAL(3,2),                         -- Average rating (0.00 to 5.00)
    rating_count INTEGER DEFAULT 0               -- Number of ratings
);

-- Indexes for themes
CREATE INDEX idx_themes_name ON observability.themes(name);
CREATE INDEX idx_themes_is_public ON observability.themes(is_public);
CREATE INDEX idx_themes_created_at ON observability.themes(created_at DESC);
CREATE INDEX idx_themes_author_id ON observability.themes(author_id) WHERE author_id IS NOT NULL;
CREATE INDEX idx_themes_rating ON observability.themes(rating DESC NULLS LAST);

-- ============================================================================
-- Theme Shares Table
-- Manages sharing links for themes
-- ============================================================================
CREATE TABLE observability.theme_shares (
    id TEXT PRIMARY KEY,                         -- UUID
    theme_id TEXT NOT NULL,                      -- Reference to theme
    share_token TEXT NOT NULL UNIQUE,            -- Unique shareable token
    expires_at TIMESTAMPTZ,                      -- Optional expiration time
    is_public BOOLEAN DEFAULT FALSE,             -- Public share flag
    allowed_users JSONB,                         -- Array of allowed user IDs (if not public)
    created_at TIMESTAMPTZ NOT NULL,             -- Creation timestamp
    access_count INTEGER DEFAULT 0,              -- Number of times accessed

    CONSTRAINT fk_theme_shares_theme
        FOREIGN KEY (theme_id)
        REFERENCES observability.themes(id)
        ON DELETE CASCADE
);

-- Indexes for theme shares
CREATE INDEX idx_theme_shares_theme_id ON observability.theme_shares(theme_id);
CREATE INDEX idx_theme_shares_token ON observability.theme_shares(share_token);
CREATE INDEX idx_theme_shares_expires_at ON observability.theme_shares(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- Theme Ratings Table
-- Stores user ratings for themes
-- ============================================================================
CREATE TABLE observability.theme_ratings (
    id TEXT PRIMARY KEY,                         -- UUID
    theme_id TEXT NOT NULL,                      -- Reference to theme
    user_id TEXT NOT NULL,                       -- User who rated
    rating INTEGER NOT NULL                      -- Rating value (1-5)
        CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,                                -- Optional comment
    created_at TIMESTAMPTZ NOT NULL,             -- Creation timestamp

    CONSTRAINT fk_theme_ratings_theme
        FOREIGN KEY (theme_id)
        REFERENCES observability.themes(id)
        ON DELETE CASCADE,

    -- One rating per user per theme
    CONSTRAINT unique_user_theme_rating
        UNIQUE (theme_id, user_id)
);

-- Indexes for theme ratings
CREATE INDEX idx_theme_ratings_theme_id ON observability.theme_ratings(theme_id);
CREATE INDEX idx_theme_ratings_user_id ON observability.theme_ratings(user_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to update theme rating statistics
-- Call this after insert/update/delete on theme_ratings
CREATE OR REPLACE FUNCTION observability.update_theme_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate average rating and count for the theme
    UPDATE observability.themes
    SET
        rating = (
            SELECT AVG(rating)::DECIMAL(3,2)
            FROM observability.theme_ratings
            WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id)
        ),
        rating_count = (
            SELECT COUNT(*)::INTEGER
            FROM observability.theme_ratings
            WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id)
        )
    WHERE id = COALESCE(NEW.theme_id, OLD.theme_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update theme ratings
CREATE TRIGGER trigger_update_theme_rating_stats
    AFTER INSERT OR UPDATE OR DELETE ON observability.theme_ratings
    FOR EACH ROW
    EXECUTE FUNCTION observability.update_theme_rating_stats();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON SCHEMA observability IS 'Schema for Claude Code observability and event tracking';
COMMENT ON TABLE observability.events IS 'Claude Code hook events (PreToolUse, PostToolUse, etc.)';
COMMENT ON TABLE observability.themes IS 'Custom color themes for the observability UI';
COMMENT ON TABLE observability.theme_shares IS 'Shareable links for themes';
COMMENT ON TABLE observability.theme_ratings IS 'User ratings for themes';

COMMENT ON COLUMN observability.events.payload IS 'Full event payload as JSONB (flexible structure)';
COMMENT ON COLUMN observability.events.chat IS 'Chat transcript as JSONB array';
COMMENT ON COLUMN observability.events.human_in_the_loop IS 'Human-in-the-loop request data';
COMMENT ON COLUMN observability.events.human_in_the_loop_status IS 'HITL response status and data';
