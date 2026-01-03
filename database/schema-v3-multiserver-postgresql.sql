-- ============================================
-- BOT DISCORD GIVEAWAY - SCHÉMA V3 MULTI-SERVEUR
-- Version : PostgreSQL + Multi-guilds + Interface Super-Admin
-- Date : 2025-11-03
-- ============================================

-- Ce schéma supporte plusieurs serveurs Discord avec isolation complète des données
-- Chaque serveur (guild) a ses propres thèmes, collectibles, joueurs, etc.

-- ============================================
-- GESTION MULTI-SERVEUR
-- ============================================

-- Super administrateurs du bot (vous et votre associé)
CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK(role IN ('owner', 'admin')), -- owner = vous, admin = associé
  added_at TIMESTAMP DEFAULT NOW(),
  added_by TEXT
);

-- Configuration globale par serveur Discord
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  guild_name TEXT NOT NULL,

  -- Statut du bot sur ce serveur
  is_active BOOLEAN DEFAULT TRUE,
  is_trial BOOLEAN DEFAULT FALSE,
  trial_expires_at TIMESTAMP,

  -- Configuration des rôles
  co_founder_role_id TEXT,

  -- Limite de joueurs (pour version freemium)
  max_players INTEGER DEFAULT NULL, -- NULL = illimité

  -- Métadonnées
  owner_id TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  activated_at TIMESTAMP DEFAULT NOW(),
  deactivated_at TIMESTAMP,
  last_activity TIMESTAMP DEFAULT NOW(),

  -- Notes administratives
  notes TEXT
);

-- Statistiques par serveur
CREATE TABLE IF NOT EXISTS guild_stats (
  guild_id TEXT PRIMARY KEY REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  total_players INTEGER DEFAULT 0,
  total_gives INTEGER DEFAULT 0,
  total_campaigns INTEGER DEFAULT 0,
  total_collections INTEGER DEFAULT 0,
  last_give_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CONFIGURATION DES THÈMES
-- ============================================

CREATE TABLE IF NOT EXISTS themes (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  duration_days INTEGER NOT NULL,
  required_items INTEGER NOT NULL,
  final_role_name TEXT NOT NULL,
  final_role_color TEXT NOT NULL,
  final_role_discord_id TEXT, -- ID du rôle Discord final
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, theme_id)
);

-- Configuration des probabilités par thème
CREATE TABLE IF NOT EXISTS theme_config (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  probability_collectible INTEGER DEFAULT 50,
  probability_mission INTEGER DEFAULT 35,
  probability_trap INTEGER DEFAULT 15,
  mystery_box_image TEXT,
  mystery_box_title TEXT DEFAULT '🎁 BOÎTE MYSTÉRIEUSE',
  mystery_box_description TEXT DEFAULT 'Que contient-elle ?',
  CHECK (probability_collectible + probability_mission + probability_trap = 100),
  UNIQUE(guild_id, theme_id)
);

-- Messages personnalisables par thème
CREATE TABLE IF NOT EXISTS theme_messages (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(guild_id, theme_id, key)
);

-- ============================================
-- COLLECTIBLES
-- ============================================

CREATE TABLE IF NOT EXISTS collectibles (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  collectible_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  rarity TEXT DEFAULT 'common' CHECK(rarity IN ('common', 'rare', 'epic', 'legendary')),
  reveal_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, theme_id, collectible_id)
);

-- ============================================
-- MISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('keyword-message', 'reaction-message', 'quiz', 'voice-join', 'message-count', 'reaction-count', 'manual')),
  description TEXT NOT NULL,
  validation_type TEXT NOT NULL CHECK(validation_type IN ('auto', 'manual')),
  validation_data JSONB,
  timeout INTEGER DEFAULT 30,
  image_url TEXT,
  reward_type TEXT DEFAULT 'random-collectible' CHECK(reward_type IN ('random-collectible', 'specific-collectible', 'bonus-points')),
  reward_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, mission_id)
);

-- ============================================
-- PIÈGES
-- ============================================

CREATE TABLE IF NOT EXISTS traps (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  trap_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('cooldown', 'lose-collectible', 'public-shame', 'points-malus')),
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,

  -- Pour type 'cooldown'
  cooldown_duration INTEGER,

  -- Pour type 'lose-collectible'
  removes_collectible BOOLEAN DEFAULT FALSE,

  -- Pour type 'public-shame'
  shame_message TEXT,
  shame_channel_id TEXT,

  -- Pour type 'points-malus'
  malus_points INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, trap_id)
);

-- ============================================
-- SUPER BONUS
-- ============================================

CREATE TABLE IF NOT EXISTS super_bonuses (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  bonus_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,

  -- Catégorisation
  bonus_type TEXT NOT NULL CHECK(bonus_type IN ('boost', 'social', 'protection', 'time', 'economy')),
  effect_type TEXT NOT NULL CHECK(effect_type IN ('probability', 'cosmetic', 'protection', 'cooldown', 'reveal', 'transfer', 'rarity_boost', 'multiplier', 'detector', 'voice')),

  -- Configuration de l'effet
  effect_config JSONB,

  -- Durée et limites
  duration_type TEXT NOT NULL CHECK(duration_type IN ('temporary', 'charges', 'permanent')),
  duration_value INTEGER,

  -- Visuels
  image_url TEXT,
  color TEXT DEFAULT '#3498db',

  -- Méta
  rarity TEXT DEFAULT 'common' CHECK(rarity IN ('common', 'rare', 'epic', 'legendary')),
  theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
  announcement_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  CHECK (
    (duration_type = 'temporary' AND duration_value > 0) OR
    (duration_type = 'charges' AND duration_value > 0) OR
    (duration_type = 'permanent' AND duration_value IS NULL)
  ),
  UNIQUE(guild_id, bonus_id)
);

-- ============================================
-- JOUEURS ET PROGRESSION
-- ============================================

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, discord_id)
);

CREATE TABLE IF NOT EXISTS player_progress (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  collected_count INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  started_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, player_id, theme_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  collectible_id INTEGER NOT NULL REFERENCES collectibles(id) ON DELETE CASCADE,
  collected_at TIMESTAMP DEFAULT NOW(),
  source TEXT DEFAULT 'give' CHECK(source IN ('give', 'mission')),
  UNIQUE(guild_id, player_id, collectible_id)
);

-- Bonus actifs des joueurs
CREATE TABLE IF NOT EXISTS player_active_bonuses (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  bonus_id INTEGER NOT NULL REFERENCES super_bonuses(id) ON DELETE CASCADE,

  -- Tracking temporel
  activated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,

  -- Tracking charges
  remaining_charges INTEGER,

  -- État
  is_active BOOLEAN DEFAULT TRUE,
  used_at TIMESTAMP,

  -- Contexte
  obtained_from TEXT,
  given_by TEXT
);

-- Historique des utilisations de bonus
CREATE TABLE IF NOT EXISTS bonus_usage_history (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  bonus_id INTEGER NOT NULL REFERENCES super_bonuses(id) ON DELETE SET NULL,
  used_at TIMESTAMP DEFAULT NOW(),
  effect_result JSONB,
  trigger_type TEXT,
  related_event_id INTEGER
);

-- ============================================
-- MISSIONS - PROGRESSION
-- ============================================

CREATE TABLE IF NOT EXISTS mission_progress (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  thread_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
  submitted_proof TEXT,
  validated_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ============================================
-- PIÈGES - TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS player_cooldowns (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  trap_id INTEGER NOT NULL REFERENCES traps(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS player_malus_points (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, player_id, theme_id)
);

CREATE TABLE IF NOT EXISTS trap_triggered (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  trap_id INTEGER NOT NULL REFERENCES traps(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CAMPAGNES DE GIVES
-- ============================================

CREATE TABLE IF NOT EXISTS give_campaigns (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK(campaign_type IN ('burst', 'scheduled')),
  mode TEXT NOT NULL CHECK(mode IN ('random', 'here', 'specific')),

  -- Pour burst
  burst_count INTEGER,
  burst_interval INTEGER,

  -- Pour scheduled
  scheduled_duration INTEGER,
  scheduled_interval INTEGER,

  -- Tracking
  total_gives_planned INTEGER NOT NULL,
  total_gives_posted INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running' CHECK(status IN ('running', 'paused', 'stopped', 'completed')),

  admin_id TEXT NOT NULL,
  channel_id TEXT,
  category_id TEXT,

  started_at TIMESTAMP DEFAULT NOW(),
  last_give_at TIMESTAMP,
  next_give_at TIMESTAMP,
  completed_at TIMESTAMP,

  UNIQUE(guild_id, campaign_id)
);

-- ============================================
-- CONFIGURATION DES CANAUX
-- ============================================

CREATE TABLE IF NOT EXISTS give_channels (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('category', 'channel')),
  discord_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_category_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT NOT NULL,
  UNIQUE(guild_id, discord_id)
);

CREATE TABLE IF NOT EXISTS announcement_channel (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_settings (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  -- Collections
  legendary_collectible BOOLEAN DEFAULT TRUE,
  collection_completed BOOLEAN DEFAULT TRUE,
  collection_traded BOOLEAN DEFAULT TRUE,
  collection_lost BOOLEAN DEFAULT TRUE,
  -- Pièges
  trap_cooldown BOOLEAN DEFAULT TRUE,
  trap_lose_collectible BOOLEAN DEFAULT TRUE,
  trap_public_shame BOOLEAN DEFAULT TRUE,
  trap_empty_box BOOLEAN DEFAULT TRUE,
  trap_lose_all_collectibles BOOLEAN DEFAULT TRUE,
  -- Missions
  mission_word_guessed BOOLEAN DEFAULT TRUE,
  mission_started BOOLEAN DEFAULT TRUE,
  mission_completed BOOLEAN DEFAULT TRUE,
  mission_failed BOOLEAN DEFAULT TRUE,
  mission_approved BOOLEAN DEFAULT TRUE,
  mission_rejected BOOLEAN DEFAULT TRUE,
  -- Thèmes
  theme_expired BOOLEAN DEFAULT TRUE,
  theme_expiring_soon BOOLEAN DEFAULT TRUE,
  -- Super Bonus
  legendary_super_bonus BOOLEAN DEFAULT TRUE,
  super_bonus_joker_used BOOLEAN DEFAULT TRUE,
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_templates (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT DEFAULT '#3498db',
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, type)
);

-- ============================================
-- LOGS ET AUDIT
-- ============================================

CREATE TABLE IF NOT EXISTS give_logs (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  give_type TEXT NOT NULL CHECK(give_type IN ('collectible', 'mission', 'trap', 'super_bonus')),
  item_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  winner_id TEXT,
  winner_username TEXT,
  campaign_id INTEGER REFERENCES give_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  claimed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  guild_id TEXT REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Logs spécifiques aux super-admins
CREATE TABLE IF NOT EXISTS super_admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_guild_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================

-- Guilds
CREATE INDEX idx_guild_config_active ON guild_config(is_active);
CREATE INDEX idx_guild_config_trial ON guild_config(is_trial, trial_expires_at) WHERE is_trial = TRUE;

-- Themes
CREATE INDEX idx_themes_guild ON themes(guild_id);
CREATE INDEX idx_themes_active ON themes(guild_id, is_active);
CREATE INDEX idx_theme_config_guild ON theme_config(guild_id);

-- Collectibles
CREATE INDEX idx_collectibles_guild ON collectibles(guild_id);
CREATE INDEX idx_collectibles_theme ON collectibles(guild_id, theme_id);
CREATE INDEX idx_collectibles_rarity ON collectibles(guild_id, rarity);

-- Missions
CREATE INDEX idx_missions_guild ON missions(guild_id);
CREATE INDEX idx_missions_theme ON missions(guild_id, theme_id);

-- Traps
CREATE INDEX idx_traps_guild ON traps(guild_id);
CREATE INDEX idx_traps_theme ON traps(guild_id, theme_id);

-- Super Bonuses
CREATE INDEX idx_super_bonuses_guild ON super_bonuses(guild_id);
CREATE INDEX idx_super_bonuses_theme ON super_bonuses(guild_id, theme_id);

-- Players
CREATE INDEX idx_players_guild ON players(guild_id);
CREATE INDEX idx_players_discord_id ON players(guild_id, discord_id);

-- Collections
CREATE INDEX idx_collections_guild ON collections(guild_id);
CREATE INDEX idx_collections_player ON collections(guild_id, player_id);

-- Player Progress
CREATE INDEX idx_progress_guild ON player_progress(guild_id);
CREATE INDEX idx_progress_player_theme ON player_progress(guild_id, player_id, theme_id);

-- Player Active Bonuses
CREATE INDEX idx_active_bonuses_guild ON player_active_bonuses(guild_id);
CREATE INDEX idx_active_bonuses_user ON player_active_bonuses(guild_id, user_id, is_active);
CREATE INDEX idx_active_bonuses_expires ON player_active_bonuses(expires_at) WHERE is_active = TRUE AND expires_at IS NOT NULL;

-- Mission Progress
CREATE INDEX idx_mission_progress_guild ON mission_progress(guild_id);
CREATE INDEX idx_mission_progress_status ON mission_progress(guild_id, status);

-- Cooldowns
CREATE INDEX idx_cooldowns_guild ON player_cooldowns(guild_id);
CREATE INDEX idx_cooldowns_active ON player_cooldowns(guild_id, is_active, expires_at);

-- Campaigns
CREATE INDEX idx_campaigns_guild ON give_campaigns(guild_id);
CREATE INDEX idx_campaigns_status ON give_campaigns(guild_id, status);

-- Give Channels
CREATE INDEX idx_give_channels_guild ON give_channels(guild_id);
CREATE INDEX idx_give_channels_type ON give_channels(guild_id, type);

-- Logs
CREATE INDEX idx_give_logs_guild ON give_logs(guild_id);
CREATE INDEX idx_give_logs_message ON give_logs(message_id);
CREATE INDEX idx_audit_logs_guild ON audit_logs(guild_id);
CREATE INDEX idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX idx_super_admin_logs_admin ON super_admin_logs(admin_id);
CREATE INDEX idx_super_admin_logs_created ON super_admin_logs(created_at);

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE guild_config IS 'Configuration et statut de chaque serveur Discord utilisant le bot';
COMMENT ON TABLE super_admins IS 'Développeurs ayant accès à l''interface de gestion globale';
COMMENT ON TABLE themes IS 'Thèmes de collection par serveur (isolés par guild_id)';
COMMENT ON TABLE super_bonuses IS 'Super pouvoirs temporaires/permanents par serveur';
COMMENT ON TABLE guild_stats IS 'Statistiques agrégées par serveur pour monitoring';

-- ============================================
-- FIN DU SCHÉMA V3
-- ============================================

SELECT 'Schema V3 Multi-serveur PostgreSQL créé avec succès!' AS status;
