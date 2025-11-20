const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const {
  getRarityEmoji,
  getRarityColor,
  getDynamicColor,
  createProgressBar,
  formatRelativeTime,
  calculateBadges,
  getSourceEmoji,
  formatTimeAgo
} = require('../utils/profileHelpers');
const {
  getActivityTimeline,
  getDetailedStats,
  getInventoryGrouped,
  getServerComparison
} = require('../utils/profileQueries');
const { getLoomixFooter, getLoomixFooterWithCustomText, LOOMIX_BRANDING } = require('../utils/footerHelper');

/**
 * 🌟 VIEW 1: OVERVIEW - Vue principale du profil
 */
async function showOverview(interaction, player, theme, progress) {
  const guildId = interaction.guildId;

  // Récupérer le branding
  const branding = await db.getGuildBranding(guildId);

  // Utiliser la couleur préférée du joueur, sinon la couleur dynamique
  const color = player.preferred_color || getDynamicColor(progress.collected_count, theme.required_items);

  // Créer la barre de progression
  const progressBar = createProgressBar(progress.collected_count, theme.required_items);
  const percentage = Math.round((progress.collected_count / theme.required_items) * 100);

  // Récupérer les badges
  const badges = await calculateBadges(player.id, guildId, theme.id);
  const badgeDisplay = badges.length > 0 ? badges.join(' ') : '🔰 Débutant';

  // Récupérer le rang du joueur
  const leaderboard = await db.getLeaderboard(guildId, theme.id, 100);
  const userRank = leaderboard.findIndex(p => p.discord_id === interaction.user.id) + 1;
  const rankDisplay = userRank > 0 ? `#${userRank}` : 'Non classé';

  const embed = new EmbedBuilder()
    .setTitle(`${badgeDisplay} Profil de ${player.username}`)
    .setColor(color)
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(`📊 **Progression**: ${progress.collected_count}/${theme.required_items} collectibles\n${progressBar} **${percentage}%**`)
    .addFields(
      {
        name: '🎯 Thème Actif',
        value: `**${theme.name}**\n${theme.description || 'Collecte tous les items !'}`,
        inline: false
      },
      {
        name: '🏆 Classement',
        value: rankDisplay,
        inline: true
      },
      {
        name: '📅 Rejoint le',
        value: formatRelativeTime(player.created_at),
        inline: true
      },
      {
        name: '✨ Statut',
        value: progress.is_completed ? '✅ **COLLECTION COMPLÈTE**' : '🔄 En cours',
        inline: true
      }
    )

  // Footer avec dernière activité et branding
  if (progress.last_collected_at) {
    embed.setFooter(getLoomixFooterWithCustomText(`Dernière collecte: ${formatRelativeTime(progress.last_collected_at)}`));
  } else {
    embed.setFooter(await getLoomixFooter(guildId));
  }

  embed.setTimestamp();

  // Créer les boutons de navigation
  const navigationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Vue d\'ensemble')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true), // Vue actuelle
      new ButtonBuilder()
        .setCustomId('profile_inventory')
        .setLabel('Inventaire')
        .setEmoji('🎒')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_bonuses')
        .setLabel('Mes Bonus')
        .setEmoji('💫')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_history')
        .setLabel('Historique')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_badges')
        .setLabel('Badges')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Secondary)
    );

  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_refresh')
        .setLabel('Actualiser')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('profile_share')
        .setLabel('Partager')
        .setEmoji('📤')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_color_settings')
        .setLabel('Couleur de l\'embed')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Secondary)
    );

  // Bouton Loomix Discord (Link Button)
  const loomixRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Rejoindre Loomix Discord')
        .setEmoji('🌟')
        .setStyle(ButtonStyle.Link)
        .setURL(LOOMIX_BRANDING.discordInvite)
    );

  return {
    embeds: [embed],
    components: [navigationRow, actionRow, loomixRow]
  };
}

/**
 * 🎒 VIEW 2: INVENTORY - Inventaire des collectibles
 */
async function showInventory(interaction, player, theme, progress, selectedRarity = 'all', page = 0) {
  const guildId = interaction.guildId;
  const itemsPerPage = 3; // Réduit à 3 pour éviter de dépasser la limite Discord de 1024 caractères

  // Récupérer le branding
  const branding = await db.getGuildBranding(guildId);

  // Récupérer l'inventaire groupé par rareté
  const inventory = await getInventoryGrouped(player.id, guildId, theme.id);

  // Filtrer par rareté si sélectionné
  let filteredItems = [];
  if (selectedRarity === 'all') {
    // Tous les items, triés par rareté
    Object.keys(inventory).forEach(rarity => {
      filteredItems = filteredItems.concat(inventory[rarity].map(item => ({ ...item, rarity })));
    });
  } else {
    filteredItems = inventory[selectedRarity] || [];
  }

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = filteredItems.slice(start, end);

  // Créer l'embed - Utiliser la couleur préférée si définie
  const color = player.preferred_color || getDynamicColor(progress.collected_count, theme.required_items);
  const progressPercentage = Math.round((progress.collected_count / theme.required_items) * 100);
  const progressBar = createProgressBar(progress.collected_count, theme.required_items);

  const embed = new EmbedBuilder()
    .setTitle(`🎒 Inventaire - ${player.username}`)
    .setColor(color)
    .setDescription(`**🎨 Thème:** ${theme.name}\n**📊 Progression:** ${progress.collected_count}/${theme.required_items} items (${progressPercentage}%)\n${progressBar}`);

  // Trouver le premier item collecté avec une image pour le thumbnail
  const firstCollectedWithImage = pageItems.find(item => item.collected && item.image_url);
  if (firstCollectedWithImage) {
    embed.setThumbnail(firstCollectedWithImage.image_url);
  } else {
    embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }));
  }

  // Résumé par rareté avec compteurs trouvés/total - Formatage amélioré
  const summaryLines = Object.entries(inventory)
    .map(([rarity, items]) => {
      const collected = items.filter(item => item.collected).length;
      const total = items.length;
      const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;
      return `${getRarityEmoji(rarity)} **${rarity}:** ${collected}/${total} (${percentage}%)`;
    })
    .join('\n');

  embed.addFields({
    name: '📊 Résumé par Rareté',
    value: summaryLines || 'Aucun collectible',
    inline: false
  });

  // Liste des items de la page - Créer un embed par collectible pour afficher les images
  const embeds = [embed]; // Embed principal avec le résumé

  if (pageItems.length > 0) {
    pageItems.forEach((item, index) => {
      const emoji = getRarityEmoji(item.rarity);
      const rarityColor = getRarityColor(item.rarity);
      const statusIcon = item.collected ? '✅' : '❌';

      const itemEmbed = new EmbedBuilder()
        .setColor(rarityColor);

      if (item.collected) {
        const source = getSourceEmoji(item.source);
        const time = formatRelativeTime(item.collected_at);

        itemEmbed
          .setAuthor({ name: `${statusIcon} ${emoji} ${item.name}` })
          .setDescription(`${source} **Obtenu** ${time}`)
          .setThumbnail(item.image_url || null);
      } else {
        itemEmbed
          .setAuthor({ name: `${statusIcon} ${emoji} ${item.name}` })
          .setDescription(`\`Pas encore trouvé\``)
          .setThumbnail(item.image_url || null);
      }

      embeds.push(itemEmbed);
    });
  } else {
    embed.addFields({
      name: '📦 Collection',
      value: 'Aucun item dans cette catégorie',
      inline: false
    });
  }

  embed.setFooter(getLoomixFooterWithCustomText(`Filtré par: ${selectedRarity === 'all' ? 'Tous' : selectedRarity} | Page ${currentPage + 1}/${totalPages}`));

  embed.setTimestamp();

  // Menu de sélection de rareté
  const rarityMenu = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('profile_inventory_filter')
        .setPlaceholder('🔍 Filtrer par rareté')
        .addOptions([
          {
            label: 'Tous les items',
            value: 'all',
            emoji: '📦',
            default: selectedRarity === 'all'
          },
          {
            label: 'Légendaire',
            value: 'Légendaire',
            emoji: '🌟',
            default: selectedRarity === 'Légendaire'
          },
          {
            label: 'Épique',
            value: 'Épique',
            emoji: '💎',
            default: selectedRarity === 'Épique'
          },
          {
            label: 'Rare',
            value: 'Rare',
            emoji: '💠',
            default: selectedRarity === 'Rare'
          },
          {
            label: 'Commun',
            value: 'Commun',
            emoji: '⚪',
            default: selectedRarity === 'Commun'
          }
        ])
    );

  // Boutons de navigation principale
  const navigationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Vue d\'ensemble')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_inventory')
        .setLabel('Inventaire')
        .setEmoji('🎒')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true), // Vue actuelle
      new ButtonBuilder()
        .setCustomId('profile_bonuses')
        .setLabel('Mes Bonus')
        .setEmoji('💫')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_history')
        .setLabel('Historique')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_achievements')
        .setLabel('Succès')
        .setEmoji('🏅')
        .setStyle(ButtonStyle.Secondary)
    );

  // Boutons de pagination
  const paginationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_inventory_first')
        .setLabel('⏮️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('profile_inventory_prev')
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('profile_refresh')
        .setLabel('🔄')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('profile_inventory_next')
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId('profile_inventory_last')
        .setLabel('⏭️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1)
    );

  return {
    embeds: embeds, // Plusieurs embeds: 1 pour le résumé + 1 par collectible (max 3)
    components: [rarityMenu, navigationRow, paginationRow]
  };
}

/**
 * 📜 VIEW 3: HISTORY - Historique des activités
 */
async function showHistory(interaction, player, theme) {
  const guildId = interaction.guildId;

  // Récupérer le branding
  const branding = await db.getGuildBranding(guildId);

  // Récupérer l'historique groupé par jour
  const timeline = await getActivityTimeline(player.id, guildId, theme.id, 20);

  const color = branding.secondary_color;
  const embed = new EmbedBuilder()
    .setTitle(`📜 Historique - ${player.username}`)
    .setColor(color)
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(`**Thème**: ${theme.name}\n\nDernières activités groupées par jour`);

  if (timeline.length === 0) {
    embed.addFields({
      name: '📭 Aucune activité',
      value: 'Tu n\'as pas encore d\'activité sur ce thème.',
      inline: false
    });
  } else {
    // Grouper par jour
    const grouped = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    timeline.forEach(activity => {
      const date = new Date(activity.event_date);
      const dateStr = date.toDateString();

      let label;
      if (dateStr === today) {
        label = "📅 Aujourd'hui";
      } else if (dateStr === yesterday) {
        label = "📅 Hier";
      } else {
        label = `📅 ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
      }

      if (!grouped[label]) {
        grouped[label] = [];
      }

      grouped[label].push(activity);
    });

    // Afficher chaque groupe
    Object.entries(grouped).forEach(([label, activities]) => {
      const activityList = activities.map(a => {
        const time = new Date(a.event_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const emoji = getRarityEmoji(a.rarity);

        if (a.event_type === 'lost') {
          return `${time} ❌ **${a.name}** *(Perdu à cause d'un piège)*`;
        } else {
          const source = getSourceEmoji(a.source);
          return `${time} ${emoji} **${a.name}** ${source}`;
        }
      }).join('\n');

      embed.addFields({
        name: label,
        value: activityList,
        inline: false
      });
    });
  }

  embed.setFooter(await getLoomixFooter(guildId));

  embed.setTimestamp();

  // Boutons de navigation
  const navigationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Vue d\'ensemble')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_inventory')
        .setLabel('Inventaire')
        .setEmoji('🎒')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_bonuses')
        .setLabel('Mes Bonus')
        .setEmoji('💫')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_history')
        .setLabel('Historique')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true), // Vue actuelle
      new ButtonBuilder()
        .setCustomId('profile_achievements')
        .setLabel('Succès')
        .setEmoji('🏅')
        .setStyle(ButtonStyle.Secondary)
    );

  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_refresh')
        .setLabel('Actualiser')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Success)
    );

  return {
    embeds: [embed],
    components: [navigationRow, actionRow]
  };
}

/**
 * 🏅 VIEW 4: ACHIEVEMENTS - Statistiques détaillées et badges
 */
async function showAchievements(interaction, player, theme, progress) {
  const guildId = interaction.guildId;

  // Récupérer le branding
  const branding = await db.getGuildBranding(guildId);

  // Récupérer les stats détaillées
  const stats = await getDetailedStats(player.id, guildId, theme.id);

  // Récupérer les badges
  const badges = await calculateBadges(player.id, guildId, theme.id);
  const badgeDisplay = badges.length > 0 ? badges.join(' ') : '🔰';

  // Récupérer la comparaison serveur
  const serverComparison = await getServerComparison(player.id, guildId);

  const color = branding.secondary_color;
  const embed = new EmbedBuilder()
    .setTitle(`🏅 Succès & Statistiques - ${player.username}`)
    .setColor(color)
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(`**Thème**: ${theme.name}\n\n${badgeDisplay}`);

  // Statistiques de collection
  embed.addFields({
    name: '📊 Statistiques de Collection',
    value: [
      `🎯 Items collectés: **${stats.total_collected}**`,
      `🌟 Légendaires: **${stats.legendary_count}**`,
      `💎 Épiques: **${stats.epic_count}**`,
      `💠 Rares: **${stats.rare_count}**`,
      `⚪ Communs: **${stats.common_count}**`
    ].join('\n'),
    inline: true
  });

  // Statistiques de gameplay
  embed.addFields({
    name: '🎮 Statistiques de Jeu',
    value: [
      `📦 Mystery boxes ouvertes: **${stats.mystery_boxes_opened || 0}**`,
      `✅ Missions complétées: **${stats.missions_completed || 0}**`,
      `❌ Missions échouées: **${stats.missions_failed || 0}**`,
      `⚠️ Pièges activés: **${stats.traps_triggered || 0}**`,
      `🛡️ Pièges bloqués: **${stats.traps_blocked || 0}**`,
      `⚡ Points malus: **${stats.total_malus || 0}**`
    ].join('\n'),
    inline: true
  });

  // Comparaison serveur
  if (serverComparison) {
    const comparisonText = [
      `👥 Rang serveur: **#${serverComparison.rank}/${serverComparison.total_players}**`,
      `📈 Top ${Math.round((serverComparison.rank / serverComparison.total_players) * 100)}% des joueurs`,
      `🏆 Collections complètes: **${serverComparison.completed_themes}**`
    ].join('\n');

    embed.addFields({
      name: '🌐 Comparaison Serveur',
      value: comparisonText,
      inline: false
    });
  }

  // Liste des badges et conditions
  embed.addFields({
    name: '🎖️ Système de Badges',
    value: [
      `🔰 **Débutant**: Aucun item collecté`,
      `🎯 **Collectionneur**: Au moins 1 item`,
      `⭐ **Chasseur**: 50%+ de la collection`,
      `💫 **Expert**: 75%+ de la collection`,
      `🏆 **Maître**: 90%+ de la collection`,
      `👑 **Légende**: Collection 100% complète`,
      `🌟 **Perfectionniste**: Toutes les collections complètes`
    ].join('\n'),
    inline: false
  });

  embed.setFooter(getLoomixFooterWithCustomText('Continue de collecter pour débloquer tous les badges !'));

  embed.setTimestamp();

  // Boutons de navigation
  const navigationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Vue d\'ensemble')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_inventory')
        .setLabel('Inventaire')
        .setEmoji('🎒')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_bonuses')
        .setLabel('Mes Bonus')
        .setEmoji('💫')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_history')
        .setLabel('Historique')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_achievements')
        .setLabel('Succès')
        .setEmoji('🏅')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true) // Vue actuelle
    );

  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_refresh')
        .setLabel('Actualiser')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('profile_share')
        .setLabel('Partager')
        .setEmoji('📤')
        .setStyle(ButtonStyle.Secondary)
    );

  return {
    embeds: [embed],
    components: [navigationRow, actionRow]
  };
}

/**
 * 💫 VIEW 5: BONUSES - Gestion des super bonus
 */
async function showBonuses(interaction, player, theme) {
  const guildId = interaction.guildId;
  const superBonusHandler = require('../handlers/superBonusHandler');

  // Récupérer le branding
  const branding = await db.getGuildBranding(guildId);

  // Récupérer les bonus actifs du joueur
  const activeBonuses = await superBonusHandler.getPlayerActiveBonuses(guildId, interaction.user.id);

  // Séparer les bonus par type
  const automaticBonuses = activeBonuses.filter(b => {
    // Les bonus automatiques sont ceux qui sont déjà activés (activated_at != null)
    return b.activated_at !== null;
  });

  const manualBonuses = activeBonuses.filter(b => {
    // Les bonus manuels sont ceux qui attendent activation (activated_at == null)
    return b.activated_at === null;
  });

  const color = branding.primary_color;
  const embed = new EmbedBuilder()
    .setTitle(`💫 Mes Super Bonus - ${player.username}`)
    .setColor(color)
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(`🎁 Gère tes super bonus obtenus via les Mystery Boxes!`);

  // Section: Bonus actifs (automatiques + manuels activés)
  if (automaticBonuses.length > 0) {
    const activeBonusText = automaticBonuses.map(bonus => {
      const icon = bonus.icon || '✨';
      let statusText = '';

      // Afficher le statut selon le type de durée
      if (bonus.duration_type === 'permanent') {
        statusText = '♾️ Permanent';
      } else if (bonus.duration_type === 'charges' && bonus.remaining_charges !== null) {
        statusText = `🔢 ${bonus.remaining_charges} charge(s) restante(s)`;
      } else if (bonus.duration_type === 'temporary' && bonus.expires_at) {
        const now = new Date();
        const expiresAt = new Date(bonus.expires_at);
        const timeLeft = expiresAt - now;

        if (timeLeft > 0) {
          const hours = Math.floor(timeLeft / (1000 * 60 * 60));
          const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
          statusText = `⏱️ ${hours}h ${minutes}min restantes`;
        } else {
          statusText = '⏱️ Expiré';
        }
      }

      return `${icon} **${bonus.name}**\n${bonus.description}\n${statusText}`;
    }).join('\n\n');

    embed.addFields({
      name: '\u200B', // Espace invisible pour commencer une nouvelle section
      value: `━━━━━━━━━━━━━━━━━━━━━━━━━━\n**✨ BONUS ACTIFS (${automaticBonuses.length})**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${activeBonusText}`,
      inline: false
    });
  } else {
    embed.addFields({
      name: '\u200B',
      value: `━━━━━━━━━━━━━━━━━━━━━━━━━━\n**✨ BONUS ACTIFS (0)**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nAucun bonus actif pour le moment`,
      inline: false
    });
  }

  // Section: Bonus en attente d'activation (manuels non activés)
  if (manualBonuses.length > 0) {
    const manualBonusText = manualBonuses.map(bonus => {
      const icon = bonus.icon || '🎯';
      let durationInfo = '';

      if (bonus.duration_type === 'permanent') {
        durationInfo = '♾️ Permanent';
      } else if (bonus.duration_type === 'charges') {
        // Utiliser remaining_charges (valeur réelle) au lieu de duration_value (valeur par défaut)
        const charges = bonus.remaining_charges !== null ? bonus.remaining_charges : bonus.duration_value;
        durationInfo = `🔢 ${charges} charge(s)`;
      } else if (bonus.duration_type === 'temporary') {
        const hours = Math.floor(bonus.duration_value / 3600);
        const minutes = Math.floor((bonus.duration_value % 3600) / 60);
        durationInfo = `⏱️ Durée: ${hours}h ${minutes}min`;
      }

      return `${icon} **${bonus.name}**\n${bonus.description}\n${durationInfo}`;
    }).join('\n\n');

    embed.addFields({
      name: '\u200B',
      value: `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n**🎯 BONUS À ACTIVER (${manualBonuses.length})**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${manualBonusText}\n\n💡 *Utilise les boutons ci-dessous pour activer tes bonus manuels*`,
      inline: false
    });
  } else {
    embed.addFields({
      name: '\u200B',
      value: `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n**🎯 BONUS À ACTIVER (0)**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nAucun bonus en attente d'activation`,
      inline: false
    });
  }

  embed.setFooter(await getLoomixFooter(guildId));
  embed.setTimestamp();

  // Boutons de navigation
  const navigationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Vue d\'ensemble')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_inventory')
        .setLabel('Inventaire')
        .setEmoji('🎒')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_bonuses')
        .setLabel('Mes Bonus')
        .setEmoji('💫')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true), // Vue actuelle
      new ButtonBuilder()
        .setCustomId('profile_history')
        .setLabel('Historique')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_achievements')
        .setLabel('Succès')
        .setEmoji('🏅')
        .setStyle(ButtonStyle.Secondary)
    );

  // Boutons d'activation pour les bonus manuels (max 5 boutons par row)
  const components = [navigationRow];

  if (manualBonuses.length > 0) {
    // Créer des rows de 5 boutons max
    for (let i = 0; i < manualBonuses.length; i += 5) {
      const bonusChunk = manualBonuses.slice(i, i + 5);
      const activationRow = new ActionRowBuilder();

      bonusChunk.forEach(bonus => {
        activationRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`activate_bonus:${bonus.id}`)
            .setLabel(`Activer ${bonus.name}`)
            .setEmoji(bonus.icon || '⚡')
            .setStyle(ButtonStyle.Success)
        );
      });

      components.push(activationRow);
    }
  }

  // Bouton refresh
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_refresh')
        .setLabel('Actualiser')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Success)
    );

  components.push(actionRow);

  return {
    embeds: [embed],
    components
  };
}

/**
 * 🏆 VIEW 6: BADGES - Vue des badges et achievements
 */
async function showBadges(interaction, player, theme, selectedCategory = 'all', selectedRarity = 'all', page = 0) {
  const guildId = interaction.guildId;
  const badgeHandler = require('../handlers/badgeHandler');

  // Récupérer les stats des badges du joueur
  const stats = await badgeHandler.getPlayerBadgeStats(guildId, player.id);

  // Récupérer les badges débloqués avec filtres
  const filters = {};
  if (selectedCategory !== 'all') filters.category = selectedCategory;
  if (selectedRarity !== 'all') filters.rarity = selectedRarity;

  const unlockedBadges = await db.getPlayerBadges(guildId, player.id, filters);

  // Récupérer la progression
  const progressBadges = await db.getPlayerBadgeProgress(guildId, player.id);

  // Couleur selon rareté sélectionnée
  const rarityColors = badgeHandler.RARITY_COLORS;
  const color = selectedRarity !== 'all' ? rarityColors[selectedRarity] : '#2B2D31';

  // Construction de l'embed
  const embed = new EmbedBuilder()
    .setTitle('🏆 MES BADGES & ACHIEVEMENTS')
    .setColor(color)
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(
      `### 📊 Statistiques Globales\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `**Total**: ${stats.total_badges} badges débloqués (${stats.completionPercentage}%)\n\n` +
      `**Par rareté**:\n` +
      `${badgeHandler.RARITY_EMOJIS.mythic} Mythique: ${stats.mythic_count}\n` +
      `${badgeHandler.RARITY_EMOJIS.legendary} Légendaire: ${stats.legendary_count}\n` +
      `${badgeHandler.RARITY_EMOJIS.epic} Épique: ${stats.epic_count}\n` +
      `${badgeHandler.RARITY_EMOJIS.rare} Rare: ${stats.rare_count}\n` +
      `${badgeHandler.RARITY_EMOJIS.uncommon} Peu commun: ${stats.uncommon_count}\n` +
      `${badgeHandler.RARITY_EMOJIS.common} Commun: ${stats.common_count}\n\n` +
      `**Super Bonus**: ${stats.super_bonus_count} badges\n\n`
    );

  // Section badges récents
  if (unlockedBadges.length > 0) {
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(unlockedBadges.length / ITEMS_PER_PAGE);
    const startIndex = page * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, unlockedBadges.length);
    const pageBadges = unlockedBadges.slice(startIndex, endIndex);

    let badgesList = `### 🎖️ Badges Débloqués (${unlockedBadges.length})\n`;
    badgesList += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    pageBadges.forEach(badge => {
      const rarityEmoji = badgeHandler.RARITY_EMOJIS[badge.rarity];
      const rarityName = badgeHandler.RARITY_NAMES[badge.rarity];
      const unlockedDate = new Date(badge.unlocked_at);
      const timeAgo = formatTimeAgo(unlockedDate);

      badgesList += `${badge.emoji} **${badge.name}** ${rarityEmoji}\n`;
      badgesList += `   *${badge.description}*\n`;
      badgesList += `   📅 Débloqué ${timeAgo}\n\n`;
    });

    if (totalPages > 1) {
      badgesList += `\n📄 Page ${page + 1}/${totalPages}\n`;
    }

    embed.addFields({
      name: '\u200B',
      value: badgesList
    });
  } else {
    embed.addFields({
      name: '🎖️ Badges Débloqués',
      value: '❌ Aucun badge débloqué avec ces filtres.\n*Utilise les super bonus et collecte pour débloquer des badges !*'
    });
  }

  // Section progression
  if (progressBadges.length > 0) {
    let progressList = `### 📈 Progression en Cours\n`;
    progressList += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    progressBadges.slice(0, 3).forEach(progress => {
      const rarityEmoji = badgeHandler.RARITY_EMOJIS[progress.rarity];
      const progressBar = createProgressBar(progress.current_value, progress.target_value, 10);

      progressList += `${progress.emoji} **${progress.name}** ${rarityEmoji}\n`;
      progressList += `${progressBar} ${Math.round(progress.percentage)}%\n`;
      progressList += `${progress.current_value}/${progress.target_value}\n\n`;
    });

    embed.addFields({
      name: '\u200B',
      value: progressList
    });
  }

  // Composants (filtres + navigation)
  const components = [];

  // Row 1: Filtres catégorie
  const categoryOptions = [
    { label: 'Toutes catégories', value: 'all', emoji: '📦', default: selectedCategory === 'all' },
    { label: 'Super Bonus', value: 'super_bonus', emoji: '⭐', default: selectedCategory === 'super_bonus' },
    { label: 'Collection', value: 'collection', emoji: '🎨', default: selectedCategory === 'collection' },
    { label: 'Missions', value: 'mission', emoji: '📋', default: selectedCategory === 'mission' },
    { label: 'Pièges', value: 'trap', emoji: '💥', default: selectedCategory === 'trap' }
  ];

  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId('profile_badges_category')
    .setPlaceholder('Filtrer par catégorie')
    .addOptions(categoryOptions);

  components.push(new ActionRowBuilder().addComponents(categorySelect));

  // Row 2: Filtres rareté
  const rarityOptions = [
    { label: 'Toutes raretés', value: 'all', emoji: '🌟', default: selectedRarity === 'all' },
    { label: 'Mythique', value: 'mythic', emoji: '🔴', default: selectedRarity === 'mythic' },
    { label: 'Légendaire', value: 'legendary', emoji: '🟠', default: selectedRarity === 'legendary' },
    { label: 'Épique', value: 'epic', emoji: '🟣', default: selectedRarity === 'epic' },
    { label: 'Rare', value: 'rare', emoji: '🔵', default: selectedRarity === 'rare' }
  ];

  const raritySelect = new StringSelectMenuBuilder()
    .setCustomId('profile_badges_rarity')
    .setPlaceholder('Filtrer par rareté')
    .addOptions(rarityOptions);

  components.push(new ActionRowBuilder().addComponents(raritySelect));

  // Row 3: Navigation
  const navRow = new ActionRowBuilder();

  if (unlockedBadges.length > 5) {
    const totalPages = Math.ceil(unlockedBadges.length / 5);

    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`profile_badges_prev:${page}`)
        .setLabel('◀️ Précédent')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0)
    );

    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`profile_badges_next:${page}`)
        .setLabel('Suivant ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
  }

  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId('profile_badges_leaderboard')
      .setLabel('Classement')
      .setEmoji('🏆')
      .setStyle(ButtonStyle.Success)
  );

  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId('profile_refresh')
      .setLabel('Actualiser')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
  );

  components.push(navRow);

  return {
    embeds: [embed],
    components
  };
}

module.exports = {
  showOverview,
  showInventory,
  showHistory,
  showAchievements,
  showBonuses,
  showBadges
};
