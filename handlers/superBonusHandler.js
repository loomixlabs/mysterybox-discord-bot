const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonStyle
} = require('discord.js');
const db = require('../utils/database-pg');
const badgeHandler = require('./badgeHandler');

/**
 * SUPER BONUS HANDLER - Phase 5
 * Gère l'application des effets des super bonus sur le système de mystery box
 */

// Set pour tracker les révélations Vision Divine déjà effectuées
// Format: "messageId:userId"
// Permet d'éviter le multi-trigger si un joueur décline puis re-clique
const visionDivineUsed = new Set();

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
async function getPlayerActiveBonuses(guildId, userId) {
  try {
    const bonuses = await db.getActiveBonusesByPlayer(guildId, userId);

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
 * @param {string} guildId - ID du serveur Discord
 * @param {string} userId - ID Discord du joueur
 * @param {object} baseProbabilities - Probabilités de base {collectible, mission, trap}
 * @returns {object} Probabilités modifiées + informations sur les bonus appliqués
 */
async function applyProbabilityBonuses(guildId, userId, baseProbabilities) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);

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
async function hasRevealBonus(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
  return activeBonuses.find(bonus =>
    bonus.effect_type === 'reveal' &&
    (bonus.remaining_charges > 0 || bonus.duration_type !== 'charges')
  );
}

/**
 * Consommer une charge de révélation
 */
async function consumeRevealCharge(guildId, userId) {
  const revealBonus = await hasRevealBonus(guildId, userId);
  if (!revealBonus) return null;

  if (revealBonus.duration_type === 'charges') {
    await db.decrementBonusCharge(guildId, revealBonus.id);
    // TODO: Implémenter db.logBonusUsage() dans database-pg.js
    // await db.logBonusUsage(
    //   userId,
    //   revealBonus.bonus_id,
    //   { action: 'revealed_mystery_box' },
    //   'manual'
    // );
  }

  return revealBonus;
}

/**
 * Vérifier si le joueur a un bonus de détection de pièges actif
 */
async function hasTrapDetector(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
  return activeBonuses.find(bonus => bonus.effect_type === 'detector');
}

/**
 * Vérifier si le joueur a un multiplicateur de récompense actif
 */
async function getRewardMultiplier(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
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
async function consumeMultiplierCharge(guildId, userId) {
  const multiplierData = await getRewardMultiplier(guildId, userId);
  if (!multiplierData) return null;

  const { bonus } = multiplierData;

  if (bonus.duration_type === 'charges') {
    await db.decrementBonusCharge(bonus.id);
    // TODO: Implémenter db.logBonusUsage() dans database-pg.js
    // await db.logBonusUsage(
    //   userId,
    //   bonus.bonus_id,
    //   { action: 'reward_multiplied', multiplier: multiplierData.multiplier },
    //   'automatic'
    // );
  }

  return multiplierData;
}

/**
 * Vérifier si le joueur a un bouclier anti-piège actif
 */
async function hasTrapShield(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
  return activeBonuses.find(bonus =>
    bonus.effect_type === 'protection' &&
    (bonus.remaining_charges > 0 || bonus.duration_type !== 'charges')
  );
}

/**
 * Consommer le bouclier anti-piège
 */
async function consumeTrapShield(guildId, userId, trapName) {
  const shield = await hasTrapShield(guildId, userId);
  if (!shield) return null;

  // Décrémenter une charge du bouclier (pas le désactiver complètement)
  await db.decrementBonusCharge(guildId, shield.id);

  // Vérifier s'il reste des charges après décrémentation
  const updatedBonus = await db.queryOne(`
    SELECT remaining_charges
    FROM player_active_bonuses
    WHERE id = $1 AND guild_id = $2
  `, [shield.id, guildId]);

  // Si plus de charges, désactiver le bonus
  if (updatedBonus && updatedBonus.remaining_charges <= 0) {
    await db.query(`
      UPDATE player_active_bonuses
      SET is_active = FALSE, used_at = NOW()
      WHERE id = $1 AND guild_id = $2
    `, [shield.id, guildId]);
  }

  // Incrémenter le compteur de pièges bloqués
  await db.query(`
    UPDATE players
    SET traps_blocked = traps_blocked + 1
    WHERE discord_id = $1 AND guild_id = $2
  `, [userId, guildId]);

  // Logger l'utilisation du bonus (user_id, pas player_id)
  try {
    await db.query(`
      INSERT INTO bonus_usage_history (guild_id, user_id, bonus_id, used_at, effect_result, trigger_type)
      VALUES ($1, $2, $3, NOW(), $4, 'trap_blocked')
    `, [
      guildId,
      userId,
      shield.bonus_id,
      JSON.stringify({ trap_name: trapName, remaining_charges: updatedBonus?.remaining_charges || 0 })
    ]);
  } catch (logError) {
    console.error('⚠️  Erreur logging bonus usage:', logError);
    // Continuer même si logging échoue
  }

  // Retourner les stats pour l'affichage
  return {
    ...shield,
    remainingCharges: updatedBonus?.remaining_charges || 0,
    totalCharges: shield.default_charges || 3
  };
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
    // CAS SPÉCIAL: Aimant à Légendaires → toujours afficher en heures
    if (bonus.bonus_id === 'legendary_magnet') {
      const hours = Math.floor(bonus.duration_value / 3600);
      durationText = `⏱️ Durée: ${hours} heure${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(bonus.duration_value / 86400);
      const hours = Math.floor((bonus.duration_value % 86400) / 3600);
      if (days > 0) {
        durationText = `⏱️ Durée: ${days} jour${days > 1 ? 's' : ''}`;
      } else {
        durationText = `⏱️ Durée: ${hours} heure${hours > 1 ? 's' : ''}`;
      }
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

// ==========================================
// HANDLERS INTERFACE ADMIN - CONFIGURATION
// ==========================================

/**
 * Afficher directement le sélecteur de valeur selon le type de durée en DB
 * Note: Defer ICI car appelé depuis handleSelectMenu AVANT le defer général
 */
async function handleBonusDurationSelect(interaction) {
  await interaction.deferUpdate();

  try {
    const bonusId = parseInt(interaction.values[0]);
    const bonus = await db.queryOne(
      'SELECT * FROM super_bonuses WHERE id = $1',
      [bonusId]
    );

    if (!bonus) {
      return interaction.editReply({
        content: '❌ Super bonus introuvable.',
        embeds: [],
        components: []
      });
    }

    // Afficher directement le sélecteur selon le type
    if (bonus.duration_type === 'permanent') {
      // Pour les bonus permanents, juste afficher un message
      const embed = new EmbedBuilder()
        .setTitle(`♾️ ${bonus.name}`)
        .setDescription('Ce bonus est **permanent** - il n\'a pas de durée limitée.')
        .setColor('#2ecc71');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_duration')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });

    } else if (bonus.duration_type === 'temporary') {
      // CAS SPÉCIAL: Aimant à Légendaires → toujours sélecteur 1-10h
      if (bonus.bonus_id === 'legendary_magnet') {
        const currentHours = Math.floor(bonus.duration_value / 3600);
        const hourOptions = Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1} heure${i > 0 ? 's' : ''}`,
          value: (i + 1).toString(),
          emoji: '⏰'
        }));

        const selectHours = new StringSelectMenuBuilder()
          .setCustomId(`edit_bonus_duration_hours:${bonusId}`)
          .setPlaceholder('Sélectionne la durée en heures (1-10h)')
          .addOptions(hourOptions);

        const row1 = new ActionRowBuilder().addComponents(selectHours);
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_bonus_edit_duration')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
          .setTitle(`⏰ ${bonus.name}`)
          .setDescription(
            `**Configuration actuelle:** ${currentHours} heure${currentHours > 1 ? 's' : ''}\n\n` +
            '**Choisis la nouvelle durée** (1-10 heures):\n' +
            '💡 _Ce bonus est configuré pour des durées courtes en heures._'
          )
          .setColor('#9b59b6');

        return interaction.editReply({ embeds: [embed], components: [row1, row2] });
      }

      // Détecter automatiquement si c'est en heures ou jours
      const isHourBased = bonus.duration_value < 86400; // Moins de 24h = afficher en heures

      if (isHourBased) {
        // Afficher sélecteur d'heures (1-24)
        const currentHours = Math.floor(bonus.duration_value / 3600);
        const hourOptions = Array.from({ length: 24 }, (_, i) => ({
          label: `${i + 1} heure${i > 0 ? 's' : ''}`,
          value: (i + 1).toString(),
          emoji: '⏰'
        }));

        const selectHours = new StringSelectMenuBuilder()
          .setCustomId(`edit_bonus_duration_hours:${bonusId}`)
          .setPlaceholder('Sélectionne la durée en heures')
          .addOptions(hourOptions);

        const row1 = new ActionRowBuilder().addComponents(selectHours);
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_bonus_edit_duration')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
          .setTitle(`⏰ ${bonus.name}`)
          .setDescription(
            `**Configuration actuelle:** ${currentHours} heure${currentHours > 1 ? 's' : ''}\n\n` +
            '**Choisis la nouvelle durée** (1-24 heures):'
          )
          .setColor('#00D9FF');

        return interaction.editReply({ embeds: [embed], components: [row1, row2] });

      } else {
        // Afficher sélecteur de jours (1-10)
        const currentDays = Math.floor(bonus.duration_value / 86400);
        const dayOptions = Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1} jour${i > 0 ? 's' : ''}`,
          value: (i + 1).toString(),
          emoji: '📅'
        }));

        const selectDays = new StringSelectMenuBuilder()
          .setCustomId(`edit_bonus_duration_days:${bonusId}`)
          .setPlaceholder('Sélectionne la durée en jours')
          .addOptions(dayOptions);

        const row1 = new ActionRowBuilder().addComponents(selectDays);
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_bonus_edit_duration')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
          .setTitle(`⏰ ${bonus.name}`)
          .setDescription(
            `**Configuration actuelle:** ${currentDays} jour${currentDays > 1 ? 's' : ''}\n\n` +
            '**Choisis la nouvelle durée** (1-10 jours):'
          )
          .setColor('#00D9FF');

        return interaction.editReply({ embeds: [embed], components: [row1, row2] });
      }

    } else if (bonus.duration_type === 'charges') {
      // Afficher sélecteur de charges (1-10)
      const chargeOptions = Array.from({ length: 10 }, (_, i) => ({
        label: `${i + 1} charge${i > 0 ? 's' : ''}`,
        value: (i + 1).toString(),
        emoji: '🎯'
      }));

      const selectCharges = new StringSelectMenuBuilder()
        .setCustomId(`edit_bonus_duration_charges:${bonusId}`)
        .setPlaceholder('Sélectionne le nombre de charges')
        .addOptions(chargeOptions);

      const row1 = new ActionRowBuilder().addComponents(selectCharges);
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_duration')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle(`🎯 ${bonus.name}`)
        .setDescription(
          `**Configuration actuelle:** ${bonus.duration_value} charge${bonus.duration_value > 1 ? 's' : ''}\n\n` +
          '**Choisis le nouveau nombre de charges** (1-10):'
        )
        .setColor('#00D9FF');

      return interaction.editReply({ embeds: [embed], components: [row1, row2] });
    }

  } catch (error) {
    console.error('❌ Erreur handleBonusDurationSelect:', error);
    return interaction.editReply({
      content: `❌ Erreur: ${error.message}`,
      embeds: [],
      components: []
    });
  }
}

/**
 * Sauvegarder la durée en heures (temporary - bonus < 24h)
 */
async function handleEditBonusDurationHours(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guildId;
    const [, bonusId] = interaction.customId.split(':');
    const hours = parseInt(interaction.values[0]);
    const totalSeconds = hours * 3600;

    const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1 AND guild_id = $2', [parseInt(bonusId), guildId]);

    if (!bonus) {
      return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
    }

    // Sauvegarder
    await db.query(
      'UPDATE super_bonuses SET duration_value = $1 WHERE id = $2 AND guild_id = $3',
      [totalSeconds, parseInt(bonusId), guildId]
    );

    const embed = new EmbedBuilder()
      .setTitle('✅ DURÉE MODIFIÉE')
      .setDescription(`Le bonus **${bonus.icon} ${bonus.name}** expirera après **${hours} heure${hours > 1 ? 's' : ''}**.`)
      .setColor('#2ecc71')
      .addFields({ name: '⏰ Durée', value: `${hours} heure${hours > 1 ? 's' : ''}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_bonus_edit_duration')
        .setLabel('⏱️ Éditer un autre')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_super_bonuses')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    console.log(`✅ Super bonus #${bonusId} → Durée ${hours}h par ${interaction.user.tag}`);
    return interaction.editReply({ embeds: [embed], components: [row] });

  } catch (error) {
    console.error('❌ Erreur handleEditBonusDurationHours:', error);
    return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
  }
}

/**
 * Sauvegarder la durée en jours (temporary)
 */
async function handleEditBonusDurationDays(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guildId;
    const [, bonusId] = interaction.customId.split(':');
    const days = parseInt(interaction.values[0]);
    const totalSeconds = days * 86400;

    const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1 AND guild_id = $2', [parseInt(bonusId), guildId]);

    if (!bonus) {
      return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
    }

    // Sauvegarder
    await db.query(
      'UPDATE super_bonuses SET duration_value = $1 WHERE id = $2 AND guild_id = $3',
      [totalSeconds, parseInt(bonusId), guildId]
    );

    const embed = new EmbedBuilder()
      .setTitle('✅ DURÉE MODIFIÉE')
      .setDescription(`Le bonus **${bonus.icon} ${bonus.name}** expirera après **${days} jour${days > 1 ? 's' : ''}**.`)
      .setColor('#2ecc71')
      .addFields({ name: '⏰ Durée', value: `${days} jour${days > 1 ? 's' : ''}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_bonus_edit_duration')
        .setLabel('⏱️ Éditer un autre')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_super_bonuses')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    console.log(`✅ Super bonus #${bonusId} → Durée ${days}j par ${interaction.user.tag}`);
    return interaction.editReply({ embeds: [embed], components: [row] });

  } catch (error) {
    console.error('❌ Erreur handleEditBonusDurationDays:', error);
    return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
  }
}

/**
 * Sauvegarder le nombre de charges
 */
async function handleEditBonusDurationCharges(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guildId;
    const [, bonusId] = interaction.customId.split(':');
    const charges = parseInt(interaction.values[0]);

    const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1 AND guild_id = $2', [parseInt(bonusId), guildId]);

    if (!bonus) {
      return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
    }

    // Sauvegarder
    await db.query(
      'UPDATE super_bonuses SET duration_value = $1 WHERE id = $2 AND guild_id = $3',
      [charges, parseInt(bonusId), guildId]
    );

    const embed = new EmbedBuilder()
      .setTitle('✅ CHARGES MODIFIÉES')
      .setDescription(`Le bonus **${bonus.icon} ${bonus.name}** aura **${charges} charge${charges > 1 ? 's' : ''}**.`)
      .setColor('#2ecc71')
      .addFields({ name: '🎯 Charges', value: `${charges} utilisation${charges > 1 ? 's' : ''}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_bonus_edit_duration')
        .setLabel('⏱️ Éditer un autre')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_super_bonuses')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    console.log(`✅ Super bonus #${bonusId} → ${charges} charge(s) par ${interaction.user.tag}`);
    return interaction.editReply({ embeds: [embed], components: [row] });

  } catch (error) {
    console.error('❌ Erreur handleEditBonusDurationCharges:', error);
    return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
  }
}

/**
 * ========================================
 * VISION DIVINE - Révélation Mystery Box
 * ========================================
 */

/**
 * Créer l'embed stylé de révélation Vision Divine
 * @param {Object} content - Contenu tiré: { type, id, item }
 * @param {Object} branding - Branding du serveur
 * @returns {EmbedBuilder} Embed de révélation
 */
function createVisionDivineEmbed(content, branding) {
  const { type, item } = content;

  // Mapping des types vers emojis et couleurs
  const typeConfig = {
    collectible: {
      emoji: '🎨',
      name: 'Collectible',
      color: '#f39c12'
    },
    mission: {
      emoji: '📋',
      name: 'Mission',
      color: '#3498db'
    },
    trap: {
      emoji: '💀',
      name: 'Piège',
      color: '#e74c3c'
    },
    super_bonus: {
      emoji: '✨',
      name: 'Super Bonus',
      color: '#9b59b6'
    }
  };

  // Mapping des raretés vers emojis
  const rarityEmojis = {
    common: '⚪',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡'
  };

  const config = typeConfig[type] || typeConfig.collectible;
  const rarityEmoji = rarityEmojis[item.rarity?.toLowerCase()] || '⚪';

  const embed = new EmbedBuilder()
    .setColor('#FFD700') // Or divin
    .setTitle(`👁️ VISION DIVINE`)
    .setDescription(
      `✨ **Grâce à la Vision Divine, le voile se lève...**\n\n` +
      `Le contenu de cette boîte mystère t'est révélé avant de l'ouvrir !\n\n` +
      `**Contenu:** ${config.emoji} **${config.name}**`
    )
    .setThumbnail('https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif') // GIF oeil mystique
    .addFields(
      {
        name: `${config.emoji} ${item.name || 'Mystère'}`,
        value: item.description || item.reveal_message || 'Un pouvoir mystérieux...',
        inline: false
      },
      {
        name: '✨ Rareté',
        value: `${rarityEmoji} **${item.rarity ? item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1) : 'Commune'}**`,
        inline: true
      }
    )
    .setFooter({
      text: '👁️ Vision Divine - 1 charge consommée',
      iconURL: branding.logo_url
    })
    .setTimestamp();

  // Ajouter des champs spécifiques selon le type
  if (type === 'super_bonus' && item.duration_value) {
    let durationText;
    // CAS SPÉCIAL: Aimant à Légendaires → toujours afficher en heures
    if (item.bonus_id === 'legendary_magnet') {
      durationText = `${Math.floor(item.duration_value / 3600)}h`;
    } else {
      durationText = item.duration_value < 86400
        ? `${Math.floor(item.duration_value / 3600)}h`
        : `${Math.floor(item.duration_value / 86400)} jour(s)`;
    }

    embed.addFields({
      name: '⏱️ Durée/Charges',
      value: item.duration_type === 'charges'
        ? `${item.duration_value} utilisation(s)`
        : durationText,
      inline: true
    });
  }

  if (type === 'collectible' && item.required_items) {
    embed.addFields({
      name: '🎯 Collection',
      value: `Requis: ${item.required_items} items`,
      inline: true
    });
  }

  return embed;
}

/**
 * Vérifier si le joueur a Vision Divine actif et créer la réponse de révélation
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {Object} content - Contenu tiré de rollMysteryContent: { type, id, item }
 * @param {string} messageId - Message ID de la mystery box
 * @returns {Promise<Object|null>} { embed, components } si Vision Divine active, null sinon
 */
async function checkAndRevealVisionDivine(userId, guildId, content, messageId) {
  try {
    // Créer la clé de tracking pour cette révélation
    const trackingKey = `${messageId}:${userId}`;

    // Vérifier si cette boîte a déjà été révélée à ce joueur
    if (visionDivineUsed.has(trackingKey)) {
      console.log(`⏭️  [VISION DIVINE] Joueur ${userId} a déjà révélé la boîte ${messageId} - Pas de nouveau déclenchement`);
      return null;
    }

    // Vérifier si le joueur a Vision Divine actif
    const hasVisionDivine = await hasRevealBonus(guildId, userId);

    if (!hasVisionDivine) {
      console.log(`🔍 [VISION DIVINE] Joueur ${userId} n'a pas Vision Divine active`);
      return null;
    }

    console.log(`👁️ [VISION DIVINE] ACTIVÉ pour ${userId}! Révélation du contenu...`);

    // Récupérer le branding
    const branding = await db.getGuildBranding(guildId);

    // Créer l'embed de révélation
    const embed = createVisionDivineEmbed(content, branding);

    // Créer les boutons Accept/Decline
    const acceptButton = new ButtonBuilder()
      .setCustomId(`vision_divine_accept:${messageId}:${content.type}:${content.id}`)
      .setLabel('✅ Accepter et Ouvrir')
      .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
      .setCustomId(`vision_divine_decline:${messageId}`)
      .setLabel('❌ Passer')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

    // Marquer cette révélation comme effectuée AVANT de consommer la charge
    visionDivineUsed.add(trackingKey);
    console.log(`🔐 [VISION DIVINE] Révélation trackée: ${trackingKey}`);

    // Consommer 1 charge de Vision Divine
    await consumeRevealCharge(guildId, userId);
    console.log(`✅ [VISION DIVINE] 1 charge consommée pour ${userId}`);

    return {
      embeds: [embed],
      components: [row]
    };

  } catch (error) {
    console.error('❌ Erreur checkAndRevealVisionDivine:', error);
    return null;
  }
}

/**
 * Nettoyer le tracking Vision Divine pour une boîte acceptée/traitée
 * @param {string} messageId - Message ID de la mystery box
 * @param {string} userId - User ID du joueur
 */
function clearVisionDivineTracking(messageId, userId) {
  const trackingKey = `${messageId}:${userId}`;
  const wasTracked = visionDivineUsed.has(trackingKey);
  if (wasTracked) {
    visionDivineUsed.delete(trackingKey);
    console.log(`🧹 [VISION DIVINE] Tracking nettoyé: ${trackingKey}`);
  }
  return wasTracked;
}

/**
 * Appliquer un boost de rareté pour les collectibles (Aimant à Légendaires)
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {object} basePercentages - { legendary, epic, rare, common }
 * @returns {Promise<object>} { percentages, boost, hasBoost }
 */
async function applyCollectibleRarityBoost(guildId, userId, basePercentages) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);

  let modifiedPercentages = { ...basePercentages };
  let rarityBoost = null;

  // Chercher Aimant à Légendaires actif
  for (const bonus of activeBonuses) {
    if (bonus.effect_type === 'rarity_boost' && bonus.is_active) {
      const config = bonus.effect_config || {};

      if (config.target_rarity && config.boost_percentage) {
        const target = config.target_rarity; // 'legendary'
        const boost = config.boost_percentage; // 50

        console.log(`🧲 [AIMANT] Boost de rareté détecté pour ${userId}: +${boost}% ${target}`);
        console.log(`   Avant: ${target} = ${modifiedPercentages[target]}%`);

        // Addition absolue
        modifiedPercentages[target] += boost;

        console.log(`   Après boost: ${target} = ${modifiedPercentages[target]}%`);

        rarityBoost = {
          bonus: bonus,
          target: target,
          boost: boost,
          original: basePercentages[target],
          boosted: modifiedPercentages[target]
        };
        break;
      }
    }
  }

  // Normaliser pour respecter 100%
  const total = modifiedPercentages.legendary + modifiedPercentages.epic +
                modifiedPercentages.rare + modifiedPercentages.common;

  if (total > 100) {
    console.log(`🧲 [AIMANT] Total avant normalisation: ${total}% → Normalisation à 100%`);
    const factor = 100 / total;
    modifiedPercentages.legendary = Math.round(modifiedPercentages.legendary * factor);
    modifiedPercentages.epic = Math.round(modifiedPercentages.epic * factor);
    modifiedPercentages.rare = Math.round(modifiedPercentages.rare * factor);
    modifiedPercentages.common = Math.round(modifiedPercentages.common * factor);

    console.log(`   Après normalisation: legendary=${modifiedPercentages.legendary}%, epic=${modifiedPercentages.epic}%, rare=${modifiedPercentages.rare}%, common=${modifiedPercentages.common}%`);

    if (rarityBoost) {
      rarityBoost.normalized = modifiedPercentages[rarityBoost.target];
    }
  }

  return {
    percentages: modifiedPercentages,
    boost: rarityBoost,
    hasBoost: !!rarityBoost
  };
}

/**
 * Vérifier si le joueur a un bonus multiplicateur actif (Jackpot x2)
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {string} contentType - Type de contenu ('collectible')
 * @returns {Promise<object|null>} Bonus multiplicateur ou null
 */
async function hasMultiplierBonus(guildId, userId, contentType) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);

  return activeBonuses.find(bonus =>
    bonus.effect_type === 'multiplier' &&
    bonus.is_active &&
    bonus.remaining_charges > 0 &&
    (!bonus.expires_at || new Date(bonus.expires_at) > new Date()) &&
    (bonus.effect_config?.applies_to === contentType)
  );
}

/**
 * Consommer une charge d'un bonus actif (fonction générique)
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID (pour les logs futurs)
 * @param {number} activeBonusId - ID du bonus actif dans player_active_bonuses
 * @param {Object} client - Client Discord (optionnel, pour tracking badges)
 */
async function consumeBonusCharge(guildId, userId, activeBonusId, client = null) {
  await db.decrementBonusCharge(guildId, activeBonusId);
  console.log(`📉 [BONUS] Charge consommée - activeBonusId: ${activeBonusId}, userId: ${userId}`);

  // Tracking des badges
  try {
    // Récupérer le user_id et le bonus_id
    const activeBonus = await db.queryOne(`
      SELECT pab.user_id, sb.bonus_id
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.id = $1 AND pab.guild_id = $2
    `, [activeBonusId, guildId]);

    if (activeBonus) {
      // Récupérer player_id depuis user_id (Discord ID)
      const player = await db.getPlayerByDiscordId(guildId, activeBonus.user_id);
      if (player) {
        await badgeHandler.onSuperBonusUsed(
          guildId,
          player.id,
          activeBonus.bonus_id,
          client
        );
      }
    }
  } catch (error) {
    console.error(`🔴 Erreur tracking badge dans consumeBonusCharge:`, error);
  }

  // TODO: Implémenter db.logBonusUsage() pour tracer l'utilisation complète
}

// ============================================================================
// ADMINISTRATION - GESTION ACTIVATION/DÉSACTIVATION DES SUPER BONUS
// ============================================================================

/**
 * Afficher le panneau d'administration des super bonus
 * Design moderne 2025: Sombre, compact, avec badges visuels
 */
async function showSuperBonusesAdminPanel(interaction) {
  // Ne déférer que si pas déjà déféré (éviter double defer depuis toggleSuperBonus)
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }

  const guildId = interaction.guildId;

  // Récupérer tous les super bonus du serveur
  const bonuses = await db.queryAll(`
    SELECT
      id,
      bonus_id,
      name,
      description,
      icon,
      rarity,
      effect_type,
      activation_mode,
      is_enabled,
      (SELECT COUNT(*) FROM player_active_bonuses pab
       WHERE pab.bonus_id = super_bonuses.id
         AND pab.guild_id = super_bonuses.guild_id
         AND pab.is_active = TRUE
         AND (pab.expires_at IS NULL OR pab.expires_at > NOW())) as active_users
    FROM super_bonuses
    WHERE guild_id = $1
    ORDER BY
      CASE rarity
        WHEN 'legendary' THEN 1
        WHEN 'epic' THEN 2
        WHEN 'rare' THEN 3
        WHEN 'common' THEN 4
      END,
      name
  `, [guildId]);

  if (bonuses.length === 0) {
    return interaction.editReply({
      content: '❌ Aucun super bonus trouvé pour ce serveur.',
      components: []
    });
  }

  // Statistiques
  const totalBonuses = bonuses.length;
  const enabledCount = bonuses.filter(b => b.is_enabled).length;
  const disabledCount = totalBonuses - enabledCount;
  const activeUsersTotal = bonuses.reduce((sum, b) => sum + parseInt(b.active_users), 0);

  // Compter les bonus inactifs (is_active = FALSE ou expirés)
  const inactiveBonusesCount = await db.queryOne(`
    SELECT COUNT(*) as count
    FROM player_active_bonuses
    WHERE guild_id = $1
      AND (is_active = FALSE OR (expires_at IS NOT NULL AND expires_at <= NOW()))
  `, [guildId]);
  const inactiveCount = parseInt(inactiveBonusesCount.count) || 0;

  // Créer l'embed principal (Design 2025: Sombre, moderne, compact)
  const embed = new EmbedBuilder()
    .setTitle('⭐ GESTION DES SUPER BONUS')
    .setDescription(
      `### 📊 Vue d'ensemble\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `\`\`\`ansi\n` +
      `\x1b[32m●\x1b[0m ${enabledCount} activé${enabledCount > 1 ? 's' : ''}  |  ` +
      `\x1b[31m●\x1b[0m ${disabledCount} désactivé${disabledCount > 1 ? 's' : ''}  |  ` +
      `\x1b[36m${activeUsersTotal} activation${activeUsersTotal > 1 ? 's' : ''} en cours  |  ` +
      `\x1b[33m${inactiveCount} bonus inactif${inactiveCount > 1 ? 's' : ''}\n` +
      `\`\`\`\n\n` +
      `### 🎁 Liste des Bonus\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    )
    .setColor('#2B2D31'); // Couleur sombre Discord 2025

  // Grouper par rareté
  const rarityGroups = {
    legendary: { emoji: '🌟', label: 'LÉGENDAIRE', bonuses: [] },
    epic: { emoji: '💜', label: 'ÉPIQUE', bonuses: [] },
    rare: { emoji: '💎', label: 'RARE', bonuses: [] },
    common: { emoji: '⚪', label: 'COMMUN', bonuses: [] }
  };

  for (const bonus of bonuses) {
    rarityGroups[bonus.rarity].bonuses.push(bonus);
  }

  // Construire la description par rareté
  let description = embed.data.description;
  for (const [rarity, group] of Object.entries(rarityGroups)) {
    if (group.bonuses.length === 0) continue;

    description += `${group.emoji} **${group.label}**\n`;
    for (const bonus of group.bonuses) {
      const statusEmoji = bonus.is_enabled ? '🟢' : '🔴';
      const usersBadge = bonus.active_users > 0 ? ` • \`${bonus.active_users} 👤\`` : '';
      const modeIcon = bonus.activation_mode === 'automatic' ? '⚡' : '🎯';
      description += `${statusEmoji} **${bonus.icon} ${bonus.name}** ${modeIcon}${usersBadge}\n`;
    }
    description += '\n';
  }

  description += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💡 Sélectionne un bonus pour l'activer ou le désactiver`;

  embed.setDescription(description);
  embed.setFooter({ text: '⚡ Automatique | 🎯 Manuel • 👤 Activations en cours' });
  embed.setTimestamp();

  // Créer le menu de sélection (max 25 options)
  const selectOptions = bonuses.slice(0, 25).map(bonus => {
    const statusEmoji = bonus.is_enabled ? '🟢' : '🔴';
    const rarityEmoji = rarityGroups[bonus.rarity].emoji;
    return {
      label: `${bonus.icon} ${bonus.name}`.substring(0, 100),
      description: `${statusEmoji} ${bonus.is_enabled ? 'Activé' : 'Désactivé'} • ${rarityGroups[bonus.rarity].label}`.substring(0, 100),
      value: `bonus_toggle_${bonus.id}`,
      emoji: rarityEmoji
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('super_bonus_select')
    .setPlaceholder('Sélectionner un super bonus à gérer')
    .addOptions(selectOptions);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);

  // Boutons d'action globale
  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('super_bonus_enable_all')
        .setLabel('🟢 Tout Activer')
        .setStyle(ButtonStyle.Success)
        .setDisabled(enabledCount === totalBonuses),
      new ButtonBuilder()
        .setCustomId('super_bonus_disable_all')
        .setLabel('🔴 Tout Désactiver')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabledCount === totalBonuses),
      new ButtonBuilder()
        .setCustomId('admin_settings')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

  // Boutons d'édition avancée
  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('admin_bonus_edit_duration')
        .setLabel('⏱️ Modifier Durée/Charges')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_bonus_edit_rarity')
        .setLabel('🎨 Modifier Raretés')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [row1, row2, row3]
  });
}

/**
 * Activer/Désactiver un super bonus individuel
 */
async function toggleSuperBonus(interaction, bonusId) {
  await interaction.deferUpdate();

  const guildId = interaction.guildId;

  // Récupérer le bonus
  const bonus = await db.queryOne(`
    SELECT * FROM super_bonuses
    WHERE id = $1 AND guild_id = $2
  `, [bonusId, guildId]);

  if (!bonus) {
    return interaction.followUp({
      content: '❌ Super bonus introuvable.',
      flags: 64
    });
  }

  // Inverser le statut
  const newStatus = !bonus.is_enabled;

  await db.query(`
    UPDATE super_bonuses
    SET is_enabled = $1
    WHERE id = $2 AND guild_id = $3
  `, [newStatus, bonusId, guildId]);

  console.log(`🔄 [SUPER BONUS] ${bonus.name} ${newStatus ? 'ACTIVÉ' : 'DÉSACTIVÉ'} dans ${guildId}`);

  // Rafraîchir le panneau directement (pas de message de confirmation séparé)
  await showSuperBonusesAdminPanel(interaction);
}

/**
 * Activer tous les super bonus
 */
async function enableAllSuperBonuses(interaction) {
  await interaction.deferUpdate();

  const guildId = interaction.guildId;

  await db.query(`
    UPDATE super_bonuses
    SET is_enabled = TRUE
    WHERE guild_id = $1 AND is_enabled = FALSE
  `, [guildId]);

  console.log(`🟢 [SUPER BONUS] Tous les bonus activés dans ${guildId}`);

  // Rafraîchir le panneau directement
  await showSuperBonusesAdminPanel(interaction);
}

/**
 * Désactiver tous les super bonus
 */
async function disableAllSuperBonuses(interaction) {
  await interaction.deferUpdate();

  const guildId = interaction.guildId;

  await db.query(`
    UPDATE super_bonuses
    SET is_enabled = FALSE
    WHERE guild_id = $1 AND is_enabled = TRUE
  `, [guildId]);

  console.log(`🔴 [SUPER BONUS] Tous les bonus désactivés dans ${guildId}`);

  // Rafraîchir le panneau directement
  await showSuperBonusesAdminPanel(interaction);
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
  formatDuration,
  // Vision Divine
  checkAndRevealVisionDivine,
  createVisionDivineEmbed,
  clearVisionDivineTracking,
  // Aimant à Légendaires & Jackpot x2
  applyCollectibleRarityBoost,
  hasMultiplierBonus,
  consumeBonusCharge,
  // Admin handlers
  handleBonusDurationSelect,
  handleEditBonusDurationHours,
  handleEditBonusDurationDays,
  handleEditBonusDurationCharges,
  // Admin panel - Activation/Désactivation
  showSuperBonusesAdminPanel,
  toggleSuperBonus,
  enableAllSuperBonuses,
  disableAllSuperBonuses
};
