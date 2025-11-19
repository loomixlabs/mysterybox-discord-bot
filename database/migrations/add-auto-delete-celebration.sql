-- Migration: Ajouter toggle pour suppression automatique des messages de félicitation
-- Date: 2025-11-18
-- Description: Permet d'activer/désactiver la suppression automatique du message
--              de félicitation après ouverture de mystery box (après 10 secondes)

-- Ajouter la colonne à theme_config
ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS auto_delete_celebration_message BOOLEAN DEFAULT FALSE;

-- Commentaire explicatif
COMMENT ON COLUMN theme_config.auto_delete_celebration_message IS
'Si TRUE, le message de félicitation après ouverture de mystery box sera supprimé après 10 secondes';
