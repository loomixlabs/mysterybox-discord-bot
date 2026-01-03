const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const db = require('../utils/database-pg');
const superBonusHandler = require('./superBonusHandler');
const dailyClaimHandler = require('./dailyClaimHandler');
const { showOverview, showInventory, showHistory, showAchievements, showBonuses, showBadges, showFavorites, showFrames } = require('../views/profileView');
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
const mysteryBoxHandler = require('./mysteryBoxHandler');

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
      badgesRarity: 'all',
      badgesMode: 'overview' // Nouveau: mode du menu badges (overview, progress, discover)
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

    // Daily claim/calendar/catchup - déléguer au handler qui défère lui-même
    if (customId.startsWith('daily_')) {
      return dailyClaimHandler.handleDailyClaimInteraction(interaction);
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
    } else if (customId.startsWith('deactivate_bonus:')) {
      await handleDeactivateBonus(interaction, player, theme, state);
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
    } else if (customId.startsWith('profile_badges_mode:')) {
      // Nouveau: Changement de mode (overview, progress, discover)
      const mode = customId.split(':')[1];
      await handleBadgesModeChange(interaction, player, theme, state, mode);
    } else if (customId.startsWith('profile_badges_category:')) {
      // Nouveau: Filtre catégorie avec mode
      await handleBadgesCategory(interaction, player, theme, state);
    } else if (customId.startsWith('profile_badges_page:')) {
      // Nouveau: Pagination avec mode et catégorie
      const parts = customId.split(':');
      const mode = parts[1];
      const category = parts[2];
      const page = parseInt(parts[3], 10);
      await handleBadgesPageChange(interaction, player, theme, state, mode, category, page);
    } else if (customId === 'profile_badges_leaderboard') {
      await handleBadgesLeaderboard(interaction, player, theme, state);
    } else if (customId === 'profile_badges_refresh') {
      await handleBadges(interaction, player, theme, state);
    } else if (customId === 'profile_daily_rewards') {
      await handleDailyRewards(interaction, player, theme, progress, state);
    } else if (customId === 'profile_mysterybox') {
      await handleMysteryBoxInventory(interaction, player, theme, state);
    } else if (customId.startsWith('mb_open:')) {
      await handleMysteryBoxOpen(interaction, player, theme, state);
    }
    // ========== FAVORIS & FRAMES ==========
    else if (customId === 'profile_favorites') {
      await handleFavorites(interaction, player, theme, state);
    } else if (customId.startsWith('profile_favorite_pos:')) {
      await handleFavoritePosition(interaction, player, theme, state);
    } else if (customId.startsWith('profile_favorite_select:')) {
      await handleFavoriteSelect(interaction, player, theme, state);
    } else if (customId === 'profile_frames') {
      await handleFrames(interaction, player, theme, state);
    } else if (customId.startsWith('profile_frame_equip:')) {
      await handleFrameEquip(interaction, player, theme, state);
    } else if (customId === 'profile_frame_unequip') {
      await handleFrameUnequip(interaction, player, theme, state);
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

      // Récupérer TOUS les collectibles avec leur état (pour le système de leveling)
      const jokerData = await superBonusHandler.getCollectiblesForJoker(guildId, interaction.user.id);
      const selectableCollectibles = jokerData.collectibles.filter(c => c.canSelect);

      // Vérifier s'il reste des collectibles sélectionnables
      if (selectableCollectibles.length === 0) {
        // Tous les collectibles sont possédés ET au niveau max
        return interaction.editReply({
          content: '🏆 **Collection parfaite !** Tous tes collectibles sont au niveau maximum !\n\nLe MysteryBox Joker n\'a pas été consommé.',
          components: []
        });
      }

      // Afficher l'interface de sélection avec le GIF personnalisé
      const embed = superBonusHandler.createJokerSelectionEmbed(jokerData.collectibles, interaction.user.username, jokerData.stats);
      const components = superBonusHandler.createJokerSelectMenu(jokerData.collectibles, 0);

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

    // === CAS SPÉCIAL: ACCÉLÉRATEUR DE COOLDOWN ===
    if (bonus.effect_type === 'cooldown') {
      // Vérifier s'il reste des charges
      const effectiveCharges = bonus.remaining_charges !== null ? bonus.remaining_charges : bonus.duration_value;
      if (effectiveCharges <= 0) {
        // Message éphémère séparé - ne pas toucher à l'interface
        await interaction.followUp({
          content: `❌ Tu n'as plus de charges pour l'**${bonus.name}** !`,
          flags: 64
        });
        return;
      }

      console.log(`⚡ [COOLDOWN] ${interaction.user.tag} utilise l'Accélérateur de Cooldown (${effectiveCharges} charge(s) restante(s))`);

      // Activer l'Accélérateur de Cooldown
      const result = await superBonusHandler.activateCooldownAccelerator(guildId, interaction.user.id);

      if (!result.success) {
        // Pas de cooldown actif - message éphémère séparé, ne pas toucher à l'interface
        await interaction.followUp({
          content: result.message,
          flags: 64
        });
        return;
      }

      // Succès - cooldown supprimé - rafraîchir la vue des bonus
      state.currentView = 'bonuses';
      saveProfileState(interaction.user.id, state);

      // Rafraîchir l'affichage des bonus
      const content = await showBonuses(interaction, player, theme);
      await interaction.editReply(content);

      // Message de confirmation éphémère
      await interaction.followUp({
        content: `⚡ **Accélérateur de Cooldown activé !**\n\n✅ Cooldown supprimé !\n🔢 Charges restantes: **${result.remainingCharges}**`,
        flags: 64
      });
      return;
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
 * ⏸️ Handler: Désactiver un bonus actif
 * Permet au joueur de désactiver manuellement un bonus à charges pour économiser ses charges
 * Applicable uniquement à: Vision Divine (reveal), Bouclier Anti-Piège (protection), Jackpot x2 (multiplier)
 */
async function handleDeactivateBonus(interaction, player, theme, state) {
  const [, bonusId] = interaction.customId.split(':');
  const guildId = interaction.guildId;

  try {
    // Récupérer le bonus à désactiver
    const activeBonusRecord = await db.query(
      `SELECT pab.*, sb.name, sb.description, sb.icon, sb.duration_type, sb.effect_type
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

    // Vérifier que le bonus est bien activé
    if (bonus.activated_at === null) {
      return interaction.editReply({
        content: `❌ Le bonus **${bonus.name}** n'est pas encore activé !`,
        components: []
      });
    }

    // Vérifier que c'est un bonus désactivable (reveal, protection, multiplier)
    const DEACTIVATABLE_EFFECT_TYPES = ['reveal', 'protection', 'multiplier'];
    if (!DEACTIVATABLE_EFFECT_TYPES.includes(bonus.effect_type)) {
      return interaction.editReply({
        content: `❌ Le bonus **${bonus.name}** ne peut pas être désactivé manuellement.`,
        components: []
      });
    }

    // Vérifier qu'il reste des charges
    if (bonus.remaining_charges <= 0) {
      return interaction.editReply({
        content: `❌ Le bonus **${bonus.name}** n'a plus de charges restantes !`,
        components: []
      });
    }

    // Désactiver le bonus (remettre activated_at à NULL pour permettre réactivation)
    await db.query(
      `UPDATE player_active_bonuses
       SET activated_at = NULL, expires_at = NULL
       WHERE id = $1`,
      [bonusId]
    );

    console.log(`⏸️ [BONUS DEACTIVATION] ${interaction.user.tag} a désactivé le bonus "${bonus.name}" (ID: ${bonusId}) - ${bonus.remaining_charges} charge(s) conservée(s)`);

    // Préparer message de confirmation
    const icon = bonus.icon || '⏸️';

    await interaction.editReply({
      content:
        `⏸️ **Bonus Désactivé !**\n\n` +
        `${icon} **${bonus.name}**\n\n` +
        `🔢 **${bonus.remaining_charges} charge(s)** conservée(s)\n\n` +
        `💡 *Tu peux le réactiver plus tard depuis cette page !*`,
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
    console.error('🔴 Erreur handleDeactivateBonus:', error);
    return interaction.editReply({
      content: `❌ Erreur lors de la désactivation du bonus: ${error.message}`,
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
  } else if (currentView === 'daily_rewards') {
    await handleDailyRewards(interaction, player, theme, progress, state);
  } else if (currentView === 'mysterybox') {
    await handleMysteryBoxInventory(interaction, player, theme, state);
  } else {
    // Défaut: overview
    await handleOverview(interaction, player, theme, progress, state);
  }
}

/**
 * 🎴 Handler: FLEX - Partager une carte de profil moderne et impressionnante
 * Remplace l'ancien système "Partager" avec une image générée visuellement attrayante
 */
async function handleShare(interaction, player, theme, progress) {
  const guildId = interaction.guildId;
  const imageGenerator = require('../utils/imageGenerator');

  // Message de chargement
  await interaction.editReply({
    content: '🎴 **Génération de ta carte FLEX en cours...**\n✨ Préparation des effets visuels...',
    components: [],
    embeds: []
  });

  try {
    // Récupérer toutes les données nécessaires en parallèle
    const [badges, leaderboard, inventory, favorites, equippedFrame, themeConfig] = await Promise.all([
      calculateBadges(player.id, guildId, theme.id),
      db.getLeaderboard(guildId, theme.id, 100),
      getInventoryGrouped(player.id, guildId, theme.id),
      db.getPlayerFavorites(guildId, player.id),
      db.getEquippedFrame(interaction.user.id, guildId),
      db.getThemeConfig(guildId, theme.id)
    ]);

    // Calculer le rang
    const userRank = leaderboard.findIndex(p => p.discord_id === interaction.user.id) + 1;

    // Calculer les stats par rareté
    let legendaryCount = 0;
    Object.entries(inventory).forEach(([rarity, items]) => {
      if (rarity === 'Légendaire') {
        legendaryCount = items.filter(item => item.collected).length;
      }
    });

    // Préparer les favoris avec leurs images - FILTRER ceux sans image ET du thème actif uniquement
    let favoritesWithImages = favorites
      .filter(fav => fav.image_url && fav.theme_id === theme.id) // Exclure les favoris sans image ou d'un autre thème
      .map(fav => ({
        position: fav.position,
        name: fav.name,
        rarity: fav.rarity,
        imageUrl: fav.image_url,
        level: fav.level || 1,
        mintNumber: fav.mint_number,
        themeId: fav.theme_id  // Pour récupérer la frame du thème
      }));

    // Compléter avec les meilleurs collectibles si moins de 3 favoris avec image
    if (favoritesWithImages.length < 3) {
      // Récupérer les meilleurs collectibles (priorité: niveau > rareté légendaire > date)
      // UNIQUEMENT ceux avec une image et qui ne sont pas déjà dans les favoris
      const existingNames = favoritesWithImages.map(f => f.name);
      const bestCollectibles = await db.queryAll(`
        SELECT c.level, c.mint_number, col.name, col.rarity, col.image_url
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3
          AND c.lost_at IS NULL
          AND col.image_url IS NOT NULL
        ORDER BY
          c.level DESC,
          CASE col.rarity
            WHEN 'Légendaire' THEN 1
            WHEN 'Épique' THEN 2
            WHEN 'Rare' THEN 3
            ELSE 4
          END,
          c.collected_at DESC
        LIMIT 10
      `, [guildId, player.id, theme.id]);

      // Compléter les positions manquantes
      const usedPositions = favoritesWithImages.map(f => f.position);
      let nextPosition = 1;

      for (const item of bestCollectibles) {
        if (favoritesWithImages.length >= 3) break;
        if (existingNames.includes(item.name)) continue; // Éviter les doublons

        // Trouver la prochaine position disponible
        while (usedPositions.includes(nextPosition)) nextPosition++;

        favoritesWithImages.push({
          position: nextPosition,
          name: item.name,
          rarity: item.rarity,
          imageUrl: item.image_url,
          level: item.level || 1,
          mintNumber: item.mint_number,
          themeId: theme.id  // Pour récupérer la frame du thème
        });
        usedPositions.push(nextPosition);
        existingNames.push(item.name);
      }

      // Trier par position finale
      favoritesWithImages.sort((a, b) => a.position - b.position);
    }

    // Déterminer la couleur du thème (même logique que profileView.js)
    const themeColor = player.preferred_color || getDynamicColor(progress.collected_count, theme.required_items);

    // Générer la carte FLEX
    const flexCardBuffer = await imageGenerator.generateFlexCard({
      guildId: guildId,  // Pour récupérer les frames des collectibles
      username: player.username,
      avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
      frameUrl: equippedFrame?.frame_url || null,
      favorites: favoritesWithImages,
      stats: {
        rank: userRank || '?',
        totalPlayers: leaderboard.length,
        collected: progress.collected_count,
        total: theme.required_items,
        percentage: Math.round((progress.collected_count / theme.required_items) * 100),
        legendaryCount: legendaryCount
      },
      themeName: theme.name,
      themeColor: themeColor,
      badges: badges,
      isCompleted: progress.is_completed
    });

    // Créer l'attachment
    const attachment = new AttachmentBuilder(flexCardBuffer, { name: 'flex_card.png' });

    // Créer un embed minimaliste pour accompagner l'image
    const embed = new EmbedBuilder()
      .setColor(themeColor)
      .setImage('attachment://flex_card.png')
      .setFooter({ text: `✨ ${player.username} flex son profil ! • Utilise /profile pour créer ta carte` });

    // Envoyer dans le channel (public)
    await interaction.followUp({
      embeds: [embed],
      files: [attachment],
      flags: 0 // Public
    });

    // Confirmer à l'utilisateur
    await interaction.editReply({
      content: '🎴 **FLEX envoyé !** Ta carte a été partagée dans le channel 🔥',
      components: [],
      embeds: []
    });

    // 🏆 BADGE TRACKING - Flex Used
    try {
      const badgeHandler = require('./badgeHandler');
      await badgeHandler.onFlexUsed(guildId, player.id, interaction.client);
      console.log(`🏆 [BADGES] Flex badge tracking appelé pour player ${player.id}`);
    } catch (error) {
      console.error('🔴 [BADGES] Erreur tracking flex:', error);
    }

    // Remettre le profil après 2 secondes
    setTimeout(async () => {
      try {
        const state = getProfileState(interaction.user.id);
        await handleRefresh(interaction, player, theme, progress, state);
      } catch (error) {
        // Ignorer les erreurs (interaction peut être expirée)
      }
    }, 2000);

  } catch (error) {
    console.error('🔴 Erreur génération Flex Card:', error);

    // Fallback: envoyer un message d'erreur
    await interaction.editReply({
      content: `❌ Erreur lors de la génération de ta carte FLEX.\n\`${error.message}\`\n\nRéessaie dans quelques instants !`,
      components: [],
      embeds: []
    });
  }
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
 * 🏆 Handler: Vue Badges (Refonte v2 - 3 modes)
 */
async function handleBadges(interaction, player, theme, state) {
  state.currentView = 'badges';
  state.badgesPage = 0; // Reset à la première page
  state.badgesMode = state.badgesMode || 'overview'; // Conserver le mode ou défaut
  saveProfileState(interaction.user.id, state);

  const content = await showBadges(
    interaction,
    player,
    theme,
    interaction.guildId,
    state.badgesMode,
    state.badgesCategory,
    state.badgesPage
  );

  await interaction.editReply(content);
}

/**
 * 🎯 Handler: Changement de mode badges (overview, progress, discover)
 */
async function handleBadgesModeChange(interaction, player, theme, state, mode) {
  state.badgesMode = mode;
  state.badgesPage = 0; // Reset pagination au changement de mode
  saveProfileState(interaction.user.id, state);

  const content = await showBadges(
    interaction,
    player,
    theme,
    interaction.guildId,
    state.badgesMode,
    state.badgesCategory,
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
    interaction.guildId,
    state.badgesMode,
    state.badgesCategory,
    state.badgesPage
  );

  await interaction.editReply(content);
}

/**
 * 📄 Handler: Changement de page badges
 */
async function handleBadgesPageChange(interaction, player, theme, state, mode, category, page) {
  state.badgesMode = mode;
  state.badgesCategory = category;
  state.badgesPage = page;
  saveProfileState(interaction.user.id, state);

  const content = await showBadges(
    interaction,
    player,
    theme,
    interaction.guildId,
    state.badgesMode,
    state.badgesCategory,
    state.badgesPage
  );

  await interaction.editReply(content);
}

/**
 * 📦 Handler: Ouvrir une Mystery Box par rareté
 * DÉLÉGATION: Utilise mysteryBoxHandler.handleRarityBoxOpen() pour le flow complet
 *
 * Fonctionnalités:
 * - Animation d'ouverture séquencée (2 phases)
 * - Collectibles OU Super Bonus (configurable via mystery_box_config)
 * - Système d'upgrade vers rareté supérieure
 * - Jackpot x2, Aimant à Légendaires, badges, progression roles
 * - Collection complete check
 * - Logging complet dans give_logs
 */
async function handleMysteryBoxOpen(interaction, player, theme, state) {
  const customId = interaction.customId;
  const rarity = customId.split(':')[1]; // common, rare, epic, legendary

  console.log(`📦 [PROFILE] Délégation vers mysteryBoxHandler.handleRarityBoxOpen(${rarity})`);

  // Déléguer au mysteryBoxHandler pour le flow complet
  await mysteryBoxHandler.handleRarityBoxOpen(interaction, player, theme, rarity);
}

/**
 * 🎁 Handler: Daily Rewards
 */
async function handleDailyRewards(interaction, player, theme, progress, state) {
  state.currentView = 'daily_rewards';
  saveProfileState(interaction.user.id, state);

  const content = await dailyClaimHandler.showDailyRewards(interaction, player, theme, progress);
  await interaction.editReply(content);
}

/**
 * 📦 Handler: Mystery Box Inventory (placeholder)
 */
async function handleMysteryBoxInventory(interaction, player, theme, state) {
  state.currentView = 'mysterybox';
  saveProfileState(interaction.user.id, state);

  const guildId = interaction.guildId;

  // Récupérer les clés mystery box (globales, pas liées au thème)
  const mbCredits = await db.getMysteryBoxCredits(guildId, player.id);

  const embed = new EmbedBuilder()
    .setTitle(`📦 Mes MysteryBox`)
    .setColor('#5865F2')
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(`Tes clés permettent d'ouvrir des Mystery Box et obtenir des collectibles :`)
    .addFields(
      {
        name: '🔑 Commune',
        value: `**${mbCredits?.common || 0}** clé(s)`,
        inline: true
      },
      {
        name: '🔑💎 Rare',
        value: `**${mbCredits?.rare || 0}** clé(s)`,
        inline: true
      },
      {
        name: '🔑✨ Épique',
        value: `**${mbCredits?.epic || 0}** clé(s)`,
        inline: true
      },
      {
        name: '🗝️👑 Légendaire',
        value: `**${mbCredits?.legendary || 0}** clé(s)`,
        inline: true
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  // Boutons pour ouvrir les box (disabled si pas de crédits)
  const openRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('mb_open:common')
        .setLabel(`Commune (${mbCredits?.common || 0})`)
        .setEmoji('📦')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!mbCredits?.common || mbCredits.common < 1),
      new ButtonBuilder()
        .setCustomId('mb_open:rare')
        .setLabel(`Rare (${mbCredits?.rare || 0})`)
        .setEmoji('💎')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!mbCredits?.rare || mbCredits.rare < 1),
      new ButtonBuilder()
        .setCustomId('mb_open:epic')
        .setLabel(`Épique (${mbCredits?.epic || 0})`)
        .setEmoji('✨')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!mbCredits?.epic || mbCredits.epic < 1),
      new ButtonBuilder()
        .setCustomId('mb_open:legendary')
        .setLabel(`Légendaire (${mbCredits?.legendary || 0})`)
        .setEmoji('👑')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!mbCredits?.legendary || mbCredits.legendary < 1)
    );

  const navRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Retour')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_refresh')
        .setLabel('Actualiser')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Success)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [openRow, navRow]
  });
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
      case 'max_level_reached':
        errorMessage = '🔒 Ce collectible est déjà au niveau maximum !\n\n' +
          '💡 *Choisis un autre collectible pour utiliser ton Joker.*';
        break;
      case 'player_not_found':
        errorMessage = '❌ Joueur non trouvé.';
        break;
      case 'database_error':
        errorMessage = '❌ Une erreur est survenue. Réessaie plus tard.';
        break;
    }

    return interaction.editReply({
      content: errorMessage,
      embeds: [],
      components: []
    });
  }

  // Succès ! Afficher le collectible gagné avec l'UI légendaire
  const { collectible, player, isNew, wasDuplicate, wasRecovered, isLevelUp } = result;

  // Passer result pour afficher les infos de fusion/récupération/nouveau
  const successEmbed = superBonusHandler.createJokerSuccessEmbed(interaction.user.username, collectible, result);

  // Créer l'attachment pour le GIF de succès
  const jokerGifPath = path.join(__dirname, '..', 'assets', 'joker.gif');
  const jokerAttachment = new AttachmentBuilder(jokerGifPath, { name: 'joker-wow.gif' });

  // 🔄 MISE À JOUR PROGRESSION
  // - Nouveau collectible: incrémenter la progression
  // - Récupération d'un perdu: incrémenter la progression (recompter dans la collection)
  // - Fusion (doublon): NE PAS incrémenter (le collectible est déjà compté)
  try {
    let progress = null;

    if (isNew || wasRecovered) {
      progress = await db.incrementProgress(guildId, player.id, collectible.theme_id);
      console.log(`🃏 [JOKER] Progression mise à jour: ${progress.collected_count} collectibles (${isNew ? 'nouveau' : 'récupéré'})`);
    } else if (wasDuplicate) {
      // Pour les fusions, on récupère juste la progression actuelle sans incrémenter
      progress = await db.queryOne(`
        SELECT collected_count, is_completed FROM player_progress
        WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
      `, [guildId, player.id, collectible.theme_id]);
      console.log(`🃏 [JOKER] Fusion - progression inchangée: ${progress?.collected_count || 0} collectibles`);
    }

    // Récupérer le nombre total de collectibles requis pour ce thème
    const themeStats = await db.queryOne(`
      SELECT COUNT(*) as total_items
      FROM collectibles
      WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, collectible.theme_id]);

    const requiredItems = parseInt(themeStats?.total_items || 0);
    const collectedCount = progress?.collected_count || 0;
    const isCompleted = progress?.is_completed || false;
    console.log(`🃏 [JOKER] Vérification complétion: ${collectedCount}/${requiredItems}`);

    // Vérifier si collection complète (seulement pour nouveau ou récupéré, pas fusion)
    if ((isNew || wasRecovered) && collectedCount >= requiredItems && !isCompleted) {
      console.log(`🎉 [JOKER] Collection COMPLÈTE pour ${interaction.user.tag} !`);

      // Marquer comme complété
      await db.completeCollection(guildId, player.id, collectible.theme_id);

      // Récupérer le thème pour le rôle final
      const theme = await db.queryOne('SELECT * FROM themes WHERE id = $1 AND guild_id = $2', [collectible.theme_id, guildId]);

      if (theme) {
        // Attribuer le rôle final
        let finalRoleId = theme.final_role_discord_id;

        // Lazy creation du rôle si nécessaire
        if (!finalRoleId && theme.final_role_name) {
          try {
            console.log(`🎨 [JOKER] Création du rôle de complétion "${theme.final_role_name}"`);
            let roleColor = '#FFD700';
            if (theme.final_role_color) {
              roleColor = theme.final_role_color.startsWith('#')
                ? parseInt(theme.final_role_color.replace('#', ''), 16)
                : theme.final_role_color;
            }

            const newRole = await interaction.guild.roles.create({
              name: theme.final_role_name,
              color: roleColor,
              hoist: true,
              mentionable: true,
              reason: `Lazy creation - Rôle de complétion pour le thème "${theme.name}"`
            });

            finalRoleId = newRole.id;
            await db.query('UPDATE themes SET final_role_discord_id = $1 WHERE id = $2 AND guild_id = $3',
              [finalRoleId, theme.id, guildId]);
            console.log(`✅ [JOKER] Rôle créé: ${newRole.name} (${newRole.id})`);
          } catch (roleError) {
            console.error('❌ [JOKER] Erreur création rôle:', roleError);
          }
        }

        // Attribuer le rôle
        if (finalRoleId) {
          try {
            const finalRole = await interaction.guild.roles.fetch(finalRoleId);
            if (finalRole) {
              const member = await interaction.guild.members.fetch(interaction.user.id);
              await member.roles.add(finalRole);
              console.log(`✅ [JOKER] Rôle "${finalRole.name}" attribué à ${interaction.user.tag}`);
            }
          } catch (roleError) {
            console.error('❌ [JOKER] Erreur attribution rôle:', roleError);
          }
        }

        // Envoyer notification de collection complète en DM
        try {
          const themeMessages = await db.getThemeMessages(guildId, collectible.theme_id);
          let completeMessage = themeMessages?.collection_complete_message ||
            '🏆 Félicitations ! Tu as complété ta collection et obtenu le rôle {role} !';
          completeMessage = completeMessage.replace(/\{role\}/g, theme.final_role_name || 'Collectionneur');

          const completeEmbed = new EmbedBuilder()
            .setTitle('👑 COLLECTION COMPLÈTE !')
            .setDescription(completeMessage)
            .setColor(theme.final_role_color || '#FFD700')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter(await getLoomixFooter(guildId))
            .setTimestamp();

          await interaction.user.send({
            embeds: [completeEmbed],
            content: `🎉 Bravo ! Tu as reçu le rôle **${theme.final_role_name}** !`
          });
        } catch (dmError) {
          console.log('⚠️ [JOKER] Impossible d\'envoyer DM de complétion (MPs fermés)');
        }
      }
    }
  } catch (progressError) {
    console.error('❌ [JOKER] Erreur mise à jour progression:', progressError);
  }

  // Nettoyer le state
  delete state.pendingJokerBonusId;
  saveProfileState(userId, state);

  // Envoyer les annonces publiques selon le type d'action
  try {
    const announcements = require('../utils/announcements');

    // ========== GÉNÉRATION D'IMAGE AVEC FRAME ET MINT (même logique que mysteryBoxHandler) ==========
    let generatedImageBuffer = null;

    // Mapping niveau → type de frame
    const levelToFrameRarity = {
      1: null,      // Pas de frame
      2: 'rare',
      3: 'epic',
      4: 'legendary'
    };

    try {
      const currentLevel = result.newLevel || 1;
      const oldLevel = result.oldLevel || 1;
      const frameRarityForLevel = levelToFrameRarity[currentLevel];

      if (isLevelUp && oldLevel !== currentLevel) {
        // Level up: générer image de transition avant/après
        const oldFrameRarity = levelToFrameRarity[oldLevel];
        const newFrameRarity = levelToFrameRarity[currentLevel];

        const [oldFrameUrl, newFrameUrl] = await Promise.all([
          oldFrameRarity ? db.getCollectibleFrameUrl(guildId, collectible.theme_id, oldFrameRarity) : null,
          newFrameRarity ? db.getCollectibleFrameUrl(guildId, collectible.theme_id, newFrameRarity) : null
        ]);

        generatedImageBuffer = await imageGenerator.generateLevelUpImage(
          collectible.image_url,
          {
            oldFrameUrl,
            newFrameUrl,
            oldRarity: oldFrameRarity,
            newRarity: newFrameRarity,
            oldLevel,
            newLevel: currentLevel,
            mintNumber: result.mintNumber
          }
        );
      } else {
        // Nouveau collectible, fusion simple ou restauré : générer image avec frame/mint
        const frameUrl = frameRarityForLevel
          ? await db.getCollectibleFrameUrl(guildId, collectible.theme_id, frameRarityForLevel)
          : null;

        generatedImageBuffer = await imageGenerator.generateCollectibleWithFrame(
          collectible.image_url,
          frameUrl,
          frameRarityForLevel,
          {
            level: currentLevel,
            mintNumber: result.mintNumber,
            useCache: true
          }
        );
      }
    } catch (imgError) {
      console.error('⚠️ [JOKER IMAGE] Erreur génération image:', imgError.message);
      // Continuer sans image générée
    }

    // Annonce de base: Joker utilisé
    await announcements.announceJokerUsed(
      interaction.client,
      guildId,
      interaction.user.username,
      collectible.name,
      collectible.rarity,
      jokerGifPath
    );

    // Annonces spécifiques selon le résultat (avec image générée)
    if (wasRecovered) {
      // Collectible récupéré (était perdu à cause d'un piège)
      await announcements.announceCollectibleRestored(
        interaction.client,
        guildId,
        interaction.user.username,
        collectible.name,
        result.newLevel || 1,
        result.currentXp || 0,
        result.mintNumber,
        generatedImageBuffer  // Image générée avec frame/étoiles/mint
      );
    } else if (wasDuplicate && isLevelUp) {
      // Fusion avec level up !
      const MAX_LEVEL = 4;
      if (result.newLevel >= MAX_LEVEL) {
        // Niveau MAX atteint
        await announcements.announceCollectibleMaxLevel(
          interaction.client,
          guildId,
          interaction.user.username,
          collectible.name,
          result.newLevel,
          result.mintNumber,
          generatedImageBuffer  // Image générée avec frame/étoiles/mint
        );
      } else {
        // Level up normal
        await announcements.announceCollectibleLevelUp(
          interaction.client,
          guildId,
          interaction.user.username,
          collectible.name,
          result.oldLevel || 1,
          result.newLevel || 2,
          result.currentXp || 0,
          result.xpToNextLevel || 0,
          generatedImageBuffer  // Image générée avec frame/étoiles/mint
        );
      }
    }
  } catch (announceError) {
    console.error('⚠️ Erreur envoi annonces joker:', announceError);
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

  // Récupérer TOUS les collectibles avec leur état (pour le système de leveling)
  const jokerData = await superBonusHandler.getCollectiblesForJoker(guildId, userId);
  const selectableCollectibles = jokerData.collectibles.filter(c => c.canSelect);

  if (selectableCollectibles.length === 0) {
    return interaction.editReply({
      content: '🏆 **Collection parfaite !** Tous tes collectibles sont au niveau maximum !',
      embeds: [],
      components: []
    });
  }

  // Mettre à jour l'interface avec la nouvelle page
  const embed = superBonusHandler.createJokerSelectionEmbed(jokerData.collectibles, interaction.user.username, jokerData.stats);
  const components = superBonusHandler.createJokerSelectMenu(jokerData.collectibles, page);

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

// ========== HANDLERS FAVORIS & FRAMES ==========

/**
 * ⭐ Handler: Vue Favoris
 */
async function handleFavorites(interaction, player, theme, state) {
  state.currentView = 'favorites';
  state.selectedFavoritePosition = null;
  saveProfileState(interaction.user.id, state);

  const content = await showFavorites(interaction, player, theme, null);
  await interaction.editReply(content);
}

/**
 * ⭐ Handler: Sélection position favori
 */
async function handleFavoritePosition(interaction, player, theme, state) {
  const position = parseInt(interaction.customId.split(':')[1]);

  state.selectedFavoritePosition = position;
  saveProfileState(interaction.user.id, state);

  const content = await showFavorites(interaction, player, theme, position);
  await interaction.editReply(content);
}

/**
 * ⭐ Handler: Sélection collectible favori (SelectMenu)
 */
async function handleFavoriteSelect(interaction, player, theme, state) {
  const position = parseInt(interaction.customId.split(':')[1]);
  const collectibleId = parseInt(interaction.values[0]);

  // Définir le favori
  await db.setPlayerFavorite(interaction.guildId, player.id, collectibleId, position);

  // Reset la position sélectionnée
  state.selectedFavoritePosition = null;
  saveProfileState(interaction.user.id, state);

  // Recharger la vue favoris
  const content = await showFavorites(interaction, player, theme, null);
  await interaction.editReply(content);

  // 🏆 BADGE TRACKING - Favorites Set
  try {
    const badgeHandler = require('./badgeHandler');
    const favorites = await db.getPlayerFavorites(interaction.guildId, player.id);
    const favoritesCount = favorites.filter(f => f.collectible_id !== null).length;
    await badgeHandler.onFavoritesSet(interaction.guildId, player.id, favoritesCount, interaction.client);
    console.log(`🏆 [BADGES] Favorites badge tracking appelé pour player ${player.id} (count: ${favoritesCount})`);
  } catch (error) {
    console.error('🔴 [BADGES] Erreur tracking favorites:', error);
  }
}

/**
 * 🖼️ Handler: Vue Frames
 */
async function handleFrames(interaction, player, theme, state) {
  state.currentView = 'frames';
  saveProfileState(interaction.user.id, state);

  const content = await showFrames(interaction, player, theme);
  await interaction.editReply(content);
}

/**
 * 🖼️ Handler: Équiper une frame
 */
async function handleFrameEquip(interaction, player, theme, state) {
  const frameId = parseInt(interaction.customId.split(':')[1]);

  // Équiper la frame
  await db.equipFrame(interaction.user.id, frameId, interaction.guildId);

  // Recharger la vue frames
  const content = await showFrames(interaction, player, theme);
  await interaction.editReply(content);
}

/**
 * 🖼️ Handler: Retirer la frame équipée
 */
async function handleFrameUnequip(interaction, player, theme, state) {
  // Retirer la frame
  await db.unequipFrame(interaction.user.id, interaction.guildId);

  // Recharger la vue frames
  const content = await showFrames(interaction, player, theme);
  await interaction.editReply(content);
}

module.exports = {
  handleProfileInteraction,
  handleJokerInteraction
};
