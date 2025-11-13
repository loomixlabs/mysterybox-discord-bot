-- Migration: Créer la table guild_admin_roles
-- Date: 2025-11-09
-- Description: Stocke les rôles Discord ayant accès à l'admin panel par serveur

-- Créer la table guild_admin_roles
CREATE TABLE IF NOT EXISTS guild_admin_roles (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  role_id VARCHAR(20) NOT NULL,
  added_by VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Contraintes
  UNIQUE(guild_id, role_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_guild_admin_roles_guild ON guild_admin_roles(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_admin_roles_role ON guild_admin_roles(role_id);

-- Commentaires
COMMENT ON TABLE guild_admin_roles IS 'Rôles Discord ayant accès à l''admin panel par serveur';
COMMENT ON COLUMN guild_admin_roles.guild_id IS 'ID du serveur Discord';
COMMENT ON COLUMN guild_admin_roles.role_id IS 'ID du rôle Discord';
COMMENT ON COLUMN guild_admin_roles.added_by IS 'ID de l''utilisateur qui a ajouté ce rôle';
