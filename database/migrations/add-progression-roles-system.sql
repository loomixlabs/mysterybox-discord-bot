-- Migration: Ajout du système de progression_roles
-- Date: 2025-11-23
-- Description: Ajoute une colonne JSONB pour stocker les progression_roles avec leurs Discord IDs

-- 1. Ajouter la colonne progression_roles à theme_config
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS progression_roles JSONB DEFAULT '[]'::jsonb;

-- 2. Ajouter une colonne pour tracker les rôles déjà attribués aux joueurs
-- Format: tableau des required_items atteints, ex: [5, 10, 15]
ALTER TABLE player_progress
ADD COLUMN IF NOT EXISTS achieved_progression_roles INTEGER[] DEFAULT '{}';

-- Commentaires pour documentation
COMMENT ON COLUMN theme_config.progression_roles IS 'Array JSON des rôles de progression: [{name, color, required_items, percentage, discord_role_id, hoist, mentionable}]';
COMMENT ON COLUMN player_progress.achieved_progression_roles IS 'Array des seuils required_items déjà atteints pour éviter double attribution';

-- Index pour améliorer les performances de lecture JSONB
CREATE INDEX IF NOT EXISTS idx_theme_config_progression_roles ON theme_config USING GIN (progression_roles);
