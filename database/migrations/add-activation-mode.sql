-- Migration: Ajouter activation_mode et corriger activated_at
-- Date: 2025-11-16
-- Raison: Système de super bonus avec activation automatique vs manuelle
--
-- Impact: Moyen - Ajoute colonne et modifie DEFAULT

BEGIN;

-- 1. Ajouter colonne activation_mode à super_bonuses
ALTER TABLE super_bonuses
ADD COLUMN IF NOT EXISTS activation_mode TEXT DEFAULT 'manual';

-- 2. Ajouter contrainte CHECK
ALTER TABLE super_bonuses
ADD CONSTRAINT super_bonuses_activation_mode_check
CHECK (activation_mode IN ('automatic', 'manual'));

-- 3. Corriger DEFAULT de activated_at dans player_active_bonuses
-- IMPORTANT: Par défaut NULL, la duration ne se déclenche qu'à l'activation
ALTER TABLE player_active_bonuses
ALTER COLUMN activated_at DROP DEFAULT;

ALTER TABLE player_active_bonuses
ALTER COLUMN activated_at SET DEFAULT NULL;

-- 4. Mettre à jour les super bonus existants avec le bon mode
-- Bonus AUTOMATIQUES (passive effects)
UPDATE super_bonuses
SET activation_mode = 'automatic'
WHERE bonus_id IN (
  'chance_devil',        -- 🎰 Chance du Diable - +20% probabilités (passif)
  'legendary_magnet',    -- 🧲 Aimant Légendaires - Boost rareté (passif)
  'trap_detector'        -- 🔍 Détecteur de Pièges - Marqueur 💀 (passif)
);

-- Bonus MANUELS (active effects) - Tous les autres
UPDATE super_bonuses
SET activation_mode = 'manual'
WHERE bonus_id IN (
  'vision_divine',       -- 👁️ Vision Divine - Révéler mystery box (action)
  'trap_shield',         -- 🛡️ Bouclier Anti-Piège - Bloquer piège (action)
  'jackpot_x2',          -- 💵 Jackpot x2 - Doubler collectible (action)
  'insurance',           -- 💎 Assurance Collector - Protection perte (action)
  'cooldown_boost',      -- ⚡ Accélérateur Cooldown - Enlever cooldowns (action)
  'time_rewind',         -- ⏪ Retour dans le Futur - Reroll mystery box (action)
  'sponsor',             -- 🤝 Parrain/Marraine - Offrir box (action)
  'celebrity_aura',      -- 👑 Aura de Célébrité - Rôle gold (action)
  'voice_of_god'         -- 📢 Voix de Dieu - Message annonce (action)
);

COMMIT;
