-- Migration: Ajouter les champs is_default et is_active à la table traps
-- Date: 2025-11-10
-- Description: Permet de gérer les pièges par défaut et leur activation/désactivation

-- Ajouter le champ is_default (identifie les pièges créés automatiquement)
ALTER TABLE traps
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Ajouter le champ is_active (permet d'activer/désactiver les pièges)
ALTER TABLE traps
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Marquer les pièges existants comme non-default et actifs
UPDATE traps
SET is_default = FALSE, is_active = TRUE
WHERE is_default IS NULL OR is_active IS NULL;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_traps_active ON traps(guild_id, theme_id, is_active);
CREATE INDEX IF NOT EXISTS idx_traps_default ON traps(guild_id, theme_id, is_default);

-- Afficher le résultat
SELECT
    COUNT(*) FILTER (WHERE is_default = TRUE) as default_traps,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_traps,
    COUNT(*) as total_traps
FROM traps;
