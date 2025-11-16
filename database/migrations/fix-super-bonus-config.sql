-- Migration: Corriger configuration des super bonus
-- Date: 2025-11-16
-- Raison: Jackpot x2, Aura de Célébrité, Parrain/Marraine mal configurés
--
-- Changements:
-- 1. Jackpot x2: manual → automatic, 5 charges → 1 charge
-- 2. Aura de Célébrité: manual → automatic
-- 3. Parrain/Marraine: temporary 5j → charges (1)

BEGIN;

-- 1. Corriger Jackpot x2 (ID 8)
UPDATE super_bonuses
SET
  activation_mode = 'automatic',  -- Activation immédiate
  duration_value = 1               -- 1 seule charge
WHERE bonus_id = 'jackpot_x2';

-- 2. Corriger Aura de Célébrité (ID 4)
UPDATE super_bonuses
SET
  activation_mode = 'automatic'    -- Activation immédiate
WHERE bonus_id = 'celebrity_aura';

-- 3. Corriger Parrain/Marraine (ID 10)
UPDATE super_bonuses
SET
  duration_type = 'charges',       -- Passer de temporary à charges
  duration_value = 1               -- 1 box à offrir
WHERE bonus_id = 'godparent';

COMMIT;
