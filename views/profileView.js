const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const imageGenerator = require('../utils/imageGenerator');
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

// Seuils XP pour les niveaux
const XP_THRESHOLDS = { 2: 100, 3: 300, 4: 700 };
const MAX_LEVEL = 4;

// Mapping niveau → type de frame
const LEVEL_TO_FRAME_RARITY = {
  1: null,      // Pas de frame
  2: 'rare',
  3: 'epic',
  4: 'legendary'
};

/**
 * 🌟 Générer les étoiles de niveau
 * @param {number} level - Niveau actuel (1-4)
 * @returns {string} Étoiles
 */
function getLevelStars(level) {
  const stars = ['⭐', '⭐', '⭐', '⭐'];
  const filledStars = Math.min(Math.max(level, 1), 4);
  return stars.slice(0, filledStars).join('') + '☆'.repeat(4 - filledStars);
}

/**
 * 📊 Créer une barre de progression XP
 * @param {number} currentXp - XP actuel
 * @param {number} level - Niveau actuel
 * @returns {string} Barre de progression XP
 */
function createXpProgressBar(currentXp, level) {
  if (level >= MAX_LEVEL) {
    return '`[████████████████████]` **MAX**';
  }

  const prevThreshold = level === 1 ? 0 : XP_THRESHOLDS[level] || 0;
  const nextThreshold = XP_THRESHOLDS[level + 1] || XP_THRESHOLDS[MAX_LEVEL];
  const xpInLevel = currentXp - prevThreshold;
  const xpNeeded = nextThreshold - prevThreshold;
  const progress = Math.min(xpInLevel / xpNeeded, 1);

  const barLength = 20;
  const filled = Math.round(progress * barLength);
  const empty = barLength - filled;

  return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\` **${currentXp}/${nextThreshold}** XP`;
}

/**
 * 🌟 VIEW 1: OVERVIEW - Vue principale du profil
 */
async function showOverview(interaction, player, theme, progress) {
  const guildId = interaction.guildId;
  const discordId = interaction.user.id;

  // Récupérer le branding
  const branding = await db.getGuildBranding(guildId);

  // Récupérer la frame équipée du joueur
  const equippedFrame = await db.getEquippedFrame(discordId, guildId);

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
  const userRank = leaderboard.findIndex(p => p.discord_id === discordId) + 1;
  const rankDisplay = userRank > 0 ? `#${userRank}` : 'Non classé';

  // Vérifier si le joueur a un cooldown actif
  const activeCooldowns = await db.getActiveCooldowns(guildId, player.id);
  let statusValue = progress.is_completed ? '✅ **COLLECTION COMPLÈTE**' : '🔄 En cours';

  if (activeCooldowns.length > 0) {
    const cooldown = activeCooldowns[0];
    // Utiliser minutes_left calculé côté PostgreSQL pour éviter les problèmes de timezone
    const minutesLeft = Math.max(1, Math.ceil(cooldown.minutes_left));
    statusValue = `⏰ **COOLDOWN ACTIF**\n${minutesLeft} min restantes`;
  }

  // Construire la description avec frame si équipée
  let description = `📊 **Progression**: ${progress.collected_count}/${theme.required_items} collectibles\n${progressBar} **${percentage}%**`;
  if (equippedFrame) {
    description += `\n\n🖼️ **Frame:** ${equippedFrame.name}`;
    if (equippedFrame.bonus_type && equippedFrame.bonus_value) {
      description += ` (+${equippedFrame.bonus_value}% ${equippedFrame.bonus_type})`;
    }
  }

  // Générer l'image de profil avec frame superposée si équipée
  const files = [];
  let thumbnailUrl = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });

  if (equippedFrame?.frame_url) {
    try {
      const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const profileBuffer = await imageGenerator.generateProfileWithFrame(avatarUrl, equippedFrame.frame_url);
      const attachment = new AttachmentBuilder(profileBuffer, { name: 'profile_framed.png' });
      files.push(attachment);
      thumbnailUrl = 'attachment://profile_framed.png';
    } catch (error) {
      console.warn('⚠️ Erreur génération image profil avec frame:', error.message);
      // Fallback: utiliser l'avatar normal
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`${badgeDisplay} Profil de ${player.username}`)
    .setColor(color)
    .setThumbnail(thumbnailUrl)
    .setDescription(description)
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
        value: statusValue,
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
        .setLabel('FLEX')
        .setEmoji('🎴')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('profile_favorites')
        .setLabel('Favoris')
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_frames')
        .setLabel('Frames')
        .setEmoji('🖼️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('profile_color_settings')
        .setLabel('Couleur')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Secondary)
    );

  // Row pour les récompenses (Daily + Clés + Crafting)
  const rewardsRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_daily_rewards')
        .setLabel('Récompense quotidienne')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('profile_mysterybox')
        .setLabel('Mes MysteryBox')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('craft_panel')
        .setLabel('Craft')
        .setEmoji('🔨')
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
    components: [navigationRow, actionRow, rewardsRow, loomixRow],
    files: files
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

  // Liste des items de la page - Créer un embed par collectible avec images générées
  const embeds = [embed]; // Embed principal avec le résumé
  const files = []; // Attachments pour les images générées

  if (pageItems.length > 0) {
    // Générer les images en parallèle pour les items collectés
    const imagePromises = pageItems.map(async (item, index) => {
      if (item.collected && item.image_url) {
        try {
          const level = item.level || 1;
          const frameRarity = LEVEL_TO_FRAME_RARITY[level] || null;

          // Récupérer l'URL de la frame si niveau >= 2
          let frameUrl = null;
          if (frameRarity && item.theme_id) {
            frameUrl = await db.getCollectibleFrameUrl(guildId, item.theme_id, frameRarity);
          }

          // Générer l'image avec frame, niveau et mint
          const imageBuffer = await imageGenerator.generateCollectibleWithFrame(
            item.image_url,
            frameUrl,
            frameRarity,
            {
              level: level,
              mintNumber: item.mint_number,
              useCache: true
            }
          );

          return { index, buffer: imageBuffer, success: true };
        } catch (error) {
          console.warn(`⚠️ Erreur génération image inventaire pour ${item.name}:`, error.message);
          return { index, success: false };
        }
      }
      return { index, success: false };
    });

    const generatedImages = await Promise.all(imagePromises);

    pageItems.forEach((item, index) => {
      const emoji = getRarityEmoji(item.rarity);
      const rarityColor = getRarityColor(item.rarity);
      const statusIcon = item.collected ? '✅' : '❌';

      const itemEmbed = new EmbedBuilder()
        .setColor(rarityColor);

      if (item.collected) {
        const source = getSourceEmoji(item.source);
        const time = formatRelativeTime(item.collected_at);
        const level = item.level || 1;
        const xp = item.xp || 0;
        const mintNumber = item.mint_number;

        // Infos de niveau et XP
        const levelStars = getLevelStars(level);
        const xpBar = createXpProgressBar(xp, level);

        // Construire la description avec toutes les infos
        let description = `${source} **Obtenu** ${time}\n`;
        description += `\n${levelStars} **Niveau ${level}**\n`;
        description += `${xpBar}\n`;
        if (mintNumber && mintNumber <= 100) {
          description += `🏷️ **Mint #${mintNumber}**`;
        }

        itemEmbed
          .setAuthor({ name: `${statusIcon} ${emoji} ${item.name}` })
          .setDescription(description);

        // Utiliser l'image générée si disponible
        const generatedImage = generatedImages.find(img => img.index === index && img.success);
        if (generatedImage) {
          const fileName = `collectible_${item.id}_${index}.png`;
          const attachment = new AttachmentBuilder(generatedImage.buffer, { name: fileName });
          files.push(attachment);
          itemEmbed.setThumbnail(`attachment://${fileName}`);
        } else {
          // Fallback: image originale
          itemEmbed.setThumbnail(item.image_url || null);
        }
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
    components: [rarityMenu, navigationRow, paginationRow],
    files: files // Images générées avec frames
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
        .setLabel('FLEX')
        .setEmoji('🎴')
        .setStyle(ButtonStyle.Danger)
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
  // IMPORTANT: L'Accélérateur de Cooldown (effect_type === 'cooldown') est TOUJOURS manuel
  // même si activated_at est défini par erreur - son effet est instantané et consomme une charge
  const automaticBonuses = activeBonuses.filter(b => {
    // Les bonus automatiques sont ceux qui sont déjà activés (activated_at != null)
    // SAUF l'Accélérateur de Cooldown qui doit toujours apparaître dans les manuels
    return b.activated_at !== null && b.effect_type !== 'cooldown';
  });

  const manualBonuses = activeBonuses.filter(b => {
    // Les bonus manuels sont ceux qui attendent activation (activated_at == null)
    // OU l'Accélérateur de Cooldown (même si activated_at est défini par erreur)
    return b.activated_at === null || b.effect_type === 'cooldown';
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

  // === NOUVEAU: Boutons de désactivation pour les bonus actifs à charges ===
  // Filtrer les bonus qui peuvent être désactivés:
  // - Doivent être activés (activated_at != null)
  // - Doivent être de type 'charges'
  // - Doivent avoir des charges restantes
  // - UNIQUEMENT: Vision Divine (reveal), Bouclier Anti-Piège (protection), Jackpot x2 (multiplier)
  // - EXCLURE: Accélérateur de Cooldown (cooldown), MysteryBox Joker (joker - usage manuel unique)
  const DEACTIVATABLE_EFFECT_TYPES = ['reveal', 'protection', 'multiplier'];
  const deactivatableBonuses = automaticBonuses.filter(b =>
    b.duration_type === 'charges' &&
    b.remaining_charges > 0 &&
    DEACTIVATABLE_EFFECT_TYPES.includes(b.effect_type)
  );

  if (deactivatableBonuses.length > 0) {
    // Créer des rows de 5 boutons max pour la désactivation
    for (let i = 0; i < deactivatableBonuses.length; i += 5) {
      const bonusChunk = deactivatableBonuses.slice(i, i + 5);
      const deactivationRow = new ActionRowBuilder();

      bonusChunk.forEach(bonus => {
        deactivationRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`deactivate_bonus:${bonus.id}`)
            .setLabel(`Désactiver ${bonus.name}`)
            .setEmoji('⏸️')
            .setStyle(ButtonStyle.Danger)
        );
      });

      components.push(deactivationRow);
    }
  }

  // Boutons d'activation pour les bonus manuels
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
 * 🏆 VIEW 6: BADGES - Vue des badges et achievements (REFONTE v2)
 *
 * Modes disponibles:
 * - 'overview': Vue d'ensemble avec stats + badges récents
 * - 'unlocked': Badges obtenus avec date d'obtention
 * - 'progress': Tous les badges avec progression détaillée
 * - 'discover': Badges pas encore commencés avec guides
 */
async function showBadges(interaction, player, theme, guildId, mode = 'overview', selectedCategory = 'all', page = 0) {
  // BUG 16 FIX: guildId passé en paramètre au lieu de interaction.guildId pour supporter DM context
  const badgeHandler = require('../handlers/badgeHandler');

  // Récupérer les stats des badges du joueur
  const stats = await badgeHandler.getPlayerBadgeStats(guildId, player.id);

  // Récupérer tous les badges existants avec calculs dynamiques pour plusieurs catégories
  // On récupère les données du joueur pour les badges calculés dynamiquement
  // Les données Loomix sont dans la table player_currency (currency_type = 'loomix')
  const playerData = await db.queryOne(`
    SELECT
      EXTRACT(DAY FROM NOW() - p.created_at)::int as days_since_creation,
      p.current_claim_streak,
      p.best_claim_streak,
      COALESCE(pc.balance, 0) as loomix_balance,
      COALESCE(pc.total_earned, 0) as total_loomix_earned,
      COALESCE(pc.total_spent, 0) as total_loomix_spent
    FROM players p
    LEFT JOIN player_currency pc ON pc.guild_id = p.guild_id AND pc.player_id = p.id AND pc.currency_type = 'loomix'
    WHERE p.guild_id = $1 AND p.id = $2
  `, [guildId, player.id]);

  // Données de collection par rareté
  const collectionData = await db.queryOne(`
    SELECT
      COUNT(DISTINCT c.collectible_id) as total_collected,
      COUNT(DISTINCT CASE WHEN col.rarity = 'legendary' THEN c.collectible_id END) as legendary_count,
      COUNT(DISTINCT CASE WHEN col.rarity = 'epic' THEN c.collectible_id END) as epic_count,
      COUNT(DISTINCT CASE WHEN col.rarity = 'rare' THEN c.collectible_id END) as rare_count
    FROM collections c
    JOIN collectibles col ON c.collectible_id = col.id
    WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
  `, [guildId, player.id]);

  // Données de missions
  const missionData = await db.queryOne(`
    SELECT COUNT(*) as completed_missions
    FROM mission_progress
    WHERE guild_id = $1 AND player_id = $2 AND status = 'completed'
  `, [guildId, player.id]);

  // Données de mystery boxes
  const mysteryBoxData = await db.queryOne(`
    SELECT COUNT(*) as boxes_opened
    FROM give_logs
    WHERE guild_id = $1 AND winner_id = $2
  `, [guildId, player.discord_id]);

  // Données de pièges
  // Note: La colonne 'blocked' n'existe pas dans trap_triggered
  // On utilise traps_blocked de la table players + count de trap_triggered
  const trapData = await db.queryOne(`
    SELECT
      (SELECT COUNT(*) FROM trap_triggered WHERE guild_id = $1 AND player_id = $2) as traps_triggered,
      (SELECT COALESCE(traps_blocked, 0) FROM players WHERE guild_id = $1 AND id = $2) as traps_blocked
  `, [guildId, player.id]);

  // Données super bonus
  const superBonusData = await db.queryOne(`
    SELECT COUNT(*) as bonuses_used
    FROM bonus_usage_history
    WHERE guild_id = $1 AND user_id = $2
  `, [guildId, player.discord_id]);

  const allBadges = await db.queryAll(`
    SELECT b.*,
           pb.unlocked_at,
           bp.current_value,
           bp.target_value,
           CASE WHEN pb.id IS NOT NULL THEN true ELSE false END as is_unlocked
    FROM badges b
    LEFT JOIN player_badges pb ON pb.badge_id = b.id AND pb.guild_id = $1 AND pb.player_id = $2
    LEFT JOIN badge_progress bp ON bp.badge_id = b.id AND bp.guild_id = $1 AND bp.player_id = $2
    ORDER BY b.rarity DESC, b.category, b.name
  `, [guildId, player.id]);

  // Enrichir les badges avec les valeurs calculées dynamiquement selon leur catégorie/condition_type
  allBadges.forEach(badge => {
    const condType = badge.condition_type;
    const target = parseInt(badge.condition_value) || 1;

    // SENIORITY - jours depuis création
    if (badge.category === 'seniority' && playerData) {
      badge.current_value = playerData.days_since_creation || 0;
      badge.target_value = target;
    }
    // ENGAGEMENT - meilleur streak de claims
    else if (badge.category === 'engagement' && playerData) {
      badge.current_value = Math.max(playerData.current_claim_streak || 0, playerData.best_claim_streak || 0);
      badge.target_value = target;
    }
    // ECONOMY - loomix balance/earned/spent
    else if (badge.category === 'economy' && playerData) {
      if (condType === 'loomix_balance') {
        badge.current_value = parseInt(playerData.loomix_balance) || 0;
      } else if (condType === 'loomix_earned') {
        badge.current_value = parseInt(playerData.total_loomix_earned) || 0;
      } else if (condType === 'loomix_spent') {
        badge.current_value = parseInt(playerData.total_loomix_spent) || 0;
      }
      badge.target_value = target;
    }
    // COLLECTION - nombre de collectibles / par rareté
    else if (badge.category === 'collection' && collectionData) {
      if (condType === 'collectible_count') {
        badge.current_value = parseInt(collectionData.total_collected) || 0;
      }
      badge.target_value = target;
    }
    // RARITY - comptage par rareté spécifique
    else if (badge.category === 'rarity' && collectionData) {
      if (condType === 'legendary_count') {
        badge.current_value = parseInt(collectionData.legendary_count) || 0;
      } else if (condType === 'epic_count') {
        badge.current_value = parseInt(collectionData.epic_count) || 0;
      } else if (condType === 'rare_count') {
        badge.current_value = parseInt(collectionData.rare_count) || 0;
      }
      badge.target_value = target;
    }
    // MISSION - missions complétées
    else if (badge.category === 'mission' && missionData) {
      if (condType === 'mission_complete') {
        badge.current_value = parseInt(missionData.completed_missions) || 0;
      }
      badge.target_value = target;
    }
    // MYSTERY_BOX - mystery boxes ouvertes
    else if (badge.category === 'mystery_box' && mysteryBoxData) {
      if (condType === 'mystery_box_open') {
        badge.current_value = parseInt(mysteryBoxData.boxes_opened) || 0;
      }
      badge.target_value = target;
    }
    // TRAP - pièges déclenchés/bloqués
    else if (badge.category === 'trap' && trapData) {
      if (condType === 'trap_triggered') {
        badge.current_value = parseInt(trapData.traps_triggered) || 0;
      } else if (condType === 'trap_survive') {
        badge.current_value = parseInt(trapData.traps_blocked) || 0;
      }
      badge.target_value = target;
    }
    // SUPER_BONUS - bonus utilisés
    else if (badge.category === 'super_bonus' && superBonusData) {
      if (condType === 'super_bonus_usage' || condType === 'trap_block') {
        badge.current_value = parseInt(superBonusData.bonuses_used) || 0;
      }
      badge.target_value = target;
    }
  });

  // Filtrer par catégorie si demandé
  const filteredBadges = selectedCategory === 'all'
    ? allBadges
    : allBadges.filter(b => b.category === selectedCategory);

  // Séparer les badges par état
  const unlockedBadges = filteredBadges.filter(b => b.is_unlocked);
  const inProgressBadges = filteredBadges.filter(b => !b.is_unlocked && b.current_value > 0);
  const notStartedBadges = filteredBadges.filter(b => !b.is_unlocked && (!b.current_value || b.current_value === 0));

  // Couleur selon mode
  const modeColors = {
    overview: '#2B2D31',
    unlocked: '#2ecc71',  // Vert pour les badges obtenus
    progress: '#3498db',
    discover: '#9b59b6'
  };

  // Générer l'image de profil avec frame (comme showOverview)
  const files = [];
  let thumbnailUrl = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });
  const discordId = interaction.user.id;

  // Récupérer la frame équipée du joueur
  const equippedFrame = await db.getEquippedFrame(discordId, guildId);

  if (equippedFrame?.frame_url) {
    try {
      const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const profileBuffer = await imageGenerator.generateProfileWithFrame(avatarUrl, equippedFrame.frame_url);
      const attachment = new AttachmentBuilder(profileBuffer, { name: 'profile_framed.png' });
      files.push(attachment);
      thumbnailUrl = 'attachment://profile_framed.png';
    } catch (error) {
      console.warn('⚠️ Erreur génération image profil avec frame (badges):', error.message);
      // Fallback: utiliser l'avatar normal
    }
  }

  const embed = new EmbedBuilder()
    .setColor(modeColors[mode])
    .setThumbnail(thumbnailUrl);

  // ========== MODE: OVERVIEW ==========
  if (mode === 'overview') {
    embed.setTitle('🏆 MES BADGES & ACHIEVEMENTS');

    // Barre de progression globale
    const totalBadges = allBadges.length;
    const globalProgress = Math.round((stats.total_badges / totalBadges) * 100);
    const globalBar = createProgressBar(stats.total_badges, totalBadges, 15);

    let description = `### 📊 Progression Globale\n`;
    description += `${globalBar}\n`;
    description += `**${stats.total_badges}/${totalBadges}** badges débloqués (${globalProgress}%)\n\n`;

    description += `### 🎯 Répartition par Rareté\n`;
    description += `${badgeHandler.RARITY_EMOJIS.mythic} Mythique: **${stats.mythic_count}**\n`;
    description += `${badgeHandler.RARITY_EMOJIS.legendary} Légendaire: **${stats.legendary_count}**\n`;
    description += `${badgeHandler.RARITY_EMOJIS.epic} Épique: **${stats.epic_count}**\n`;
    description += `${badgeHandler.RARITY_EMOJIS.rare} Rare: **${stats.rare_count}**\n`;
    description += `${badgeHandler.RARITY_EMOJIS.uncommon} Peu commun: **${stats.uncommon_count}**\n`;
    description += `${badgeHandler.RARITY_EMOJIS.common} Commun: **${stats.common_count}**\n`;

    embed.setDescription(description);

    // Badges récemment débloqués (top 3)
    const recentBadges = unlockedBadges
      .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at))
      .slice(0, 3);

    if (recentBadges.length > 0) {
      let recentText = '';
      recentBadges.forEach(badge => {
        const timeAgo = formatTimeAgo(new Date(badge.unlocked_at));
        recentText += `${badge.emoji} **${badge.name}** ${badgeHandler.RARITY_EMOJIS[badge.rarity]}\n`;
        recentText += `└ 📅 ${timeAgo}\n`;
      });
      embed.addFields({ name: '🆕 Récemment Débloqués', value: recentText, inline: true });
    }

    // Prochains badges à débloquer (top 3 les plus proches)
    const almostThere = inProgressBadges
      .map(b => ({
        ...b,
        percentage: b.target_value ? (b.current_value / b.target_value) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);

    if (almostThere.length > 0) {
      let almostText = '';
      almostThere.forEach(badge => {
        const pct = Math.round(badge.percentage);
        almostText += `${badge.emoji} **${badge.name}** ${badgeHandler.RARITY_EMOJIS[badge.rarity]}\n`;
        almostText += `└ ${createProgressBar(badge.current_value, badge.target_value, 8)} **${pct}%**\n`;
      });
      embed.addFields({ name: '🔥 Presque Débloqués !', value: almostText, inline: true });
    }
  }

  // ========== MODE: UNLOCKED (Mes Badges Obtenus) ==========
  else if (mode === 'unlocked') {
    embed.setTitle('✅ MES BADGES OBTENUS');

    // Filtrer les badges débloqués par catégorie si demandé
    const filteredUnlocked = selectedCategory === 'all'
      ? unlockedBadges
      : unlockedBadges.filter(b => b.category === selectedCategory);

    // Pagination
    const ITEMS_PER_PAGE = 6;
    const totalPages = Math.ceil(filteredUnlocked.length / ITEMS_PER_PAGE) || 1;
    const startIdx = page * ITEMS_PER_PAGE;
    const pageBadges = filteredUnlocked
      .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at)) // Plus récents d'abord
      .slice(startIdx, startIdx + ITEMS_PER_PAGE);

    let description = `### ${selectedCategory === 'all' ? 'Tous mes Badges' : getCategoryDisplayName(selectedCategory)}\n`;
    description += `🏆 **${filteredUnlocked.length}** badge(s) obtenu(s)\n\n`;

    if (pageBadges.length === 0) {
      description += '*Aucun badge obtenu dans cette catégorie.*\n';
      description += '💡 Consulte l\'onglet **Découvrir** pour voir comment les débloquer !';
    } else {
      pageBadges.forEach(badge => {
        // Formater la date d'obtention
        const unlockedDate = new Date(badge.unlocked_at);
        const dateStr = unlockedDate.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        const timeStr = unlockedDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        description += `${badge.emoji} **${badge.name}** ${badgeHandler.RARITY_EMOJIS[badge.rarity]}\n`;
        description += `└ 📅 Obtenu le **${dateStr}** à ${timeStr}\n`;
        description += `└ *${badge.description}*\n\n`;
      });
    }

    if (totalPages > 1) {
      description += `\n📄 Page ${page + 1}/${totalPages}`;
    }

    embed.setDescription(description);
  }

  // ========== MODE: PROGRESS ==========
  else if (mode === 'progress') {
    embed.setTitle('📈 PROGRESSION DES BADGES');

    // Pagination
    const ITEMS_PER_PAGE = 6;
    const badgesToShow = [...inProgressBadges, ...notStartedBadges];
    const totalPages = Math.ceil(badgesToShow.length / ITEMS_PER_PAGE);
    const startIdx = page * ITEMS_PER_PAGE;
    const pageBadges = badgesToShow.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    let description = `### ${selectedCategory === 'all' ? 'Tous les Badges' : getCategoryDisplayName(selectedCategory)}\n`;
    description += `*Clique sur un badge pour voir comment le débloquer*\n\n`;

    if (pageBadges.length === 0) {
      description += '✅ **Tous les badges de cette catégorie sont débloqués !**';
    } else {
      pageBadges.forEach(badge => {
        const currentVal = badge.current_value || 0;
        const targetVal = badge.target_value || badge.condition_value || 1;
        const pct = Math.round((currentVal / targetVal) * 100);
        const progressBar = createProgressBar(currentVal, targetVal, 10);

        description += `${badge.emoji} **${badge.name}** ${badgeHandler.RARITY_EMOJIS[badge.rarity]}\n`;
        description += `${progressBar} ${currentVal}/${targetVal} (${pct}%)\n`;
        description += `💡 *${getBadgeHint(badge)}*\n\n`;
      });
    }

    if (totalPages > 1) {
      description += `\n📄 Page ${page + 1}/${totalPages}`;
    }

    embed.setDescription(description);
  }

  // ========== MODE: DISCOVER ==========
  else if (mode === 'discover') {
    embed.setTitle('🔍 DÉCOUVRIR DE NOUVEAUX BADGES');

    // Pagination
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(notStartedBadges.length / ITEMS_PER_PAGE);
    const startIdx = page * ITEMS_PER_PAGE;
    const pageBadges = notStartedBadges.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    let description = `### Badges à Découvrir (${notStartedBadges.length})\n`;
    description += `*Ces badges attendent d'être débloqués !*\n\n`;

    if (pageBadges.length === 0) {
      description += '🎉 **Tu as commencé tous les badges disponibles !**\n';
      description += 'Consulte l\'onglet **Progression** pour voir ton avancement.';
    } else {
      pageBadges.forEach(badge => {
        description += `${badge.emoji} **${badge.name}** ${badgeHandler.RARITY_EMOJIS[badge.rarity]}\n`;
        description += `└ *${badge.description}*\n`;
        description += `└ 🎯 **Comment l'obtenir:** ${getBadgeHowTo(badge)}\n\n`;
      });
    }

    if (totalPages > 1) {
      description += `\n📄 Page ${page + 1}/${totalPages}`;
    }

    embed.setDescription(description);
  }

  // ========== COMPOSANTS ==========
  const components = [];

  // Row 1: Onglets de mode (Vue d'ensemble, Mes Badges, Progression, Découverte)
  const modeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_badges_mode:overview')
      .setLabel('Résumé')
      .setEmoji('📊')
      .setStyle(mode === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_badges_mode:unlocked')
      .setLabel('Mes Badges')
      .setEmoji('✅')
      .setStyle(mode === 'unlocked' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_badges_mode:progress')
      .setLabel('En cours')
      .setEmoji('📈')
      .setStyle(mode === 'progress' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_badges_mode:discover')
      .setLabel('À découvrir')
      .setEmoji('🔍')
      .setStyle(mode === 'discover' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  components.push(modeRow);

  // Row 2: Filtres catégorie (pour les modes unlocked, progress ou discover)
  if (mode === 'unlocked' || mode === 'progress' || mode === 'discover') {
    const categoryOptions = [
      { label: 'Toutes catégories', value: 'all', emoji: '📦', default: selectedCategory === 'all' },
      { label: 'Super Bonus', value: 'super_bonus', emoji: '⭐', default: selectedCategory === 'super_bonus' },
      { label: 'Collection', value: 'collection', emoji: '🎨', default: selectedCategory === 'collection' },
      { label: 'Rareté', value: 'rarity', emoji: '💎', default: selectedCategory === 'rarity' },
      { label: 'Évolution', value: 'evolution', emoji: '📈', default: selectedCategory === 'evolution' },
      { label: 'Missions', value: 'mission', emoji: '📋', default: selectedCategory === 'mission' },
      { label: 'Pièges', value: 'trap', emoji: '💥', default: selectedCategory === 'trap' },
      { label: 'Mystery Box', value: 'mystery_box', emoji: '🎁', default: selectedCategory === 'mystery_box' },
      { label: 'Engagement', value: 'engagement', emoji: '📅', default: selectedCategory === 'engagement' },
      { label: 'Économie', value: 'economy', emoji: '💰', default: selectedCategory === 'economy' },
      { label: 'Ancienneté', value: 'seniority', emoji: '⏰', default: selectedCategory === 'seniority' },
      { label: 'Social', value: 'social', emoji: '👥', default: selectedCategory === 'social' },
      { label: 'Chance', value: 'luck', emoji: '🍀', default: selectedCategory === 'luck' },
      { label: 'Mint', value: 'mint', emoji: '✨', default: selectedCategory === 'mint' },
      { label: 'Thème', value: 'theme', emoji: '🎭', default: selectedCategory === 'theme' },
      { label: 'Crafting', value: 'crafting', emoji: '🔧', default: selectedCategory === 'crafting' }
    ];

    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId(`profile_badges_category:${mode}`)
      .setPlaceholder('Filtrer par catégorie')
      .addOptions(categoryOptions);

    components.push(new ActionRowBuilder().addComponents(categorySelect));
  }

  // Row 3: Navigation pagination (si nécessaire)
  let badgesToShow = [];
  let itemsPerPageForNav = 6;

  if (mode === 'unlocked') {
    const filteredUnlocked = selectedCategory === 'all'
      ? unlockedBadges
      : unlockedBadges.filter(b => b.category === selectedCategory);
    badgesToShow = filteredUnlocked;
    itemsPerPageForNav = 6;
  } else if (mode === 'progress') {
    badgesToShow = [...inProgressBadges, ...notStartedBadges];
    itemsPerPageForNav = 6;
  } else if (mode === 'discover') {
    badgesToShow = notStartedBadges;
    itemsPerPageForNav = 5;
  }

  const totalPages = Math.ceil(badgesToShow.length / itemsPerPageForNav) || 1;

  if (totalPages > 1) {
    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`profile_badges_page:${mode}:${selectedCategory}:${Math.max(0, page - 1)}`)
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('profile_badges_pageinfo')
        .setLabel(`${page + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`profile_badges_page:${mode}:${selectedCategory}:${Math.min(totalPages - 1, page + 1)}`)
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
    components.push(navRow);
  }

  // Row finale: Actions avec Retour au profil
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_overview')
      .setLabel('Retour au profil')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_badges_leaderboard')
      .setLabel('Classement')
      .setEmoji('🏆')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('profile_refresh')
      .setLabel('Actualiser')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
  );
  components.push(actionRow);

  return {
    embeds: [embed],
    components,
    files  // Inclure l'image de profil avec frame
  };
}

/**
 * Helper: Nom d'affichage des catégories
 */
function getCategoryDisplayName(category) {
  const names = {
    super_bonus: '⭐ Super Bonus',
    collection: '🎨 Collection',
    mission: '📋 Missions',
    trap: '💥 Pièges',
    mystery_box: '🎁 Mystery Box',
    engagement: '📅 Engagement',
    crafting: '🔧 Crafting',
    rarity: '💎 Raretés',
    social: '👥 Social',
    special: '🌟 Spéciaux'
  };
  return names[category] || category;
}

/**
 * Helper: Indice court pour un badge (affiché dans la progression)
 */
function getBadgeHint(badge) {
  const hints = {
    // Super Bonus
    'vision_divine': 'Utilise le bonus Vision Divine',
    'jackpot_x2': 'Utilise le bonus Jackpot x2',
    'legendary_magnet': 'Utilise le bonus Aimant Légendaire',
    'trap_block': 'Bloque des pièges avec Bouclier Anti-Piège',

    // Collection
    'collectible_count': 'Collecte des items',

    // Missions
    'mission_complete': 'Complete des missions',

    // Mystery Box
    'mystery_box_open': 'Ouvre des mystery boxes',

    // Pièges
    'trap_survive': 'Survie aux pièges',
    'trap_triggered': 'Déclenche des pièges',

    // Engagement
    'daily_claim_streak': 'Réclame tes récompenses quotidiennes',

    // Crafting
    'craft_count': 'Fabrique des items'
  };

  return hints[badge.condition_type] || badge.description;
}

/**
 * Helper: Instructions détaillées pour obtenir un badge
 */
function getBadgeHowTo(badge) {
  const howTo = {
    // Super Bonus détaillés
    'vision_divine': `Utilise le bonus **Vision Divine** ${badge.condition_value || '?'} fois pour révéler le contenu des mystery boxes avant de les ouvrir.`,
    'jackpot_x2': `Active le bonus **Jackpot x2** ${badge.condition_value || '?'} fois pour doubler tes gains.`,
    'legendary_magnet': `Utilise l'**Aimant Légendaire** ${badge.condition_value || '?'} fois pour augmenter tes chances d'obtenir des légendaires.`,
    'trap_block': `Bloque ${badge.condition_value || '?'} pièges avec le **Bouclier Anti-Piège**.`,

    // Collection
    'collectible_count': `Collecte ${badge.condition_value || '?'} items uniques dans ta collection.`,

    // Missions
    'mission_complete': `Complete ${badge.condition_value || '?'} missions avec succès.`,

    // Mystery Box
    'mystery_box_open': `Ouvre ${badge.condition_value || '?'} mystery boxes.`,

    // Pièges
    'trap_survive': `Survie à ${badge.condition_value || '?'} pièges sans perdre de collectibles.`,
    'trap_triggered': `Déclenche ${badge.condition_value || '?'} pièges (volontairement ou non).`,

    // Engagement
    'daily_claim_streak': `Maintiens un streak de ${badge.condition_value || '?'} jours consécutifs en réclamant tes récompenses quotidiennes.`,

    // Crafting
    'craft_count': `Fabrique ${badge.condition_value || '?'} items via le système de crafting.`
  };

  return howTo[badge.condition_type] || `${badge.description} (${badge.condition_value || '?'} requis)`;
}

/**
 * ⭐ VIEW 7: FAVORITES - Gestion des 3 collectibles favoris
 */
async function showFavorites(interaction, player, theme, selectedPosition = null) {
  const guildId = interaction.guildId;

  // Récupérer les favoris actuels et tous les collectibles du joueur
  const [favorites, collectibles] = await Promise.all([
    db.getPlayerFavorites(guildId, player.id),
    db.getPlayerCollectiblesForFavorites(guildId, player.id, theme.id)
  ]);

  // Helper pour les étoiles de niveau
  const getLevelStars = (level) => '★'.repeat(level) + '☆'.repeat(4 - level);

  // Créer l'embed
  const embed = new EmbedBuilder()
    .setTitle('⭐ Mes Favoris')
    .setColor('#FFD700')
    .setDescription(
      'Sélectionne tes **3 collectibles favoris** à mettre en avant sur ton profil !\n\n' +
      'Ces collectibles seront affichés en priorité quand tu partages ton profil.'
    );

  // Afficher les 3 slots de favoris
  for (let pos = 1; pos <= 3; pos++) {
    const fav = favorites.find(f => f.position === pos);
    if (fav) {
      const emoji = getRarityEmoji(fav.rarity);
      embed.addFields({
        name: `${pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'} Position ${pos}`,
        value: `${emoji} **${fav.name}** (${fav.rarity})\n` +
          `${getLevelStars(fav.level || 1)} Niveau ${fav.level || 1}` +
          (fav.mint_number && fav.mint_number <= 100 ? ` • Mint #${fav.mint_number}` : ''),
        inline: true
      });
    } else {
      embed.addFields({
        name: `${pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'} Position ${pos}`,
        value: '*Aucun favori*\nClique pour choisir',
        inline: true
      });
    }
  }

  embed.setFooter(await getLoomixFooter(guildId));

  // Créer les boutons de position
  const positionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_favorite_pos:1')
      .setLabel('Position 1')
      .setEmoji('🥇')
      .setStyle(selectedPosition === 1 ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_favorite_pos:2')
      .setLabel('Position 2')
      .setEmoji('🥈')
      .setStyle(selectedPosition === 2 ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_favorite_pos:3')
      .setLabel('Position 3')
      .setEmoji('🥉')
      .setStyle(selectedPosition === 3 ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  // Si une position est sélectionnée, afficher le menu de sélection des collectibles
  const rows = [positionRow];

  if (selectedPosition && collectibles.length > 0) {
    // Filtrer les collectibles déjà en favori (sauf si c'est pour remplacer la même position)
    const favoriteIds = favorites
      .filter(f => f.position !== selectedPosition)
      .map(f => f.collectible_id);
    const availableCollectibles = collectibles.filter(c => !favoriteIds.includes(c.collectible_id));

    if (availableCollectibles.length > 0) {
      const options = availableCollectibles.slice(0, 25).map(c => {
        const mintDisplay = c.mint_number === 1 ? ' 🥇' : (c.mint_number ? ` #${c.mint_number}` : '');
        return {
          label: `${c.name} (${c.rarity})${mintDisplay}`,
          description: `Niveau ${c.level || 1} ${getLevelStars(c.level || 1)}`,
          value: `${c.collectible_id}`,
          emoji: getRarityEmoji(c.rarity)
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`profile_favorite_select:${selectedPosition}`)
        .setPlaceholder(`Choisir un collectible pour la position ${selectedPosition}`)
        .addOptions(options);

      rows.push(new ActionRowBuilder().addComponents(selectMenu));
    }
  }

  // Bouton retour
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_overview')
      .setLabel('Retour')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  );
  rows.push(backRow);

  return { embeds: [embed], components: rows };
}

/**
 * 🖼️ VIEW 8: FRAMES - Gestion des frames de profil
 */
async function showFrames(interaction, player, theme) {
  const guildId = interaction.guildId;
  const discordId = interaction.user.id;

  // Récupérer les frames débloquées et la frame équipée
  const [unlockedFrames, equippedFrame, themeFrames] = await Promise.all([
    db.getUnlockedFrames(discordId),
    db.getEquippedFrame(discordId, guildId),
    db.getThemeProfileFrames(guildId, theme.id)
  ]);

  // Récupérer les stats du joueur pour afficher la progression
  const playerStats = await db.queryOne(`
    SELECT
      COUNT(*) FILTER (WHERE c.level >= 2) as level2_count,
      COUNT(*) FILTER (WHERE c.level >= 3) as level3_count,
      COUNT(*) FILTER (WHERE c.level >= 4) as level4_count,
      COUNT(*) FILTER (WHERE col.rarity = 'legendary' AND c.level >= 2) as legendary_level2_count,
      COUNT(*) FILTER (WHERE col.rarity = 'legendary' AND c.level >= 3) as legendary_level3_count,
      COUNT(*) FILTER (WHERE col.rarity = 'legendary' AND c.level >= 4) as legendary_level4_count
    FROM collections c
    JOIN collectibles col ON c.collectible_id = col.id
    WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3 AND c.lost_at IS NULL
  `, [guildId, player.id, theme.id]);

  const embed = new EmbedBuilder()
    .setTitle('🖼️ Mes Frames de Profil')
    .setColor('#9B59B6')
    .setDescription(
      'Les frames de profil sont des décorations déblocables en atteignant certains objectifs.\n' +
      '**Les frames débloquées sont utilisables sur tous les serveurs !**\n\n' +
      '⚠️ *La Frame 2 ne peut être débloquée que si la Frame 1 est déjà obtenue.*'
    );

  // Frame actuellement équipée
  if (equippedFrame) {
    embed.addFields({
      name: '✨ Frame Équipée',
      value: `**${equippedFrame.name}**\n${equippedFrame.description || ''}`,
      inline: false
    });
  } else {
    embed.addFields({
      name: '✨ Frame Équipée',
      value: '*Aucune frame équipée*',
      inline: false
    });
  }

  // Frames du thème actuel avec progression détaillée
  if (themeFrames.length > 0) {
    // Trier par frame_number
    const sortedFrames = [...themeFrames].sort((a, b) => a.frame_number - b.frame_number);

    // Créer une map des frames débloquées du thème
    const unlockedThemeFrameNumbers = new Set();
    for (const frame of sortedFrames) {
      if (unlockedFrames.some(f => f.frame_id === frame.id)) {
        unlockedThemeFrameNumbers.add(frame.frame_number);
      }
    }

    for (const frame of sortedFrames) {
      const isUnlocked = unlockedThemeFrameNumbers.has(frame.frame_number);
      const isEquipped = equippedFrame?.id === frame.id;
      const condition = frame.unlock_condition || {};

      // Vérifier si la frame précédente est débloquée (pour frame > 1)
      const previousFrameUnlocked = frame.frame_number === 1 || unlockedThemeFrameNumbers.has(frame.frame_number - 1);

      // Calculer la progression
      let currentProgress = 0;
      let requiredAmount = condition.count || 0;
      let progressText = '';

      if (condition.type === 'collectibles_level') {
        const minLevel = condition.min_level || 2;
        if (minLevel === 2) currentProgress = parseInt(playerStats?.level2_count || 0);
        else if (minLevel === 3) currentProgress = parseInt(playerStats?.level3_count || 0);
        else if (minLevel === 4) currentProgress = parseInt(playerStats?.level4_count || 0);

        progressText = `Avoir **${requiredAmount}** collectibles au niveau **${minLevel}+**`;
      } else if (condition.type === 'legendary_level') {
        const minLevel = condition.min_level || 2;
        if (minLevel === 2) currentProgress = parseInt(playerStats?.legendary_level2_count || 0);
        else if (minLevel === 3) currentProgress = parseInt(playerStats?.legendary_level3_count || 0);
        else if (minLevel === 4) currentProgress = parseInt(playerStats?.legendary_level4_count || 0);

        progressText = `Avoir **${requiredAmount}** légendaire(s) au niveau **${minLevel}+**`;
      }

      // Déterminer le statut avec icône
      let statusIcon, statusText;
      if (isEquipped) {
        statusIcon = '✅';
        statusText = 'Équipée';
      } else if (isUnlocked) {
        statusIcon = '🔓';
        statusText = 'Débloquée';
      } else if (!previousFrameUnlocked) {
        statusIcon = '⛔';
        statusText = 'Requiert Frame ' + (frame.frame_number - 1);
      } else {
        statusIcon = '🔒';
        statusText = 'Verrouillée';
      }

      // Construire le texte du champ
      let fieldValue = `${statusIcon} **${statusText}**\n`;

      // Condition de déblocage
      fieldValue += `📋 **Comment débloquer:** ${progressText || 'Condition inconnue'}\n`;

      // Afficher la progression si pas débloquée et frame précédente OK
      if (!isUnlocked && previousFrameUnlocked && requiredAmount > 0) {
        const progressBar = createProgressBar(currentProgress, requiredAmount);
        fieldValue += `📊 **Progression:** ${currentProgress}/${requiredAmount} ${progressBar}\n`;
      } else if (!isUnlocked && !previousFrameUnlocked) {
        fieldValue += `⚠️ *Débloque d'abord la Frame ${frame.frame_number - 1}*\n`;
      }

      // Bonus de la frame
      if (frame.bonus_type) {
        fieldValue += `🎁 **Bonus:** +${frame.bonus_value}% ${frame.bonus_type}`;
      }

      embed.addFields({
        name: `🖼️ Frame ${frame.frame_number}: ${frame.name}`,
        value: fieldValue,
        inline: false
      });
    }
  } else {
    embed.addFields({
      name: `📦 Frames du Thème "${theme.name}"`,
      value: '*Aucune frame configurée pour ce thème*',
      inline: false
    });
  }

  // Toutes les frames débloquées (multi-serveur)
  if (unlockedFrames.length > 0) {
    const otherFrames = unlockedFrames.filter(f =>
      !themeFrames.some(tf => tf.id === f.frame_id)
    );

    if (otherFrames.length > 0) {
      const otherFramesText = otherFrames.slice(0, 5).map(f =>
        `• **${f.name}** (obtenue sur autre serveur)`
      ).join('\n');

      embed.addFields({
        name: '🌐 Autres Frames Débloquées',
        value: otherFramesText,
        inline: false
      });
    }
  }

  embed.addFields({
    name: '📊 Total',
    value: `${unlockedFrames.length} frame(s) débloquée(s)`,
    inline: true
  });

  embed.setFooter(await getLoomixFooter(guildId));

  // Boutons pour équiper/déséquiper
  const actionRow = new ActionRowBuilder();

  // Ajouter les frames débloquées du thème comme boutons d'équipement
  const unlockedThemeFrames = themeFrames.filter(f =>
    unlockedFrames.some(uf => uf.frame_id === f.id)
  );

  for (const frame of unlockedThemeFrames.slice(0, 3)) {
    const isEquipped = equippedFrame?.id === frame.id;
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`profile_frame_equip:${frame.id}`)
        .setLabel(frame.name)
        .setEmoji(isEquipped ? '✅' : '🖼️')
        .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(isEquipped)
    );
  }

  // Bouton pour retirer la frame
  if (equippedFrame) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId('profile_frame_unequip')
        .setLabel('Retirer')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );
  }

  // Bouton retour
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_overview')
      .setLabel('Retour')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  );

  const rows = [];
  if (actionRow.components.length > 0) {
    rows.push(actionRow);
  }
  rows.push(backRow);

  return { embeds: [embed], components: rows };
}

module.exports = {
  showOverview,
  showInventory,
  showHistory,
  showAchievements,
  showBonuses,
  showBadges,
  showFavorites,
  showFrames
};
