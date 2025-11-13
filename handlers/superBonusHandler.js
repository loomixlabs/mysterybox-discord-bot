const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database-pg');

/**
 * SUPER BONUS HANDLER - Phase 5
 * Gère l'application des effets des super bonus sur le système de mystery box
 */

/**
 * Nettoyer les bonus expirés (à appeler périodiquement)
 */
async function cleanupExpiredBonuses() {
  try {
    await db.cleanupExpiredBonuses();
    console.log('✅ Super bonus expirés nettoyés');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des bonus expirés:', error);
  }
}

/**
 * Récupérer les bonus actifs d'un joueur avec leurs configurations parsées
 */
async function getPlayerActiveBonuses(userId) {
  try {
    const bonuses = await db.getActiveBonusesByPlayer(userId);

    // Parser les configurations JSON
    return bonuses.map(bonus => {
      if (bonus.effect_config && typeof bonus.effect_config === 'string') {
        try {
          bonus.effect_config = JSON.parse(bonus.effect_config);
        } catch (e) {
          console.error(`Erreur parsing effect_config pour bonus ${bonus.id}:`, e);
          bonus.effect_config = {};
        }
      }
      return bonus;
    });
  } catch (error) {
    console.error('❌ Erreur récupération bonus actifs:', error);
    return [];
  }
}

/**
 * Appliquer les modifications de probabilités dues aux bonus actifs
 * @param {string} userId - ID Discord du joueur
 * @param {object} baseProbabilities - Probabilités de base {collectible, mission, trap}
 * @returns {object} Probabilités modifiées + informations sur les bonus appliqués
 */
async function applyProbabilityBonuses(userId, baseProbabilities) {
  const activeBonuses = await getPlayerActiveBonuses(userId);

  let modifiedProbs = { ...baseProbabilities };
  const appliedBonuses = [];

  for (const bonus of activeBonuses) {
    const config = bonus.effect_config || {};

    // Boost de probabilité global (ex: Chance du Diable)
    if (bonus.effect_type === 'probability' && config.boost_percentage) {
      const boostPercent = config.boost_percentage;

      if (config.applies_to === 'all' || !config.applies_to) {
        // Boost global sur collectible
        modifiedProbs.collectible += (baseProbabilities.collectible * boostPercent / 100);
        appliedBonuses.push({
          name: bonus.name,
          icon: bonus.icon,
          description: `+${boostPercent}% chance globale`
        });
      }
    }

    // Boost de rareté (ex: Aimant à Légendaires)
    if (bonus.effect_type === 'rarity_boost' && config.boost_percentage && config.target_rarity) {
      appliedBonuses.push({
        name: bonus.name,
        icon: bonus.icon,
        description: `+${config.boost_percentage}% chance ${config.target_rarity}`,
        rarity_boost: {
          target: config.target_rarity,
          percentage: config.boost_percentage
        }
      });
    }
  }

  // Normaliser les probabilités si elles dépassent 100
  const total = modifiedProbs.collectible + modifiedProbs.mission + modifiedProbs.trap;
  if (total > 100) {
    const factor = 100 / total;
    modifiedProbs.collectible = Math.round(modifiedProbs.collectible * factor);
    modifiedProbs.mission = Math.round(modifiedProbs.mission * factor);
    modifiedProbs.trap = Math.round(modifiedProbs.trap * factor);
  }

  return {
    probabilities: modifiedProbs,
    appliedBonuses,
    hasBoosts: appliedBonuses.length > 0
  };
}

/**
 * Vérifier si le joueur a un bonus de révélation actif (Vision Divine)
 */
async function hasRevealBonus(userId) {
  const activeBonuses = await getPlayerActiveBonuses(userId);
  return activeBonuses.find(bonus =>
    bonus.effect_type === 'reveal' &&
    (bonus.remaining_charges > 0 || bonus.duration_type !== 'charges')
  );
}

/**
 * Consommer une charge de révélation
 */
async function consumeRevealCharge(userId) {
  const revealBonus = await hasRevealBonus(userId);
  if (!revealBonus) return null;

  if (revealBonus.duration_type === 'charges') {
    await db.decrementBonusCharge(revealBonus.id);
    await db.logBonusUsage(
      userId,
      revealBonus.bonus_id,
      { action: 'revealed_mystery_box' },
      'manual'
    );
  }

  return revealBonus;
}

/**
 * Vérifier si le joueur a un bonus de détection de pièges actif
 */
async function hasTrapDetector(userId) {
  const activeBonuses = await getPlayerActiveBonuses(userId);
  return activeBonuses.find(bonus => bonus.effect_type === 'detector');
}

/**
 * Vérifier si le joueur a un multiplicateur de récompense actif
 */
async function getRewardMultiplier(userId) {
  const activeBonuses = await getPlayerActiveBonuses(userId);
  const multiplierBonus = activeBonuses.find(bonus =>
    bonus.effect_type === 'multiplier' &&
    (bonus.remaining_charges > 0 || bonus.duration_type !== 'charges')
  );

  if (!multiplierBonus) return null;

  const config = multiplierBonus.effect_config || {};
  return {
    multiplier: config.multiplier || 2,
    appliesTo: config.applies_to || 'all',
    bonus: multiplierBonus
  };
}

/**
 * Consommer une charge de multiplicateur
 */
async function consumeMultiplierCharge(userId) {
  const multiplierData = await getRewardMultiplier(userId);
  if (!multiplierData) return null;

  const { bonus } = multiplierData;

  if (bonus.duration_type === 'charges') {
    await db.decrementBonusCharge(bonus.id);
    await db.logBonusUsage(
      userId,
      bonus.bonus_id,
      { action: 'reward_multiplied', multiplier: multiplierData.multiplier },
      'automatic'
    );
  }

  return multiplierData;
}

/**
 * Vérifier si le joueur a un bouclier anti-piège actif
 */
async function hasTrapShield(userId) {
  const activeBonuses = await getPlayerActiveBonuses(userId);
  return activeBonuses.find(bonus =>
    bonus.effect_type === 'protection' &&
    (bonus.remaining_charges > 0 || bonus.duration_type !== 'charges')
  );
}

/**
 * Consommer le bouclier anti-piège
 */
async function consumeTrapShield(userId, trapName) {
  const shield = await hasTrapShield(userId);
  if (!shield) return null;

  await db.consumeBonus(shield.id);
  await db.logBonusUsage(
    userId,
    shield.bonus_id,
    { action: 'trap_blocked', trap_name: trapName },
    'automatic'
  );

  return shield;
}

/**
 * Créer un embed pour afficher les bonus actifs d'un joueur
 */
async function createActiveBonusesEmbed(userId, username) {
  const activeBonuses = await getPlayerActiveBonuses(userId);

  const embed = new EmbedBuilder()
    .setTitle(`${username} - Super Bonus Actifs`)
    .setColor('#FFD700');

  if (activeBonuses.length === 0) {
    embed.setDescription('Aucun super bonus actif pour le moment.');
    return embed;
  }

  for (const bonus of activeBonuses) {
    let fieldValue = `${bonus.description}\n\n`;

    // Afficher la durée restante
    if (bonus.duration_type === 'temporary' && bonus.expires_at) {
      const expiresDate = new Date(bonus.expires_at);
      const remaining = Math.ceil((expiresDate - Date.now()) / 1000 / 60); // minutes

      if (remaining > 60) {
        const hours = Math.floor(remaining / 60);
        fieldValue += `⏱️ Expire dans: ${hours}h\n`;
      } else {
        fieldValue += `⏱️ Expire dans: ${remaining}min\n`;
      }
    }

    // Afficher les charges restantes
    if (bonus.duration_type === 'charges' && bonus.remaining_charges !== null) {
      fieldValue += `🔢 Charges restantes: ${bonus.remaining_charges}\n`;
    }

    // Afficher la rareté
    const rarityEmoji = {
      legendary: '🌟',
      epic: '💜',
      rare: '💙',
      common: '⚪'
    }[bonus.rarity] || '⚪';

    fieldValue += `${rarityEmoji} ${bonus.rarity.toUpperCase()}`;

    embed.addFields({
      name: `${bonus.icon} ${bonus.name}`,
      value: fieldValue,
      inline: false
    });
  }

  embed.setFooter({ text: `Total: ${activeBonuses.length} bonus actif${activeBonuses.length > 1 ? 's' : ''}` });
  embed.setTimestamp();

  return embed;
}

/**
 * Créer un embed pour afficher un bonus reçu
 */
function createBonusReceivedEmbed(bonusData, userMention) {
  const bonus = bonusData;
  const config = typeof bonus.effect_config === 'string'
    ? JSON.parse(bonus.effect_config)
    : (bonus.effect_config || {});

  const embed = new EmbedBuilder()
    .setTitle(`${bonus.icon} SUPER BONUS REÇU !`)
    .setDescription(`${userMention} a reçu le super bonus **${bonus.name}** !`)
    .setColor(bonus.color || '#FFD700');

  embed.addFields({
    name: 'Description',
    value: bonus.description,
    inline: false
  });

  // Durée / Charges
  let durationText = '';
  if (bonus.duration_type === 'temporary') {
    const days = Math.floor(bonus.duration_value / 86400);
    const hours = Math.floor((bonus.duration_value % 86400) / 3600);
    if (days > 0) {
      durationText = `⏱️ Durée: ${days} jour${days > 1 ? 's' : ''}`;
    } else {
      durationText = `⏱️ Durée: ${hours} heure${hours > 1 ? 's' : ''}`;
    }
  } else if (bonus.duration_type === 'charges') {
    durationText = `🔢 Utilisations: ${bonus.duration_value}`;
  } else if (bonus.duration_type === 'permanent') {
    durationText = `♾️ Permanent jusqu'à utilisation`;
  }

  if (durationText) {
    embed.addFields({
      name: 'Type',
      value: durationText,
      inline: true
    });
  }

  // Rareté
  const rarityEmoji = {
    legendary: '🌟',
    epic: '💜',
    rare: '💙',
    common: '⚪'
  }[bonus.rarity] || '⚪';

  embed.addFields({
    name: 'Rareté',
    value: `${rarityEmoji} ${bonus.rarity.toUpperCase()}`,
    inline: true
  });

  if (bonus.image_url) {
    embed.setImage(bonus.image_url);
  }

  if (bonus.announcement_message) {
    embed.setFooter({ text: bonus.announcement_message });
  }

  return embed;
}

/**
 * Formater la durée en texte lisible
 */
function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);

  return parts.join(' ') || '< 1min';
}

module.exports = {
  cleanupExpiredBonuses,
  getPlayerActiveBonuses,
  applyProbabilityBonuses,
  hasRevealBonus,
  consumeRevealCharge,
  hasTrapDetector,
  getRewardMultiplier,
  consumeMultiplierCharge,
  hasTrapShield,
  consumeTrapShield,
  createActiveBonusesEmbed,
  createBonusReceivedEmbed,
  formatDuration
};
