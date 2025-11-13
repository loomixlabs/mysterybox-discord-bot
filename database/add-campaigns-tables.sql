-- ============================================
-- AJOUT TABLES CAMPAGNES - Phase 2
-- ============================================

-- Table des campagnes
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('burst', 'schedule')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'stopped')),

  -- Burst mode
  total_count INTEGER,           -- Nombre total de boîtes à lancer
  launched_count INTEGER DEFAULT 0,  -- Nombre déjà lancées
  interval_seconds INTEGER,      -- Intervalle entre chaque boîte

  -- Schedule mode
  duration_days INTEGER,         -- Durée totale de la campagne
  frequency_hours INTEGER,       -- Fréquence de lancement (toutes les X heures)
  active_hours_start TEXT,       -- Format: 'HH:MM' (ex: '10:00')
  active_hours_end TEXT,         -- Format: 'HH:MM' (ex: '22:00')

  -- Commun
  target_channels TEXT,          -- JSON array des channel IDs
  channel_mode TEXT DEFAULT 'random' CHECK(channel_mode IN ('random', 'specific')),

  -- Métadonnées
  created_by TEXT NOT NULL,      -- Discord user ID
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,               -- Quand la campagne a démarré
  completed_at TEXT,             -- Quand elle s'est terminée

  FOREIGN KEY (theme_id) REFERENCES themes(id)
);

-- Table des lancements de campagne
CREATE TABLE IF NOT EXISTS campaign_launches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  message_id TEXT,               -- ID du message Discord de la boîte
  channel_id TEXT,               -- ID du salon où la boîte a été postée
  launched_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_theme ON campaigns(theme_id);
CREATE INDEX IF NOT EXISTS idx_campaign_launches_campaign ON campaign_launches(campaign_id);
