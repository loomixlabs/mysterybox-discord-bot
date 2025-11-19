-- Migration: Nettoyer les descriptions des super bonus (enlever durées/charges hardcodées)
-- Date: 2025-11-18
-- Raison: Les durées/charges hardcodées ne reflètent pas les vraies valeurs configurables

-- 1. Chance du Diable - Enlever "pendant 7 jours !"
UPDATE super_bonuses
SET description = '+20% de chance sur toutes les mystery boxes !'
WHERE bonus_id = 'chance_devil';

-- 2. Vision Divine - Enlever "(1 utilisation)"
UPDATE super_bonuses
SET description = 'Révèle le contenu d''une mystery box AVANT de cliquer'
WHERE bonus_id = 'divine_vision';

-- 3. Aimant à Légendaires - Enlever "(3 jours)"
UPDATE super_bonuses
SET description = 'Si un collectible tombe, +50% de chance qu''il soit légendaire'
WHERE bonus_id = 'legendary_magnet';

-- 4. Aura de Célébrité - Enlever "(48h)"
UPDATE super_bonuses
SET description = 'Nom en GOLD et réaction ⭐ automatique sur tous tes messages'
WHERE bonus_id = 'celebrity_aura';

-- 5. Détecteur de Pièges - Enlever "pendant 48h"
UPDATE super_bonuses
SET description = 'Les mystery boxes pièges sont marquées 💀 (visible que pour toi)'
WHERE bonus_id = 'trap_detector';

-- 6. Parrain/Marraine - Enlever "(5 jours)"
UPDATE super_bonuses
SET description = 'Offre UNE mystery box à quelqu''un. S''il trouve un collectible, tu gagnes 2x points !'
WHERE bonus_id = 'godparent';

-- 7. Assurance Collector - Enlever "(1 utilisation)"
UPDATE super_bonuses
SET description = 'Si tu perds un collectible (piège), récupération automatique GRATUITE'
WHERE bonus_id = 'collector_insurance';

-- Vérification
SELECT bonus_id, name, description
FROM super_bonuses
ORDER BY id;
