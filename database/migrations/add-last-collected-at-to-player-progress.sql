-- Migration: Ajouter la colonne last_collected_at à player_progress
-- Date: 2025-11-10
-- Description: Permet de tracker la date de dernière collecte d'un collectible

ALTER TABLE player_progress
ADD COLUMN IF NOT EXISTS last_collected_at TIMESTAMP;

COMMENT ON COLUMN player_progress.last_collected_at IS 'Date et heure de la dernière collecte d''un collectible';
