-- Migration: Ajouter le champ pour personnaliser le message de félicitations d'ouverture de mysterybox

ALTER TABLE theme_config
ADD COLUMN IF NOT EXISTS mystery_box_winner_message TEXT DEFAULT '🎉 **{player}** a ouvert la boîte mystère !';

-- Commentaire pour documentation
COMMENT ON COLUMN theme_config.mystery_box_winner_message IS 'Message personnalisé affiché quand un joueur ouvre une mysterybox. Utilisez {player} pour mentionner le joueur.';
