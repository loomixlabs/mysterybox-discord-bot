-- Migration: Ajouter table give_channels
-- Date: 2025-10-31
-- Description: Table pour stocker les canaux et catégories configurés pour les gives

CREATE TABLE IF NOT EXISTS give_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('category', 'channel')),
  discord_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_category_id TEXT, -- Pour les canaux: ID de la catégorie parente (optionnel)
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT NOT NULL
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_give_channels_type ON give_channels(type);
CREATE INDEX IF NOT EXISTS idx_give_channels_discord_id ON give_channels(discord_id);
CREATE INDEX IF NOT EXISTS idx_give_channels_parent ON give_channels(parent_category_id);
