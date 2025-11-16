-- Migration: Ajouter 'reroll' à la contrainte effect_type
-- Date: 2025-11-16
-- Raison: Le bonus "Retour dans le Futur" nécessite le type 'reroll'
--
-- Impact: Faible - Élargit simplement les valeurs acceptées sans modifier les données

BEGIN;

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE super_bonuses DROP CONSTRAINT IF EXISTS super_bonuses_effect_type_check;

-- 2. Recréer la contrainte avec 'reroll' ajouté
ALTER TABLE super_bonuses ADD CONSTRAINT super_bonuses_effect_type_check
  CHECK (effect_type IN (
    'probability',
    'cosmetic',
    'protection',
    'cooldown',
    'reveal',
    'transfer',
    'rarity_boost',
    'multiplier',
    'detector',
    'voice',
    'reroll'  -- AJOUT
  ));

COMMIT;
