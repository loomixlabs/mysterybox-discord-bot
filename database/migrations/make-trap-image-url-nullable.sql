-- Migration: Rendre la colonne image_url optionnelle dans la table traps
-- Date: 2025-11-10
-- Description: Permet de créer des pièges sans image obligatoire

ALTER TABLE traps
ALTER COLUMN image_url DROP NOT NULL;

COMMENT ON COLUMN traps.image_url IS 'URL de l''image du piège (optionnel)';
