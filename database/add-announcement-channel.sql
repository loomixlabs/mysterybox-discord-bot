-- Table pour le canal d'annonces
CREATE TABLE IF NOT EXISTS announcement_channel (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id TEXT UNIQUE NOT NULL,
  channel_name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Configuration des types d'annonces activées
CREATE TABLE IF NOT EXISTS announcement_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  legendary_collectible BOOLEAN DEFAULT 1,
  collection_completed BOOLEAN DEFAULT 1,
  collection_traded BOOLEAN DEFAULT 1,
  collection_lost BOOLEAN DEFAULT 1,
  trap_curse BOOLEAN DEFAULT 1,
  mission_word_guessed BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insérer les valeurs par défaut pour announcement_settings
INSERT OR IGNORE INTO announcement_settings (id) VALUES (1);
