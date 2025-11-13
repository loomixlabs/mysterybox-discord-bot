-- Migration: Ajouter colonnes d'annonces missions
-- Date: 2025-11-06
-- Description: Ajoute les colonnes pour les annonces de missions dans announcement_settings

-- Ajouter les colonnes si elles n'existent pas déjà
ALTER TABLE announcement_settings
ADD COLUMN IF NOT EXISTS mission_started BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mission_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mission_failed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mission_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mission_rejected BOOLEAN DEFAULT FALSE;

-- Afficher la structure mise à jour
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name='announcement_settings'
AND column_name LIKE '%mission%'
ORDER BY column_name;
