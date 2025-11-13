-- Migration: Trigger automatique pour mettre à jour player_progress.collected_count
-- Date: 2025-11-09
--
-- OBJECTIF: Synchroniser automatiquement collected_count avec le nombre réel
-- de collectibles DISTINCTS du joueur dans un thème
--
-- DÉCLENCHEURS:
-- - INSERT dans collections
-- - DELETE dans collections

BEGIN;

-- 1. Créer une fonction qui recalcule collected_count
CREATE OR REPLACE FUNCTION update_collected_count()
RETURNS TRIGGER AS $$
DECLARE
  v_theme_id INTEGER;
  v_new_count INTEGER;
BEGIN
  -- Déterminer le theme_id du collectible
  SELECT theme_id INTO v_theme_id
  FROM collectibles
  WHERE id = COALESCE(NEW.collectible_id, OLD.collectible_id);

  -- Si theme_id trouvé, mettre à jour player_progress
  IF v_theme_id IS NOT NULL THEN
    -- Calculer le nombre DISTINCT de collectibles du joueur pour ce thème
    SELECT COUNT(DISTINCT col.collectible_id) INTO v_new_count
    FROM collections col
    JOIN collectibles c ON col.collectible_id = c.id
    WHERE col.guild_id = COALESCE(NEW.guild_id, OLD.guild_id)
      AND col.player_id = COALESCE(NEW.player_id, OLD.player_id)
      AND c.theme_id = v_theme_id;

    -- Mettre à jour player_progress
    UPDATE player_progress
    SET collected_count = v_new_count
    WHERE guild_id = COALESCE(NEW.guild_id, OLD.guild_id)
      AND player_id = COALESCE(NEW.player_id, OLD.player_id)
      AND theme_id = v_theme_id;

    RAISE NOTICE 'Updated collected_count to % for player % in theme %',
      v_new_count,
      COALESCE(NEW.player_id, OLD.player_id),
      v_theme_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. Créer le trigger sur INSERT
DROP TRIGGER IF EXISTS trg_collections_insert_update_count ON collections;
CREATE TRIGGER trg_collections_insert_update_count
AFTER INSERT ON collections
FOR EACH ROW
EXECUTE FUNCTION update_collected_count();

-- 3. Créer le trigger sur DELETE
DROP TRIGGER IF EXISTS trg_collections_delete_update_count ON collections;
CREATE TRIGGER trg_collections_delete_update_count
AFTER DELETE ON collections
FOR EACH ROW
EXECUTE FUNCTION update_collected_count();

-- 4. Vérifier que les triggers sont créés
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'collections'
  AND trigger_name LIKE 'trg_collections%'
ORDER BY trigger_name;

COMMIT;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Triggers créés avec succès !';
  RAISE NOTICE '   - trg_collections_insert_update_count';
  RAISE NOTICE '   - trg_collections_delete_update_count';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Maintenant player_progress.collected_count sera automatiquement';
  RAISE NOTICE '   synchronisé quand un joueur obtient ou perd un collectible.';
END
$$;
