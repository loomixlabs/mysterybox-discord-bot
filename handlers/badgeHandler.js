/**
 * ================================================================================
 * BADGE HANDLER - Système de Badges Complet
 * ================================================================================
 *
 * Gestion centralisée de tous les badges :
 * - Progression tracking
 * - Déblocage automatique
 * - Notifications
 * - Statistiques
 * - Leaderboards
 *
 * Ce handler est conçu pour être facilement maintenable et extensible.
 *
 * Structure:
 *   1. Constants & Configuration
 *   2. Badge Unlocking & Progress
 *   3. Condition Checking
 *   4. Notifications
 *   5. Statistics & Leaderboards
 *   6. Integration Hooks
 *
 * @module badgeHandler
 * @since 2025-11-20
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database-pg');

// ================================================================================
// SECTION 1: CONSTANTS & CONFIGURATION
// ================================================================================

/**
 * Couleurs par rareté de badge
 */
const RARITY_COLORS = {
  common: '#95a5a6',    // Gris
  uncommon: '#2ecc71',  // Vert
  rare: '#3498db',      // Bleu
  epic: '#9b59b6',      // Violet
  legendary: '#f39c12', // Or
  mythic: '#e74c3c'     // Rouge/Rose
};

/**
 * Emojis par rareté
 */
const RARITY_EMOJIS = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟠',
  mythic: '🔴'
};

/**
 * Seuils "Almost There" pour notifications (en pourcentage)
 * Le joueur reçoit une notification quand il atteint ces seuils
 */
const ALMOST_THERE_THRESHOLDS = [50, 75, 90, 95];

/**
 * Messages motivants par seuil de progression
 */
const ALMOST_THERE_MESSAGES = {
  50: { emoji: '🔥', title: 'À mi-chemin !', message: 'Tu as déjà fait la moitié du chemin !' },
  75: { emoji: '⚡', title: 'Presque là !', message: 'Plus que 25% et le badge est à toi !' },
  90: { emoji: '🚀', title: 'Dernière ligne droite !', message: 'Encore un petit effort !' },
  95: { emoji: '✨', title: 'Tellement proche !', message: 'Le badge est à portée de main !' }
};

/**
 * Noms français des raretés
 */
const RARITY_NAMES = {
  common: 'Commun',
  uncommon: 'Peu commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
  mythic: 'Mythique'
};

/**
 * Mapping des bonus_id vers badge codes (pour tracking automatique)
 */
const SUPER_BONUS_TO_BADGE_MAP = {
  vision_divine: [
    { code: 'VOYANT_DIVIN_APPRENTI', threshold: 10 },
    { code: 'VOYANT_DIVIN_EXPERT', threshold: 50 },
    { code: 'VOYANT_DIVIN_MAITRE', threshold: 100 }
  ],
  jackpot_x2: [
    { code: 'JACKPOT_CHANCEUX', threshold: 10 },
    { code: 'JACKPOT_FORTUNE', threshold: 30 },
    { code: 'JACKPOT_ROI', threshold: 50 }
  ],
  legendary_magnet: [
    { code: 'AIMANT_DEBUTANT', threshold: 5 },
    { code: 'AIMANT_COLLECTIONNEUR', threshold: 15 },
    { code: 'AIMANT_MAITRE', threshold: 30 }
  ]
};

/**
 * Mapping pour les badges "trap_block" (Bouclier Anti-Piège)
 */
const TRAP_BLOCK_BADGES = [
  { code: 'BOUCLIER_NOVICE', threshold: 1 },
  { code: 'BOUCLIER_EXPERT', threshold: 25 },
  { code: 'BOUCLIER_LEGENDE', threshold: 50 }
];

/**
 * Mapping pour les badges Collection (collectible_count)
 */
const COLLECTION_BADGES = [
  { code: 'COLLECTION_DEBUTANT', threshold: 1 },
  { code: 'COLLECTION_COLLECTIONNEUR', threshold: 10 },
  { code: 'COLLECTION_CHASSEUR', threshold: 50 },
  { code: 'COLLECTION_EXPERT', threshold: 100 },
  { code: 'COLLECTION_MAITRE', threshold: 100 },
  { code: 'COLLECTION_LEGENDE', threshold: 500 }
];

/**
 * Mapping pour les badges Rareté (legendary_count, epic_count, rare_count)
 * V3: Progressions étendues (5 niveaux par rareté)
 */
const RARITY_COUNT_BADGES = {
  legendary: [
    { code: 'RARITY_LEGENDARY_NOVICE', threshold: 1 },
    { code: 'RARITY_LEGENDARY_SEEKER', threshold: 5 },
    { code: 'RARITY_LEGENDARY_HUNTER', threshold: 10 },
    { code: 'RARITY_LEGENDARY_COLLECTOR', threshold: 25 },
    { code: 'RARITY_LEGENDARY_MASTER', threshold: 50 },
    { code: 'RARITY_LEGENDARY_EMPEROR', threshold: 100 }
  ],
  epic: [
    { code: 'RARITY_EPIC_NOVICE', threshold: 5 },
    { code: 'RARITY_EPIC_SEEKER', threshold: 10 },
    { code: 'RARITY_EPIC_MASTER', threshold: 25 },
    { code: 'RARITY_EPIC_COLLECTOR', threshold: 50 },
    { code: 'RARITY_EPIC_EMPEROR', threshold: 100 }
  ],
  rare: [
    { code: 'RARITY_RARE_NOVICE', threshold: 10 },
    { code: 'RARITY_RARE_SEEKER', threshold: 25 },
    { code: 'RARITY_RARE_BARON', threshold: 50 },
    { code: 'RARITY_RARE_COLLECTOR', threshold: 100 },
    { code: 'RARITY_RARE_EMPEROR', threshold: 200 }
  ]
};

/**
 * Mapping pour les badges Evolution
 */
const EVOLUTION_BADGES = [
  { code: 'EVOLUTION_LEVEL_2', level: 2 },
  { code: 'EVOLUTION_LEVEL_3', level: 3 },
  { code: 'EVOLUTION_LEVEL_4', level: 4 }
];

/**
 * Mapping pour les badges Mystery Box par rareté
 * V3: Progressions étendues (5 niveaux par rareté)
 */
const MYSTERY_BOX_RARITY_BADGES = {
  epic: [
    { code: 'BOX_EPIC_NOVICE', threshold: 1 },
    { code: 'BOX_EPIC_SEEKER', threshold: 5 },
    { code: 'BOX_EPIC_COLLECTOR', threshold: 10 },
    { code: 'BOX_EPIC_MASTER', threshold: 25 },
    { code: 'BOX_EPIC_EMPEROR', threshold: 50 }
  ],
  legendary: [
    { code: 'BOX_LEGENDARY_NOVICE', threshold: 1 },
    { code: 'BOX_LEGENDARY_SEEKER', threshold: 3 },
    { code: 'BOX_LEGENDARY_COLLECTOR', threshold: 5 },
    { code: 'BOX_LEGENDARY_MASTER', threshold: 10 },
    { code: 'BOX_LEGENDARY_EMPEROR', threshold: 25 }
  ]
};

/**
 * Mapping pour les badges Trap triggered
 * V3: Progressions étendues (6 niveaux)
 */
const TRAP_TRIGGERED_BADGES = [
  { code: 'TRAP_TRIGGERED_1', threshold: 1 },
  { code: 'TRAP_TRIGGERED_5', threshold: 5 },
  { code: 'TRAP_TRIGGERED_10', threshold: 10 },
  { code: 'TRAP_TRIGGERED_25', threshold: 25 },
  { code: 'TRAP_TRIGGERED_50', threshold: 50 },
  { code: 'TRAP_TRIGGERED_100', threshold: 100 }
];

/**
 * Mapping pour les badges Economy (Loomix)
 * V3: Progressions étendues (5 niveaux par type)
 */
const ECONOMY_BADGES = {
  spent: [
    { code: 'ECONOMY_FIRST_SPEND', threshold: 100 },
    { code: 'ECONOMY_REGULAR_SPENDER', threshold: 500 },
    { code: 'ECONOMY_SPENDER', threshold: 1000 },
    { code: 'ECONOMY_BIG_SPENDER', threshold: 5000 },
    { code: 'ECONOMY_MEGA_SPENDER', threshold: 10000 }
  ],
  earned: [
    { code: 'ECONOMY_FIRST_EARNINGS', threshold: 1000 },
    { code: 'ECONOMY_REGULAR_EARNER', threshold: 5000 },
    { code: 'ECONOMY_MILLIONAIRE', threshold: 10000 },
    { code: 'ECONOMY_WEALTHY', threshold: 50000 },
    { code: 'ECONOMY_BILLIONAIRE', threshold: 100000 }
  ],
  balance: [
    { code: 'ECONOMY_FIRST_SAVINGS', threshold: 1000 },
    { code: 'ECONOMY_GOOD_SAVER', threshold: 2500 },
    { code: 'ECONOMY_SAVER', threshold: 5000 },
    { code: 'ECONOMY_RICH', threshold: 10000 },
    { code: 'ECONOMY_ULTRA_RICH', threshold: 25000 }
  ]
};

/**
 * Mapping pour les badges Seniority (jours actifs)
 */
const SENIORITY_BADGES = [
  { code: 'SENIORITY_WEEK', threshold: 7 },
  { code: 'SENIORITY_MONTH', threshold: 30 },
  { code: 'SENIORITY_6MONTHS', threshold: 180 },
  { code: 'SENIORITY_YEAR', threshold: 365 }
];

/**
 * Mapping pour les badges Social
 * V3: Progressions étendues (6 niveaux)
 */
const SOCIAL_BADGES = {
  flex: [
    { code: 'SOCIAL_FIRST_FLEX', threshold: 1 },
    { code: 'SOCIAL_FLEX_5', threshold: 5 },
    { code: 'SOCIAL_FLEX_10', threshold: 10 },
    { code: 'SOCIAL_FLEX_25', threshold: 25 },
    { code: 'SOCIAL_FLEX_50', threshold: 50 },
    { code: 'SOCIAL_FLEX_100', threshold: 100 }
  ]
};

/**
 * Mapping pour les badges Mission (mission_complete)
 * V3: Progressions étendues (5 niveaux)
 */
const MISSION_BADGES = [
  { code: 'MISSION_FIRST', threshold: 1 },
  { code: 'MISSION_REGULAR', threshold: 10 },
  { code: 'MISSION_VETERAN', threshold: 25 },
  { code: 'MISSION_EXPERT', threshold: 50 },
  { code: 'MISSION_MASTER', threshold: 100 }
];

/**
 * Mapping pour les badges Mystery Box (mystery_box_open)
 * V3: Progressions étendues (6 niveaux)
 */
const MYSTERY_BOX_BADGES = [
  { code: 'BOX_OPENER_FIRST', threshold: 1 },
  { code: 'BOX_OPENER_10', threshold: 10 },
  { code: 'BOX_OPENER_50', threshold: 50 },
  { code: 'BOX_OPENER_100', threshold: 100 },
  { code: 'BOX_OPENER_500', threshold: 500 },
  { code: 'BOX_OPENER_1000', threshold: 1000 }
];

/**
 * Mapping pour les badges Trap Survive (trap_survive)
 */
const TRAP_SURVIVE_BADGES = [
  { code: 'TRAP_SURVIVOR', threshold: 1 },
  { code: 'TRAP_RESILIENT', threshold: 10 },
  { code: 'TRAP_VETERAN', threshold: 50 },
  { code: 'TRAP_MASTER', threshold: 100 },
  { code: 'TRAP_IMMORTAL', threshold: 250 }
];

/**
 * Mapping pour les badges Engagement (daily_claim_streak)
 * Basé sur le streak du calendrier quotidien (daily rewards)
 */
const ENGAGEMENT_BADGES = [
  { code: 'ENGAGEMENT_ACTIF', threshold: 3 },
  { code: 'ENGAGEMENT_ASSIDU', threshold: 7 },
  { code: 'ENGAGEMENT_DEVOU', threshold: 14 },
  { code: 'ENGAGEMENT_MARATHONIEN', threshold: 30 },
  { code: 'ENGAGEMENT_ETERNEL', threshold: 90 }
];

/**
 * Mapping pour les badges Theme (theme_completion, themes_completed)
 * V3: Progressions de thème
 */
const THEME_BADGES = {
  completion: [
    { code: 'THEME_25_PERCENT', threshold: 25 },
    { code: 'THEME_50_PERCENT', threshold: 50 },
    { code: 'THEME_75_PERCENT', threshold: 75 },
    { code: 'THEME_100_PERCENT', threshold: 100 }
  ],
  completed: [
    { code: 'THEME_COMPLETER_1', threshold: 1 },
    { code: 'THEME_COMPLETER_3', threshold: 3 },
    { code: 'THEME_COMPLETER_5', threshold: 5 },
    { code: 'THEME_COMPLETER_10', threshold: 10 }
  ]
};

/**
 * Mapping pour les badges Mint (mint_first, mint_top_10, mint_100)
 * V3: Progressions pour chaque type de mint
 */
const MINT_BADGES = {
  first: [
    { code: 'MINT_FIRST', threshold: 1 },
    { code: 'MINT_FIRST_5', threshold: 5 },
    { code: 'MINT_FIRST_10', threshold: 10 }
  ],
  top_10: [
    { code: 'MINT_TOP_10', threshold: 1 },
    { code: 'MINT_TOP_10_5', threshold: 5 },
    { code: 'MINT_TOP_10_10', threshold: 10 },
    { code: 'MINT_TOP_10_25', threshold: 25 }
  ],
  mint_100: [
    { code: 'MINT_100', threshold: 1 },
    { code: 'MINT_100_5', threshold: 5 },
    { code: 'MINT_100_10', threshold: 10 }
  ]
};

/**
 * Mapping pour les badges Luck (legendaries_in_24h, win_streak)
 * V3: Progressions pour la chance
 */
const LUCK_BADGES = {
  legendaries_24h: [
    { code: 'LUCK_LEGENDARY_24H', threshold: 1 },
    { code: 'LUCK_2_LEGENDARY_24H', threshold: 2 },
    { code: 'LUCK_3_LEGENDARY_24H', threshold: 3 },
    { code: 'LUCK_5_LEGENDARY_24H', threshold: 5 }
  ],
  win_streak: [
    { code: 'LUCK_STREAK_3', threshold: 3 },
    { code: 'LUCK_STREAK_5', threshold: 5 },
    { code: 'LUCK_STREAK_7', threshold: 7 },
    { code: 'LUCK_STREAK_10', threshold: 10 },
    { code: 'LUCK_STREAK_15', threshold: 15 }
  ]
};

/**
 * Mapping pour les badges Tictactoe (Morpion PvP)
 * V1: Badges progressifs pour toutes les stats de morpion
 */
const TICTACTOE_BADGES = {
  // Victoires (games_won)
  wins: [
    { code: 'TICTACTOE_FIRST_WIN', threshold: 1 },
    { code: 'TICTACTOE_WINNER_10', threshold: 10 },
    { code: 'TICTACTOE_WINNER_25', threshold: 25 },
    { code: 'TICTACTOE_WINNER_50', threshold: 50 },
    { code: 'TICTACTOE_WINNER_100', threshold: 100 },
    { code: 'TICTACTOE_WINNER_250', threshold: 250 },
    { code: 'TICTACTOE_WINNER_500', threshold: 500 }
  ],
  // Parties jouées (games_played)
  games_played: [
    { code: 'TICTACTOE_PLAYER_25', threshold: 25 },
    { code: 'TICTACTOE_PLAYER_50', threshold: 50 },
    { code: 'TICTACTOE_PLAYER_100', threshold: 100 },
    { code: 'TICTACTOE_PLAYER_250', threshold: 250 },
    { code: 'TICTACTOE_PLAYER_500', threshold: 500 },
    { code: 'TICTACTOE_PLAYER_1000', threshold: 1000 }
  ],
  // Win Streak (best_win_streak)
  win_streak: [
    { code: 'TICTACTOE_STREAK_3', threshold: 3 },
    { code: 'TICTACTOE_STREAK_5', threshold: 5 },
    { code: 'TICTACTOE_STREAK_7', threshold: 7 },
    { code: 'TICTACTOE_STREAK_10', threshold: 10 },
    { code: 'TICTACTOE_STREAK_15', threshold: 15 },
    { code: 'TICTACTOE_STREAK_20', threshold: 20 }
  ],
  // Victoires propres (wins_by_play)
  clean_wins: [
    { code: 'TICTACTOE_CLEAN_WIN_25', threshold: 25 },
    { code: 'TICTACTOE_CLEAN_WIN_50', threshold: 50 },
    { code: 'TICTACTOE_CLEAN_WIN_100', threshold: 100 },
    { code: 'TICTACTOE_CLEAN_WIN_250', threshold: 250 }
  ],
  // Victoire rapide (fastest_win_moves) - inversé: moins = mieux
  fast_wins: [
    { code: 'TICTACTOE_FAST_WIN_5', threshold: 5 },
    { code: 'TICTACTOE_FAST_WIN_4', threshold: 4 },
    { code: 'TICTACTOE_FAST_WIN_3', threshold: 3 }
  ],
  // Égalités (games_draw)
  draws: [
    { code: 'TICTACTOE_DRAW_10', threshold: 10 },
    { code: 'TICTACTOE_DRAW_50', threshold: 50 },
    { code: 'TICTACTOE_DRAW_100', threshold: 100 }
  ],
  // Résilience - défaites (games_lost)
  resilience: [
    { code: 'TICTACTOE_RESILIENT_25', threshold: 25 },
    { code: 'TICTACTOE_RESILIENT_50', threshold: 50 },
    { code: 'TICTACTOE_RESILIENT_100', threshold: 100 },
    { code: 'TICTACTOE_RESILIENT_250', threshold: 250 }
  ],
  // Patience - victoires par timeout (wins_by_timeout)
  patience: [
    { code: 'TICTACTOE_PATIENT_5', threshold: 5 },
    { code: 'TICTACTOE_PATIENT_15', threshold: 15 },
    { code: 'TICTACTOE_PATIENT_30', threshold: 30 }
  ],
  // Intimidation - victoires par abandon (wins_by_abandon)
  intimidation: [
    { code: 'TICTACTOE_INTIMIDATOR_5', threshold: 5 },
    { code: 'TICTACTOE_INTIMIDATOR_15', threshold: 15 },
    { code: 'TICTACTOE_INTIMIDATOR_30', threshold: 30 }
  ],
  // Expérience - coups joués (total_moves_played)
  moves: [
    { code: 'TICTACTOE_MOVES_500', threshold: 500 },
    { code: 'TICTACTOE_MOVES_1000', threshold: 1000 },
    { code: 'TICTACTOE_MOVES_2500', threshold: 2500 },
    { code: 'TICTACTOE_MOVES_5000', threshold: 5000 },
    { code: 'TICTACTOE_MOVES_10000', threshold: 10000 }
  ],
  // Ratio W/L (calculé: games_won / games_lost avec min parties)
  ratio: [
    { code: 'TICTACTOE_RATIO_POSITIVE', minGames: 20, ratioMultiplier: 1 },
    { code: 'TICTACTOE_RATIO_DOMINANT', minGames: 50, ratioMultiplier: 2 },
    { code: 'TICTACTOE_RATIO_ELITE', minGames: 100, ratioMultiplier: 3 },
    { code: 'TICTACTOE_RATIO_GOD', minGames: 200, ratioMultiplier: 5 }
  ]
};

// ================================================================================
// SECTION 2: BADGE UNLOCKING & PROGRESS
// ================================================================================

/**
 * Tente de débloquer un badge pour un joueur
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} badgeCode - Code du badge
 * @param {string} unlockedFrom - Source du déblocage
 * @param {Object} client - Client Discord (pour notifications)
 * @returns {Object|null} Badge débloqué ou null si déjà existant
 */
async function unlockBadge(guildId, playerId, badgeCode, unlockedFrom = null, client = null) {
  try {
    // Récupérer le badge
    const badge = await db.getBadgeByCode(badgeCode);
    if (!badge) {
      console.error(`🔴 Badge ${badgeCode} introuvable`);
      return null;
    }

    // Tenter le déblocage
    const unlocked = await db.unlockBadge(guildId, playerId, badge.id, unlockedFrom);

    if (unlocked) {
      console.log(`🏆 Badge débloqué: ${badge.emoji} ${badge.name} pour player ${playerId}`);

      // Envoyer notification si client fourni
      if (client) {
        await sendBadgeUnlockNotification(client, guildId, playerId, badge);
      }

      return { badge, unlocked };
    }

    return null; // Badge déjà débloqué
  } catch (error) {
    console.error(`🔴 Erreur unlockBadge (${badgeCode}):`, error);
    return null;
  }
}

/**
 * Met à jour la progression d'un joueur vers un badge
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} badgeCode - Code du badge
 * @param {number} currentValue - Valeur actuelle
 * @param {Object} client - Client Discord (pour déblocage auto et notifications Almost There)
 * @returns {Object|null} Résultat de la mise à jour
 */
async function updateBadgeProgress(guildId, playerId, badgeCode, currentValue, client = null) {
  try {
    const badge = await db.getBadgeByCode(badgeCode);
    if (!badge) {
      console.error(`🔴 Badge ${badgeCode} introuvable`);
      return null;
    }

    // Vérifier si déjà débloqué
    const isUnlocked = await db.playerHasBadge(guildId, playerId, badge.id);
    if (isUnlocked) {
      return null; // Déjà débloqué, rien à faire
    }

    // Récupérer la progression précédente pour "Almost There"
    const previousProgress = await db.queryOne(`
      SELECT current_value FROM badge_progress
      WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
    `, [guildId, playerId, badge.id]);
    const previousValue = previousProgress ? previousProgress.current_value : 0;

    // Mettre à jour la progression
    const progress = await db.updateBadgeProgress(
      guildId,
      playerId,
      badge.id,
      currentValue,
      badge.condition_value
    );

    // Si progression atteinte → débloquer
    if (progress && currentValue >= badge.condition_value) {
      await unlockBadge(guildId, playerId, badgeCode, 'progression_complete', client);
    } else if (client && currentValue > previousValue) {
      // Vérifier si on doit envoyer une notification "Almost There"
      await checkAndSendAlmostThereNotification(
        client,
        guildId,
        playerId,
        badge,
        previousValue,
        currentValue,
        badge.condition_value
      );
    }

    return progress;
  } catch (error) {
    console.error(`🔴 Erreur updateBadgeProgress (${badgeCode}):`, error);
    return null;
  }
}

/**
 * Incrémente la progression d'un joueur vers un badge
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} badgeCode - Code du badge
 * @param {number} incrementBy - Valeur à ajouter (défaut: 1)
 * @param {Object} client - Client Discord (pour déblocage auto et notifications Almost There)
 * @returns {Object|null} Résultat de l'incrémentation
 */
async function incrementBadgeProgress(guildId, playerId, badgeCode, incrementBy = 1, client = null) {
  try {
    const badge = await db.getBadgeByCode(badgeCode);
    if (!badge) {
      console.error(`🔴 Badge ${badgeCode} introuvable`);
      return null;
    }

    // Vérifier si déjà débloqué
    const isUnlocked = await db.playerHasBadge(guildId, playerId, badge.id);
    if (isUnlocked) {
      return null; // Déjà débloqué, rien à faire
    }

    // Récupérer la progression précédente pour "Almost There"
    const previousProgress = await db.queryOne(`
      SELECT current_value FROM badge_progress
      WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
    `, [guildId, playerId, badge.id]);
    const previousValue = previousProgress ? previousProgress.current_value : 0;

    // Incrémenter
    const progress = await db.incrementBadgeProgress(
      guildId,
      playerId,
      badge.id,
      incrementBy,
      badge.condition_value
    );

    // Vérifier si déblocage atteint
    if (progress && progress.current_value >= badge.condition_value) {
      await unlockBadge(guildId, playerId, badgeCode, 'progression_complete', client);
    } else if (client && progress) {
      // Vérifier si on doit envoyer une notification "Almost There"
      await checkAndSendAlmostThereNotification(
        client,
        guildId,
        playerId,
        badge,
        previousValue,
        progress.current_value,
        badge.condition_value
      );
    }

    return progress;
  } catch (error) {
    console.error(`🔴 Erreur incrementBadgeProgress (${badgeCode}):`, error);
    return null;
  }
}

// ================================================================================
// SECTION 3: CONDITION CHECKING
// ================================================================================

/**
 * Vérifie et met à jour les badges liés à l'utilisation d'un super bonus
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} bonusId - ID du super bonus utilisé
 * @param {Object} client - Client Discord
 */
async function checkSuperBonusUsageBadges(guildId, playerId, bonusId, client = null) {
  try {
    // Vérifier si ce bonus a des badges associés
    const badgeList = SUPER_BONUS_TO_BADGE_MAP[bonusId];
    if (!badgeList) {
      return; // Pas de badges pour ce bonus
    }

    // Compter le nombre d'utilisations de ce bonus
    const usageCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM bonus_usage_history
      WHERE guild_id = $1
        AND user_id = $2
        AND bonus_id IN (
          SELECT id FROM super_bonuses WHERE bonus_id = $3
        )
    `, [guildId, playerId, bonusId]);

    const totalUsage = usageCount ? parseInt(usageCount.count) : 0;

    // Mettre à jour la progression pour chaque badge
    for (const badgeInfo of badgeList) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalUsage, client);
    }
  } catch (error) {
    console.error(`🔴 Erreur checkSuperBonusUsageBadges:`, error);
  }
}

/**
 * Vérifie et met à jour les badges liés au blocage de pièges
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function checkTrapBlockBadges(guildId, playerId, client = null) {
  try {
    // Récupérer le Discord ID du joueur (bonus_usage_history utilise user_id, pas player_id)
    const player = await db.queryOne(`
      SELECT discord_id FROM players
      WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId]);

    if (!player || !player.discord_id) {
      console.warn(`⚠️  Impossible de récupérer Discord ID pour player ${playerId}`);
      return;
    }

    // Compter le nombre de pièges bloqués (via Bouclier Anti-Piège)
    const blockCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM bonus_usage_history
      WHERE guild_id = $1
        AND user_id = $2
        AND bonus_id IN (
          SELECT id FROM super_bonuses WHERE bonus_id = 'trap_shield'
        )
        AND effect_result->>'blocked_trap' IS NOT NULL
    `, [guildId, player.discord_id]);

    const totalBlocks = blockCount ? parseInt(blockCount.count) : 0;

    // Mettre à jour la progression pour chaque badge Bouclier
    for (const badgeInfo of TRAP_BLOCK_BADGES) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalBlocks, client);
    }
  } catch (error) {
    console.error(`🔴 Erreur checkTrapBlockBadges:`, error);
  }
}

/**
 * Vérifie et met à jour les badges liés au nombre de collectibles
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function checkCollectibleCountBadges(guildId, playerId, client = null) {
  try {
    // Compter le nombre total de collectibles collectés (actuellement possédés)
    const collectibleCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM collections
      WHERE guild_id = $1
        AND player_id = $2
        AND lost_at IS NULL
    `, [guildId, playerId]);

    const totalCount = collectibleCount ? parseInt(collectibleCount.count) : 0;

    // Mettre à jour la progression pour chaque badge Collection
    for (const badgeInfo of COLLECTION_BADGES) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalCount, client);
    }
  } catch (error) {
    console.error(`🔴 Erreur checkCollectibleCountBadges:`, error);
  }
}

/**
 * Vérifie et met à jour les badges liés aux missions complétées
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function checkMissionCompleteBadges(guildId, playerId, client = null) {
  try {
    // Compter le nombre de missions complétées
    const missionCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM mission_progress
      WHERE guild_id = $1
        AND player_id = $2
        AND status = 'completed'
    `, [guildId, playerId]);

    const totalMissions = missionCount ? parseInt(missionCount.count) : 0;

    // Mettre à jour la progression pour chaque badge Mission
    for (const badgeInfo of MISSION_BADGES) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalMissions, client);
    }
  } catch (error) {
    console.error(`🔴 Erreur checkMissionCompleteBadges:`, error);
  }
}

/**
 * Vérifie et met à jour les badges liés aux mystery boxes ouvertes
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function checkMysteryBoxOpenBadges(guildId, playerId, client = null) {
  try {
    // Compter le nombre de mystery boxes ouvertes
    // (chercher dans give_logs avec give_type contenant 'super_bonus' ou similaire)
    // Mystery boxes sont tracées via give_logs
    const boxCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM give_logs gl
      JOIN players p ON gl.winner_id = p.discord_id AND gl.guild_id = p.guild_id
      WHERE gl.guild_id = $1
        AND p.id = $2
        AND gl.give_type = 'super_bonus'
    `, [guildId, playerId]);

    const totalBoxes = boxCount ? parseInt(boxCount.count) : 0;

    // Mettre à jour la progression pour chaque badge Mystery Box
    for (const badgeInfo of MYSTERY_BOX_BADGES) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalBoxes, client);
    }
  } catch (error) {
    console.error(`🔴 Erreur checkMysteryBoxOpenBadges:`, error);
  }
}

/**
 * Vérifie et met à jour les badges liés à la survie aux pièges
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function checkTrapSurviveBadges(guildId, playerId, client = null) {
  try {
    // Compter le nombre de pièges subis (trap_triggered)
    const trapCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM trap_triggered
      WHERE guild_id = $1
        AND player_id = $2
    `, [guildId, playerId]);

    const totalTraps = trapCount ? parseInt(trapCount.count) : 0;

    // Mettre à jour la progression pour chaque badge Trap Survive
    for (const badgeInfo of TRAP_SURVIVE_BADGES) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalTraps, client);
    }
  } catch (error) {
    console.error(`🔴 Erreur checkTrapSurviveBadges:`, error);
  }
}

/**
 * Vérifie et met à jour les badges liés aux daily claim streaks (calendrier quotidien)
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {number} currentStreak - Streak actuel en jours
 * @param {Object} client - Client Discord
 */
async function checkLoginStreakBadges(guildId, playerId, currentStreak, client = null) {
  try {
    // Mettre à jour la progression pour chaque badge Engagement
    for (const badgeInfo of ENGAGEMENT_BADGES) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, currentStreak, client);
    }
  } catch (error) {
    console.error(`🔴 Erreur checkLoginStreakBadges:`, error);
  }
}

/**
 * Vérifie toutes les conditions de badges pour un joueur
 * (Appelé périodiquement ou après action importante)
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function checkAllBadgeConditions(guildId, playerId, client = null) {
  try {
    // Vérifier les badges Super Bonus
    for (const bonusId of Object.keys(SUPER_BONUS_TO_BADGE_MAP)) {
      await checkSuperBonusUsageBadges(guildId, playerId, bonusId, client);
    }

    // Vérifier les badges Bouclier
    await checkTrapBlockBadges(guildId, playerId, client);

    // Vérifier les badges Collection
    await checkCollectibleCountBadges(guildId, playerId, client);

    // Vérifier les badges Mission
    await checkMissionCompleteBadges(guildId, playerId, client);

    // Vérifier les badges Mystery Box
    await checkMysteryBoxOpenBadges(guildId, playerId, client);

    // Vérifier les badges Trap Survive
    await checkTrapSurviveBadges(guildId, playerId, client);

    // Note: Login streaks nécessitent un paramètre spécifique
  } catch (error) {
    console.error(`🔴 Erreur checkAllBadgeConditions:`, error);
  }
}

// ================================================================================
// SECTION 4: NOTIFICATIONS
// ================================================================================

/**
 * Envoie une notification de déblocage de badge
 *
 * @param {Object} client - Client Discord
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} badge - Badge débloqué
 */
async function sendBadgeUnlockNotification(client, guildId, playerId, badge) {
  try {
    // Récupérer le joueur
    const player = await db.queryOne(
      'SELECT discord_id, username FROM players WHERE id = $1 AND guild_id = $2',
      [playerId, guildId]
    );

    if (!player) {
      console.error(`🔴 Joueur ${playerId} introuvable`);
      return;
    }

    // Récupérer le user Discord
    const user = await client.users.fetch(player.discord_id);
    if (!user) {
      return;
    }

    // Construire l'embed de notification
    const rarityColor = RARITY_COLORS[badge.rarity] || '#95a5a6';
    const rarityEmoji = RARITY_EMOJIS[badge.rarity] || '⚪';
    const rarityName = RARITY_NAMES[badge.rarity] || badge.rarity;

    const embed = new EmbedBuilder()
      .setColor(rarityColor)
      .setTitle(`${rarityEmoji} NOUVEAU BADGE DÉBLOQUÉ !`)
      .setDescription(`### ${badge.emoji} ${badge.name}\n\n${badge.description}`)
      .addFields(
        { name: 'Rareté', value: `${rarityEmoji} **${rarityName}**`, inline: true },
        { name: 'Catégorie', value: badge.category.replace('_', ' ').toUpperCase(), inline: true }
      )
      .setFooter({ text: 'Bravo ! 🎉' })
      .setTimestamp();

    // Bouton pour voir tous les badges
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`view_my_badges:${guildId}`)
        .setLabel('Voir mes badges')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Primary)
    );

    // Envoyer en DM
    await user.send({
      content: `🎉 Félicitations <@${player.discord_id}> !`,
      embeds: [embed],
      components: [row]
    }).catch(err => {
      console.error(`🔴 Impossible d'envoyer DM à ${player.username}:`, err.message);
    });
  } catch (error) {
    console.error(`🔴 Erreur sendBadgeUnlockNotification:`, error);
  }
}

/**
 * Envoie une notification "Almost There" quand un joueur approche d'un badge
 *
 * @param {Object} client - Client Discord
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} badge - Badge concerné
 * @param {number} currentValue - Valeur actuelle de progression
 * @param {number} targetValue - Valeur cible
 * @param {number} thresholdReached - Seuil atteint (50, 75, 90, 95)
 */
async function sendAlmostThereNotification(client, guildId, playerId, badge, currentValue, targetValue, thresholdReached) {
  try {
    // Récupérer le joueur
    const player = await db.queryOne(
      'SELECT discord_id, username FROM players WHERE id = $1 AND guild_id = $2',
      [playerId, guildId]
    );

    if (!player) {
      console.error(`🔴 Joueur ${playerId} introuvable pour Almost There`);
      return;
    }

    // Récupérer le user Discord
    const user = await client.users.fetch(player.discord_id);
    if (!user) {
      return;
    }

    // Message motivant selon le seuil
    const thresholdInfo = ALMOST_THERE_MESSAGES[thresholdReached] || ALMOST_THERE_MESSAGES[75];
    const rarityColor = RARITY_COLORS[badge.rarity] || '#3498db';
    const rarityEmoji = RARITY_EMOJIS[badge.rarity] || '⚪';
    const remaining = targetValue - currentValue;
    const percentage = Math.round((currentValue / targetValue) * 100);

    // Créer une barre de progression visuelle
    const progressBarLength = 10;
    const filledBars = Math.round((currentValue / targetValue) * progressBarLength);
    const emptyBars = progressBarLength - filledBars;
    const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

    const embed = new EmbedBuilder()
      .setColor(rarityColor)
      .setTitle(`${thresholdInfo.emoji} ${thresholdInfo.title}`)
      .setDescription(`### ${badge.emoji} ${badge.name}\n\n${thresholdInfo.message}`)
      .addFields(
        {
          name: '📊 Progression',
          value: `\`${progressBar}\` **${percentage}%**\n${currentValue}/${targetValue} (reste **${remaining}**)`,
          inline: false
        },
        {
          name: '🏆 Rareté',
          value: `${rarityEmoji} ${RARITY_NAMES[badge.rarity] || badge.rarity}`,
          inline: true
        },
        {
          name: '📁 Catégorie',
          value: getCategoryDisplayNameForNotif(badge.category),
          inline: true
        }
      )
      .setFooter({ text: 'Continue comme ça ! 💪' })
      .setTimestamp();

    // Bouton pour voir la progression des badges
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`view_badge_progress:${guildId}`)
        .setLabel('Voir ma progression')
        .setEmoji('📈')
        .setStyle(ButtonStyle.Primary)
    );

    // Envoyer en DM
    await user.send({
      embeds: [embed],
      components: [row]
    }).catch(err => {
      // Silencieusement ignorer si les DMs sont fermés
      console.log(`📧 Almost There DM non envoyé à ${player.username}: DMs fermés`);
    });

    console.log(`📧 [Almost There] Notification envoyée à ${player.username} pour ${badge.name} (${percentage}%)`);
  } catch (error) {
    console.error(`🔴 Erreur sendAlmostThereNotification:`, error);
  }
}

/**
 * Helper: Nom de catégorie pour notifications
 */
function getCategoryDisplayNameForNotif(category) {
  const categoryNames = {
    super_bonus: '⚡ Super Bonus',
    collection: '🎯 Collection',
    rarity: '💎 Rareté',
    mystery_box: '📦 Mystery Box',
    trap: '⚠️ Pièges',
    mission: '🎯 Missions',
    engagement: '📅 Engagement',
    social: '👥 Social',
    special: '🌟 Spécial',
    crafting: '🔨 Crafting',
    evolution: '📈 Évolution',
    economy: '💰 Économie',
    seniority: '⏰ Ancienneté',
    mint: '✨ Mint',
    luck: '🍀 Chance'
  };
  return categoryNames[category] || category;
}

/**
 * Vérifie et envoie les notifications "Almost There" si applicable
 *
 * @param {Object} client - Client Discord
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} badge - Badge concerné
 * @param {number} previousValue - Valeur précédente
 * @param {number} currentValue - Nouvelle valeur
 * @param {number} targetValue - Valeur cible
 */
async function checkAndSendAlmostThereNotification(client, guildId, playerId, badge, previousValue, currentValue, targetValue) {
  if (!client || currentValue >= targetValue) return; // Pas de notif si déjà débloqué

  const previousPercentage = Math.round((previousValue / targetValue) * 100);
  const currentPercentage = Math.round((currentValue / targetValue) * 100);

  // Vérifier si on a franchi un seuil
  for (const threshold of ALMOST_THERE_THRESHOLDS) {
    if (previousPercentage < threshold && currentPercentage >= threshold) {
      // On vient de franchir ce seuil !
      await sendAlmostThereNotification(client, guildId, playerId, badge, currentValue, targetValue, threshold);
      break; // Une seule notification par mise à jour
    }
  }
}

// ================================================================================
// SECTION 5: STATISTICS & LEADERBOARDS
// ================================================================================

/**
 * Récupère les statistiques de badges d'un joueur
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @returns {Object} Statistiques des badges
 */
async function getPlayerBadgeStats(guildId, playerId) {
  try {
    const stats = await db.getPlayerBadgeStats(guildId, playerId);

    // Calculer le pourcentage de complétion
    const totalBadges = await db.queryOne('SELECT COUNT(*) as count FROM badges WHERE is_secret = FALSE');
    const totalAvailable = totalBadges ? parseInt(totalBadges.count) : 0;
    const completionPercentage = totalAvailable > 0
      ? Math.round((stats.total_badges / totalAvailable) * 100)
      : 0;

    return {
      ...stats,
      totalAvailable,
      completionPercentage
    };
  } catch (error) {
    console.error(`🔴 Erreur getPlayerBadgeStats:`, error);
    return null;
  }
}

/**
 * Récupère le leaderboard des badges
 *
 * @param {string} guildId - ID du serveur
 * @param {number} limit - Nombre de joueurs à retourner
 * @returns {Array} Top joueurs
 */
async function getBadgeLeaderboard(guildId, limit = 10) {
  try {
    return await db.getBadgeLeaderboard(guildId, limit);
  } catch (error) {
    console.error(`🔴 Erreur getBadgeLeaderboard:`, error);
    return [];
  }
}

/**
 * Récupère les badges récemment débloqués
 *
 * @param {string} guildId - ID du serveur
 * @param {number} limit - Nombre de badges à retourner
 * @returns {Array} Badges récents
 */
async function getRecentBadgeUnlocks(guildId, limit = 10) {
  try {
    return await db.getRecentBadgeUnlocks(guildId, limit);
  } catch (error) {
    console.error(`🔴 Erreur getRecentBadgeUnlocks:`, error);
    return [];
  }
}

// ================================================================================
// SECTION 6: INTEGRATION HOOKS
// ================================================================================

/**
 * Hook appelé quand un super bonus est utilisé
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} bonusId - ID du super bonus
 * @param {Object} client - Client Discord
 */
async function onSuperBonusUsed(guildId, playerId, bonusId, client = null) {
  await checkSuperBonusUsageBadges(guildId, playerId, bonusId, client);
}

/**
 * Hook appelé quand un piège est bloqué
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function onTrapBlocked(guildId, playerId, client = null) {
  await checkTrapBlockBadges(guildId, playerId, client);
}

/**
 * Hook appelé quand un collectible est trouvé
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} rarity - Rareté du collectible
 * @param {Object} client - Client Discord
 */
async function onCollectibleFound(guildId, playerId, rarity, client = null) {
  await checkCollectibleCountBadges(guildId, playerId, client);
}

/**
 * Hook appelé quand une mission est complétée
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function onMissionCompleted(guildId, playerId, client = null) {
  await checkMissionCompleteBadges(guildId, playerId, client);
}

/**
 * Hook appelé quand une mystery box est ouverte
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function onMysteryBoxOpened(guildId, playerId, client = null) {
  await checkMysteryBoxOpenBadges(guildId, playerId, client);
}

/**
 * Hook appelé quand un joueur subit un piège (survit)
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function onTrapSurvived(guildId, playerId, client = null) {
  await checkTrapSurviveBadges(guildId, playerId, client);
}

/**
 * Hook appelé pour mettre à jour le login streak
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {number} currentStreak - Streak actuel en jours
 * @param {Object} client - Client Discord
 */
async function onLoginStreak(guildId, playerId, currentStreak, client = null) {
  await checkLoginStreakBadges(guildId, playerId, currentStreak, client);
}

/**
 * Hook appelé quand un joueur résout un emoji-puzzle avec 1 seul emoji
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function onEmojiPuzzleSolvedWithOneEmoji(guildId, playerId, client = null) {
  try {
    console.log(`🧩 [Badge] Emoji-puzzle résolu avec 1 emoji - Player ${playerId}`);

    // Chercher le badge "EMOJI_PUZZLE_FIRST_TRY" ou équivalent
    const badge = await db.queryOne(
      `SELECT * FROM badges WHERE code = 'EMOJI_PUZZLE_FIRST_TRY' OR code = 'EMOJI_GENIUS'`
    );

    if (!badge) {
      console.log('⚠️ Badge emoji-puzzle non trouvé en DB (sera créé plus tard)');
      return;
    }

    // Débloquer directement le badge (condition = 1 occurrence)
    await unlockBadge(guildId, playerId, badge.code, client);

  } catch (error) {
    console.error('🔴 Erreur hook onEmojiPuzzleSolvedWithOneEmoji:', error);
  }
}

// ================================================================================
// HOOK: onCrafting
// Vérifie les badges liés au crafting de clés
// ================================================================================

/**
 * 🔨 Hook appelé après chaque craft (upgrade ou recycle)
 * Vérifie les badges de crafting basés sur les stats du joueur
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} stats - Stats de crafting du joueur
 * @param {Object} client - Client Discord
 */
async function onCrafting(guildId, playerId, stats, client = null) {
  try {
    console.log(`🔨 [Badge] Crafting hook - Player ${playerId}, upgrades: ${stats.total_upgrades}, criticals: ${stats.total_criticals}, recycles: ${stats.total_recycles}`);

    // Mapping des badges crafting
    const craftingBadges = [
      // Badges Upgrades
      { code: 'CRAFT_NOVICE', condition: 'crafting_upgrades', threshold: 1 },
      { code: 'CRAFT_APPRENTICE', condition: 'crafting_upgrades', threshold: 10 },
      { code: 'CRAFT_EXPERT', condition: 'crafting_upgrades', threshold: 50 },
      { code: 'CRAFT_MASTER', condition: 'crafting_upgrades', threshold: 100 },
      { code: 'CRAFT_LEGEND', condition: 'crafting_upgrades', threshold: 500 },

      // Badges Critiques
      { code: 'CRAFT_LUCKY', condition: 'crafting_criticals', threshold: 1 },
      { code: 'CRAFT_FORTUNE', condition: 'crafting_criticals', threshold: 10 },
      { code: 'CRAFT_BLESSED', condition: 'crafting_criticals', threshold: 50 },

      // Badges Recyclage
      { code: 'RECYCLER_NOVICE', condition: 'crafting_recycles', threshold: 1 },
      { code: 'RECYCLER_EXPERT', condition: 'crafting_recycles', threshold: 25 },
      { code: 'RECYCLER_MASTER', condition: 'crafting_recycles', threshold: 100 }
    ];

    // Récupérer les badges existants
    const badges = await db.queryAll(
      `SELECT * FROM badges WHERE code IN (${craftingBadges.map((_, i) => `$${i + 1}`).join(', ')})`,
      craftingBadges.map(b => b.code)
    );

    if (badges.length === 0) {
      console.log('⚠️ Aucun badge crafting trouvé en DB (à créer via script de seeding)');
      return;
    }

    // Vérifier chaque badge
    for (const badgeDef of craftingBadges) {
      const badge = badges.find(b => b.code === badgeDef.code);
      if (!badge) continue;

      let currentValue = 0;
      switch (badgeDef.condition) {
        case 'crafting_upgrades':
          currentValue = stats.total_upgrades;
          break;
        case 'crafting_criticals':
          currentValue = stats.total_criticals;
          break;
        case 'crafting_recycles':
          currentValue = stats.total_recycles;
          break;
      }

      // Débloquer ou mettre à jour la progression
      if (currentValue >= badgeDef.threshold) {
        await unlockBadge(guildId, playerId, badgeDef.code, client);
      } else {
        await updateBadgeProgress(guildId, playerId, badgeDef.code, currentValue);
      }
    }

  } catch (error) {
    console.error('🔴 Erreur hook onCrafting:', error);
  }
}

// ================================================================================
// NOUVEAUX HOOKS POUR BADGES V2
// ================================================================================

/**
 * 💎 Hook appelé quand un collectible est trouvé - vérifie les badges par rareté
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} rarity - Rareté du collectible (common, rare, epic, legendary)
 * @param {number} mintNumber - Numéro de mint du collectible
 * @param {Object} client - Client Discord
 */
async function onCollectibleFoundWithDetails(guildId, playerId, rarity, mintNumber = null, client = null) {
  try {
    console.log(`💎 [Badge] Collectible trouvé - Player ${playerId}, rarity: ${rarity}, mint: ${mintNumber}`);

    // 1. Badges par rareté spécifique (legendary_count, epic_count, rare_count)
    if (RARITY_COUNT_BADGES[rarity]) {
      const rarityCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL AND col.rarity = $3
      `, [guildId, playerId, rarity]);

      const count = rarityCount ? parseInt(rarityCount.count) : 0;
      for (const badgeInfo of RARITY_COUNT_BADGES[rarity]) {
        await updateBadgeProgress(guildId, playerId, badgeInfo.code, count, client);
      }
    }

    // 2. Badges de mint (#1, #1-10, #100) - V3: Avec progressions
    if (mintNumber) {
      // Compter tous les mint #1 du joueur
      if (mintNumber === 1) {
        const firstMintCount = await db.queryOne(`
          SELECT COUNT(*) as count FROM collections
          WHERE guild_id = $1 AND player_id = $2 AND mint_number = 1 AND lost_at IS NULL
        `, [guildId, playerId]);
        const count = firstMintCount ? parseInt(firstMintCount.count) : 1;

        for (const badgeInfo of MINT_BADGES.first) {
          await updateBadgeProgress(guildId, playerId, badgeInfo.code, count, client);
        }
      }

      // Compter tous les mint top 10 du joueur
      if (mintNumber <= 10) {
        const top10Count = await db.queryOne(`
          SELECT COUNT(*) as count FROM collections
          WHERE guild_id = $1 AND player_id = $2 AND mint_number <= 10 AND lost_at IS NULL
        `, [guildId, playerId]);
        const count = top10Count ? parseInt(top10Count.count) : 1;

        for (const badgeInfo of MINT_BADGES.top_10) {
          await updateBadgeProgress(guildId, playerId, badgeInfo.code, count, client);
        }
      }

      // Compter tous les mint #100 du joueur
      if (mintNumber === 100) {
        const mint100Count = await db.queryOne(`
          SELECT COUNT(*) as count FROM collections
          WHERE guild_id = $1 AND player_id = $2 AND mint_number = 100 AND lost_at IS NULL
        `, [guildId, playerId]);
        const count = mint100Count ? parseInt(mint100Count.count) : 1;

        for (const badgeInfo of MINT_BADGES.mint_100) {
          await updateBadgeProgress(guildId, playerId, badgeInfo.code, count, client);
        }
      }
    }

    // 3. Vérifier les légendaires en 24h (V3: utilise le nouveau hook)
    if (rarity === 'legendary') {
      await onLegendariesIn24h(guildId, playerId, client);
    }

    // 4. Vérifier complétion du thème
    await checkThemeCompletionBadges(guildId, playerId, client);

    // 5. Mettre à jour les badges collection classiques
    await checkCollectibleCountBadges(guildId, playerId, client);

  } catch (error) {
    console.error('🔴 Erreur hook onCollectibleFoundWithDetails:', error);
  }
}

/**
 * ⭐ Hook appelé quand un collectible évolue de niveau
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {number} newLevel - Nouveau niveau atteint
 * @param {Object} client - Client Discord
 */
async function onCollectibleEvolution(guildId, playerId, newLevel, client = null) {
  try {
    console.log(`⭐ [Badge] Évolution niveau ${newLevel} - Player ${playerId}`);

    // Badges niveau spécifique
    for (const badgeInfo of EVOLUTION_BADGES) {
      if (newLevel >= badgeInfo.level) {
        await unlockBadge(guildId, playerId, badgeInfo.code, 'evolution_level', client);
      }
    }

    // Badge "10 collectibles au niveau 4"
    if (newLevel === 4) {
      const maxLevelCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM collections
        WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL AND level = 4
      `, [guildId, playerId]);

      const count = maxLevelCount ? parseInt(maxLevelCount.count) : 0;
      await updateBadgeProgress(guildId, playerId, 'EVOLUTION_MASTER', count, client);
    }

  } catch (error) {
    console.error('🔴 Erreur hook onCollectibleEvolution:', error);
  }
}

/**
 * 📦 Hook appelé quand une mystery box est ouverte - avec rareté
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} boxRarity - Rareté de la box (common, rare, epic, legendary)
 * @param {Object} client - Client Discord
 */
async function onMysteryBoxOpenedWithRarity(guildId, playerId, boxRarity, client = null) {
  try {
    console.log(`📦 [Badge] Mystery Box ${boxRarity} ouverte - Player ${playerId}`);

    // Badge par rareté de box (V3: tableau de badges par niveau)
    if (MYSTERY_BOX_RARITY_BADGES[boxRarity]) {
      const boxBadges = MYSTERY_BOX_RARITY_BADGES[boxRarity];
      const rarityBoxCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM give_logs gl
        JOIN players p ON gl.winner_id = p.discord_id AND gl.guild_id = p.guild_id
        WHERE gl.guild_id = $1 AND p.id = $2 AND gl.mystery_box_rarity = $3
      `, [guildId, playerId, boxRarity]);

      const count = rarityBoxCount ? parseInt(rarityBoxCount.count) : 0;
      console.log(`📦 [Badge] Comptage boxes ${boxRarity}: ${count}`);

      // V3: Itérer sur tous les niveaux de badges pour cette rareté
      for (const badgeInfo of boxBadges) {
        await updateBadgeProgress(guildId, playerId, badgeInfo.code, count, client);
      }
    }

    // Badge "toutes les raretés ouvertes"
    const allRarities = await db.queryOne(`
      SELECT
        COUNT(DISTINCT gl.mystery_box_rarity) as rarity_count
      FROM give_logs gl
      JOIN players p ON gl.winner_id = p.discord_id AND gl.guild_id = p.guild_id
      WHERE gl.guild_id = $1 AND p.id = $2
      AND gl.mystery_box_rarity IN ('common', 'rare', 'epic', 'legendary')
    `, [guildId, playerId]);

    if (allRarities && parseInt(allRarities.rarity_count) >= 4) {
      await unlockBadge(guildId, playerId, 'BOX_FULL_SET', 'all_rarities_opened', client);
    }

    // Mettre à jour les badges mystery box classiques
    await checkMysteryBoxOpenBadges(guildId, playerId, client);

  } catch (error) {
    console.error('🔴 Erreur hook onMysteryBoxOpenedWithRarity:', error);
  }
}

/**
 * 💥 Hook appelé quand un piège est déclenché
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} trapType - Type du piège (lose_all, etc.)
 * @param {Object} client - Client Discord
 */
async function onTrapTriggered(guildId, playerId, trapType = null, client = null) {
  try {
    console.log(`💥 [Badge] Piège déclenché - Player ${playerId}, type: ${trapType}`);

    // Compter les pièges déclenchés
    const trapCount = await db.queryOne(`
      SELECT COUNT(*) as count FROM trap_triggered
      WHERE guild_id = $1 AND player_id = $2
    `, [guildId, playerId]);

    const count = trapCount ? parseInt(trapCount.count) : 0;

    for (const badgeInfo of TRAP_TRIGGERED_BADGES) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, count, client);
    }

    // Badge spécial "survivre à lose_all"
    if (trapType === 'lose_all') {
      await unlockBadge(guildId, playerId, 'TRAP_INFERNAL_SURVIVOR', 'survive_lose_all', client);
    }

    // Aussi mettre à jour les badges trap survive
    await checkTrapSurviveBadges(guildId, playerId, client);

  } catch (error) {
    console.error('🔴 Erreur hook onTrapTriggered:', error);
  }
}

/**
 * 🎯 Hook appelé quand une mission est complétée avec détails
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} missionDetails - Détails de la mission
 * @param {Object} client - Client Discord
 */
async function onMissionCompletedWithDetails(guildId, playerId, missionDetails = {}, client = null) {
  try {
    console.log(`🎯 [Badge] Mission complétée - Player ${playerId}`, missionDetails);

    const {
      missionType,        // 'quiz', 'keyword', 'emoji', 'wordle', etc.
      timeTaken,          // temps en secondes
      perfectQuiz,        // true si 100% au quiz
      wordleFirstTry,     // true si wordle réussi en 1 essai
      consecutiveSuccess  // nombre de missions réussies consécutives
    } = missionDetails;

    // Badge Speed Runner (moins de 10 secondes)
    if (timeTaken && timeTaken < 10) {
      await unlockBadge(guildId, playerId, 'MISSION_SPEED_RUNNER', 'fast_mission', client);
    }

    // Badge Perfect Quiz
    if (perfectQuiz) {
      await unlockBadge(guildId, playerId, 'MISSION_QUIZ_PERFECT', 'perfect_quiz', client);
    }

    // Badge Wordle Genius
    if (wordleFirstTry) {
      await unlockBadge(guildId, playerId, 'MISSION_WORDLE_GENIUS', 'wordle_first_try', client);
    }

    // Badge Sans Faute (10 missions consécutives sans échec)
    if (consecutiveSuccess) {
      await updateBadgeProgress(guildId, playerId, 'MISSION_FLAWLESS', consecutiveSuccess, client);
    }

    // Badge Rédemption (réussir après 3 échecs)
    // Note: nécessite tracking des échecs consécutifs dans la DB

    // Mettre à jour les badges mission classiques
    await checkMissionCompleteBadges(guildId, playerId, client);

  } catch (error) {
    console.error('🔴 Erreur hook onMissionCompletedWithDetails:', error);
  }
}

/**
 * 💰 Hook appelé pour les opérations économiques (Loomix)
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} operation - 'earned', 'spent', 'balance_check'
 * @param {number} amount - Montant concerné
 * @param {Object} client - Client Discord
 */
async function onLoomixOperation(guildId, playerId, operation, amount, client = null) {
  try {
    console.log(`💰 [Badge] Loomix ${operation} - Player ${playerId}, amount: ${amount}`);

    // Récupérer les stats économiques du joueur depuis player_currency
    const currency = await db.queryOne(`
      SELECT balance, total_earned, total_spent
      FROM player_currency
      WHERE guild_id = $1 AND player_id = $2 AND currency_type = 'loomix'
    `, [guildId, playerId]);

    if (!currency) {
      console.log(`💰 [Badge] Aucune entrée player_currency pour player ${playerId}`);
      return;
    }

    console.log(`💰 [Badge] Stats Loomix - balance: ${currency.balance}, earned: ${currency.total_earned}, spent: ${currency.total_spent}`);

    // Badges earned
    for (const badgeInfo of ECONOMY_BADGES.earned) {
      const totalEarned = currency.total_earned || 0;
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalEarned, client);
    }

    // Badges spent
    for (const badgeInfo of ECONOMY_BADGES.spent) {
      const totalSpent = currency.total_spent || 0;
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalSpent, client);
    }

    // Badges balance
    for (const badgeInfo of ECONOMY_BADGES.balance) {
      const balance = currency.balance || 0;
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, balance, client);
    }

  } catch (error) {
    console.error('🔴 Erreur hook onLoomixOperation:', error);
  }
}

/**
 * 📅 Hook appelé pour vérifier l'ancienneté du joueur
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function onPlayerActivity(guildId, playerId, client = null) {
  try {
    // Calculer les jours depuis la création du compte
    const player = await db.queryOne(`
      SELECT created_at FROM players WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId]);

    if (!player) return;

    const createdAt = new Date(player.created_at);
    const now = new Date();
    const daysActive = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

    console.log(`📅 [Badge] Ancienneté - Player ${playerId}, jours: ${daysActive}`);

    for (const badgeInfo of SENIORITY_BADGES) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, daysActive, client);
    }

  } catch (error) {
    console.error('🔴 Erreur hook onPlayerActivity:', error);
  }
}

/**
 * 📤 Hook appelé quand /flex est utilisé
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function onFlexUsed(guildId, playerId, client = null) {
  try {
    // Incrémenter le compteur de flex et récupérer la nouvelle valeur
    const result = await db.queryOne(`
      UPDATE players
      SET flex_count = COALESCE(flex_count, 0) + 1
      WHERE guild_id = $1 AND id = $2
      RETURNING flex_count
    `, [guildId, playerId]);

    const count = result ? result.flex_count : 1;
    console.log(`📤 [Badge] Flex utilisé - Player ${playerId}, total: ${count}`);

    for (const badgeInfo of SOCIAL_BADGES.flex) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, count, client);
    }

  } catch (error) {
    console.error('🔴 Erreur hook onFlexUsed:', error);
  }
}

/**
 * ⭐ Hook appelé quand les favoris sont configurés
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {number} favoritesCount - Nombre de favoris configurés
 * @param {Object} client - Client Discord
 */
async function onFavoritesSet(guildId, playerId, favoritesCount, client = null) {
  try {
    console.log(`⭐ [Badge] Favoris configurés - Player ${playerId}, count: ${favoritesCount}`);

    if (favoritesCount >= 3) {
      await unlockBadge(guildId, playerId, 'SOCIAL_FAVORITES', 'favorites_set', client);
    }

  } catch (error) {
    console.error('🔴 Erreur hook onFavoritesSet:', error);
  }
}

/**
 * 🔥 Hook appelé pour vérifier les win streaks
 * Calcule automatiquement le streak actuel en regardant les dernières mystery boxes
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {number} winStreak - Streak de victoires sans piège (optionnel, calculé si non fourni)
 * @param {Object} client - Client Discord
 */
async function onWinStreak(guildId, playerId, winStreak = null, client = null) {
  try {
    // Si winStreak n'est pas fourni, le calculer dynamiquement
    if (winStreak === null) {
      // Récupérer le discord_id du joueur
      const player = await db.queryOne(
        'SELECT discord_id FROM players WHERE guild_id = $1 AND id = $2',
        [guildId, playerId]
      );
      if (!player) return;

      // Calculer le streak: combien de give_logs sans trap_triggered depuis le dernier piège
      const lastTrap = await db.queryOne(`
        SELECT MAX(triggered_at) as last_trap
        FROM trap_triggered
        WHERE guild_id = $1 AND player_id = $2
      `, [guildId, playerId]);

      // Compter les mystery boxes ouvertes depuis le dernier piège
      const streakResult = await db.queryOne(`
        SELECT COUNT(*) as streak
        FROM give_logs
        WHERE guild_id = $1 AND winner_id = $2
        ${lastTrap?.last_trap ? "AND claimed_at > $3" : ""}
      `, lastTrap?.last_trap
        ? [guildId, player.discord_id, lastTrap.last_trap]
        : [guildId, player.discord_id]
      );

      winStreak = streakResult ? parseInt(streakResult.streak) : 0;
    }

    console.log(`🔥 [Badge] Win streak - Player ${playerId}, streak: ${winStreak}`);

    // V3: Itérer sur tous les niveaux de win_streak (3, 5, 7, 10, 15)
    for (const badgeInfo of LUCK_BADGES.win_streak) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, winStreak, client);
    }

  } catch (error) {
    console.error('🔴 Erreur hook onWinStreak:', error);
  }
}

/**
 * 🍀 Hook: Légendaires trouvés en 24h
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} client - Client Discord
 */
async function onLegendariesIn24h(guildId, playerId, client = null) {
  try {
    // Compter les légendaires trouvés dans les dernières 24h
    const legendaryCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2
        AND col.rarity = 'legendary'
        AND c.collected_at > NOW() - INTERVAL '24 hours'
        AND c.lost_at IS NULL
    `, [guildId, playerId]);

    const count = legendaryCount ? parseInt(legendaryCount.count) : 0;

    if (count >= 1) {
      console.log(`🍀 [Badge] Légendaires en 24h - Player ${playerId}: ${count} légendaires`);

      // V3: Itérer sur tous les niveaux de legendaries_24h (1, 2, 3, 5)
      for (const badgeInfo of LUCK_BADGES.legendaries_24h) {
        await updateBadgeProgress(guildId, playerId, badgeInfo.code, count, client);
      }
    }

  } catch (error) {
    console.error('🔴 Erreur hook onLegendariesIn24h:', error);
  }
}

/**
 * 📚 Vérifie les badges de complétion de thème
 * V3: Utilise THEME_BADGES.completion (25%, 50%, 75%, 100%)
 *     et THEME_BADGES.completed (nombre de thèmes complétés)
 */
async function checkThemeCompletionBadges(guildId, playerId, client = null) {
  try {
    // Récupérer le pourcentage de complétion du thème actif
    const theme = await db.getActiveTheme(guildId);
    if (!theme) return;

    const totalCollectibles = await db.queryOne(`
      SELECT COUNT(*) as count FROM collectibles WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, theme.id]);

    const playerCollectibles = await db.queryOne(`
      SELECT COUNT(DISTINCT c.collectible_id) as count
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3 AND c.lost_at IS NULL
    `, [guildId, playerId, theme.id]);

    const total = totalCollectibles ? parseInt(totalCollectibles.count) : 0;
    const collected = playerCollectibles ? parseInt(playerCollectibles.count) : 0;
    const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;

    console.log(`📚 [Badge] Complétion thème - Player ${playerId}: ${percentage}%`);

    // V3: Itérer sur tous les niveaux de complétion (25%, 50%, 75%, 100%)
    for (const badgeInfo of THEME_BADGES.completion) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, percentage, client);
    }

    // Si thème 100% complété, vérifier badges themes_completed
    if (percentage >= 100) {
      // Compter le nombre de thèmes complétés à 100%
      const completedThemes = await db.queryAll(`
        SELECT DISTINCT col.theme_id
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
        GROUP BY col.theme_id
        HAVING COUNT(DISTINCT c.collectible_id) >= (
          SELECT COUNT(*) FROM collectibles WHERE guild_id = $1 AND theme_id = col.theme_id
        )
      `, [guildId, playerId]);

      const completedCount = completedThemes ? completedThemes.length : 0;
      console.log(`📚 [Badge] Thèmes complétés - Player ${playerId}: ${completedCount}`);

      // V3: Itérer sur tous les niveaux de thèmes complétés (1, 3, 5, 10)
      for (const badgeInfo of THEME_BADGES.completed) {
        await updateBadgeProgress(guildId, playerId, badgeInfo.code, completedCount, client);
      }
    }

  } catch (error) {
    console.error('🔴 Erreur checkThemeCompletionBadges:', error);
  }
}

/**
 * 🎁 Hook: Super Bonus reçu (quand le bonus est UTILISÉ/ACTIVÉ, pas juste attribué)
 * V3: Utilise checkSuperBonusUsageBadges pour gérer les progressions par type de bonus
 *     + Badge SUPER_BONUS_COLLECTIONNEUR pour le nombre total de bonus reçus
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} bonusType - Type de bonus reçu (vision_divine, jackpot_x2, legendary_magnet, trap_shield)
 * @param {Object} client - Client Discord
 */
async function onSuperBonusReceived(guildId, playerId, bonusType, client = null) {
  try {
    console.log(`🎁 [Badge] Super bonus utilisé - Player ${playerId}, type: ${bonusType}`);

    // 1. Mettre à jour les badges spécifiques au type de bonus (via le mapping existant)
    await checkSuperBonusUsageBadges(guildId, playerId, bonusType, client);

    // 2. Badge SUPER_BONUS_COLLECTIONNEUR (nombre total de bonus différents reçus/utilisés)
    // Récupérer le discord_id du joueur
    const player = await db.queryOne(`
      SELECT discord_id FROM players WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId]);

    if (player?.discord_id) {
      // Compter le nombre total de super bonus utilisés (tous types confondus)
      const totalUsed = await db.queryOne(`
        SELECT COUNT(*) as count FROM bonus_usage_history
        WHERE guild_id = $1 AND user_id = $2
      `, [guildId, player.discord_id]);

      const count = totalUsed ? parseInt(totalUsed.count) : 0;

      // Badge SUPER_BONUS_COLLECTIONNEUR (11 super bonus utilisés)
      await updateBadgeProgress(guildId, playerId, 'SUPER_BONUS_COLLECTIONNEUR', count, client);
    }

  } catch (error) {
    console.error('🔴 Erreur hook onSuperBonusReceived:', error);
  }
}

/**
 * 🎮 Hook: Partie de Morpion terminée
 * Vérifie et débloque tous les badges Tictactoe basés sur les stats du joueur
 *
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {Object} stats - Stats du joueur depuis tictactoe_stats
 * @param {Object} client - Client Discord
 */
async function onTictactoeGameComplete(guildId, playerId, stats, client = null) {
  try {
    console.log(`🎮 [Badge] Tictactoe game complete - Player ${playerId}`);

    if (!stats) {
      console.warn('⚠️ [Badge] Stats tictactoe manquantes pour player', playerId);
      return;
    }

    // 1. Badges Victoires (games_won)
    for (const badge of TICTACTOE_BADGES.wins) {
      if (stats.games_won >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.games_won, client);
      }
    }

    // 2. Badges Parties jouées (games_played)
    for (const badge of TICTACTOE_BADGES.games_played) {
      if (stats.games_played >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.games_played, client);
      }
    }

    // 3. Badges Win Streak (best_win_streak)
    for (const badge of TICTACTOE_BADGES.win_streak) {
      if (stats.best_win_streak >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.best_win_streak, client);
      }
    }

    // 4. Badges Victoires propres (wins_by_play)
    for (const badge of TICTACTOE_BADGES.clean_wins) {
      if (stats.wins_by_play >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.wins_by_play, client);
      }
    }

    // 5. Badges Victoire rapide (fastest_win_moves) - inversé: moins = mieux
    // On ne check que si le joueur a un fastest_win_moves valide (>0)
    if (stats.fastest_win_moves && stats.fastest_win_moves > 0) {
      for (const badge of TICTACTOE_BADGES.fast_wins) {
        if (stats.fastest_win_moves <= badge.threshold) {
          // Pour les fast wins, on passe 1 car c'est un badge binaire (atteint ou non)
          await updateBadgeProgress(guildId, playerId, badge.code, 1, client);
        }
      }
    }

    // 6. Badges Égalités (games_draw)
    for (const badge of TICTACTOE_BADGES.draws) {
      if (stats.games_draw >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.games_draw, client);
      }
    }

    // 7. Badges Résilience - défaites (games_lost)
    for (const badge of TICTACTOE_BADGES.resilience) {
      if (stats.games_lost >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.games_lost, client);
      }
    }

    // 8. Badges Patience - victoires par timeout (wins_by_timeout)
    for (const badge of TICTACTOE_BADGES.patience) {
      if (stats.wins_by_timeout >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.wins_by_timeout, client);
      }
    }

    // 9. Badges Intimidation - victoires par abandon (wins_by_abandon)
    for (const badge of TICTACTOE_BADGES.intimidation) {
      if (stats.wins_by_abandon >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.wins_by_abandon, client);
      }
    }

    // 10. Badges Expérience - coups joués (total_moves_played)
    for (const badge of TICTACTOE_BADGES.moves) {
      if (stats.total_moves_played >= badge.threshold) {
        await updateBadgeProgress(guildId, playerId, badge.code, stats.total_moves_played, client);
      }
    }

    // 11. Badges Ratio W/L (calculé)
    // Éviter division par zéro
    const losses = stats.games_lost || 1; // Minimum 1 pour éviter division par zéro
    const ratio = stats.games_won / losses;

    for (const badge of TICTACTOE_BADGES.ratio) {
      if (stats.games_played >= badge.minGames && ratio >= badge.ratioMultiplier) {
        // Pour les ratios, on passe 1 car c'est un badge binaire (atteint ou non)
        await updateBadgeProgress(guildId, playerId, badge.code, 1, client);
      }
    }

    console.log(`✅ [Badge] Tictactoe badges checked for player ${playerId}`);

  } catch (error) {
    console.error('🔴 Erreur hook onTictactoeGameComplete:', error);
  }
}

/**
 * 🎭 Hook appelé quand un piège "Shame Nickname" est déclenché
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {string} shameNickname - Le pseudo honteux attribué
 * @param {number} durationMinutes - Durée du piège en minutes
 * @param {Object} client - Client Discord
 */
async function onShameNicknameTriggered(guildId, playerId, shameNickname, durationMinutes, client = null) {
  try {
    console.log(`🎭 [Badge] Shame Nickname déclenché - Player ${playerId}, pseudo: ${shameNickname}, durée: ${durationMinutes}min`);

    // Compter le nombre total de fois piégé
    const trapCount = await db.queryOne(`
      SELECT COUNT(*) as count FROM player_shame_nickname
      WHERE guild_id = $1 AND player_id = $2
    `, [guildId, playerId]);

    const count = trapCount ? parseInt(trapCount.count) : 0;

    // Mettre à jour les badges basés sur le nombre de fois piégé
    const shameBadges = [
      { code: 'SHAME_FIRST_VICTIM', threshold: 1 },
      { code: 'SHAME_REGULAR_VICTIM', threshold: 5 },
      { code: 'SHAME_SERIAL_VICTIM', threshold: 15 },
      { code: 'SHAME_ETERNAL_VICTIM', threshold: 50 }
    ];

    for (const badge of shameBadges) {
      await updateBadgeProgress(guildId, playerId, badge.code, count, client);
    }

    // Badge spécial "Roi des Clowns" si le pseudo contient "Clown"
    if (shameNickname && shameNickname.toLowerCase().includes('clown')) {
      const clownCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM player_shame_nickname
        WHERE guild_id = $1 AND player_id = $2 AND LOWER(shame_nickname) LIKE '%clown%'
      `, [guildId, playerId]);

      if (clownCount) {
        await updateBadgeProgress(guildId, playerId, 'SHAME_CLOWN_KING', parseInt(clownCount.count), client);
      }
    }

    console.log(`✅ [Badge] Shame nickname badges checked for player ${playerId}`);

  } catch (error) {
    console.error('🔴 Erreur hook onShameNicknameTriggered:', error);
  }
}

/**
 * 🏃 Hook appelé quand un joueur tente de changer son pseudo honteux
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {number} totalAttempts - Nombre total de tentatives cumulées
 * @param {Object} client - Client Discord
 */
async function onShameNicknameEscapeAttempt(guildId, playerId, totalAttempts, client = null) {
  try {
    console.log(`🏃 [Badge] Tentative de fuite - Player ${playerId}, total: ${totalAttempts}`);

    // Mettre à jour les badges de tentatives de fuite
    const escapeBadges = [
      { code: 'SHAME_FIRST_ESCAPE_ATTEMPT', threshold: 1 },
      { code: 'SHAME_PERSISTENT_ESCAPEE', threshold: 10 },
      { code: 'SHAME_DESPERATE_ESCAPEE', threshold: 50 },
      { code: 'SHAME_ESCAPE_LEGEND', threshold: 200 }
    ];

    for (const badge of escapeBadges) {
      await updateBadgeProgress(guildId, playerId, badge.code, totalAttempts, client);
    }

    console.log(`✅ [Badge] Escape attempt badges checked for player ${playerId}`);

  } catch (error) {
    console.error('🔴 Erreur hook onShameNicknameEscapeAttempt:', error);
  }
}

/**
 * ⏰ Hook appelé quand un piège "Shame Nickname" expire
 * Met à jour les badges de durée totale
 * @param {string} guildId - ID du serveur
 * @param {number} playerId - ID du joueur
 * @param {number} durationMinutes - Durée du piège qui vient d'expirer (en minutes)
 * @param {Object} client - Client Discord
 */
async function onShameNicknameExpired(guildId, playerId, durationMinutes, client = null) {
  try {
    console.log(`⏰ [Badge] Shame Nickname expiré - Player ${playerId}, durée: ${durationMinutes}min`);

    // Calculer la durée totale passée en pseudo honteux
    const totalDuration = await db.queryOne(`
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (LEAST(expires_at, NOW()) - started_at)) / 60
      )::integer, 0) as total_minutes
      FROM player_shame_nickname
      WHERE guild_id = $1 AND player_id = $2
    `, [guildId, playerId]);

    const totalMinutes = totalDuration ? parseInt(totalDuration.total_minutes) : 0;

    // Mettre à jour les badges de survie
    const survivorBadges = [
      { code: 'SHAME_HOUR_SURVIVOR', threshold: 60 },      // 1 heure
      { code: 'SHAME_DAY_SURVIVOR', threshold: 1440 },     // 24 heures
      { code: 'SHAME_WEEK_SURVIVOR', threshold: 10080 },   // 7 jours
      { code: 'SHAME_MONTH_SURVIVOR', threshold: 43200 }   // 30 jours
    ];

    for (const badge of survivorBadges) {
      await updateBadgeProgress(guildId, playerId, badge.code, totalMinutes, client);
    }

    console.log(`✅ [Badge] Shame nickname survivor badges checked for player ${playerId}, total: ${totalMinutes}min`);

  } catch (error) {
    console.error('🔴 Erreur hook onShameNicknameExpired:', error);
  }
}

// ================================================================================
// EXPORTS
// ================================================================================

module.exports = {
  // Constants
  RARITY_COLORS,
  RARITY_EMOJIS,
  RARITY_NAMES,
  ALMOST_THERE_THRESHOLDS,
  ALMOST_THERE_MESSAGES,

  // Badge Mappings (V3)
  RARITY_COUNT_BADGES,
  MYSTERY_BOX_RARITY_BADGES,
  TRAP_TRIGGERED_BADGES,
  ECONOMY_BADGES,
  SENIORITY_BADGES,
  SOCIAL_BADGES,
  MISSION_BADGES,
  MYSTERY_BOX_BADGES,
  TRAP_SURVIVE_BADGES,
  ENGAGEMENT_BADGES,
  THEME_BADGES,
  MINT_BADGES,
  LUCK_BADGES,
  TICTACTOE_BADGES,

  // Core functions
  unlockBadge,
  updateBadgeProgress,
  incrementBadgeProgress,

  // Condition checking
  checkSuperBonusUsageBadges,
  checkTrapBlockBadges,
  checkCollectibleCountBadges,
  checkMissionCompleteBadges,
  checkMysteryBoxOpenBadges,
  checkTrapSurviveBadges,
  checkLoginStreakBadges,
  checkAllBadgeConditions,
  checkThemeCompletionBadges,

  // Notifications
  sendBadgeUnlockNotification,
  sendAlmostThereNotification,
  checkAndSendAlmostThereNotification,

  // Stats & Leaderboards
  getPlayerBadgeStats,
  getBadgeLeaderboard,
  getRecentBadgeUnlocks,

  // Integration hooks (anciens)
  onSuperBonusUsed,
  onTrapBlocked,
  onCollectibleFound,
  onMissionCompleted,
  onMysteryBoxOpened,
  onTrapSurvived,
  onLoginStreak,
  onEmojiPuzzleSolvedWithOneEmoji,
  onCrafting,

  // Integration hooks (nouveaux V2)
  onCollectibleFoundWithDetails,
  onCollectibleEvolution,
  onMysteryBoxOpenedWithRarity,
  onTrapTriggered,
  onMissionCompletedWithDetails,
  onLoomixOperation,
  onPlayerActivity,
  onFlexUsed,
  onFavoritesSet,
  onWinStreak,
  onLegendariesIn24h,
  onSuperBonusReceived,

  // Integration hooks (Tictactoe/Morpion V3)
  onTictactoeGameComplete,

  // Integration hooks (Shame Nickname V4)
  onShameNicknameTriggered,
  onShameNicknameEscapeAttempt,
  onShameNicknameExpired
};
