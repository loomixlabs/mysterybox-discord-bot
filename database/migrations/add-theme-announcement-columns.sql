-- Migration: Add theme announcement columns to announcement_settings table
-- Date: 2025-11-04
-- Description: Adds columns for theme expiration announcements

ALTER TABLE announcement_settings
ADD COLUMN IF NOT EXISTS theme_expired BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS theme_expiring_soon BOOLEAN DEFAULT FALSE;

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'announcement_settings'
AND column_name IN ('theme_expired', 'theme_expiring_soon');
