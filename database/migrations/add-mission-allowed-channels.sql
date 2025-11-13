-- Migration: Add allowed_channels column to missions table
-- Allows missions to specify which channels can be used for random selection

ALTER TABLE missions
ADD COLUMN IF NOT EXISTS allowed_channels TEXT[];

COMMENT ON COLUMN missions.allowed_channels IS 'Array of channel IDs where the mission can be assigned (null = all channels)';

-- Example: UPDATE missions SET allowed_channels = ARRAY['1234567890', '0987654321'] WHERE id = 1;
