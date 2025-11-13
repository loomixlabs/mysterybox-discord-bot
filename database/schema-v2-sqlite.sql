-- ============================================
-- BOT DISCORD GIVEAWAY - SCHÉMA V2 COMPLET
-- Version : Boîte mystère + Campagnes
-- ============================================

-- Supprimer les tables existantes
DROP TABLE IF EXISTS give_campaigns;
DROP TABLE IF EXISTS player_malus_points;
DROP TABLE IF EXISTS player_cooldowns;
DROP TABLE IF EXISTS theme_config;
DROP TABLE IF EXISTS missions;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS give_logs;
DROP TABLE IF EXISTS trap_triggered;
DROP TABLE IF EXISTS mission_progress;
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS player_progress;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS theme_messages;
DROP TABLE IF EXISTS traps;
DROP TABLE IF EXISTS collectibles;
DROP TABLE IF EXISTS themes;

-- ============================================
-- CONFIGURATION DES THÈMES
-- ============================================

CREATE TABLE themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  duration_days INTEGER NOT NULL,
  required_items INTEGER NOT NULL,
  final_role_name TEXT NOT NULL,
  final_role_color TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Configuration des probabilités par thème
CREATE TABLE theme_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL UNIQUE,
  probability_collectible INTEGER DEFAULT 50,
  probability_mission INTEGER DEFAULT 35,
  probability_trap INTEGER DEFAULT 15,
  mystery_box_image TEXT,
  mystery_box_title TEXT DEFAULT '🎁 BOÎTE MYSTÉRIEUSE',
  mystery_box_description TEXT DEFAULT 'Que contient-elle ?',
  FOREIGN KEY (theme_id) REFERENCES themes(id),
  CHECK (probability_collectible + probability_mission + probability_trap = 100)
);

-- ============================================
-- COLLECTIBLES
-- ============================================

CREATE TABLE collectibles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  collectible_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  rarity TEXT DEFAULT 'common', -- common, rare, epic, legendary
  reveal_message TEXT, -- Message personnalisé lors de la révélation
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (theme_id) REFERENCES themes(id),
  UNIQUE(theme_id, collectible_id)
);

-- ============================================
-- MISSIONS
-- ============================================

CREATE TABLE missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  mission_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'keyword-message', 'reaction-message', 'quiz', 'voice-join', 'message-count', 'reaction-count', 'manual'
  description TEXT NOT NULL,
  validation_type TEXT NOT NULL, -- 'auto', 'manual'
  validation_data TEXT, -- JSON: config de validation
  timeout INTEGER DEFAULT 30, -- en minutes
  image_url TEXT,
  reward_type TEXT DEFAULT 'random-collectible', -- random-collectible, specific-collectible, bonus-points
  reward_data TEXT, -- JSON: config de récompense
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (theme_id) REFERENCES themes(id)
);

-- ============================================
-- PIÈGES
-- ============================================

CREATE TABLE traps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  trap_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'cooldown', 'lose-collectible', 'public-shame', 'points-malus'
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,

  -- Pour type 'cooldown'
  cooldown_duration INTEGER, -- en minutes

  -- Pour type 'lose-collectible'
  removes_collectible INTEGER DEFAULT 0,

  -- Pour type 'public-shame'
  shame_message TEXT,
  shame_channel_id TEXT,

  -- Pour type 'points-malus'
  malus_points INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (theme_id) REFERENCES themes(id)
);

-- Messages personnalisables par thème
CREATE TABLE theme_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (theme_id) REFERENCES themes(id),
  UNIQUE(theme_id, key)
);

-- ============================================
-- JOUEURS ET PROGRESSION
-- ============================================

CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE player_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  theme_id INTEGER NOT NULL,
  collected_count INTEGER DEFAULT 0,
  is_completed INTEGER DEFAULT 0,
  completed_at TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (theme_id) REFERENCES themes(id),
  UNIQUE(player_id, theme_id)
);

CREATE TABLE collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  collectible_id INTEGER NOT NULL,
  collected_at TEXT DEFAULT (datetime('now')),
  source TEXT DEFAULT 'give', -- 'give', 'mission'
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (collectible_id) REFERENCES collectibles(id),
  UNIQUE(player_id, collectible_id)
);

-- ============================================
-- MISSIONS - PROGRESSION
-- ============================================

CREATE TABLE mission_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  mission_id INTEGER NOT NULL,
  thread_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
  submitted_proof TEXT,
  validated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

-- ============================================
-- PIÈGES - TRACKING
-- ============================================

CREATE TABLE player_cooldowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  trap_id INTEGER NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (trap_id) REFERENCES traps(id)
);

CREATE TABLE player_malus_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  theme_id INTEGER NOT NULL,
  points INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (theme_id) REFERENCES themes(id),
  UNIQUE(player_id, theme_id)
);

CREATE TABLE trap_triggered (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  trap_id INTEGER NOT NULL,
  triggered_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (trap_id) REFERENCES traps(id)
);

-- ============================================
-- CAMPAGNES DE GIVES
-- ============================================

CREATE TABLE give_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  campaign_type TEXT NOT NULL, -- 'burst', 'scheduled'
  mode TEXT NOT NULL, -- 'random', 'here'

  -- Pour burst
  burst_count INTEGER,
  burst_interval INTEGER, -- en secondes

  -- Pour scheduled
  scheduled_duration INTEGER, -- en minutes
  scheduled_interval INTEGER, -- en minutes

  -- Tracking
  total_gives_planned INTEGER NOT NULL,
  total_gives_posted INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running', -- 'running', 'paused', 'stopped', 'completed'

  admin_id TEXT NOT NULL,
  channel_id TEXT,
  category_id TEXT,

  started_at TEXT DEFAULT (datetime('now')),
  last_give_at TEXT,
  next_give_at TEXT,
  completed_at TEXT,

  FOREIGN KEY (theme_id) REFERENCES themes(id)
);

-- ============================================
-- LOGS ET AUDIT
-- ============================================

CREATE TABLE give_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  give_type TEXT NOT NULL, -- 'collectible', 'mission', 'trap'
  item_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  winner_id TEXT,
  winner_username TEXT,
  campaign_id INTEGER, -- Si fait partie d'une campagne
  created_at TEXT DEFAULT (datetime('now')),
  claimed_at TEXT,
  FOREIGN KEY (campaign_id) REFERENCES give_campaigns(id)
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================

CREATE INDEX idx_players_discord_id ON players(discord_id);
CREATE INDEX idx_collections_player ON collections(player_id);
CREATE INDEX idx_progress_player_theme ON player_progress(player_id, theme_id);
CREATE INDEX idx_give_logs_message ON give_logs(message_id);
CREATE INDEX idx_themes_active ON themes(is_active);
CREATE INDEX idx_collectibles_theme ON collectibles(theme_id);
CREATE INDEX idx_missions_theme ON missions(theme_id);
CREATE INDEX idx_traps_theme ON traps(theme_id);
CREATE INDEX idx_campaigns_status ON give_campaigns(status);
CREATE INDEX idx_cooldowns_active ON player_cooldowns(is_active, expires_at);
CREATE INDEX idx_mission_progress_status ON mission_progress(status);

-- ============================================
-- DONNÉES DE TEST
-- ============================================

-- Insérer le thème Blanche-Neige
INSERT INTO themes (theme_id, name, is_active, duration_days, required_items, final_role_name, final_role_color)
VALUES ('blanche-neige', 'Blanche-Neige et les 7 Nains', 1, 30, 7, '👸 Blanche-Neige', '#FFD700');

-- Configuration du thème
INSERT INTO theme_config (theme_id, probability_collectible, probability_mission, probability_trap)
SELECT id, 40, 40, 20 FROM themes WHERE theme_id = 'blanche-neige';

-- Messages par défaut
INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'mystery_box_button', '🎯 Ouvrir la boîte' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'collectible_obtained', '🎉 Félicitations ! Tu as trouvé **{name}** ! ({count}/{total})' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'mission_started', '📋 **MISSION DÉBLOQUÉE** : {name}' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'trap_triggered', '💀 **PIÈGE !** {name}' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'collection_complete', '👑 **INCROYABLE !** Tu as complété la collection ! Tu obtiens le rôle **{role}** !' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'duplicate_collectible', '⚠️ Tu as déjà **{name}** dans ta collection !' FROM themes WHERE theme_id = 'blanche-neige';

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Schema V2 created successfully!' AS status;
SELECT COUNT(*) AS theme_count FROM themes;
SELECT COUNT(*) AS config_count FROM theme_config;
SELECT COUNT(*) AS message_count FROM theme_messages;
