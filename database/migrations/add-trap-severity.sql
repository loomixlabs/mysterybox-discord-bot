-- ============================================================
-- Migration: Système de Sévérité des Pièges
-- Date: 2024-12-14
-- Version: 1.0.0
-- Description: Ajoute une sévérité (1-5) aux pièges avec
--              probabilités configurables par thème
-- ============================================================

-- ============================================================
-- ÉTAPE 1: Ajouter la colonne severity à la table traps
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traps' AND column_name = 'severity'
  ) THEN
    ALTER TABLE traps
    ADD COLUMN severity INTEGER DEFAULT 3
    CHECK (severity >= 1 AND severity <= 5);

    RAISE NOTICE '✅ Colonne severity ajoutée à la table traps';
  ELSE
    RAISE NOTICE '⏭️ Colonne severity existe déjà dans traps';
  END IF;
END
$$;

-- ============================================================
-- ÉTAPE 2: Ajouter les colonnes de configuration à theme_config
-- ============================================================

-- trap_severity_1 (Minor - 45% par défaut)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_config' AND column_name = 'trap_severity_1'
  ) THEN
    ALTER TABLE theme_config ADD COLUMN trap_severity_1 INTEGER DEFAULT 45;
    RAISE NOTICE '✅ Colonne trap_severity_1 ajoutée';
  ELSE
    RAISE NOTICE '⏭️ Colonne trap_severity_1 existe déjà';
  END IF;
END
$$;

-- trap_severity_2 (Low - 30% par défaut)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_config' AND column_name = 'trap_severity_2'
  ) THEN
    ALTER TABLE theme_config ADD COLUMN trap_severity_2 INTEGER DEFAULT 30;
    RAISE NOTICE '✅ Colonne trap_severity_2 ajoutée';
  ELSE
    RAISE NOTICE '⏭️ Colonne trap_severity_2 existe déjà';
  END IF;
END
$$;

-- trap_severity_3 (Medium - 15% par défaut)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_config' AND column_name = 'trap_severity_3'
  ) THEN
    ALTER TABLE theme_config ADD COLUMN trap_severity_3 INTEGER DEFAULT 15;
    RAISE NOTICE '✅ Colonne trap_severity_3 ajoutée';
  ELSE
    RAISE NOTICE '⏭️ Colonne trap_severity_3 existe déjà';
  END IF;
END
$$;

-- trap_severity_4 (High - 8% par défaut)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_config' AND column_name = 'trap_severity_4'
  ) THEN
    ALTER TABLE theme_config ADD COLUMN trap_severity_4 INTEGER DEFAULT 8;
    RAISE NOTICE '✅ Colonne trap_severity_4 ajoutée';
  ELSE
    RAISE NOTICE '⏭️ Colonne trap_severity_4 existe déjà';
  END IF;
END
$$;

-- trap_severity_5 (Extreme - 2% par défaut)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_config' AND column_name = 'trap_severity_5'
  ) THEN
    ALTER TABLE theme_config ADD COLUMN trap_severity_5 INTEGER DEFAULT 2;
    RAISE NOTICE '✅ Colonne trap_severity_5 ajoutée';
  ELSE
    RAISE NOTICE '⏭️ Colonne trap_severity_5 existe déjà';
  END IF;
END
$$;

-- ============================================================
-- ÉTAPE 3: Migrer les pièges existants (assigner sévérité par type)
-- ============================================================

-- Assigner sévérité par défaut selon le type de piège
UPDATE traps SET severity =
  CASE type
    WHEN 'empty-box' THEN 1              -- Minor
    WHEN 'cooldown' THEN 2               -- Low
    WHEN 'points-malus' THEN 2           -- Low
    WHEN 'lose-collectible' THEN 3       -- Medium
    WHEN 'public-shame' THEN 3           -- Medium
    WHEN 'lose-all-collectibles' THEN 5  -- Extreme
    ELSE 3                               -- Medium par défaut
  END
WHERE severity IS NULL OR severity = 0;

-- ============================================================
-- ÉTAPE 4: Mettre à jour les thèmes existants avec valeurs par défaut
-- ============================================================

UPDATE theme_config
SET
  trap_severity_1 = COALESCE(trap_severity_1, 45),
  trap_severity_2 = COALESCE(trap_severity_2, 30),
  trap_severity_3 = COALESCE(trap_severity_3, 15),
  trap_severity_4 = COALESCE(trap_severity_4, 8),
  trap_severity_5 = COALESCE(trap_severity_5, 2);

-- ============================================================
-- ÉTAPE 5: Vérification
-- ============================================================

DO $$
DECLARE
  traps_with_severity INTEGER;
  themes_with_config INTEGER;
BEGIN
  -- Compter les pièges avec sévérité
  SELECT COUNT(*) INTO traps_with_severity
  FROM traps WHERE severity IS NOT NULL;

  -- Compter les thèmes avec config
  SELECT COUNT(*) INTO themes_with_config
  FROM theme_config WHERE trap_severity_1 IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ MIGRATION TERMINÉE - Système de Sévérité des Pièges';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '📊 Pièges avec sévérité: %', traps_with_severity;
  RAISE NOTICE '📊 Thèmes avec config: %', themes_with_config;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Distribution par sévérité:';
END
$$;

-- Afficher la distribution finale
SELECT
  severity,
  CASE severity
    WHEN 1 THEN '⭐ Minor'
    WHEN 2 THEN '⭐⭐ Low'
    WHEN 3 THEN '⭐⭐⭐ Medium'
    WHEN 4 THEN '⭐⭐⭐⭐ High'
    WHEN 5 THEN '⭐⭐⭐⭐⭐ Extreme'
  END as label,
  COUNT(*) as count
FROM traps
WHERE severity IS NOT NULL
GROUP BY severity
ORDER BY severity;
