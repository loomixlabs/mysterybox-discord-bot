const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const db = require('../utils/database-pg');
const superBonusHandler = require('./superBonusHandler');
const { showOverview, showInventory, showHistory, showAchievements, showBonuses, showBadges } = require('../views/profileView');
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
      inventoryFilter: 'all',
      badgesPage: 0,
      badgesCategory: 'all',
      badgesRarity: 'all'
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
    } else if (customId === 'profile_badges') {
      await handleBadges(interaction, player, theme, state);
    } else if (customId === 'profile_badges_category') {
      await handleBadgesCategory(interaction, player, theme, state);
    } else if (customId === 'profile_badges_rarity') {
      await handleBadgesRarity(interaction, player, theme, state);
    } else if (customId.startsWith('profile_badges_prev:')) {
      await handleBadgesPagination(interaction, player, theme, state, 'prev');
    } else if (customId.startsWith('profile_badges_next:')) {
      await handleBadgesPagination(interaction, player, theme, state, 'next');
    } else if (customId === 'profile_badges_leaderboard') {
      await handleBadgesLeaderboard(interaction, player, theme, state);
    } else if (customId === 'profile_badges_refresh') {
      await handleBadges(interaction, player, theme, state);
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
    // Récupérer le bonus à activer (avec effect_type pour détecter le joker)
    const activeBonusRecord = await db.query(
      `SELECT pab.*, sb.name, sb.description, sb.icon, sb.duration_type, sb.duration_value, sb.effect_type
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

    // === CAS SPÉCIAL: MYSTERYBOX JOKER ===
    // Le joker est un bonus à USAGE MANUEL - même s'il est "activé", il peut être UTILISÉ
    // tant qu'il reste des charges. Le check d'activation doit être APRÈS le check joker.
    if (bonus.effect_type === 'joker') {
      // Vérifier s'il reste des charges (avec fallback sur duration_value)
      const effectiveCharges = bonus.remaining_charges !== null ? bonus.remaining_charges : bonus.duration_value;
      if (effectiveCharges <= 0) {
        return interaction.editReply({
          content: `❌ Tu n'as plus de charges pour le **${bonus.name}** !`,
          components: []
        });
      }

      console.log(`🃏 [JOKER] ${interaction.user.tag} utilise le MysteryBox Joker (${effectiveCharges} charge(s) restante(s))`);

      // Récupérer les collectibles manquants
      const missingCollectibles = await superBonusHandler.getMissingCollectibles(guildId, interaction.user.id);

      if (missingCollectibles.length === 0) {
        return interaction.editReply({
          content: '🎉 **Félicitations !** Tu possèdes déjà tous les collectibles du thème actif !\n\nLe MysteryBox Joker n\'a pas été consommé.',
          components: []
        });
      }

      // Afficher l'interface de sélection avec le GIF personnalisé
      const embed = superBonusHandler.createJokerSelectionEmbed(missingCollectibles, interaction.user.username);
      const components = superBonusHandler.createJokerSelectMenu(missingCollectibles, 0);

      // Créer l'attachment pour le GIF personnalisé
      const jokerGifPath = path.join(__dirname, '..', 'assets', 'joker.gif');
      const jokerAttachment = new AttachmentBuilder(jokerGifPath, { name: 'joker-wow.gif' });

      // Stocker le bonusId pour la sélection
      state.pendingJokerBonusId = bonusId;
      saveProfileState(interaction.user.id, state);

      return interaction.editReply({
        embeds: [embed],
        components: components,
        files: [jokerAttachment]
      });
    }

    // Vérifier si déjà activé (pour les autres bonus)
    if (bonus.activated_at !== null) {
      return interaction.editReply({
        content: `❌ Le bonus **${bonus.name}** est déjà actif !`,
        components: []
      });
    }

    // === CAS NORMAL: Autres bonus ===
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
      durationText = `🔢 **${remainingCharges} charge(s)** disponibles`;
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
  } else if (currentView === 'badges') {
    await handleBadges(interaction, player, theme, state);
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

  const itemsPerPage = 3; // Doit correspondre à profileView.js pour éviter pages vides
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
 * 🏆 Handler: Vue Badges
 */
async function handleBadges(interaction, player, theme, state) {
  state.currentView = 'badges';
  state.badgesPage = 0; // Reset à la première page
  saveProfileState(interaction.user.id, state);

  const content = await showBadges(
    interaction,
    player,
    theme,
    interaction.guildId,  // BUG 16 FIX: Pass guildId explicitly
    state.badgesCategory,
    state.badgesRarity,
    state.badgesPage
  );

  await interaction.editReply(content);
}

/**
 * 🔍 Handler: Filtre catégorie badges (SelectMenu)
 */
async function handleBadgesCategory(interaction, player, theme, state) {
  const selectedCategory = interaction.values[0];

  state.badgesCategory = selectedCategory;
  state.badgesPage = 0; // Reset à la première page
  saveProfileState(interaction.user.id, state);

  const content = await showBadges(
    interaction,
    player,
    theme,
    interaction.guildId,  // BUG 16 FIX: Pass guildId explicitly
    state.badgesCategory,
    state.badgesRarity,
    state.badgesPage
  );

  await interaction.editReply(content);
}

/**
 * 🌟 Handler: Filtre rareté badges (SelectMenu)
 */
async function handleBadgesRarity(interaction, player, theme, state) {
  const selectedRarity = interaction.values[0];

  state.badgesRarity = selectedRarity;
  state.badgesPage = 0; // Reset à la première page
  saveProfileState(interaction.user.id, state);

  const content = await showBadges(
    interaction,
    player,
    theme,
    interaction.guildId,  // BUG 16 FIX: Pass guildId explicitly
    state.badgesCategory,
    state.badgesRarity,
    state.badgesPage
  );

  await interaction.editReply(content);
}

/**
 * 📄 Handler: Pagination badges
 */
async function handleBadgesPagination(interaction, player, theme, state, action) {
  const guildId = interaction.guildId;

  // Récupérer le nombre total de badges filtrés
  const filters = {};
  if (state.badgesCategory !== 'all') filters.category = state.badgesCategory;
  if (state.badgesRarity !== 'all') filters.rarity = state.badgesRarity;

  const unlockedBadges = await db.getPlayerBadges(guildId, player.id, filters);

  const itemsPerPage = 5;
  const totalPages = Math.ceil(unlockedBadges.length / itemsPerPage) || 1;
  let newPage = state.badgesPage;

  if (action === 'prev') {
    newPage = Math.max(0, state.badgesPage - 1);
  } else if (action === 'next') {
    newPage = Math.min(totalPages - 1, state.badgesPage + 1);
  }

  state.badgesPage = newPage;
  saveProfileState(interaction.user.id, state);

  const content = await showBadges(
    interaction,
    player,
    theme,
    guildId,  // BUG 16 FIX: Pass guildId explicitly (already defined in line 618)
    state.badgesCategory,
    state.badgesRarity,
    state.badgesPage
  );

  await interaction.editReply(content);
}

/**
 * 🏅 Handler: Leaderboard badges
 */
async function handleBadgesLeaderboard(interaction, player, theme, state) {
  const guildId = interaction.guildId;
  const badgeHandler = require('./badgeHandler');

  // Récupérer le leaderboard
  const leaderboard = await badgeHandler.getBadgeLeaderboard(guildId, 10);

  if (!leaderboard || leaderboard.length === 0) {
    return interaction.editReply({
      content: '❌ Aucun joueur n\'a encore débloqué de badges.',
      components: []
    });
  }

  // Créer l'embed du leaderboard
  const leaderboardText = leaderboard.map((entry, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
    return `${medal} <@${entry.discord_id}> - **${entry.total_badges}** badges`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🏆 TOP 10 - COLLECTIONNEURS DE BADGES')
    .setColor('#f39c12')
    .setDescription(
      `### 👑 Les Maîtres de la Collection\n\n${leaderboardText}\n\n` +
      `💡 *Continue à utiliser des Super Bonus pour débloquer plus de badges !*`
    )
    .setTimestamp();

  // Boutons de navigation
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_badges')
      .setLabel('← Retour')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_badges_refresh')
      .setLabel('Actualiser')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
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

// =====================================================
// JOKER HANDLERS - Gestion de la sélection de collectible
// =====================================================

/**
 * 🃏 Handler: Sélection d'un collectible via le joker
 */
async function handleJokerCollectibleSelect(interaction) {
  await interaction.deferUpdate();

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const state = getProfileState(userId);

  // Récupérer l'ID du collectible sélectionné
  const selectedValue = interaction.values[0]; // Format: joker_select_123
  const collectibleId = parseInt(selectedValue.replace('joker_select_', ''));

  console.log(`🃏 [JOKER] ${interaction.user.tag} sélectionne collectible ID ${collectibleId}`);

  // Consommer le joker et donner le collectible
  const result = await superBonusHandler.consumeJokerBonus(guildId, userId, collectibleId);

  if (!result.success) {
    let errorMessage = '❌ Erreur lors de l\'utilisation du joker.';

    switch (result.error) {
      case 'no_bonus':
        errorMessage = '❌ Tu n\'as pas de MysteryBox Joker actif.';
        break;
      case 'invalid_collectible':
        errorMessage = '❌ Ce collectible n\'existe pas.';
        break;
      case 'already_owned':
        errorMessage = '❌ Tu possèdes déjà ce collectible !';
        break;
      case 'player_not_found':
        errorMessage = '❌ Joueur non trouvé.';
        break;
    }

    return interaction.editReply({
      content: errorMessage,
      embeds: [],
      components: []
    });
  }

  // Succès ! Afficher le collectible gagné avec l'UI légendaire
  const { collectible } = result;
  const successEmbed = superBonusHandler.createJokerSuccessEmbed(interaction.user.username, collectible);

  // Créer l'attachment pour le GIF de succès
  const jokerGifPath = path.join(__dirname, '..', 'assets', 'joker.gif');
  const jokerAttachment = new AttachmentBuilder(jokerGifPath, { name: 'joker-wow.gif' });

  // Nettoyer le state
  delete state.pendingJokerBonusId;
  saveProfileState(userId, state);

  // Envoyer l'annonce publique pour l'UTILISATION du Joker (avec le collectible choisi)
  try {
    const announcements = require('../utils/announcements');
    await announcements.announceJokerUsed(
      interaction.client,
      guildId,
      interaction.user.username,
      collectible.name,
      collectible.rarity,
      jokerGifPath
    );
  } catch (announceError) {
    console.error('⚠️ Erreur envoi annonce joker utilisé:', announceError);
  }

  return interaction.editReply({
    embeds: [successEmbed],
    components: [],
    files: [jokerAttachment]
  });
}

/**
 * 🃏 Handler: Pagination du menu joker
 */
async function handleJokerPagination(interaction, page) {
  await interaction.deferUpdate();

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // Récupérer les collectibles manquants (re-fetch pour avoir les données à jour)
  const missingCollectibles = await superBonusHandler.getMissingCollectibles(guildId, userId);

  if (missingCollectibles.length === 0) {
    return interaction.editReply({
      content: '🎉 Tu possèdes déjà tous les collectibles !',
      embeds: [],
      components: []
    });
  }

  // Mettre à jour l'interface avec la nouvelle page
  const embed = superBonusHandler.createJokerSelectionEmbed(missingCollectibles, interaction.user.username);
  const components = superBonusHandler.createJokerSelectMenu(missingCollectibles, page);

  // Ajouter le GIF personnalisé
  const jokerGifPath = path.join(__dirname, '..', 'assets', 'joker.gif');
  const jokerAttachment = new AttachmentBuilder(jokerGifPath, { name: 'joker-wow.gif' });

  return interaction.editReply({
    embeds: [embed],
    components: components,
    files: [jokerAttachment]
  });
}

/**
 * 🃏 Handler: Annulation du joker
 */
async function handleJokerCancel(interaction) {
  await interaction.deferUpdate();

  const userId = interaction.user.id;
  const state = getProfileState(userId);

  // Nettoyer le state
  delete state.pendingJokerBonusId;
  saveProfileState(userId, state);

  return interaction.editReply({
    content: '❌ Utilisation du MysteryBox Joker annulée.\n\n💡 Le bonus n\'a pas été consommé, tu peux l\'utiliser plus tard !',
    embeds: [],
    components: []
  });
}

/**
 * 🃏 Router pour les interactions joker
 */
async function handleJokerInteraction(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('joker_collectible_select')) {
    return handleJokerCollectibleSelect(interaction);
  } else if (customId.startsWith('joker_page_')) {
    const page = parseInt(customId.replace('joker_page_', ''));
    return handleJokerPagination(interaction, page);
  } else if (customId === 'joker_cancel') {
    return handleJokerCancel(interaction);
  }

  console.warn(`⚠️ [JOKER] CustomId non géré: ${customId}`);
}

module.exports = {
  handleProfileInteraction,
  handleJokerInteraction
};
