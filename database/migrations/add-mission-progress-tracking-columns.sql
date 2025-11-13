-- Migration: Add tracking columns to mission_progress for active mission monitoring
-- These columns store mission-specific parameters needed for global event monitoring

ALTER TABLE mission_progress
ADD COLUMN IF NOT EXISTS target_channel_id TEXT,
ADD COLUMN IF NOT EXISTS target_keyword TEXT,
ADD COLUMN IF NOT EXISTS mission_type TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Index for quickly finding active keyword missions
CREATE INDEX IF NOT EXISTS idx_mission_progress_active_keyword
ON mission_progress(guild_id, status, mission_type, target_keyword)
WHERE status = 'in_progress' AND mission_type = 'keyword-message';

-- Index for quickly finding expired missions
CREATE INDEX IF NOT EXISTS idx_mission_progress_expires
ON mission_progress(expires_at)
WHERE status = 'in_progress' AND expires_at IS NOT NULL;

COMMENT ON COLUMN mission_progress.target_channel_id IS 'For keyword missions: the channel where the word must be said';
COMMENT ON COLUMN mission_progress.target_keyword IS 'For keyword missions: the word that must be guessed';
COMMENT ON COLUMN mission_progress.mission_type IS 'Cached mission type for fast filtering (keyword-message, quiz, etc.)';
COMMENT ON COLUMN mission_progress.expires_at IS 'Timestamp when the mission expires (for timeout handling)';
