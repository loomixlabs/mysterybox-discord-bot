-- Migration: Ajouter le champ difficulty aux mission_keywords
-- Date: 2025-01-XX
-- Permet de configurer la difficulté des mots-clés pour les missions "Mot Deviné"

-- Ajouter la colonne difficulty avec valeur par défaut 'medium'
ALTER TABLE mission_keywords
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard'));

-- Ajouter un commentaire pour la documentation
COMMENT ON COLUMN mission_keywords.difficulty IS 'Difficulté du mot-clé: easy (facile), medium (moyen), hard (difficile)';

-- Mettre à jour les keywords existants pour avoir la valeur par défaut
UPDATE mission_keywords
SET difficulty = 'medium'
WHERE difficulty IS NULL;
