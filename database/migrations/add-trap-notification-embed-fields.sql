-- Migration: Ajouter les champs de personnalisation pour l'embed de notification des pièges
-- Date: 2025-11-10
-- Description: Permet de personnaliser l'embed envoyé à l'utilisateur quand il tombe sur un piège

-- Ajouter les champs pour personnaliser l'embed de notification
ALTER TABLE traps
ADD COLUMN IF NOT EXISTS notif_title TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notif_description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notif_color TEXT DEFAULT '#e74c3c',
ADD COLUMN IF NOT EXISTS notif_footer TEXT DEFAULT NULL;

-- Commenter les colonnes pour documentation
COMMENT ON COLUMN traps.notif_title IS 'Titre de l''embed de notification envoyé quand un joueur tombe sur ce piège';
COMMENT ON COLUMN traps.notif_description IS 'Description de l''embed de notification (peut contenir des variables comme {user}, {duration}, {collectible}, {points})';
COMMENT ON COLUMN traps.notif_color IS 'Couleur de l''embed au format hexadécimal (#RRGGBB)';
COMMENT ON COLUMN traps.notif_footer IS 'Footer de l''embed de notification';

-- Mettre à jour les pièges existants avec des valeurs par défaut génériques
UPDATE traps
SET
  notif_title = CASE type
    WHEN 'cooldown' THEN '⏱️ Piège Activé !'
    WHEN 'lose-collectible' THEN '💀 Piège Voleur !'
    WHEN 'public-shame' THEN '😱 Piège de la Honte !'
    WHEN 'points-malus' THEN '⚠️ Piège Maudit !'
    ELSE 'Piège Activé !'
  END,
  notif_description = shame_message,
  notif_color = '#e74c3c',
  notif_footer = 'Tu as déclenché un piège'
WHERE notif_title IS NULL;

-- Afficher le résultat
SELECT
  trap_id,
  name,
  type,
  notif_title,
  LEFT(notif_description, 50) as notif_description_preview,
  notif_color
FROM traps
ORDER BY type, trap_id;
