-- Migration: Badge System (2025-11-20)
-- Description: Création du système de badges complet avec 3 tables
-- Tables: badges, player_badges, badge_progress

-- =====================================================
-- TABLE 1: badges (Définition des badges disponibles)
-- =====================================================
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL, -- Code couleur hex pour la rareté
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  category TEXT NOT NULL CHECK (category IN (
    'super_bonus',
    'collection',
    'rarity',
    'mystery_box',
    'trap',
    'mission',
    'engagement',
    'social',
    'special'
  )),

  -- Conditions de déblocage
  condition_type TEXT NOT NULL CHECK (condition_type IN (
    'super_bonus_usage',      -- Utiliser un super bonus X fois
    'super_bonus_unlock',     -- Débloquer un super bonus spécifique
    'collectible_count',      -- Collecter X collectibles
    'rarity_collect',         -- Collecter X items d'une rareté
    'mystery_box_open',       -- Ouvrir X mystery boxes
    'trap_survive',           -- Survivre à X pièges
    'trap_block',             -- Bloquer X pièges (via Bouclier)
    'mission_complete',       -- Compléter X missions
    'login_streak',           -- X jours consécutifs
    'custom'                  -- Condition personnalisée
  )),
  condition_target TEXT,      -- ID du super bonus, type de collectible, etc.
  condition_value INTEGER,    -- Nombre requis (ex: 10 pour "utiliser 10 fois")

  -- Affichage
  display_order INTEGER DEFAULT 0,
  is_secret BOOLEAN DEFAULT FALSE, -- Badge secret (caché jusqu'au déblocage)

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);
CREATE INDEX IF NOT EXISTS idx_badges_rarity ON badges(rarity);
CREATE INDEX IF NOT EXISTS idx_badges_condition ON badges(condition_type, condition_target);

-- =====================================================
-- TABLE 2: player_badges (Badges débloqués par joueurs)
-- =====================================================
CREATE TABLE IF NOT EXISTS player_badges (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,

  unlocked_at TIMESTAMP DEFAULT NOW(),
  unlocked_from TEXT, -- Source du déblocage (ex: "super_bonus_vision_divine")

  -- Contrainte d'unicité: un badge ne peut être débloqué qu'une fois par joueur par serveur
  UNIQUE(guild_id, player_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_player_badges_player ON player_badges(guild_id, player_id);
CREATE INDEX IF NOT EXISTS idx_player_badges_badge ON player_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_player_badges_unlocked ON player_badges(unlocked_at DESC);

-- =====================================================
-- TABLE 3: badge_progress (Progression vers déblocage)
-- =====================================================
CREATE TABLE IF NOT EXISTS badge_progress (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,

  current_value INTEGER DEFAULT 0,    -- Valeur actuelle (ex: 5 utilisations)
  target_value INTEGER NOT NULL,      -- Valeur cible (ex: 10 utilisations)

  -- Pourcentage calculé automatiquement
  percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN target_value > 0 THEN LEAST(100, (current_value::DECIMAL / target_value::DECIMAL) * 100)
      ELSE 0
    END
  ) STORED,

  started_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Contrainte d'unicité: une seule progression par badge par joueur par serveur
  UNIQUE(guild_id, player_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_badge_progress_player ON badge_progress(guild_id, player_id);
CREATE INDEX IF NOT EXISTS idx_badge_progress_badge ON badge_progress(badge_id);
CREATE INDEX IF NOT EXISTS idx_badge_progress_percentage ON badge_progress(percentage DESC);

-- =====================================================
-- FONCTION: Mise à jour automatique du timestamp updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_badge_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_badge_progress_timestamp
BEFORE UPDATE ON badge_progress
FOR EACH ROW
EXECUTE FUNCTION update_badge_progress_timestamp();

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON TABLE badges IS 'Définition de tous les badges disponibles dans le système';
COMMENT ON TABLE player_badges IS 'Badges débloqués par les joueurs (historique des achievements)';
COMMENT ON TABLE badge_progress IS 'Progression en temps réel vers le déblocage des badges';

COMMENT ON COLUMN badges.code IS 'Identifiant unique du badge (ex: VOYANT_DIVIN_APPRENTI)';
COMMENT ON COLUMN badges.condition_target IS 'ID ou code de la cible (ex: "vision_divine" pour un super bonus)';
COMMENT ON COLUMN badges.is_secret IS 'Si true, le badge est caché jusqu''au déblocage (easter egg)';

COMMENT ON COLUMN player_badges.unlocked_from IS 'Source du déblocage (ex: "super_bonus_id_5", "mystery_box_legendary")';

COMMENT ON COLUMN badge_progress.percentage IS 'Pourcentage calculé automatiquement (current_value / target_value * 100)';
