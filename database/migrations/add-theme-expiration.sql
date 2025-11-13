-- Migration pour ajouter le système d'expiration des thèmes
-- Date: 2025-01-04

-- Ajouter le champ activated_at pour savoir quand le thème a été activé
ALTER TABLE themes
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP DEFAULT NULL;

-- Mettre à jour les thèmes déjà actifs avec la date de création comme date d'activation
UPDATE themes
SET activated_at = created_at
WHERE is_active = TRUE AND activated_at IS NULL;

-- Ajouter un index pour optimiser les requêtes sur l'expiration
CREATE INDEX IF NOT EXISTS idx_themes_expiration
ON themes(guild_id, is_active, activated_at, duration_days);

-- Commentaires
COMMENT ON COLUMN themes.activated_at IS 'Date d''activation du thème. NULL si jamais activé. Utilisé pour calculer l''expiration.';
