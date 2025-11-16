-- Migration: Ajouter colonnes de probabilités par rareté
-- Date: 2025-11-16
-- Raison: Système de sélection pondérée pour collectibles et super bonuses
--
-- Impact: Moyen - Ajoute 8 colonnes à theme_config
--
-- Colonnes ajoutées:
-- - Collectibles: collectible_rarity_legendary/epic/rare/common
-- - Super Bonuses: super_bonus_rarity_legendary/epic/rare/common
--
-- Valeurs par défaut:
-- - Plus le nombre est BAS, plus c'est RARE
-- - legendary (5) < epic (10) < rare (20) < common (40)

BEGIN;

-- ====================================================================
-- PROBABILITÉS PAR RARETÉ - COLLECTIBLES
-- ====================================================================

-- Legendary: Très rare (poids le plus faible)
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS collectible_rarity_legendary INTEGER DEFAULT 5;

-- Epic: Rare
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS collectible_rarity_epic INTEGER DEFAULT 10;

-- Rare: Peu commun
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS collectible_rarity_rare INTEGER DEFAULT 20;

-- Common: Commun (poids le plus élevé)
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS collectible_rarity_common INTEGER DEFAULT 40;

-- ====================================================================
-- PROBABILITÉS PAR RARETÉ - SUPER BONUSES
-- ====================================================================

-- Legendary: Très rare (poids le plus faible)
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS super_bonus_rarity_legendary INTEGER DEFAULT 5;

-- Epic: Rare
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS super_bonus_rarity_epic INTEGER DEFAULT 10;

-- Rare: Peu commun
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS super_bonus_rarity_rare INTEGER DEFAULT 20;

-- Common: Commun (poids le plus élevé)
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS super_bonus_rarity_common INTEGER DEFAULT 40;

-- ====================================================================
-- CONTRAINTES DE VALIDATION
-- ====================================================================

-- Contrainte: Tous les poids doivent être > 0 pour collectibles
ALTER TABLE theme_config
ADD CONSTRAINT collectible_rarity_weights_positive
CHECK (
  collectible_rarity_legendary > 0 AND
  collectible_rarity_epic > 0 AND
  collectible_rarity_rare > 0 AND
  collectible_rarity_common > 0
);

-- Contrainte: Tous les poids doivent être > 0 pour super bonuses
ALTER TABLE theme_config
ADD CONSTRAINT super_bonus_rarity_weights_positive
CHECK (
  super_bonus_rarity_legendary > 0 AND
  super_bonus_rarity_epic > 0 AND
  super_bonus_rarity_rare > 0 AND
  super_bonus_rarity_common > 0
);

-- ====================================================================
-- COMMENTAIRES
-- ====================================================================

COMMENT ON COLUMN theme_config.collectible_rarity_legendary IS 'Poids pour collectibles legendary (défaut: 5 = très rare)';
COMMENT ON COLUMN theme_config.collectible_rarity_epic IS 'Poids pour collectibles epic (défaut: 10 = rare)';
COMMENT ON COLUMN theme_config.collectible_rarity_rare IS 'Poids pour collectibles rare (défaut: 20 = peu commun)';
COMMENT ON COLUMN theme_config.collectible_rarity_common IS 'Poids pour collectibles common (défaut: 40 = commun)';

COMMENT ON COLUMN theme_config.super_bonus_rarity_legendary IS 'Poids pour super bonuses legendary (défaut: 5 = très rare)';
COMMENT ON COLUMN theme_config.super_bonus_rarity_epic IS 'Poids pour super bonuses epic (défaut: 10 = rare)';
COMMENT ON COLUMN theme_config.super_bonus_rarity_rare IS 'Poids pour super bonuses rare (défaut: 20 = peu commun)';
COMMENT ON COLUMN theme_config.super_bonus_rarity_common IS 'Poids pour super bonuses common (défaut: 40 = commun)';

COMMIT;

-- ====================================================================
-- NOTES D'UTILISATION
-- ====================================================================

-- Ces poids sont utilisés pour la sélection pondérée:
--
-- Exemple avec collectibles:
--   legendary (5) : 5 occurences dans le pool
--   epic (10)     : 10 occurences dans le pool
--   rare (20)     : 20 occurences dans le pool
--   common (40)   : 40 occurences dans le pool
--   TOTAL = 75 occurences
--
--   Probabilité legendary = 5/75 = 6.67%
--   Probabilité epic      = 10/75 = 13.33%
--   Probabilité rare      = 20/75 = 26.67%
--   Probabilité common    = 40/75 = 53.33%
--
-- Pour rendre un type PLUS rare: DIMINUER son poids
-- Pour rendre un type PLUS commun: AUGMENTER son poids
