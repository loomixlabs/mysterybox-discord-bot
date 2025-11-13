-- Migration: Add footer_text and thumbnail_url to announcement_templates
-- Date: 2025-11-04
-- Description: Adds missing columns for full template customization

ALTER TABLE announcement_templates
ADD COLUMN IF NOT EXISTS footer_text TEXT DEFAULT 'Système d''annonces',
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Vérifier les colonnes ajoutées
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'announcement_templates'
AND column_name IN ('footer_text', 'thumbnail_url');
