-- Migration: Ajouter la colonne max_attempts à la table missions
-- Date: 2025-11-09
-- Description: Permet de définir le nombre maximum d'essais pour les missions quiz

-- Ajouter la colonne max_attempts (NULL par défaut = essais illimités)
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT NULL;

-- Commentaire sur la colonne
COMMENT ON COLUMN missions.max_attempts IS 'Nombre maximum d''essais pour les missions quiz (NULL = illimité)';

-- Index pour améliorer les performances (optionnel mais recommandé)
CREATE INDEX IF NOT EXISTS idx_missions_max_attempts ON missions(max_attempts) WHERE max_attempts IS NOT NULL;
