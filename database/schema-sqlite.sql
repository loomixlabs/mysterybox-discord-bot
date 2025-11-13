-- ============================================
-- BOT DISCORD GIVEAWAY - SCHÉMA SQLITE
-- ============================================

-- Supprimer les tables existantes (pour réinitialisation)
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

CREATE TABLE collectibles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  collectible_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role_name TEXT NOT NULL,
  role_color TEXT NOT NULL,
  role_discord_id TEXT,
  image_url TEXT NOT NULL,
  rarity TEXT DEFAULT 'common',
  has_mission INTEGER DEFAULT 0,
  mission_type TEXT,
  mission_desc TEXT,
  mission_timeout INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
  UNIQUE(theme_id, collectible_id)
);

CREATE TABLE traps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  trap_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  curse_role_name TEXT,
  curse_role_id TEXT,
  curse_duration INTEGER,
  riddle_question TEXT,
  riddle_answer TEXT,
  riddle_timeout INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
  UNIQUE(theme_id, trap_id)
);

CREATE TABLE theme_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
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
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
  UNIQUE(player_id, theme_id)
);

CREATE TABLE collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  collectible_id INTEGER NOT NULL,
  collected_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (collectible_id) REFERENCES collectibles(id) ON DELETE CASCADE,
  UNIQUE(player_id, collectible_id)
);

-- ============================================
-- MISSIONS
-- ============================================

CREATE TABLE mission_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  collectible_id INTEGER NOT NULL,
  thread_id TEXT,
  status TEXT DEFAULT 'pending',
  submitted_proof TEXT,
  validated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- ============================================
-- PIÈGES
-- ============================================

CREATE TABLE trap_triggered (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  trap_id INTEGER NOT NULL,
  triggered_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (trap_id) REFERENCES traps(id) ON DELETE CASCADE
);

-- ============================================
-- LOGS ET AUDIT
-- ============================================

CREATE TABLE give_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  give_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  winner_id TEXT,
  winner_username TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  claimed_at TEXT
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
CREATE INDEX idx_traps_theme ON traps(theme_id);

-- ============================================
-- DONNÉES DE TEST (OPTIONNEL)
-- ============================================

-- Insérer un thème de test
INSERT INTO themes (theme_id, name, is_active, duration_days, required_items, final_role_name, final_role_color)
VALUES ('blanche-neige', 'Blanche-Neige et les 7 Nains', 1, 30, 7, '👸 Blanche-Neige', '#FFD700');

-- Messages par défaut (récupérer l'ID du thème inséré)
INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'give_embed_title', '🎁 Un nain sauvage apparaît !' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'give_embed_description', 'Sois le premier à cliquer pour le capturer !' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'success_message', '✨ Félicitations ! Tu as capturé **{dwarf_name}** !' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'duplicate_message', '⚠️ Tu as déjà **{dwarf_name}** dans ta collection !' FROM themes WHERE theme_id = 'blanche-neige';

INSERT INTO theme_messages (theme_id, key, content)
SELECT id, 'complete_message', '👑 **INCROYABLE !** Tu as collecté les 7 nains ! Bienvenue dans l''élite, **Blanche-Neige** !' FROM themes WHERE theme_id = 'blanche-neige';

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Schema created successfully!' AS status;
SELECT COUNT(*) AS theme_count FROM themes;
SELECT COUNT(*) AS message_count FROM theme_messages;
