-- Migration: Ajout des paramètres de notification pour les threads de mission
-- Date: 2025-11-22
-- Description: Permet de configurer les pings et ajouts au thread pour chaque niveau de permission

-- Colonnes pour Super Admins
ALTER TABLE guild_config
ADD COLUMN IF NOT EXISTS notify_super_admins_thread BOOLEAN DEFAULT TRUE;

ALTER TABLE guild_config
ADD COLUMN IF NOT EXISTS notify_super_admins_mention BOOLEAN DEFAULT FALSE;

-- Colonnes pour Propriétaire du serveur
ALTER TABLE guild_config
ADD COLUMN IF NOT EXISTS notify_owner_thread BOOLEAN DEFAULT TRUE;

ALTER TABLE guild_config
ADD COLUMN IF NOT EXISTS notify_owner_mention BOOLEAN DEFAULT FALSE;

-- Colonnes pour Co-fondateurs
ALTER TABLE guild_config
ADD COLUMN IF NOT EXISTS notify_cofounders_thread BOOLEAN DEFAULT TRUE;

ALTER TABLE guild_config
ADD COLUMN IF NOT EXISTS notify_cofounders_mention BOOLEAN DEFAULT TRUE;

-- Commentaires pour documenter les colonnes
COMMENT ON COLUMN guild_config.notify_super_admins_thread IS 'Ajouter les super admins aux threads de mission';
COMMENT ON COLUMN guild_config.notify_super_admins_mention IS 'Mentionner (@) les super admins dans les threads';
COMMENT ON COLUMN guild_config.notify_owner_thread IS 'Ajouter le propriétaire du serveur aux threads de mission';
COMMENT ON COLUMN guild_config.notify_owner_mention IS 'Mentionner (@) le propriétaire dans les threads';
COMMENT ON COLUMN guild_config.notify_cofounders_thread IS 'Ajouter les co-fondateurs aux threads de mission';
COMMENT ON COLUMN guild_config.notify_cofounders_mention IS 'Mentionner (@) les co-fondateurs dans les threads';
