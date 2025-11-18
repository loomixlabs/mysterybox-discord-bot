const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database-pg');
const { showOverview, showInventory, showHistory, showAchievements, showBonuses } = require('../views/profileView');
const {
  getRarityEmoji,
  createProgressBar,
  calculateBadges,
  formatRelativeTime,
  getSourceEmoji,
  getDynamicColor
} = require('../utils/profileHelpers');
const { getInventoryGrouped, getActivityTimeline } = require('../utils/profileQueries');
const { getLoomixFooter, LOOMIX_BRANDING } = require('../utils/footerHelper');
const profileColorHandler = require('./profileColorHandler');

/**
 * 🎯 PROFILE HANDLER - Router principal pour toutes les interactions du profil
 *
 * CustomIds gérés:
 * - profile_overview          → Vue d'ensemble
 * - profile_inventory         → Inventaire
 * - profile_bonuses           → Mes Bonus
 * - profile_history           → Historique
 * - profile_achievements      → Succès
 * - profile_refresh           → Actualiser la vue actuelle
 * - profile_share             → Partager le profil
 * - profile_inventory_filter  → SelectMenu filtre rareté
 * - profile_inventory_first   → Première page inventaire
 * - profile_inventory_prev    → Page précédente
 * - profile_inventory_next    → Page suivante
 * - profile_inventory_last    → Dernière page
 * - activate_bonus:id         → Activer un super bonus manuel
 */

// Store pour persister l'état entre les interactions
const profileState = new Map();

/**
 * 🔍 Récupérer l'état du profil pour un utilisateur
 */
function getProfileState(userId) {
  if (!profileState.has(userId)) {
    profileState.set(userId, {
      currentView: 'overview',
      inventoryPage: 0,
      inventoryFilter: 'all'
    });
  }
  return profileState.get(userId);
}

/**
 * 💾 Sauvegarder l'état du profil
 */
function saveProfileState(userId, state) {
  profileState.set(userId, state);
}

/**
 * 🎯 Router principal des interactions profile
 */
async function handleProfileInteraction(interaction) {
  const { customId, user } = interaction;

  try {
    // Gérer les select menus de couleur (ne PAS déférer car le handler le fait)
    if (customId.startsWith('profile_color_select_')) {
      return profileColorHandler.handleProfileColorSelect(interaction);
    }

    // Gérer le modal de couleur custom (ne PAS déférer car showModal répond immédiatement)
    if (customId === 'profile_color_custom') {
      return profileColorHandler.showCustomColorModal(interaction);
    }

    // ✅ CRITIQUE: Déférer IMMÉDIATEMENT
    await interaction.deferUpdate();

    // Récupérer les données de base
    const guildId = interaction.guildId;
    const player = await db.getPlayerByDiscordId(guildId, user.id);

    if (!player) {
      return interaction.editReply({
        content: '❌ Profil introuvable. Utilise `/profile` pour créer ton profil.',
        components: []
      });
    }

    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif pour le moment.',
        components: []
      });
    }

    const progress = await db.getPlayerProgress(guildId, player.id, theme.id);

    if (!progress) {
      return interaction.editReply({
        content: '❌ Aucune progression trouvée pour ce thème.',
        components: []
      });
    }

    // Récupérer l'état actuel
    const state = getProfileState(user.id);

    // Router selon le customId
    if (customId === 'profile_overview') {
      await handleOverview(interaction, player, theme, progress, state);
    } else if (customId === 'profile_inventory') {
      await handleInventory(interaction, player, theme, progress, state);
    } else if (customId === 'profile_bonuses') {
      await handleBonuses(interaction, player, theme, state);
    } else if (customId === 'profile_history') {
      await handleHistory(interaction, player, theme, state);
    } else if (customId === 'profile_achievements') {
      await handleAchievements(interaction, player, theme, progress, state);
    } else if (customId === 'profile_refresh') {
      await handleRefresh(interaction, player, theme, progress, state);
    } else if (customId === 'profile_share') {
      await handleShare(interaction, player, theme, progress);
    } else if (customId.startsWith('activate_bonus:')) {
      await handleActivateBonus(interaction, player, theme, state);
    } else if (customId === 'profile_inventory_filter') {
      await handleInventoryFilter(interaction, player, theme, progress, state);
    } else if (customId === 'profile_inventory_first') {
      await handleInventoryPagination(interaction, player, theme, progress, state, 'first');
    } else if (customId === 'profile_inventory_prev') {
      await handleInventoryPagination(interaction, player, theme, progress, state, 'prev');
    } else if (customId === 'profile_inventory_next') {
      await handleInventoryPagination(interaction, player, theme, progress, state, 'next');
    } else if (customId === 'profile_inventory_last') {
      await handleInventoryPagination(interaction, player, theme, progress, state, 'last');
    } else if (customId === 'profile_color_settings') {
      await profileColorHandler.showProfileColorPalette(interaction, player, theme, progress);
    } else if (customId === 'profile_color_auto') {
      await profileColorHandler.resetToAutoColor(interaction);
    }

  } catch (error) {
    console.error('🔴 Erreur handleProfileInteraction:', error);

    // Ignorer si interaction expirée
    if (error.code === 10062) {
      console.error('⏱️  Interaction expirée - Timeout dépassé');
      return;
    }

    const errorMsg = {
      content: '❌ Une erreur est survenue. Réessaye ou contacte un administrateur.',
      components: []
    };

    if (interaction.deferred) {
      await interaction.editReply(errorMsg).catch(() => {});
    } else {
      await interaction.reply({ ...errorMsg, flags: 64 }).catch(() => {});
    }
  }
}

/**
 * 🏠 Handler: Vue d'ensemble
 */
async function handleOverview(interaction, player, theme, progress, state) {
  state.currentView = 'overview';
  saveProfileState(interaction.user.id, state);

  const content = await showOverview(interaction, player, theme, progress);
  await interaction.editReply(content);
}

/**
 * 🎒 Handler: Inventaire
 */
async function handleInventory(interaction, player, theme, progress, state) {
  state.currentView = 'inventory';
  state.inventoryPage = 0; // Reset à la première page
  saveProfileState(interaction.user.id, state);

  const content = await showInventory(
    interaction,
    player,
    theme,
    progress,
    state.inventoryFilter,
    state.inventoryPage
  );

  await interaction.editReply(content);
}

/**
 * 💫 Handler: Mes Bonus
 */
async function handleBonuses(interaction, player, theme, state) {
  state.currentView = 'bonuses';
  saveProfileState(interaction.user.id, state);

  const content = await showBonuses(interaction, player, theme);
  await interaction.editReply(content);
}

/**
 * ⚡ Handler: Activer un bonus manuel
 */
async function handleActivateBonus(interaction, player, theme, state) {
  const [, bonusId] = interaction.customId.split(':');
  const guildId = interaction.guildId;

  try {
    // Récupérer le bonus à activer
    const activeBonusRecord = await db.query(
      `SELECT pab.*, sb.name, sb.description, sb.icon, sb.duration_type, sb.duration_value
       FROM player_active_bonuses pab
       JOIN super_bonuses sb ON pab.bonus_id = sb.id
       WHERE pab.id = $1 AND pab.user_id = $2 AND pab.guild_id = $3`,
      [bonusId, interaction.user.id, guildId]
    );

    if (activeBonusRecord.length === 0) {
      return interaction.editReply({
        content: '❌ Ce bonus n\'existe pas ou ne t\'appartient pas.',
        components: []
      });
    }

    const bonus = activeBonusRecord[0];

    // Vérifier si déjà activé
    if (bonus.activated_at !== null) {
      return interaction.editReply({
        content: `❌ Le bonus **${bonus.name}** est déjà actif !`,
        components: []
      });
    }

    // Activer le bonus
    const now = new Date();
    let expiresAt = null;
    let remainingCharges = bonus.remaining_charges; // Conserver la valeur existante

    if (bonus.duration_type === 'temporary' && bonus.duration_value) {
      expiresAt = new Date(now.getTime() + bonus.duration_value * 1000);
    }

    // Initialiser remaining_charges si NULL pour les bonus de type 'charges'
    if (bonus.duration_type === 'charges' && remainingCharges === null && bonus.duration_value) {
      remainingCharges = bonus.duration_value;
    }

    await db.query(
      `UPDATE player_active_bonuses
       SET activated_at = $1, expires_at = $2, remaining_charges = $3
       WHERE id = $4`,
      [now, expiresAt, remainingCharges, bonusId]
    );

    console.log(`✅ [BONUS ACTIVATION] ${interaction.user.tag} a activé le bonus "${bonus.name}" (ID: ${bonusId})`);

    // Préparer message de confirmation
    const icon = bonus.icon || '⚡';
    let durationText = '';

    if (bonus.duration_type === 'permanent') {
      durationText = '♾️ **Permanent** - Actif sans limite de temps';
    } else if (bonus.duration_type === 'charges') {
      durationText = `🔢 **${bonus.remaining_charges} charge(s)** disponibles`;
    } else if (bonus.duration_type === 'temporary') {
      const hours = Math.floor(bonus.duration_value / 3600);
      const minutes = Math.floor((bonus.duration_value % 3600) / 60);
      durationText = `⏱️ **Actif pendant ${hours}h ${minutes}min**`;
    }

    await interaction.editReply({
      content:
        `✨ **Bonus Activé !**\n\n` +
        `${icon} **${bonus.name}**\n` +
        `${bonus.description}\n\n` +
        `${durationText}\n\n` +
        `💡 *Le bonus est maintenant actif et ses effets s'appliquent automatiquement !*`,
      components: []
    });

    // Rafraîchir la vue des bonus après 2 secondes
    setTimeout(async () => {
      try {
        await handleBonuses(interaction, player, theme, state);
      } catch (error) {
        // Ignorer les erreurs (interaction peut être expirée)
      }
    }, 2000);

  } catch (error) {
    console.error('🔴 Erreur handleActivateBonus:', error);
    return interaction.editReply({
      content: `❌ Erreur lors de l'activation du bonus: ${error.message}`,
      components: []
    });
  }
}

/**
 * 📜 Handler: Historique
 */
async function handleHistory(interaction, player, theme, state) {
  state.currentView = 'history';
  saveProfileState(interaction.user.id, state);

  const content = await showHistory(interaction, player, theme);
  await interaction.editReply(content);
}

/**
 * 🏅 Handler: Succès
 */
async function handleAchievements(interaction, player, theme, progress, state) {
  state.currentView = 'achievements';
  saveProfileState(interaction.user.id, state);

  const content = await showAchievements(interaction, player, theme, progress);
  await interaction.editReply(content);
}

/**
 * 🔄 Handler: Actualiser
 */
async function handleRefresh(interaction, player, theme, progress, state) {
  // Actualiser la vue actuelle
  const { currentView } = state;

  if (currentView === 'overview') {
    await handleOverview(interaction, player, theme, progress, state);
  } else if (currentView === 'inventory') {
    await handleInventory(interaction, player, theme, progress, state);
  } else if (currentView === 'bonuses') {
    await handleBonuses(interaction, player, theme, state);
  } else if (currentView === 'history') {
    await handleHistory(interaction, player, theme, state);
  } else if (currentView === 'achievements') {
    await handleAchievements(interaction, player, theme, progress, state);
  } else {
    // Défaut: overview
    await handleOverview(interaction, player, theme, progress, state);
  }
}

/**
 * 📤 Handler: Partager le profil (Version 2.0 - Rich Embed + Loomix Promo)
 */
async function handleShare(interaction, player, theme, progress) {
  const guildId = interaction.guildId;

  // Récupérer les données nécessaires
  const [badges, leaderboard, inventory, recentActivity] = await Promise.all([
    calculateBadges(player.id, guildId, theme.id),
    db.getLeaderboard(guildId, theme.id, 100),
    getInventoryGrouped(player.id, guildId, theme.id),
    getActivityTimeline(player.id, guildId, theme.id, 3) // 3 dernières activités
  ]);

  // Calculer les stats
  const percentage = Math.round((progress.collected_count / theme.required_items) * 100);
  const progressBar = createProgressBar(progress.collected_count, theme.required_items);
  const badgeDisplay = badges.length > 0 ? badges.join(' ') : '🔰';
  const userRank = leaderboard.findIndex(p => p.discord_id === interaction.user.id) + 1;
  const rankDisplay = userRank > 0 ? `#${userRank}/${leaderboard.length}` : 'Non classé';
  // Utiliser la couleur préférée si définie, sinon la couleur dynamique
  const color = player.preferred_color || getDynamicColor(progress.collected_count, theme.required_items);

  // Calculer les stats par rareté
  const rarityStats = Object.entries(inventory)
    .map(([rarity, items]) => {
      const collected = items.filter(item => item.collected).length;
      const total = items.length;
      const rarityPercentage = total > 0 ? Math.round((collected / total) * 100) : 0;
      const emoji = getRarityEmoji(rarity);
      return `${emoji} **${rarity}:** ${collected}/${total} (${rarityPercentage}%)`;
    })
    .join('\n');

  // Créer l'embed riche
  const embed = new EmbedBuilder()
    .setTitle(`${badgeDisplay} Profil de ${player.username}`)
    .setColor(color)
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(
      `🎨 **Thème:** ${theme.name}\n` +
      `📊 **Progression:** ${progress.collected_count}/${theme.required_items} items\n` +
      `${progressBar} **${percentage}%**\n\n` +
      `${progress.is_completed ? '✅ **COLLECTION COMPLÈTE !** 🎉' : '🔄 En cours de collection'}`
    )
    .addFields(
      {
        name: '💎 Collection par Rareté',
        value: rarityStats || 'Aucun collectible',
        inline: false
      },
      {
        name: '🏆 Classement Serveur',
        value: rankDisplay,
        inline: true
      },
      {
        name: '📅 Joue depuis',
        value: formatRelativeTime(player.created_at),
        inline: true
      }
    );

  // Ajouter l'historique récent si disponible
  if (recentActivity.length > 0) {
    const activityText = recentActivity.map(activity => {
      const emoji = getRarityEmoji(activity.rarity);
      const source = getSourceEmoji(activity.source);
      const time = formatRelativeTime(activity.event_date);

      if (activity.event_type === 'lost') {
        return `❌ **${activity.name}** *(Perdu ${time})*`;
      } else {
        return `${emoji} **${activity.name}** ${source} *(${time})*`;
      }
    }).join('\n');

    embed.addFields({
      name: '📜 Activité Récente',
      value: activityText,
      inline: false
    });
  }

  // Footer avec call-to-action Loomix
  embed.setFooter(await getLoomixFooter(guildId, '🎮 Utilise /profile pour voir ton propre profil !'));
  embed.setTimestamp();

  // Envoyer dans le channel (non-éphémère) - Sans bouton
  await interaction.followUp({
    embeds: [embed],
    flags: 0 // Public
  });

  // Confirmer à l'utilisateur
  await interaction.editReply({
    content: '✅ Profil partagé dans le channel !',
    components: []
  });

  // Remettre le profil après 2 secondes
  setTimeout(async () => {
    try {
      const state = getProfileState(interaction.user.id);
      await handleRefresh(interaction, player, theme, progress, state);
    } catch (error) {
      // Ignorer les erreurs (interaction peut être expirée)
    }
  }, 2000);
}

/**
 * 🔍 Handler: Filtre inventaire (SelectMenu)
 */
async function handleInventoryFilter(interaction, player, theme, progress, state) {
  const selectedRarity = interaction.values[0];

  state.inventoryFilter = selectedRarity;
  state.inventoryPage = 0; // Reset à la première page
  saveProfileState(interaction.user.id, state);

  const content = await showInventory(
    interaction,
    player,
    theme,
    progress,
    state.inventoryFilter,
    state.inventoryPage
  );

  await interaction.editReply(content);
}

/**
 * 📄 Handler: Pagination inventaire
 */
async function handleInventoryPagination(interaction, player, theme, progress, state, action) {
  const { getInventoryGrouped } = require('../utils/profileQueries');
  const inventory = await getInventoryGrouped(player.id, interaction.guildId, theme.id);

  // Filtrer par rareté
  let filteredItems = [];
  if (state.inventoryFilter === 'all') {
    Object.keys(inventory).forEach(rarity => {
      filteredItems = filteredItems.concat(inventory[rarity].map(item => ({ ...item, rarity })));
    });
  } else {
    filteredItems = inventory[state.inventoryFilter] || [];
  }

  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  let newPage = state.inventoryPage;

  if (action === 'first') {
    newPage = 0;
  } else if (action === 'prev') {
    newPage = Math.max(0, state.inventoryPage - 1);
  } else if (action === 'next') {
    newPage = Math.min(totalPages - 1, state.inventoryPage + 1);
  } else if (action === 'last') {
    newPage = totalPages - 1;
  }

  state.inventoryPage = newPage;
  saveProfileState(interaction.user.id, state);

  const content = await showInventory(
    interaction,
    player,
    theme,
    progress,
    state.inventoryFilter,
    state.inventoryPage
  );

  await interaction.editReply(content);
}

/**
 * 🗑️ Nettoyer l'état du profil (à appeler périodiquement)
 */
function cleanupProfileState() {
  // Nettoyer les états de plus de 1 heure
  const oneHourAgo = Date.now() - 3600000;

  for (const [userId, state] of profileState.entries()) {
    if (state.lastUpdate && state.lastUpdate < oneHourAgo) {
      profileState.delete(userId);
    }
  }
}

// Nettoyer toutes les heures
setInterval(cleanupProfileState, 3600000);

module.exports = {
  handleProfileInteraction
};
