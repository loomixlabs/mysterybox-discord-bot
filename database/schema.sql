-- ============================================
-- BOT DISCORD GIVEAWAY - SCHÉMA POSTGRESQL
-- ============================================

-- Supprimer les tables existantes (pour réinitialisation)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS give_logs CASCADE;
DROP TABLE IF EXISTS trap_triggered CASCADE;
DROP TABLE IF EXISTS mission_progress CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS player_progress CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS theme_messages CASCADE;
DROP TABLE IF EXISTS traps CASCADE;
DROP TABLE IF EXISTS collectibles CASCADE;
DROP TABLE IF EXISTS themes CASCADE;

-- ============================================
-- CONFIGURATION DES THÈMES
-- ============================================

CREATE TABLE themes (
  id SERIAL PRIMARY KEY,
  theme_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  duration_days INTEGER NOT NULL,
  required_items INTEGER NOT NULL,
  final_role_name VARCHAR(100) NOT NULL,
  final_role_color VARCHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collectibles (
  id SERIAL PRIMARY KEY,
  theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
  collectible_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  role_color VARCHAR(7) NOT NULL,
  role_discord_id VARCHAR(50),
  image_url TEXT NOT NULL,
  rarity VARCHAR(20) DEFAULT 'common',
  has_mission BOOLEAN DEFAULT FALSE,
  mission_type VARCHAR(50),
  mission_desc TEXT,
  mission_timeout INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(theme_id, collectible_id)
);

CREATE TABLE traps (
  id SERIAL PRIMARY KEY,
  theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
  trap_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  curse_role_name VARCHAR(100),
  curse_role_id VARCHAR(50),
  curse_duration INTEGER,
  riddle_question TEXT,
  riddle_answer TEXT,
  riddle_timeout INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(theme_id, trap_id)
);

CREATE TABLE theme_messages (
  id SERIAL PRIMARY KEY,
  theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(theme_id, key)
);

-- ============================================
-- JOUEURS ET PROGRESSION
-- ============================================

CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(50) UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player_progress (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
  collected_count INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, theme_id)
);

CREATE TABLE collections (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  collectible_id INTEGER REFERENCES collectibles(id) ON DELETE CASCADE,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, collectible_id)
);

-- ============================================
-- MISSIONS
-- ============================================

CREATE TABLE mission_progress (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  collectible_id INTEGER NOT NULL,
  thread_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  submitted_proof TEXT,
  validated_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PIÈGES
-- ============================================

CREATE TABLE trap_triggered (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  trap_id INTEGER REFERENCES traps(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- ============================================
-- LOGS ET AUDIT
-- ============================================

CREATE TABLE give_logs (
  id SERIAL PRIMARY KEY,
  give_type VARCHAR(20) NOT NULL,
  item_id INTEGER NOT NULL,
  message_id VARCHAR(50) NOT NULL,
  channel_id VARCHAR(50) NOT NULL,
  winner_id VARCHAR(50),
  winner_username VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  admin_id VARCHAR(50) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
VALUES ('blanche-neige', 'Blanche-Neige et les 7 Nains', TRUE, 30, 7, '👸 Blanche-Neige', '#FFD700');

-- Récupérer l'ID du thème
DO $$
DECLARE
  theme_id_var INTEGER;
BEGIN
  SELECT id INTO theme_id_var FROM themes WHERE theme_id = 'blanche-neige';

  -- Messages par défaut
  INSERT INTO theme_messages (theme_id, key, content) VALUES
    (theme_id_var, 'give_embed_title', '🎁 Un nain sauvage apparaît !'),
    (theme_id_var, 'give_embed_description', 'Sois le premier à cliquer pour le capturer !'),
    (theme_id_var, 'success_message', '✨ Félicitations ! Tu as capturé **{dwarf_name}** !'),
    (theme_id_var, 'duplicate_message', '⚠️ Tu as déjà **{dwarf_name}** dans ta collection !'),
    (theme_id_var, 'complete_message', '👑 **INCROYABLE !** Tu as collecté les 7 nains ! Bienvenue dans l''élite, **Blanche-Neige** !');
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Schema created successfully!' AS status;
SELECT COUNT(*) AS theme_count FROM themes;
SELECT COUNT(*) AS message_count FROM theme_messages;
