-- Migration: Ajouter colonne is_enabled pour activer/désactiver les super bonuses
-- Date: 2025-11-19
-- Description: Permet aux super admins d'activer ou désactiver individuellement
--              chaque super bonus dans le système

-- Ajouter la colonne is_enabled
ALTER TABLE super_bonuses
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE NOT NULL;

-- Commentaire explicatif
COMMENT ON COLUMN super_bonuses.is_enabled IS
'Si TRUE, le bonus peut être obtenu par les joueurs. Si FALSE, le bonus est désactivé et ne sera pas distribué dans les mystery boxes';

-- Index pour optimiser les requêtes qui filtrent sur is_enabled
CREATE INDEX IF NOT EXISTS idx_super_bonuses_is_enabled ON super_bonuses(guild_id, is_enabled);
