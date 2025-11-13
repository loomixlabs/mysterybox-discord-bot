-- 📊 TABLES POUR SYSTÈME SUPER BONUS
-- Création des tables pour gérer les super pouvoirs temporaires/permanents

-- ==============================================
-- TABLE 1: super_bonuses (Définition des bonus)
-- ==============================================
CREATE TABLE IF NOT EXISTS super_bonuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bonus_id TEXT UNIQUE NOT NULL,  -- Identifiant unique (ex: 'chance_devil', 'divine_vision')
    name TEXT NOT NULL,              -- Nom affiché (ex: "Chance du Diable")
    description TEXT NOT NULL,       -- Description complète de l'effet
    icon TEXT,                       -- Emoji ou icône (ex: '🎰', '👁️')

    -- Catégorisation
    bonus_type TEXT NOT NULL,        -- 'boost', 'social', 'protection', 'time', 'economy'
    effect_type TEXT NOT NULL,       -- Type d'effet précis: 'probability', 'cosmetic', 'protection', 'cooldown', 'reveal', 'transfer', etc.

    -- Configuration de l'effet (JSON)
    effect_config TEXT,              -- JSON avec paramètres spécifiques
                                     -- Exemples:
                                     -- {"boost_percentage": 20} pour Chance du Diable
                                     -- {"rarity_boost": 50, "target_rarity": "legendary"} pour Aimant à Légendaires
                                     -- {"role_color": "gold"} pour Aura de Célébrité

    -- Durée et limites
    duration_type TEXT NOT NULL,     -- 'temporary' (durée en secondes), 'charges' (nombre d'utilisations), 'permanent' (jusqu'à utilisation)
    duration_value INTEGER,          -- Secondes si 'temporary', nombre d'utilisations si 'charges', NULL si 'permanent'

    -- Visuels pour affichage
    image_url TEXT,                  -- URL de l'image (upload Discord CDN)
    color TEXT DEFAULT '#3498db',    -- Couleur de l'embed (hex)

    -- Méta
    rarity TEXT DEFAULT 'common',    -- Rareté du bonus lui-même: common/rare/epic/legendary
    theme_id INTEGER,                -- Lien au thème (NULL = global)
    announcement_message TEXT,       -- Message d'annonce personnalisé quand obtenu
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,

    -- Validations
    CHECK (bonus_type IN ('boost', 'social', 'protection', 'time', 'economy')),
    CHECK (effect_type IN ('probability', 'cosmetic', 'protection', 'cooldown', 'reveal', 'transfer', 'rarity_boost', 'multiplier', 'detector', 'voice')),
    CHECK (duration_type IN ('temporary', 'charges', 'permanent')),
    CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    CHECK (
        (duration_type = 'temporary' AND duration_value > 0) OR
        (duration_type = 'charges' AND duration_value > 0) OR
        (duration_type = 'permanent' AND duration_value IS NULL)
    )
);

-- ==============================================
-- TABLE 2: player_active_bonuses (Bonus actifs des joueurs)
-- ==============================================
CREATE TABLE IF NOT EXISTS player_active_bonuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,           -- Discord User ID
    bonus_id INTEGER NOT NULL,       -- FK vers super_bonuses

    -- Tracking temporel
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,             -- NULL si permanent ou par charges

    -- Tracking charges
    remaining_charges INTEGER,       -- NULL si temporaire, décrémente si charges

    -- État
    is_active BOOLEAN DEFAULT 1,     -- 0 si expiré ou consommé
    used_at DATETIME,                -- Quand totalement consommé

    -- Contexte d'obtention
    obtained_from TEXT,              -- 'give_unique', 'mystery_box', 'mission', 'manual_admin'
    given_by TEXT,                   -- User ID de l'admin qui a donné (si applicable)

    FOREIGN KEY (bonus_id) REFERENCES super_bonuses(id) ON DELETE CASCADE,

    -- Un joueur ne peut avoir qu'une instance active du même bonus
    UNIQUE(user_id, bonus_id, is_active)
);

-- ==============================================
-- TABLE 3: bonus_usage_history (Historique des utilisations)
-- ==============================================
CREATE TABLE IF NOT EXISTS bonus_usage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,           -- Discord User ID
    bonus_id INTEGER NOT NULL,       -- FK vers super_bonuses

    -- Détails de l'utilisation
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    effect_result TEXT,              -- JSON avec résultat de l'effet
                                     -- Exemples:
                                     -- {"mystery_box_id": 123, "reward_boosted": "legendary_collectible"}
                                     -- {"trap_blocked": "lose_collectible"}
                                     -- {"cooldown_removed": 3600}

    -- Contexte
    trigger_type TEXT,               -- 'manual', 'automatic', 'passive'
    related_event_id INTEGER,        -- ID de l'événement lié (give_id, mission_id, etc.)

    FOREIGN KEY (bonus_id) REFERENCES super_bonuses(id) ON DELETE SET NULL
);

-- ==============================================
-- INDEX pour optimisation
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_player_active_bonuses_user
    ON player_active_bonuses(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_player_active_bonuses_expires
    ON player_active_bonuses(expires_at)
    WHERE is_active = 1 AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bonus_usage_user
    ON bonus_usage_history(user_id);

CREATE INDEX IF NOT EXISTS idx_super_bonuses_theme
    ON super_bonuses(theme_id);

-- ==============================================
-- INSERTION DES BONUS PAR DÉFAUT
-- ==============================================

-- 1. Chance du Diable (Boost probabilité)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'chance_devil',
    'Chance du Diable',
    '+20% de chance sur toutes les mystery boxes pendant 7 jours !',
    '🎰',
    'boost',
    'probability',
    '{"boost_percentage": 20, "applies_to": "all"}',
    'temporary',
    604800,  -- 7 jours en secondes
    '#e74c3c',
    'epic'
);

-- 2. Vision Divine (Révélation one-shot)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'divine_vision',
    'Vision Divine',
    'Révèle le contenu d''une mystery box AVANT de cliquer (1 utilisation)',
    '👁️',
    'boost',
    'reveal',
    '{"reveal_count": 1, "can_skip": true}',
    'charges',
    1,
    '#f1c40f',
    'legendary'
);

-- 3. Aimant à Légendaires (Boost rareté)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'legendary_magnet',
    'Aimant à Légendaires',
    'Si un collectible tombe, +50% de chance qu''il soit légendaire (3 jours)',
    '🧲',
    'boost',
    'rarity_boost',
    '{"boost_percentage": 50, "target_rarity": "legendary"}',
    'temporary',
    259200,  -- 3 jours
    '#9b59b6',
    'legendary'
);

-- 4. Aura de Célébrité (Cosmétique social)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'celebrity_aura',
    'Aura de Célébrité',
    'Nom en GOLD et réaction ⭐ automatique sur tous tes messages (48h)',
    '👑',
    'social',
    'cosmetic',
    '{"name_color": "gold", "auto_reaction": "⭐"}',
    'temporary',
    172800,  -- 48 heures
    '#f39c12',
    'rare'
);

-- 5. Bouclier Anti-Piège (Protection)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'trap_shield',
    'Bouclier Anti-Piège',
    'Annule automatiquement le prochain piège que tu tombes dessus',
    '🛡️',
    'protection',
    'protection',
    '{"blocks_traps": 1, "auto_consume": true}',
    'charges',
    1,
    '#3498db',
    'epic'
);

-- 6. Assurance Collector (Protection permanente)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'collector_insurance',
    'Assurance Collector',
    'Si tu perds un collectible (piège), récupération automatique GRATUITE (1 utilisation)',
    '💎',
    'protection',
    'protection',
    '{"protects_from": "lose_collectible", "auto_recover": true}',
    'permanent',
    NULL,
    '#1abc9c',
    'legendary'
);

-- 7. Accélérateur de Cooldown (Instantané)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'cooldown_accelerator',
    'Accélérateur de Cooldown',
    'Enlève TOUS tes cooldowns actifs immédiatement',
    '⚡',
    'time',
    'cooldown',
    '{"removes_all_cooldowns": true, "instant": true}',
    'charges',
    1,
    '#e67e22',
    'rare'
);

-- 8. Jackpot x2 (Économie)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'jackpot_x2',
    'Jackpot x2',
    'Les 5 prochaines mystery boxes donnent DOUBLE récompense si collectible !',
    '💵',
    'economy',
    'multiplier',
    '{"multiplier": 2, "applies_to": "collectible"}',
    'charges',
    5,
    '#27ae60',
    'epic'
);

-- 9. Détecteur de Pièges (Information)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'trap_detector',
    'Détecteur de Pièges',
    'Les mystery boxes pièges sont marquées 💀 (visible que pour toi) pendant 48h',
    '🔍',
    'economy',
    'detector',
    '{"detects": "trap", "marker": "💀", "visible_only_to_user": true}',
    'temporary',
    172800,  -- 48 heures
    '#95a5a6',
    'rare'
);

-- 10. Retour dans le Futur (Time manipulation)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'back_to_future',
    'Retour dans le Futur',
    'Relance UNE mystery box déjà ouverte (garde le meilleur résultat des 2)',
    '⏪',
    'time',
    'reroll',
    '{"reroll_count": 1, "keeps_best": true, "time_limit_minutes": 10}',
    'charges',
    1,
    '#34495e',
    'legendary'
);

-- 11. Parrain/Marraine (Social)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'godparent',
    'Parrain/Marraine',
    'Offre UNE mystery box à quelqu''un. S''il trouve un collectible, tu gagnes 2x points ! (5 jours)',
    '🤝',
    'social',
    'transfer',
    '{"can_gift_boxes": 1, "bonus_if_collectible": 2, "affects_both": true}',
    'temporary',
    432000,  -- 5 jours
    '#16a085',
    'epic'
);

-- 12. Voix de Dieu (Social unique)
INSERT OR IGNORE INTO super_bonuses (bonus_id, name, description, icon, bonus_type, effect_type, effect_config, duration_type, duration_value, color, rarity)
VALUES (
    'voice_of_god',
    'Voix de Dieu',
    'Envoie UN message dans le canal d''annonces avec ton avatar géant (1h de pouvoir)',
    '📢',
    'social',
    'voice',
    '{"can_announce": 1, "format": "special", "avatar_size": "large"}',
    'temporary',
    3600,  -- 1 heure
    '#c0392b',
    'legendary'
);
