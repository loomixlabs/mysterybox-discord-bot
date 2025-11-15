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

module.exports = {
  showOverview,
  showInventory,
  showHistory,
  showAchievements
};
