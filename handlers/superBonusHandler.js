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
 * Vérifier si le joueur a un bonus de révélation actif (Vision Divine)
 * IMPORTANT: Le bonus doit être activé (activated_at != null) pour fonctionner
 */
async function hasRevealBonus(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
  return activeBonuses.find(bonus =>
    bonus.effect_type === 'reveal' &&
    bonus.activated_at !== null &&  // ⚠️ Doit être activé (pas en pause)
    (bonus.remaining_charges > 0 || bonus.duration_type !== 'charges')
  );
}

/**
 * Consommer une charge de révélation (Vision Divine)
 * @param {string} guildId - Guild ID
 * @param {string} userId - User Discord ID
 * @param {object} client - Discord client (optionnel, pour notifications badges)
 */
async function consumeRevealCharge(guildId, userId, client = null) {
  const revealBonus = await hasRevealBonus(guildId, userId);
  if (!revealBonus) return null;

  if (revealBonus.duration_type === 'charges') {
    await db.decrementBonusCharge(guildId, revealBonus.id);

    // Logger l'utilisation dans bonus_usage_history
    try {
      await db.query(`
        INSERT INTO bonus_usage_history (guild_id, user_id, bonus_id, used_at, effect_result, trigger_type)
        VALUES ($1, $2, $3, NOW(), $4, 'vision_divine_reveal')
      `, [guildId, userId, revealBonus.bonus_id, JSON.stringify({ action: 'revealed_mystery_box' })]);
    } catch (logError) {
      console.error('⚠️  Erreur logging Vision Divine usage:', logError);
    }

    // Tracking badge Vision Divine
    try {
      const player = await db.getPlayerByDiscordId(guildId, userId);
      if (player) {
        await badgeHandler.onSuperBonusUsed(guildId, player.id, revealBonus.bonus_id, client);
      }
    } catch (badgeError) {
      console.error('🔴 Erreur tracking badge Vision Divine:', badgeError);
    }
  }

  return revealBonus;
}

/**
 * Vérifier si le joueur a un multiplicateur de récompense actif
 * IMPORTANT: Le bonus doit être activé (activated_at != null) pour fonctionner
 */
async function getRewardMultiplier(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
  const multiplierBonus = activeBonuses.find(bonus =>
    bonus.effect_type === 'multiplier' &&
    bonus.activated_at !== null &&  // ⚠️ Doit être activé (pas en pause)
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
 * IMPORTANT: Le bonus doit être activé (activated_at != null) pour fonctionner
 */
async function hasTrapShield(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
  return activeBonuses.find(bonus =>
    bonus.effect_type === 'protection' &&
    bonus.activated_at !== null &&  // ⚠️ Doit être activé (pas en pause)
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
 * Vérifier si le joueur a un Accélérateur de Cooldown actif
 */
async function hasCooldownAccelerator(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
  return activeBonuses.find(bonus =>
    bonus.effect_type === 'cooldown' &&
    (bonus.remaining_charges > 0 || bonus.duration_type !== 'charges')
  );
}

/**
 * Activer l'Accélérateur de Cooldown - supprime tous les cooldowns actifs
 * @returns {object|null} Résultat avec succès/erreur et détails
 */
async function activateCooldownAccelerator(guildId, userId) {
  // 1. Vérifier si le joueur a le bonus
  const accelerator = await hasCooldownAccelerator(guildId, userId);
  if (!accelerator) {
    return { success: false, error: 'no_bonus', message: 'Tu n\'as pas d\'Accélérateur de Cooldown actif.' };
  }

  // 2. Récupérer le joueur
  const player = await db.getPlayerByDiscordId(guildId, userId);
  if (!player) {
    return { success: false, error: 'no_player', message: 'Joueur introuvable.' };
  }

  // 3. Vérifier si le joueur a un cooldown actif
  const activeCooldowns = await db.getActiveCooldowns(guildId, player.id);
  if (activeCooldowns.length === 0) {
    return {
      success: false,
      error: 'no_cooldown',
      message: '⚠️ Tu n\'as aucun cooldown actif ! Ta charge n\'a pas été consommée.'
    };
  }

  // 4. Supprimer tous les cooldowns
  const removedCount = await db.removeAllCooldowns(guildId, player.id);

  // 5. Consommer une charge du bonus
  await db.decrementBonusCharge(guildId, accelerator.id);

  // 6. Vérifier s'il reste des charges après décrémentation
  const updatedBonus = await db.queryOne(`
    SELECT remaining_charges
    FROM player_active_bonuses
    WHERE id = $1 AND guild_id = $2
  `, [accelerator.id, guildId]);

  // 7. Si plus de charges, désactiver le bonus
  if (updatedBonus && updatedBonus.remaining_charges <= 0) {
    await db.query(`
      UPDATE player_active_bonuses
      SET is_active = FALSE, used_at = NOW()
      WHERE id = $1 AND guild_id = $2
    `, [accelerator.id, guildId]);
  }

  // 8. Logger l'utilisation du bonus
  try {
    await db.query(`
      INSERT INTO bonus_usage_history (guild_id, user_id, bonus_id, used_at, effect_result, trigger_type)
      VALUES ($1, $2, $3, NOW(), $4, 'cooldown_removed')
    `, [
      guildId,
      userId,
      accelerator.bonus_id,
      JSON.stringify({
        cooldowns_removed: removedCount,
        remaining_charges: updatedBonus?.remaining_charges || 0
      })
    ]);
  } catch (logError) {
    console.error('⚠️  Erreur logging bonus usage:', logError);
  }

  return {
    success: true,
    cooldownsRemoved: removedCount,
    remainingCharges: updatedBonus?.remaining_charges || 0,
    bonusName: accelerator.name,
    bonusIcon: accelerator.icon
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
async function checkAndRevealVisionDivine(userId, guildId, content, messageId, client = null) {
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

    // Consommer 1 charge de Vision Divine (avec tracking badge)
    await consumeRevealCharge(guildId, userId, client);
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

// =====================================================
// MYSTERY BOX JOKER - Système de choix de collectible
// =====================================================

/**
 * Vérifier si le joueur a un bonus Joker actif
 */
async function hasJokerBonus(guildId, userId) {
  const activeBonuses = await getPlayerActiveBonuses(guildId, userId);
  return activeBonuses.find(bonus => {
    if (bonus.effect_type !== 'joker') return false;

    // Pour les bonus avec charges
    if (bonus.duration_type === 'charges') {
      // null = non initialisé, considérer comme ayant des charges disponibles
      // sinon vérifier que > 0
      return bonus.remaining_charges === null || bonus.remaining_charges > 0;
    }

    // Pour les bonus temporaires ou permanents
    return true;
  });
}

/**
 * Récupérer la liste des collectibles manquants d'un joueur
 * (collectibles du thème actif qu'il n'a pas encore)
 * @deprecated Utilisez getCollectiblesForJoker() pour le nouveau système avec niveaux
 */
async function getMissingCollectibles(guildId, userId) {
  const result = await getCollectiblesForJoker(guildId, userId);
  // Compatibilité: retourner uniquement les non-possédés
  return result.collectibles.filter(c => !c.owned);
}

/**
 * Récupérer TOUS les collectibles du thème avec leur état de possession et niveau
 * pour l'interface de sélection du Joker (système de leveling)
 *
 * @returns {Object} { collectibles: Array, stats: { total, owned, missing, maxLevel } }
 */
async function getCollectiblesForJoker(guildId, userId) {
  try {
    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
      console.log('⚠️ [JOKER] Aucun thème actif');
      return { collectibles: [], stats: { total: 0, owned: 0, missing: 0, maxLevel: 0, lost: 0 } };
    }

    // Récupérer le joueur
    const player = await db.queryOne(`
      SELECT id FROM players WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, userId]);

    // Récupérer TOUS les collectibles du thème AVEC leur état de possession et niveau
    // Important: On récupère aussi les collectibles perdus (lost_at IS NOT NULL) avec leur ancien niveau
    const collectibles = await db.queryAll(`
      SELECT
        col.id,
        col.name,
        col.rarity,
        col.theme_id,
        CASE WHEN c_owned.id IS NOT NULL THEN TRUE ELSE FALSE END as owned,
        CASE WHEN c_lost.id IS NOT NULL THEN TRUE ELSE FALSE END as was_lost,
        COALESCE(c_owned.level, c_lost.level, 0) as level,
        COALESCE(c_owned.xp, c_lost.xp, 0) as xp
      FROM collectibles col
      LEFT JOIN collections c_owned ON c_owned.collectible_id = col.id
        AND c_owned.guild_id = col.guild_id
        AND c_owned.player_id = $3
        AND c_owned.lost_at IS NULL
      LEFT JOIN collections c_lost ON c_lost.collectible_id = col.id
        AND c_lost.guild_id = col.guild_id
        AND c_lost.player_id = $3
        AND c_lost.lost_at IS NOT NULL
      WHERE col.guild_id = $1 AND col.theme_id = $2
      ORDER BY
        CASE col.rarity
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'common' THEN 4
          ELSE 5
        END,
        col.name ASC
    `, [guildId, activeTheme.id, player?.id || -1]);

    // Calculer les stats
    const MAX_LEVEL = 4;
    const stats = {
      total: collectibles.length,
      owned: collectibles.filter(c => c.owned).length,
      missing: collectibles.filter(c => !c.owned && !c.was_lost).length,
      lost: collectibles.filter(c => !c.owned && c.was_lost).length,
      maxLevel: collectibles.filter(c => c.owned && c.level >= MAX_LEVEL).length
    };

    // Règles de sélection:
    // - Perdu (was_lost=true, owned=false): TOUJOURS sélectionnable (récupération, pas de gain XP)
    // - Possédé niveau max: BLOQUÉ (pas de gain possible)
    // - Possédé pas niveau max: sélectionnable (fusion XP)
    // - Jamais eu: sélectionnable (nouveau)
    const collectiblesWithStatus = collectibles.map(c => ({
      ...c,
      isMaxLevel: c.owned && c.level >= MAX_LEVEL,
      // Perdu = toujours récupérable, même si c'était niveau max
      canSelect: c.was_lost || !c.owned || c.level < MAX_LEVEL
    }));

    console.log(`🃏 [JOKER] ${stats.missing} manquants, ${stats.lost} perdus, ${stats.owned} possédés (${stats.maxLevel} niveau max) sur ${stats.total} pour ${userId}`);

    return { collectibles: collectiblesWithStatus, stats };
  } catch (error) {
    console.error('❌ [JOKER] Erreur récupération collectibles:', error);
    return { collectibles: [], stats: { total: 0, owned: 0, missing: 0, maxLevel: 0, lost: 0 } };
  }
}

/**
 * Consommer le bonus Joker et donner le collectible choisi
 * Supporte le système de leveling: si déjà possédé, ajoute de l'XP (fusion)
 *
 * @returns {Object} { success, collectible, player, isLevelUp, newLevel, loomixReward, wasDuplicate }
 */
async function consumeJokerBonus(guildId, userId, collectibleId) {
  const jokerBonus = await hasJokerBonus(guildId, userId);
  if (!jokerBonus) {
    console.log('⚠️ [JOKER] Pas de bonus joker actif');
    return { success: false, error: 'no_bonus' };
  }

  try {
    // Vérifier que le collectible existe
    const collectible = await db.queryOne(`
      SELECT id, name, rarity, theme_id
      FROM collectibles
      WHERE id = $1 AND guild_id = $2
    `, [collectibleId, guildId]);

    if (!collectible) {
      return { success: false, error: 'invalid_collectible' };
    }

    // Récupérer le player
    const player = await db.queryOne(`
      SELECT id FROM players WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, userId]);

    if (!player) {
      return { success: false, error: 'player_not_found' };
    }

    // Vérifier si le joueur possède déjà ce collectible au niveau max (BLOCAGE)
    const existingOwned = await db.queryOne(`
      SELECT c.id, c.level, c.xp
      FROM collections c
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.collectible_id = $3 AND c.lost_at IS NULL
    `, [guildId, player.id, collectibleId]);

    const MAX_LEVEL = 4;

    // SEUL cas de blocage: possédé ET niveau max
    if (existingOwned && existingOwned.level >= MAX_LEVEL) {
      return { success: false, error: 'max_level_reached' };
    }

    // Utiliser db.addCollectibleWithLevels qui gère tous les cas:
    // - Nouveau collectible → isNew: true
    // - Collectible perdu → restored: true (conserve niveau/XP/mint)
    // - Doublon → fusion: true (ajoute XP, level up possible)
    const addResult = await db.addCollectibleWithLevels(guildId, player.id, collectibleId, 'joker');

    if (!addResult) {
      return { success: false, error: 'database_error' };
    }

    const wasDuplicate = addResult.fusion || false;
    const wasRecovered = addResult.restored || false;
    const isNew = addResult.isNew || false;
    const isLevelUp = addResult.leveledUp || false;
    const newLevel = addResult.newLevel || 1;
    const loomixReward = addResult.rewards?.loomix || 0;

    // Logs adaptés au type d'action
    if (wasRecovered) {
      console.log(`🃏 [JOKER] Récupération: ${collectible.name} (niveau ${newLevel} conservé, mint #${addResult.mintNumber})`);
    } else if (wasDuplicate) {
      console.log(`🃏 [JOKER] Fusion: ${collectible.name} level ${addResult.oldLevel} → ${newLevel}` +
        (isLevelUp ? ` (+${loomixReward} Loomix)` : ''));
    } else {
      console.log(`🃏 [JOKER] Nouveau collectible: ${collectible.name} (mint #${addResult.mintNumber})`);
    }

    // Consommer la charge du joker
    if (jokerBonus.duration_type === 'charges') {
      if (jokerBonus.remaining_charges === null) {
        await db.query(`
          UPDATE player_active_bonuses
          SET remaining_charges = 0, is_active = FALSE, used_at = NOW(), activated_at = COALESCE(activated_at, NOW())
          WHERE id = $1 AND guild_id = $2
        `, [jokerBonus.id, guildId]);
        console.log(`🃏 [JOKER] Charges null -> désactivé directement`);
      } else {
        await db.decrementBonusCharge(guildId, jokerBonus.id);

        const updatedBonus = await db.queryOne(`
          SELECT remaining_charges
          FROM player_active_bonuses
          WHERE id = $1 AND guild_id = $2
        `, [jokerBonus.id, guildId]);

        if (updatedBonus && updatedBonus.remaining_charges <= 0) {
          await db.query(`
            UPDATE player_active_bonuses
            SET is_active = FALSE, used_at = NOW()
            WHERE id = $1 AND guild_id = $2
          `, [jokerBonus.id, guildId]);
        }
      }
    }

    // Logger l'utilisation du bonus
    try {
      await db.query(`
        INSERT INTO bonus_usage_history (guild_id, user_id, bonus_id, used_at, effect_result, trigger_type)
        VALUES ($1, $2, $3, NOW(), $4, 'joker_used')
      `, [
        guildId,
        userId,
        jokerBonus.bonus_id,
        JSON.stringify({
          collectible_id: collectibleId,
          collectible_name: collectible.name,
          collectible_rarity: collectible.rarity,
          is_new: isNew,
          was_duplicate: wasDuplicate,
          was_recovered: wasRecovered,
          level_up: isLevelUp,
          old_level: addResult.oldLevel || 0,
          new_level: newLevel,
          loomix_reward: loomixReward,
          mint_number: addResult.mintNumber
        })
      ]);
    } catch (logError) {
      console.error('⚠️ Erreur logging joker usage:', logError);
    }

    // Message de log adapté au type d'action
    const actionType = wasRecovered ? 'récupérer' : (wasDuplicate ? 'améliorer' : 'obtenir');
    console.log(`🃏 [JOKER] ${userId} a utilisé son joker pour ${actionType} ${collectible.name} (${collectible.rarity})`);

    return {
      success: true,
      collectible: collectible,
      player: player,
      isNew,
      wasDuplicate,
      wasRecovered,
      isLevelUp,
      oldLevel: addResult.oldLevel || 0,
      newLevel,
      loomixReward,
      mintNumber: addResult.mintNumber,
      currentXp: addResult.currentXp || 0,
      remainingCharges: 0
    };

  } catch (error) {
    console.error('❌ [JOKER] Erreur consommation bonus:', error);
    return { success: false, error: 'database_error' };
  }
}

/**
 * Créer l'embed pour la sélection du collectible (interface joker) - LEGENDARY UI
 * Supporte le nouveau système de leveling avec affichage des niveaux
 *
 * @param {Array} collectibles - Liste des collectibles avec owned, level, canSelect
 * @param {string} username - Nom du joueur
 * @param {Object} stats - Statistiques { total, owned, missing, maxLevel }
 */
function createJokerSelectionEmbed(collectibles, username, stats = null) {
  // Compatibilité avec l'ancien format (tableau simple)
  const isNewFormat = collectibles.length > 0 && typeof collectibles[0].owned !== 'undefined';

  // Calculer les stats si non fournies
  if (!stats && isNewFormat) {
    stats = {
      total: collectibles.length,
      owned: collectibles.filter(c => c.owned).length,
      missing: collectibles.filter(c => !c.owned && !c.was_lost).length,
      lost: collectibles.filter(c => c.was_lost && !c.owned).length,
      maxLevel: collectibles.filter(c => c.isMaxLevel).length
    };
  }

  // Collectibles sélectionnables (non-possédés OU possédés mais pas niveau max)
  const selectableCount = isNewFormat
    ? collectibles.filter(c => c.canSelect).length
    : collectibles.length;

  // Collectibles haut niveau pour recommandations (level 3+)
  const highLevelCollectibles = isNewFormat
    ? collectibles.filter(c => c.owned && c.level >= 3 && c.level < 4)
    : [];

  const embed = new EmbedBuilder()
    .setTitle('🃏✨ MYSTERYBOX JOKER ACTIVÉ ✨🃏')
    .setDescription(
      `╔═══════════════════════════════════════════════╗\n` +
      `║     🎰 **POUVOIR LÉGENDAIRE DÉBLOQUÉ** 🎰     ║\n` +
      `╚═══════════════════════════════════════════════╝\n\n` +
      `🌟 **${username}**, le pouvoir ultime t'appartient ! 🌟\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Tu peux choisir **N'IMPORTE QUEL** collectible:\n` +
      `• 🆕 Un collectible **manquant** pour l'obtenir\n` +
      `• ⬆️ Un collectible **possédé** pour le faire **monter de niveau**\n\n` +
      `👑 **Même les LÉGENDAIRES !** 👑\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      (stats ? `📊 **${stats.missing}** manquants` +
        (stats.lost > 0 ? ` | **${stats.lost}** perdus 🔮` : '') +
        ` | **${stats.owned}** possédés` +
        (stats.maxLevel > 0 ? ` | **${stats.maxLevel}** niveau max 🔒` : '') + `\n` : '') +
      `📦 **${selectableCount} collectibles** sélectionnables\n\n` +
      `╭─────────────────────────────────────────╮\n` +
      `│  ⚡ *Ce pouvoir est unique...* ⚡  │\n` +
      `│  💎 *Choisis avec sagesse !* 💎  │\n` +
      `╰─────────────────────────────────────────╯`
    )
    .setColor('#FFD700')
    .setImage('attachment://joker-wow.gif');

  const rarityConfig = {
    legendary: { emoji: '🌟', label: 'LÉGENDAIRE' },
    epic: { emoji: '💜', label: 'ÉPIQUE' },
    rare: { emoji: '💙', label: 'RARE' },
    common: { emoji: '⚪', label: 'COMMUN' }
  };

  // Fonction pour formater un collectible avec son niveau
  const formatCollectible = (c) => {
    const config = rarityConfig[c.rarity] || rarityConfig.common;

    // Collectible perdu (peut être récupéré)
    if (c.was_lost && !c.owned) {
      const stars = '★'.repeat(c.level) + '☆'.repeat(4 - c.level);
      return `${config.emoji} **${c.name}** ${stars} 🔮`;
    }

    // Nouveau (jamais possédé)
    if (!isNewFormat || !c.owned) {
      return `${config.emoji} **${c.name}** 🆕`;
    }

    // Possédé
    const stars = '★'.repeat(c.level) + '☆'.repeat(4 - c.level);
    if (c.isMaxLevel) {
      return `${config.emoji} ~~${c.name}~~ ${stars} 🔒`;
    }
    return `${config.emoji} **${c.name}** ${stars}`;
  };

  // Grouper par rareté
  const byRarity = {
    legendary: collectibles.filter(c => c.rarity === 'legendary'),
    epic: collectibles.filter(c => c.rarity === 'epic'),
    rare: collectibles.filter(c => c.rarity === 'rare'),
    common: collectibles.filter(c => c.rarity === 'common')
  };

  // Section prioritaire: Collectibles proches du niveau max (recommandations)
  if (highLevelCollectibles.length > 0) {
    const recommendations = highLevelCollectibles
      .slice(0, 5)
      .map(c => {
        const config = rarityConfig[c.rarity];
        const stars = '★'.repeat(c.level) + '☆'.repeat(4 - c.level);
        return `${config.emoji} **${c.name}** ${stars} → ★★★★`;
      });

    embed.addFields({
      name: `💡 ═══ RECOMMANDATIONS ═══ 💡`,
      value: `*Ces collectibles sont proches du niveau max:*\n` + recommendations.join('\n'),
      inline: false
    });
  }

  // Légendaires en section spéciale
  if (byRarity.legendary.length > 0) {
    const legendaryList = byRarity.legendary
      .slice(0, 8)
      .map(formatCollectible);
    const moreText = byRarity.legendary.length > 8
      ? `\n*+${byRarity.legendary.length - 8} autres...*`
      : '';
    embed.addFields({
      name: `🏆 ═══ LÉGENDAIRES ═══ 🏆`,
      value: legendaryList.join('\n') + moreText,
      inline: false
    });
  }

  // Autres raretés en colonnes
  for (const [rarity, items] of Object.entries(byRarity)) {
    if (rarity === 'legendary') continue;
    if (items.length > 0) {
      const config = rarityConfig[rarity];
      const itemsList = items.slice(0, 6).map(formatCollectible);
      const moreText = items.length > 6 ? `\n*+${items.length - 6} autres...*` : '';
      embed.addFields({
        name: `${config.emoji} ${config.label} (${items.length})`,
        value: itemsList.join('\n') + moreText,
        inline: true
      });
    }
  }

  embed.addFields({
    name: '📖 Légende',
    value: '🆕 = Nouveau | 🔮 = Perdu (récupérable) | ★ = Niveau | 🔒 = Max',
    inline: false
  });

  embed.setFooter({ text: '🃏 MysteryBox Joker • Bonus Légendaire • Usage unique' });
  embed.setTimestamp();

  return embed;
}

/**
 * Créer l'embed de succès après utilisation du joker - LEGENDARY UI
 * Note: Utilise attachment://joker-wow.gif - le fichier doit être attaché lors de l'envoi
 *
 * @param {string} username - Nom de l'utilisateur
 * @param {Object} collectible - Infos du collectible
 * @param {Object} result - Résultat de consumeJokerBonus (optionnel pour rétrocompat)
 */
function createJokerSuccessEmbed(username, collectible, result = {}) {
  const rarityConfig = {
    legendary: {
      emoji: '👑',
      color: '#FFD700',
      label: 'LÉGENDAIRE'
    },
    epic: {
      emoji: '💜',
      color: '#9b59b6',
      label: 'ÉPIQUE'
    },
    rare: {
      emoji: '💙',
      color: '#3498db',
      label: 'RARE'
    },
    common: {
      emoji: '⚪',
      color: '#95a5a6',
      label: 'COMMUN'
    }
  };

  const config = rarityConfig[collectible.rarity] || rarityConfig.common;
  const isLegendary = collectible.rarity === 'legendary';
  const isEpicOrHigher = ['legendary', 'epic'].includes(collectible.rarity);

  // Helpers pour les niveaux
  const getLevelStars = (level) => {
    const MAX_LEVEL = 4;
    return '★'.repeat(level) + '☆'.repeat(MAX_LEVEL - level);
  };

  // Déterminer le type d'action et le message adapté
  const { wasRecovered, wasDuplicate, isLevelUp, oldLevel, newLevel, loomixReward, mintNumber, currentXp } = result;

  // Helper pour créer une barre de progression XP (même logique que profileView.js)
  const XP_THRESHOLDS = { 2: 100, 3: 300, 4: 700 };
  const MAX_COLLECTIBLE_LEVEL = 4;

  const createXpProgressBar = (currentXp, level, barLength = 20) => {
    if (level >= MAX_COLLECTIBLE_LEVEL) {
      return `\`[${'█'.repeat(barLength)}]\` **MAX**`;
    }

    const prevThreshold = level === 1 ? 0 : XP_THRESHOLDS[level] || 0;
    const nextThreshold = XP_THRESHOLDS[level + 1] || XP_THRESHOLDS[MAX_COLLECTIBLE_LEVEL];
    const xpInLevel = currentXp - prevThreshold;
    const xpNeeded = nextThreshold - prevThreshold;
    const progress = Math.min(xpInLevel / xpNeeded, 1);

    const filled = Math.round(progress * barLength);
    const empty = barLength - filled;

    return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\` **${currentXp}/${nextThreshold}** XP`;
  };

  let actionTitle, actionDescription, footerText;

  if (wasRecovered) {
    // RÉCUPÉRATION d'un collectible perdu
    actionTitle = `🔮 COLLECTIBLE RETROUVÉ ! 🔮`;
    actionDescription =
      `🃏 **${username}** a utilisé son **MysteryBox Joker** !\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔮 **COLLECTIBLE RÉCUPÉRÉ:**\n\n` +
      `╭─────────────────────────────────────────╮\n` +
      `│  ${config.emoji} **${collectible.name}**\n` +
      `│  \n` +
      `│  📊 Rareté: **${config.label}**\n` +
      `│  ${getLevelStars(newLevel)} Niveau **${newLevel}** conservé\n` +
      (mintNumber ? `│  🏆 Mint **#${mintNumber}** original\n` : '') +
      `╰─────────────────────────────────────────╯\n\n` +
      `✨ *Tu as retrouvé ce collectible que tu avais perdu !* ✨\n` +
      `🛡️ *Son niveau et son numéro de mint sont préservés !* 🛡️`;
    footerText = `🃏 MysteryBox Joker • Collectible récupéré • Niveau ${newLevel} conservé`;

  } else if (wasDuplicate) {
    // FUSION (amélioration d'un doublon)
    if (isLevelUp) {
      actionTitle = `⬆️ LEVEL UP ! ⬆️`;
      actionDescription =
        `🃏 **${username}** a utilisé son **MysteryBox Joker** !\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⬆️ **FUSION RÉUSSIE - LEVEL UP !**\n\n` +
        `╭─────────────────────────────────────────╮\n` +
        `│  ${config.emoji} **${collectible.name}**\n` +
        `│  \n` +
        `│  📊 Rareté: **${config.label}**\n` +
        `│  ${getLevelStars(oldLevel)} → ${getLevelStars(newLevel)}\n` +
        `│  📈 Niveau **${oldLevel}** → **${newLevel}**\n` +
        (loomixReward > 0 ? `│  💰 **+${loomixReward} Loomix** gagnés !\n` : '') +
        `╰─────────────────────────────────────────╯\n\n` +
        `🎉 *Félicitations ! Ton collectible a monté de niveau !* 🎉\n` +
        `💎 *Plus le niveau est haut, plus il est précieux !* 💎`;
      footerText = `🃏 MysteryBox Joker • Level Up ! • +${loomixReward} Loomix`;
    } else {
      // Calculer la progression vers le niveau suivant (passer currentXp et niveau actuel)
      const xpProgressBar = createXpProgressBar(currentXp || 0, newLevel || 1);

      actionTitle = `⚡ FUSION ! ⚡`;
      actionDescription =
        `🃏 **${username}** a utilisé son **MysteryBox Joker** !\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚡ **XP GAGNÉ PAR FUSION:**\n\n` +
        `╭─────────────────────────────────────────╮\n` +
        `│  ${config.emoji} **${collectible.name}**\n` +
        `│  \n` +
        `│  📊 Rareté: **${config.label}**\n` +
        `│  ${getLevelStars(newLevel)} Niveau **${newLevel}**\n` +
        `│  \n` +
        `│  📈 **+100 XP** ajoutés !\n` +
        `│  \n` +
        `│  ⏳ Progression: ${xpProgressBar}\n` +
        `╰─────────────────────────────────────────╯\n\n` +
        `⚡ *Fusion réussie ! Continue pour level up !* ⚡\n` +
        `📈 *Chaque doublon te rapproche du niveau suivant !* 📈`;
      footerText = `🃏 MysteryBox Joker • Fusion • +100 XP`;
    }

  } else {
    // NOUVEAU collectible (comportement par défaut)
    actionTitle = isLegendary
      ? '🎆✨ JACKPOT LÉGENDAIRE OBTENU ✨🎆'
      : `🃏✨ JOKER UTILISÉ - ${config.label} ✨🃏`;
    actionDescription =
      (isLegendary
        ? `╔═══════════════════════════════════════════════╗\n` +
          `║     🏆 **CHOIX LÉGENDAIRE EFFECTUÉ !** 🏆     ║\n` +
          `╚═══════════════════════════════════════════════╝\n\n`
        : isEpicOrHigher
          ? `╔════════════════════════════════════════╗\n` +
            `║     💜 **EXCELLENT CHOIX !** 💜     ║\n` +
            `╚════════════════════════════════════════╝\n\n`
          : ''
      ) +
      `🃏 **${username}** a utilisé son **MysteryBox Joker** !\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎁 **NOUVEAU COLLECTIBLE:**\n\n` +
      `╭─────────────────────────────────────────╮\n` +
      `│  ${config.emoji} **${collectible.name}**\n` +
      `│  \n` +
      `│  📊 Rareté: **${config.label}**\n` +
      `│  ${getLevelStars(1)} Niveau **1**\n` +
      (mintNumber ? `│  🏆 Mint **#${mintNumber}**\n` : '') +
      `╰─────────────────────────────────────────╯\n\n` +
      (isLegendary
        ? `🌟 *Un choix audacieux et légendaire !* 🌟\n` +
          `👑 *Tu as rejoint l'élite des collectionneurs !* 👑`
        : isEpicOrHigher
          ? `💎 *Excellent choix !* 💎\n` +
            `✨ *Ta collection s'enrichit !* ✨`
          : `✨ *Ajouté à ta collection !* ✨`
      );
    footerText = `🃏 MysteryBox Joker • Nouveau collectible • Mint #${mintNumber || '?'}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(actionTitle)
    .setDescription(actionDescription)
    .setColor(config.color)
    .setImage('attachment://joker-wow.gif') // GIF local attaché
    .setFooter({ text: footerText })
    .setTimestamp();

  return embed;
}

/**
 * Créer le menu de sélection pour le joker (paginated si nécessaire)
 * Supporte le nouveau système avec niveaux - filtre les collectibles niveau max
 *
 * @param {Array} collectibles - Liste des collectibles (avec canSelect pour le nouveau format)
 * @param {number} page - Page actuelle (0-indexed)
 */
function createJokerSelectMenu(collectibles, page = 0) {
  const ITEMS_PER_PAGE = 25; // Limite Discord pour les select menus

  // Nouveau format: filtrer les collectibles non sélectionnables (niveau max)
  const isNewFormat = collectibles.length > 0 && typeof collectibles[0].canSelect !== 'undefined';
  const selectableCollectibles = isNewFormat
    ? collectibles.filter(c => c.canSelect)
    : collectibles;

  const startIdx = page * ITEMS_PER_PAGE;
  const pageItems = selectableCollectibles.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(selectableCollectibles.length / ITEMS_PER_PAGE);

  const rarityEmojis = {
    legendary: '🌟',
    epic: '💜',
    rare: '💙',
    common: '⚪'
  };

  const options = pageItems.map(c => {
    // Description avec niveau si possédé
    let description = c.rarity.toUpperCase();

    if (isNewFormat) {
      if (c.was_lost && !c.owned) {
        // Collectible perdu - peut être récupéré
        const stars = '★'.repeat(c.level);
        description = `${c.rarity.toUpperCase()} - 🔮 Récupérable (Niv.${c.level} ${stars})`;
      } else if (c.owned) {
        // Possédé - fusion pour +XP
        const stars = '★'.repeat(c.level);
        description = `${c.rarity.toUpperCase()} - Niveau ${c.level} ${stars} → +XP`;
      } else {
        // Nouveau collectible
        description = `${c.rarity.toUpperCase()} - 🆕 Nouveau !`;
      }
    }

    return {
      label: c.name.substring(0, 100), // Limite Discord
      value: `joker_select_${c.id}`,
      description: description.substring(0, 100),
      emoji: rarityEmojis[c.rarity] || '📦'
    };
  });

  // Si aucun collectible sélectionnable, retourner un message
  if (options.length === 0) {
    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('joker_cancel')
        .setLabel('❌ Annuler - Tous les collectibles sont au niveau max')
        .setStyle(ButtonStyle.Danger)
    );
    return [cancelRow];
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`joker_collectible_select:${page}`)
    .setPlaceholder(`Choisissez un collectible (Page ${page + 1}/${totalPages})`)
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  const rows = [row];

  // Ajouter pagination si nécessaire
  if (totalPages > 1) {
    const paginationRow = new ActionRowBuilder();

    if (page > 0) {
      paginationRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`joker_page_${page - 1}`)
          .setLabel('◀️ Page précédente')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    if (page < totalPages - 1) {
      paginationRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`joker_page_${page + 1}`)
          .setLabel('Page suivante ▶️')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    paginationRow.addComponents(
      new ButtonBuilder()
        .setCustomId('joker_cancel')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );

    rows.push(paginationRow);
  } else {
    // Juste le bouton annuler si une seule page
    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('joker_cancel')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );
    rows.push(cancelRow);
  }

  return rows;
}

module.exports = {
  cleanupExpiredBonuses,
  getPlayerActiveBonuses,
  hasRevealBonus,
  consumeRevealCharge,
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
  disableAllSuperBonuses,
  // MysteryBox Joker
  hasJokerBonus,
  getMissingCollectibles,
  getCollectiblesForJoker,  // Nouveau: avec niveaux pour le système de leveling
  consumeJokerBonus,
  createJokerSelectionEmbed,
  createJokerSelectMenu,
  createJokerSuccessEmbed,
  // Accélérateur de Cooldown
  hasCooldownAccelerator,
  activateCooldownAccelerator
};
