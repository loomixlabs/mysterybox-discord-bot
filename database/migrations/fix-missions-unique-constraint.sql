-- Migration: Corriger la contrainte UNIQUE sur missions
-- Date: 2025-11-09
--
-- PROBLÈME: La contrainte missions_guild_id_mission_id_key empêche plusieurs thèmes
-- dans le même serveur d'avoir des missions avec le même mission_id (ex: 'mot-devine', 'quiz')
--
-- SOLUTION: Remplacer UNIQUE (guild_id, mission_id) par UNIQUE (guild_id, theme_id, mission_id)
-- pour permettre à chaque thème d'avoir ses propres missions avec les mêmes mission_ids

BEGIN;

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE missions
DROP CONSTRAINT IF EXISTS missions_guild_id_mission_id_key;

-- 2. Ajouter la nouvelle contrainte (incluant theme_id)
ALTER TABLE missions
ADD CONSTRAINT missions_guild_id_theme_id_mission_id_key
UNIQUE (guild_id, theme_id, mission_id);

COMMIT;

-- Vérification: Afficher les nouvelles contraintes
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'missions'
AND n.nspname = 'public'
AND conname LIKE '%mission%'
ORDER BY conname;
