-- Migration: Ajouter les templates d'annonces pour les 4 types de pièges
-- Date: 2025-11-10
-- Description: Crée les templates d'annonces spécifiques pour chaque type de piège (par guild)

-- Ajouter les colonnes pour les nouveaux types dans announcement_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcement_settings' AND column_name = 'trap_cooldown') THEN
    ALTER TABLE announcement_settings ADD COLUMN trap_cooldown BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcement_settings' AND column_name = 'trap_lose_collectible') THEN
    ALTER TABLE announcement_settings ADD COLUMN trap_lose_collectible BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcement_settings' AND column_name = 'trap_public_shame') THEN
    ALTER TABLE announcement_settings ADD COLUMN trap_public_shame BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcement_settings' AND column_name = 'trap_malus_points') THEN
    ALTER TABLE announcement_settings ADD COLUMN trap_malus_points BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Insérer les 4 templates de pièges pour TOUS les guilds qui ont déjà des templates

-- Template 1: Piège Cooldown (pour chaque guild)
INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
SELECT DISTINCT
  guild_id,
  'trap_cooldown',
  '⏱️ Piège de Cooldown Déclenché !',
  '**{userName}** est tombé dans un piège !\n\n🎯 **Piège:** {trapName}\n⏱️ **Effet:** Cooldown de **{cooldownMinutes} minutes**\n\n💡 Il ne pourra pas ouvrir de boîtes mystère pendant un moment...',
  '#f39c12',
  'Système de Pièges'
FROM announcement_templates
WHERE NOT EXISTS (
  SELECT 1 FROM announcement_templates at2
  WHERE at2.guild_id = announcement_templates.guild_id
  AND at2.type = 'trap_cooldown'
);

-- Template 2: Piège Perte de Collectible (pour chaque guild)
INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
SELECT DISTINCT
  guild_id,
  'trap_lose_collectible',
  '💀 Piège Voleur Activé !',
  '**{userName}** a perdu un collectible !\n\n🎯 **Piège:** {trapName}\n🎁 **Objet perdu:** {collectibleLost}\n\n⚠️ Un piège vicieux lui a volé un objet de sa collection !',
  '#e74c3c',
  'Système de Pièges'
FROM announcement_templates
WHERE NOT EXISTS (
  SELECT 1 FROM announcement_templates at2
  WHERE at2.guild_id = announcement_templates.guild_id
  AND at2.type = 'trap_lose_collectible'
);

-- Template 3: Piège Public Shame (pour chaque guild)
INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
SELECT DISTINCT
  guild_id,
  'trap_public_shame',
  '😱 Piège de la Honte !',
  '**{userName}** est tombé dans le piège de la honte !\n\n🎯 **Piège:** {trapName}\n\n🤡 {shameMessage}',
  '#9b59b6',
  'Système de Pièges'
FROM announcement_templates
WHERE NOT EXISTS (
  SELECT 1 FROM announcement_templates at2
  WHERE at2.guild_id = announcement_templates.guild_id
  AND at2.type = 'trap_public_shame'
);

-- Template 4: Piège Malus Points (pour chaque guild)
INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
SELECT DISTINCT
  guild_id,
  'trap_malus_points',
  '⚠️ Piège Maudit Déclenché !',
  '**{userName}** est victime d''une malédiction !\n\n🎯 **Piège:** {trapName}\n👻 **Effet:** +{malusPoints} points de malédiction\n\n⚠️ Ces points pourraient avoir des conséquences négatives...',
  '#c0392b',
  'Système de Pièges'
FROM announcement_templates
WHERE NOT EXISTS (
  SELECT 1 FROM announcement_templates at2
  WHERE at2.guild_id = announcement_templates.guild_id
  AND at2.type = 'trap_malus_points'
);

-- Afficher le résultat
SELECT
  type,
  title,
  color,
  LEFT(description, 50) as description_preview
FROM announcement_templates
WHERE type LIKE 'trap_%'
ORDER BY type;
