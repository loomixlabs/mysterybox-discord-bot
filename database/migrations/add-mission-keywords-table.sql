-- Migration: Add mission_keywords table for multi-keyword support
-- Allows missions to have multiple possible keywords to avoid repetition

CREATE TABLE IF NOT EXISTS mission_keywords (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  target_channel_id TEXT, -- Optional: specific channel for this keyword variant
  created_at TIMESTAMP DEFAULT NOW(),

  -- Ensure keyword uniqueness per mission
  UNIQUE(guild_id, mission_id, keyword)
);

-- Index for fast lookup when checking messages
CREATE INDEX IF NOT EXISTS idx_mission_keywords_lookup
ON mission_keywords(guild_id, keyword);

-- Index for managing keywords by mission
CREATE INDEX IF NOT EXISTS idx_mission_keywords_mission
ON mission_keywords(mission_id);

COMMENT ON TABLE mission_keywords IS 'Stores multiple possible keywords for keyword-message missions to avoid repetition';
COMMENT ON COLUMN mission_keywords.keyword IS 'The word that players must make others say';
COMMENT ON COLUMN mission_keywords.target_channel_id IS 'Optional: specific channel where this keyword must be said';
