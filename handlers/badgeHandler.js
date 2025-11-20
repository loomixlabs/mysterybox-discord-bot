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
  { code: 'COLLECTION_EXPERT', threshold: 100 }
  // COLLECTION_MAITRE et COLLECTION_LEGENDE nécessitent une logique spéciale (100% completion)
];

/**
 * Mapping pour les badges Mission (mission_complete)
 */
const MISSION_BADGES = [
  { code: 'MISSION_APPRENTI', threshold: 1 },
  { code: 'MISSION_MISSIONNAIRE', threshold: 10 },
  { code: 'MISSION_CHAMPION', threshold: 50 },
  { code: 'MISSION_GRAND_MAITRE', threshold: 100 }
];

/**
 * Mapping pour les badges Mystery Box (mystery_box_open)
 */
const MYSTERY_BOX_BADGES = [
  { code: 'MYSTERY_CHANCEUX', threshold: 10 },
  { code: 'MYSTERY_CHASSEUR', threshold: 50 },
  { code: 'MYSTERY_MAITRE', threshold: 100 },
  { code: 'MYSTERY_LEGENDE', threshold: 250 }
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
 * Mapping pour les badges Engagement (login_streak)
 */
const ENGAGEMENT_BADGES = [
  { code: 'ENGAGEMENT_ACTIF', threshold: 3 },
  { code: 'ENGAGEMENT_ASSIDU', threshold: 7 },
  { code: 'ENGAGEMENT_DEVOU', threshold: 14 },
  { code: 'ENGAGEMENT_MARATHONIEN', threshold: 30 },
  { code: 'ENGAGEMENT_ETERNEL', threshold: 90 }
];

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
 * @param {Object} client - Client Discord (pour déblocage auto)
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
 * @param {Object} client - Client Discord
 * @returns {Object|null} Résultat de l'incrémentation
 */
async function incrementBadgeProgress(guildId, playerId, badgeCode, incrementBy = 1, client = null) {
  try {
    const badge = await db.getBadgeByCode(badgeCode);
    if (!badge) {
      console.error(`🔴 Badge ${badgeCode} introuvable`);
      return null;
    }

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
        AND player_id = $2
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
 * Vérifie et met à jour les badges liés aux login streaks
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
        .setCustomId('view_my_badges')
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

// ================================================================================
// EXPORTS
// ================================================================================

module.exports = {
  // Constants
  RARITY_COLORS,
  RARITY_EMOJIS,
  RARITY_NAMES,

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

  // Notifications
  sendBadgeUnlockNotification,

  // Stats & Leaderboards
  getPlayerBadgeStats,
  getBadgeLeaderboard,
  getRecentBadgeUnlocks,

  // Integration hooks
  onSuperBonusUsed,
  onTrapBlocked,
  onCollectibleFound,
  onMissionCompleted,
  onMysteryBoxOpened,
  onTrapSurvived,
  onLoginStreak
};
