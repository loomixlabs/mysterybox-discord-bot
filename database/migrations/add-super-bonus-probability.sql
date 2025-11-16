-- Migration: Ajouter probabilité super_bonus dans theme_config
-- Date: 2025-11-16
-- Raison: Intégrer les super bonus comme 4ème type de contenu dans mystery boxes
--
-- Impact: Modéré - Réajuste les probabilités existantes pour maintenir total = 100%

BEGIN;

-- 1. DROP contraintes existantes temporairement
ALTER TABLE theme_config
DROP CONSTRAINT IF EXISTS theme_config_check;

ALTER TABLE theme_config
DROP CONSTRAINT IF EXISTS check_probabilities_sum_100;

-- 2. Ajouter colonne probability_super_bonus SANS DEFAULT
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS probability_super_bonus INTEGER;

-- 3. Réajuster les probabilités pour GARANTIR 100%
-- Approche: UPDATE spécifique par configuration existante

-- Config type 1: 70/30/0 → 55/35/0/10
UPDATE theme_config
SET
  probability_super_bonus = 10,
  probability_collectible = 55,
  probability_mission = 35,
  probability_trap = 0
WHERE probability_collectible = 70
  AND probability_mission = 30
  AND probability_trap = 0
  AND probability_super_bonus IS NULL;

-- Config type 2: 40/40/20 → 25/35/30/10
UPDATE theme_config
SET
  probability_super_bonus = 10,
  probability_collectible = 25,
  probability_mission = 35,
  probability_trap = 30
WHERE probability_collectible = 40
  AND probability_mission = 40
  AND probability_trap = 20
  AND probability_super_bonus IS NULL;

-- Config type 3: 50/25/25 → 35/35/20/10
UPDATE theme_config
SET
  probability_super_bonus = 10,
  probability_collectible = 35,
  probability_mission = 35,
  probability_trap = 20
WHERE probability_collectible = 50
  AND probability_mission = 25
  AND probability_trap = 25
  AND probability_super_bonus IS NULL;

-- Config générique: Réduire collectible proportionnellement
UPDATE theme_config
SET
  probability_super_bonus = 10,
  probability_collectible = GREATEST(probability_collectible - 10, 10),
  probability_mission = probability_mission,
  probability_trap = probability_trap
WHERE probability_super_bonus IS NULL;

-- 4. Définir DEFAULT 10 pour futures insertions
ALTER TABLE theme_config
ALTER COLUMN probability_super_bonus SET DEFAULT 10;

-- 5. Ajouter nouvelle contrainte CHECK
ALTER TABLE theme_config
ADD CONSTRAINT check_probabilities_sum_100
CHECK (
  probability_collectible +
  probability_mission +
  probability_trap +
  COALESCE(probability_super_bonus, 0) = 100
);

-- 4. Vérification post-migration
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM theme_config
  WHERE (
    probability_collectible +
    probability_mission +
    probability_trap +
    COALESCE(probability_super_bonus, 0)
  ) != 100;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION '❌ Migration échouée: % theme_config ont une somme != 100%%', invalid_count;
  END IF;

  RAISE NOTICE '✅ Migration réussie: Toutes les probabilités = 100%%';
END $$;

COMMIT;
