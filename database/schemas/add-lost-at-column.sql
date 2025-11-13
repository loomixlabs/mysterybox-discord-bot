-- Migration: Ajouter colonne lost_at pour soft delete des collectibles
-- Permet de conserver l'historique complet (gains ET pertes)

ALTER TABLE collections
ADD COLUMN IF NOT EXISTS lost_at TIMESTAMP DEFAULT NULL;

-- Index pour améliorer les performances des requêtes filtrant sur lost_at
CREATE INDEX IF NOT EXISTS idx_collections_lost_at ON collections(lost_at);

-- Vérification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'collections'
ORDER BY ordinal_position;
