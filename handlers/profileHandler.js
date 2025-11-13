const db = require('../utils/database-pg');
const { showOverview, showInventory, showHistory, showAchievements } = require('../views/profileView');

/**
 * 🎯 PROFILE HANDLER - Router principal pour toutes les interactions du profil
 *
 * CustomIds gérés:
 * - profile_overview          → Vue d'ensemble
 * - profile_inventory         → Inventaire
 * - profile_history           → Historique
 * - profile_achievements      → Succès
 * - profile_refresh           → Actualiser la vue actuelle
 * - profile_share             → Partager le profil
 * - profile_inventory_filter  → SelectMenu filtre rareté
 * - profile_inventory_first   → Première page inventaire
 * - profile_inventory_prev    → Page précédente
 * - profile_inventory_next    → Page suivante
 * - profile_inventory_last    → Dernière page
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
    } else if (customId === 'profile_history') {
      await handleHistory(interaction, player, theme, state);
    } else if (customId === 'profile_achievements') {
      await handleAchievements(interaction, player, theme, progress, state);
    } else if (customId === 'profile_refresh') {
      await handleRefresh(interaction, player, theme, progress, state);
    } else if (customId === 'profile_share') {
      await handleShare(interaction, player, theme, progress);
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
 * 📤 Handler: Partager le profil
 */
async function handleShare(interaction, player, theme, progress) {
  // Créer un message public avec les stats du joueur
  const percentage = Math.round((progress.collected_count / theme.required_items) * 100);
  const status = progress.is_completed ? '✅ COMPLÉTÉ' : `${percentage}%`;

  const shareMessage = [
    `🎮 **Profil de ${player.username}**`,
    `📊 Thème: **${theme.name}**`,
    `🎯 Progression: **${progress.collected_count}/${theme.required_items}** (${status})`,
    ``,
    `Utilise \`/profile\` pour voir ton propre profil !`
  ].join('\n');

  // Envoyer dans le channel (non-éphémère)
  await interaction.followUp({
    content: shareMessage,
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
