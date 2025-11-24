-- Migration: Ajout des colonnes manquantes dans mission_progress
-- Date: 2025-11-24
-- Description: Ajout de target_channel_id, target_keyword, mission_type, expires_at

-- Ajout de target_channel_id (pour missions keyword-message)
ALTER TABLE mission_progress
ADD COLUMN IF NOT EXISTS target_channel_id TEXT;

-- Ajout de target_keyword (pour missions keyword-message)
ALTER TABLE mission_progress
ADD COLUMN IF NOT EXISTS target_keyword TEXT;

-- Ajout de mission_type (pour optimisation des requêtes)
ALTER TABLE mission_progress
ADD COLUMN IF NOT EXISTS mission_type TEXT;

-- Ajout de expires_at (pour timeout des missions)
ALTER TABLE mission_progress
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Créer un index sur expires_at pour les requêtes de missions expirées
CREATE INDEX IF NOT EXISTS idx_mission_progress_expires_at
ON mission_progress(guild_id, status, expires_at)
WHERE status = 'in_progress' AND expires_at IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN mission_progress.target_channel_id IS 'ID du canal cible pour les missions keyword-message';
COMMENT ON COLUMN mission_progress.target_keyword IS 'Mot-clé cible pour les missions keyword-message';
COMMENT ON COLUMN mission_progress.mission_type IS 'Type de mission (quiz, keyword-message, channel-based, etc.)';
COMMENT ON COLUMN mission_progress.expires_at IS 'Date/heure d''expiration de la mission (timeout)';
