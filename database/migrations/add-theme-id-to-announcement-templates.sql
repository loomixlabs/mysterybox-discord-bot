-- Migration: Ajouter theme_id aux announcement_templates
-- Date: 2025-11-22
-- Description: Permet de lier les templates d'annonces aux thèmes
--              - theme_id NULL = template global (fallback)
--              - theme_id = X = template spécifique au thème

-- 1. Ajouter colonne theme_id (nullable pour backward compatibility)
ALTER TABLE announcement_templates
ADD COLUMN IF NOT EXISTS theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE;

-- 2. Créer index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_announcement_templates_theme_id
ON announcement_templates(theme_id);

-- 3. Créer index composé pour la recherche optimisée
CREATE INDEX IF NOT EXISTS idx_announcement_templates_guild_type_theme
ON announcement_templates(guild_id, type, theme_id);

-- 4. Mettre à jour la contrainte unique pour permettre:
--    - Un template global par type par guild (theme_id NULL)
--    - Un template par type par thème par guild (theme_id NOT NULL)
-- Note: PostgreSQL gère les NULL comme distincts dans les contraintes UNIQUE

-- Vérifier si la contrainte existe avant de la supprimer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'announcement_templates_guild_id_type_key'
  ) THEN
    ALTER TABLE announcement_templates
    DROP CONSTRAINT announcement_templates_guild_id_type_key;
  END IF;
END $$;

-- Créer la nouvelle contrainte unique incluant theme_id
-- Cette contrainte permet:
--   - (guild_id=1, type='X', theme_id=NULL) - template global
--   - (guild_id=1, type='X', theme_id=1) - template pour thème 1
--   - (guild_id=1, type='X', theme_id=2) - template pour thème 2
ALTER TABLE announcement_templates
ADD CONSTRAINT announcement_templates_guild_type_theme_unique
UNIQUE (guild_id, type, theme_id);

-- 5. Commenter la colonne pour documentation
COMMENT ON COLUMN announcement_templates.theme_id IS
'ID du thème associé. NULL = template global utilisé comme fallback quand pas de template spécifique au thème actif';
