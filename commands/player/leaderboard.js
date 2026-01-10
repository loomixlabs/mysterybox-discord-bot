const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database-pg');

// Configuration des types de leaderboard avec descriptions détaillées
// scope: 'theme' = lié au thème actif, 'global' = tous thèmes confondus
const LEADERBOARD_TYPES = {
  collection: {
    name: 'Collection',
    emoji: '🏆',
    scope: 'theme',
    description: 'Progression dans la collection actuelle',
    details: 'Classé par : complétion > date de fin > nombre d\'items collectés.',
    color: '#FFD700'
  },
  legendary: {
    name: 'Chasseurs Légendaires',
    emoji: '💎',
    scope: 'global',
    description: 'Nombre de légendaires obtenus',
    details: 'Total de collectibles légendaires en possession (non perdus).',
    color: '#9B59B6'
  },
  epic: {
    name: 'Chasseurs Épiques',
    emoji: '💜',
    scope: 'global',
    description: 'Nombre d\'épiques obtenus',
    details: 'Total de collectibles épiques en possession (non perdus).',
    color: '#8E44AD'
  },
  lucky: {
    name: 'Les Chanceux',
    emoji: '🍀',
    scope: 'global',
    description: 'Meilleur ratio de légendaires',
    details: 'Pourcentage de légendaires sur le total de collectibles. Min 5 items.',
    color: '#27AE60'
  },
  speedrunners: {
    name: 'Speedrunners',
    emoji: '⚡',
    scope: 'global',
    description: 'Collection complétée le plus vite',
    details: 'Record personnel : durée entre le 1er et dernier item d\'une collection.',
    color: '#F1C40F'
  },
  mission_accuracy: {
    name: 'Précision Missions',
    emoji: '🎯',
    scope: 'global',
    description: 'Meilleur taux de réussite missions',
    details: 'Ratio missions réussies / échouées. Min 3 missions terminées.',
    color: '#3498DB'
  },
  streak: {
    name: 'Streaks',
    emoji: '🔥',
    scope: 'global',
    description: 'Jours consécutifs de connexion',
    details: 'Nombre de jours consécutifs de claim au calendrier quotidien.',
    color: '#E74C3C'
  },
  mystery_boxes: {
    name: 'Mystery Boxes',
    emoji: '📦',
    scope: 'global',
    description: 'Nombre de mystery boxes ouvertes',
    details: 'Total de boxes ouvertes depuis le début.',
    color: '#3498DB'
  },
  missions: {
    name: 'Missions',
    emoji: '✅',
    scope: 'global',
    description: 'Missions complétées avec succès',
    details: 'Nombre total de missions réussies (quiz, keywords, etc.).',
    color: '#2ECC71'
  },
  badges: {
    name: 'Badges',
    emoji: '🎖️',
    scope: 'global',
    description: 'Collection de badges',
    details: 'Nombre total de badges débloqués sur le serveur.',
    color: '#F39C12'
  },
  traps_blocked: {
    name: 'Survivants',
    emoji: '🛡️',
    scope: 'global',
    description: 'Pièges bloqués avec le bouclier',
    details: 'Nombre de pièges évités grâce au super bonus Bouclier.',
    color: '#1ABC9C'
  },
  trap_victims: {
    name: 'Victimes des Pièges',
    emoji: '💀',
    scope: 'global',
    description: 'Nombre de pièges déclenchés',
    details: 'Total de pièges subis. Les plus malchanceux du serveur !',
    color: '#E74C3C'
  },
  joker_masters: {
    name: 'Maîtres du Joker',
    emoji: '🃏',
    scope: 'global',
    description: 'Collectibles obtenus via Joker',
    details: 'Nombre d\'items obtenus grâce au super bonus Joker.',
    color: '#E91E63'
  },
  veterans: {
    name: 'Vétérans',
    emoji: '⭐',
    scope: 'global',
    description: 'Les plus anciens joueurs',
    details: 'Classé par date d\'inscription sur le serveur.',
    color: '#95A5A6'
  },
  loomix: {
    name: 'Riches en Loomix',
    emoji: '💰',
    scope: 'global',
    description: 'Les plus grandes fortunes',
    details: 'Classé par solde actuel de Loomix (monnaie du serveur).',
    color: '#F1C40F'
  },
  finishers: {
    name: 'Finishers',
    emoji: '🏅',
    scope: 'global',
    description: 'Nombre de thèmes complétés',
    details: 'Total de collections terminées. Les plus fidèles !',
    color: '#9B59B6'
  },
  mint_masters: {
    name: 'Mint #1 Masters',
    emoji: '🥇',
    scope: 'global',
    description: 'Collectionneurs de Mint #1',
    details: 'Nombre de collectibles obtenus en premier (Mint #1).',
    color: '#FFD700'
  },
  tictactoe_wins: {
    name: 'Champions Morpion',
    emoji: '🎮',
    scope: 'global',
    description: 'Victoires au Morpion PvP',
    details: 'Nombre de parties de Morpion gagnées contre d\'autres joueurs.',
    color: '#5865F2'
  },
  tictactoe_winrate: {
    name: 'Win Rate Morpion',
    emoji: '📈',
    scope: 'global',
    description: 'Meilleur ratio victoires/défaites',
    details: 'Pourcentage de victoires au Morpion. Min 5 parties jouées.',
    color: '#2ECC71'
  }
};

const ITEMS_PER_PAGE = 10;

// Helper pour construire le titre avec scope
function buildTitle(config, themeName = null) {
  const scopeEmoji = config.scope === 'theme' ? '🎭' : '🌍';
  if (themeName) {
    return `${config.emoji} ${config.name} ${scopeEmoji} • ${themeName}`;
  }
  return `${config.emoji} ${config.name} ${scopeEmoji}`;
}

// Helper pour construire l'en-tête descriptif
function buildHeader(config) {
  const scopeText = config.scope === 'theme' ? 'Thème actif' : 'Tous thèmes';
  return `> ${config.description}\n> *${config.details}*\n> 📍 **Scope:** ${scopeText}\n`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Voir les classements du serveur'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      const type = 'collection'; // Type par défaut
      const page = 0;

      const result = await buildLeaderboardEmbed(guildId, type, interaction.user.id, page);
      const components = buildComponents(type, page, result.totalPages, result.hasMore);

      await interaction.editReply({
        embeds: [result.embed],
        components
      });

    } catch (error) {
      console.error('🔴 Erreur /leaderboard:', error);
      await interaction.editReply({
        content: '❌ Une erreur est survenue lors du chargement du classement.',
      });
    }
  },

  // Handler pour le select menu
  async handleSelectMenu(interaction) {
    await interaction.deferUpdate();

    try {
      const type = interaction.values[0];
      const guildId = interaction.guildId;
      const page = 0; // Reset à la page 0 quand on change de type

      const result = await buildLeaderboardEmbed(guildId, type, interaction.user.id, page);
      const components = buildComponents(type, page, result.totalPages, result.hasMore);

      await interaction.editReply({
        embeds: [result.embed],
        components
      });
    } catch (error) {
      console.error('🔴 Erreur leaderboard select:', error);
    }
  },

  // Handler pour les boutons de pagination
  async handleButton(interaction) {
    await interaction.deferUpdate();

    try {
      // Format: leaderboard_action_type_page (type peut contenir des underscores)
      // Exemple: leaderboard_next_mystery_boxes_0
      const parts = interaction.customId.split('_');
      const action = parts[1]; // prev ou next
      const pageStr = parts[parts.length - 1]; // dernier élément = page
      const type = parts.slice(2, -1).join('_'); // tout entre action et page = type

      console.log(`🔍 [LEADERBOARD] Button clicked: customId=${interaction.customId}, parts=${JSON.stringify(parts)}, action=${action}, type=${type}, pageStr=${pageStr}`);

      const guildId = interaction.guildId;
      let page = parseInt(pageStr);

      if (action === 'prev') page--;
      if (action === 'next') page++;

      const result = await buildLeaderboardEmbed(guildId, type, interaction.user.id, page);
      const components = buildComponents(type, page, result.totalPages, result.hasMore);

      await interaction.editReply({
        embeds: [result.embed],
        components
      });
    } catch (error) {
      console.error('🔴 Erreur leaderboard button:', error);
    }
  }
};

// Construire les composants (select + boutons pagination)
function buildComponents(currentType, currentPage, totalPages, hasMore) {
  const components = [];

  // Row 1: Select Menu pour changer de type
  const selectOptions = Object.entries(LEADERBOARD_TYPES).map(([value, config]) => ({
    label: config.name,
    description: config.description.substring(0, 50),
    value: value,
    emoji: config.emoji,
    default: value === currentType
  }));

  // Discord limite à 25 options, on en a 14, c'est bon
  const select = new StringSelectMenuBuilder()
    .setCustomId('leaderboard_type_select')
    .setPlaceholder('Changer de classement...')
    .addOptions(selectOptions);

  components.push(new ActionRowBuilder().addComponents(select));

  // Row 2: Boutons de pagination
  const prevButton = new ButtonBuilder()
    .setCustomId(`leaderboard_prev_${currentType}_${currentPage}`)
    .setLabel('◀ Précédent')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === 0);

  const pageInfo = new ButtonBuilder()
    .setCustomId('leaderboard_page_info')
    .setLabel(`Page ${currentPage + 1}${totalPages ? ` / ${totalPages}` : ''}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  const nextButton = new ButtonBuilder()
    .setCustomId(`leaderboard_next_${currentType}_${currentPage}`)
    .setLabel('Suivant ▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(!hasMore);

  components.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));

  return components;
}

// Construire l'embed du leaderboard avec pagination
async function buildLeaderboardEmbed(guildId, type, requesterId, page = 0) {
  const config = LEADERBOARD_TYPES[type];
  const offset = page * ITEMS_PER_PAGE;

  switch (type) {
    case 'collection':
      return await buildCollectionLeaderboard(guildId, requesterId, config, page);

    case 'lucky':
      return await buildLuckyLeaderboard(guildId, requesterId, config, page);

    case 'speedrunners':
      return await buildSpeedrunnerLeaderboard(guildId, requesterId, config, page);

    case 'mission_accuracy':
      return await buildMissionAccuracyLeaderboard(guildId, requesterId, config, page);

    default:
      return await buildGenericLeaderboard(guildId, type, requesterId, config, page);
  }
}

// === NOUVEAUX CLASSEMENTS ===

// Classement des Chanceux (ratio légendaires)
async function buildLuckyLeaderboard(guildId, requesterId, config, page) {
  const offset = page * ITEMS_PER_PAGE;

  const data = await db.queryAll(`
    SELECT p.username, p.discord_id,
           COUNT(*) FILTER (WHERE col.rarity = 'legendary')::integer as legendaries,
           COUNT(*)::integer as total,
           ROUND(COUNT(*) FILTER (WHERE col.rarity = 'legendary')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as ratio
    FROM collections c
    JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
    JOIN collectibles col ON c.collectible_id = col.id
    WHERE c.guild_id = $1 AND c.lost_at IS NULL
    GROUP BY p.id, p.username, p.discord_id
    HAVING COUNT(*) >= 5
    ORDER BY ratio DESC, legendaries DESC
    LIMIT $2 OFFSET $3
  `, [guildId, ITEMS_PER_PAGE + 1, offset]);

  const hasMore = data.length > ITEMS_PER_PAGE;
  const displayData = data.slice(0, ITEMS_PER_PAGE);

  const totalCount = await db.queryOne(`
    SELECT COUNT(*) as count FROM (
      SELECT p.id FROM collections c
      JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
      WHERE c.guild_id = $1 AND c.lost_at IS NULL
      GROUP BY p.id HAVING COUNT(*) >= 5
    ) sub
  `, [guildId]);

  const totalPages = Math.ceil((totalCount?.count || 0) / ITEMS_PER_PAGE);

  if (displayData.length === 0) {
    return {
      embed: new EmbedBuilder()
        .setTitle(`${config.emoji} ${config.name}`)
        .setColor(config.color)
        .setDescription('Aucun joueur avec assez de collectibles (min: 5).'),
      totalPages: 1,
      hasMore: false
    };
  }

  const lines = displayData.map((player, index) => {
    const rank = offset + index;
    const medal = getMedal(rank);
    const isRequester = player.discord_id === requesterId;
    const nameDisplay = isRequester ? `**${player.username}** ⭐` : player.username;

    return `${medal} ${nameDisplay}\n┗ 🍀 **${player.ratio}%** ratio (${player.legendaries}💎 / ${player.total} total)`;
  });

  const header = buildHeader(config);
  const embed = new EmbedBuilder()
    .setTitle(buildTitle(config))
    .setColor(config.color)
    .setDescription(header + '\n' + lines.join('\n\n'))
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages}` });

  // Position du joueur
  await addRequesterPosition(embed, guildId, requesterId, displayData, 'lucky', page);

  return { embed, totalPages, hasMore };
}

// Classement Speedrunners - Meilleur temps par joueur (tous thèmes confondus, sans doublons)
async function buildSpeedrunnerLeaderboard(guildId, requesterId, config, page) {
  const offset = page * ITEMS_PER_PAGE;

  // Récupérer le MEILLEUR temps de chaque joueur (un seul record par joueur)
  const data = await db.queryAll(`
    SELECT p.username, p.discord_id,
           best.completed_at, best.seconds_to_complete,
           t.name as theme_name
    FROM (
      SELECT player_id,
             MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as seconds_to_complete
      FROM player_progress
      WHERE guild_id = $1 AND is_completed = TRUE AND completed_at IS NOT NULL
      GROUP BY player_id
    ) best_times
    JOIN player_progress best ON best.player_id = best_times.player_id
      AND best.guild_id = $1
      AND best.is_completed = TRUE
      AND EXTRACT(EPOCH FROM (best.completed_at - best.started_at)) = best_times.seconds_to_complete
    JOIN players p ON best.player_id = p.id AND best.guild_id = p.guild_id
    JOIN themes t ON best.theme_id = t.id
    ORDER BY best_times.seconds_to_complete ASC
    LIMIT $2 OFFSET $3
  `, [guildId, ITEMS_PER_PAGE + 1, offset]);

  const hasMore = data.length > ITEMS_PER_PAGE;
  const displayData = data.slice(0, ITEMS_PER_PAGE);

  // Compter le nombre de joueurs DISTINCTS qui ont complété au moins un thème
  const totalCount = await db.queryOne(`
    SELECT COUNT(DISTINCT player_id) as count FROM player_progress
    WHERE guild_id = $1 AND is_completed = TRUE AND completed_at IS NOT NULL
  `, [guildId]);

  const totalPages = Math.ceil((totalCount?.count || 0) / ITEMS_PER_PAGE);

  if (displayData.length === 0) {
    return {
      embed: new EmbedBuilder()
        .setTitle(`${config.emoji} ${config.name}`)
        .setColor(config.color)
        .setDescription('Aucune collection complétée pour le moment.'),
      totalPages: 1,
      hasMore: false
    };
  }

  const lines = displayData.map((player, index) => {
    const rank = offset + index;
    const medal = getMedal(rank);
    const isRequester = player.discord_id === requesterId;
    const nameDisplay = isRequester ? `**${player.username}** ⭐` : player.username;

    const duration = formatDuration(player.seconds_to_complete);
    const completedDate = new Date(player.completed_at).toLocaleDateString('fr-FR');

    return `${medal} ${nameDisplay}\n┗ ⚡ **${duration}** • ${player.theme_name} (${completedDate})`;
  });

  const header = buildHeader(config);
  const embed = new EmbedBuilder()
    .setTitle(buildTitle(config))
    .setColor(config.color)
    .setDescription(header + '\n' + lines.join('\n\n'))
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages}` });

  return { embed, totalPages, hasMore };
}

// Classement Précision Missions
async function buildMissionAccuracyLeaderboard(guildId, requesterId, config, page) {
  const offset = page * ITEMS_PER_PAGE;

  const data = await db.queryAll(`
    SELECT p.username, p.discord_id,
           COUNT(*) FILTER (WHERE mp.status = 'completed')::integer as completed,
           COUNT(*) FILTER (WHERE mp.status = 'failed')::integer as failed,
           COUNT(*)::integer as total,
           ROUND(COUNT(*) FILTER (WHERE mp.status = 'completed')::numeric / NULLIF(COUNT(*) FILTER (WHERE mp.status IN ('completed', 'failed')), 0) * 100, 1) as success_rate
    FROM mission_progress mp
    JOIN players p ON mp.player_id = p.id AND mp.guild_id = p.guild_id
    WHERE mp.guild_id = $1 AND mp.status IN ('completed', 'failed')
    GROUP BY p.id, p.username, p.discord_id
    HAVING COUNT(*) FILTER (WHERE mp.status IN ('completed', 'failed')) >= 3
    ORDER BY success_rate DESC, completed DESC
    LIMIT $2 OFFSET $3
  `, [guildId, ITEMS_PER_PAGE + 1, offset]);

  const hasMore = data.length > ITEMS_PER_PAGE;
  const displayData = data.slice(0, ITEMS_PER_PAGE);

  const totalCount = await db.queryOne(`
    SELECT COUNT(*) as count FROM (
      SELECT p.id FROM mission_progress mp
      JOIN players p ON mp.player_id = p.id AND mp.guild_id = p.guild_id
      WHERE mp.guild_id = $1 AND mp.status IN ('completed', 'failed')
      GROUP BY p.id HAVING COUNT(*) >= 3
    ) sub
  `, [guildId]);

  const totalPages = Math.ceil((totalCount?.count || 0) / ITEMS_PER_PAGE);

  if (displayData.length === 0) {
    return {
      embed: new EmbedBuilder()
        .setTitle(`${config.emoji} ${config.name}`)
        .setColor(config.color)
        .setDescription('Aucun joueur avec assez de missions (min: 3).'),
      totalPages: 1,
      hasMore: false
    };
  }

  const lines = displayData.map((player, index) => {
    const rank = offset + index;
    const medal = getMedal(rank);
    const isRequester = player.discord_id === requesterId;
    const nameDisplay = isRequester ? `**${player.username}** ⭐` : player.username;

    return `${medal} ${nameDisplay}\n┗ 🎯 **${player.success_rate || 0}%** (${player.completed}✅ / ${player.failed}❌)`;
  });

  const header = buildHeader(config);
  const embed = new EmbedBuilder()
    .setTitle(buildTitle(config))
    .setColor(config.color)
    .setDescription(header + '\n' + lines.join('\n\n'))
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages}` });

  return { embed, totalPages, hasMore };
}

// === CLASSEMENTS EXISTANTS AMÉLIORÉS ===

// Classement Collection avec pagination
async function buildCollectionLeaderboard(guildId, requesterId, config, page) {
  const theme = await db.getActiveTheme(guildId);
  const offset = page * ITEMS_PER_PAGE;

  if (!theme) {
    return {
      embed: new EmbedBuilder()
        .setTitle('❌ Aucun thème actif')
        .setColor('#E74C3C')
        .setDescription('Il n\'y a pas de thème actif sur ce serveur.'),
      totalPages: 1,
      hasMore: false
    };
  }

  // Récupérer les données paginées
  const leaderboard = await db.queryAll(`
    SELECT p.username, p.discord_id, pp.collected_count, pp.is_completed, pp.started_at, pp.completed_at
    FROM player_progress pp
    JOIN players p ON pp.player_id = p.id AND pp.guild_id = p.guild_id
    WHERE pp.guild_id = $1 AND pp.theme_id = $2
    ORDER BY pp.is_completed DESC, pp.completed_at ASC NULLS LAST, pp.collected_count DESC, pp.started_at ASC
    LIMIT $3 OFFSET $4
  `, [guildId, theme.id, ITEMS_PER_PAGE + 1, offset]);

  const hasMore = leaderboard.length > ITEMS_PER_PAGE;
  const displayData = leaderboard.slice(0, ITEMS_PER_PAGE);

  // Compter le total
  const totalCount = await db.queryOne(`
    SELECT COUNT(*) as count FROM player_progress WHERE guild_id = $1 AND theme_id = $2
  `, [guildId, theme.id]);

  const totalPages = Math.ceil((totalCount?.count || 0) / ITEMS_PER_PAGE);

  if (displayData.length === 0) {
    return {
      embed: new EmbedBuilder()
        .setTitle(`${config.emoji} ${theme.name}`)
        .setColor(config.color)
        .setDescription('Aucun joueur n\'a encore participé à ce thème.'),
      totalPages: 1,
      hasMore: false
    };
  }

  // Construire le classement avec barres de progression
  const lines = displayData.map((player, index) => {
    const rank = offset + index;
    const medal = getMedal(rank);
    const requiredItems = theme.required_items || 1; // Éviter division par 0
    const percentage = Math.min(100, Math.round((player.collected_count / requiredItems) * 100));
    const progressBar = buildProgressBar(percentage);

    const isRequester = player.discord_id === requesterId;
    const nameDisplay = isRequester ? `**${player.username}** ⭐` : player.username;

    if (player.is_completed) {
      const completedDate = player.completed_at ? new Date(player.completed_at).toLocaleDateString('fr-FR') : '';
      return `${medal} ${nameDisplay}\n┗ ✅ **COMPLÈTE** ${completedDate ? `le ${completedDate}` : ''} 🎉`;
    }

    return `${medal} ${nameDisplay}\n┗ ${progressBar} ${player.collected_count}/${theme.required_items} (${percentage}%)`;
  });

  // Stats globales
  const stats = await db.queryOne(`
    SELECT
      COUNT(DISTINCT player_id) as total_players,
      COUNT(*) FILTER (WHERE is_completed = TRUE) as completed
    FROM player_progress
    WHERE guild_id = $1 AND theme_id = $2
  `, [guildId, theme.id]);

  const header = buildHeader(config);
  const embed = new EmbedBuilder()
    .setTitle(buildTitle(config, theme.name))
    .setColor(config.color)
    .setDescription(header + '\n' + lines.join('\n\n'))
    .addFields({
      name: '📊 Statistiques du thème',
      value: [
        `👥 **${stats?.total_players || 0}** joueurs actifs`,
        `✅ **${stats?.completed || 0}** collections complètes`,
        `🎯 **${theme.required_items}** items à collecter`
      ].join('\n'),
      inline: false
    })
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages}` });

  // Position du joueur si pas dans la page actuelle
  const requesterInPage = displayData.find(p => p.discord_id === requesterId);
  if (!requesterInPage) {
    const requesterRank = await getPlayerRank(guildId, requesterId, theme.id);
    if (requesterRank) {
      embed.setFooter({
        text: `Page ${page + 1}/${totalPages} • Ta position: #${requesterRank.rank} (${requesterRank.collected}/${theme.required_items})`
      });
    }
  }

  return { embed, totalPages, hasMore };
}

// Leaderboard générique avec pagination
async function buildGenericLeaderboard(guildId, type, requesterId, config, page) {
  const offset = page * ITEMS_PER_PAGE;
  let data, totalCount, statLine;

  switch (type) {
    case 'legendary':
      // Tri par count DESC, puis par date du Nème collectible (pour avoir le premier à atteindre ce score)
      // Note: On compte les collectibles UNIQUES jamais obtenus (même perdus puis récupérés = compte 1 seule fois)
      data = await db.queryAll(`
        WITH player_counts AS (
          SELECT p.id as player_id, p.username, p.discord_id,
                 COUNT(DISTINCT c.collectible_id)::integer as count
          FROM collections c
          JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
          JOIN collectibles col ON c.collectible_id = col.id
          WHERE c.guild_id = $1 AND col.rarity = 'legendary'
          GROUP BY p.id, p.username, p.discord_id
        ),
        nth_dates AS (
          SELECT fo.player_id, MIN(fo.achieved_at) as first_collected_at
          FROM (
            SELECT c.player_id, c.collectible_id, MIN(c.collected_at) as achieved_at,
                   ROW_NUMBER() OVER (PARTITION BY c.player_id ORDER BY MIN(c.collected_at)) as rn
            FROM collections c
            JOIN collectibles col ON c.collectible_id = col.id
            WHERE c.guild_id = $1 AND col.rarity = 'legendary'
            GROUP BY c.player_id, c.collectible_id
          ) fo
          JOIN player_counts pc ON pc.player_id = fo.player_id
          WHERE fo.rn = pc.count
          GROUP BY fo.player_id
        )
        SELECT pc.username, pc.discord_id, pc.count, COALESCE(nd.first_collected_at, NOW()) as achieved_at
        FROM player_counts pc
        LEFT JOIN nth_dates nd ON nd.player_id = pc.player_id
        ORDER BY pc.count DESC, achieved_at ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT c.player_id) as count FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND col.rarity = 'legendary'
      `, [guildId]);
      statLine = (p) => `**${p.count}** légendaire${p.count > 1 ? 's' : ''} 💎`;
      break;

    case 'epic':
      // Tri par count DESC, puis par date du Nème collectible (pour avoir le premier à atteindre ce score)
      // Note: On compte les collectibles UNIQUES jamais obtenus (même perdus puis récupérés = compte 1 seule fois)
      data = await db.queryAll(`
        WITH player_counts AS (
          SELECT p.id as player_id, p.username, p.discord_id,
                 COUNT(DISTINCT c.collectible_id)::integer as count
          FROM collections c
          JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
          JOIN collectibles col ON c.collectible_id = col.id
          WHERE c.guild_id = $1 AND col.rarity = 'epic'
          GROUP BY p.id, p.username, p.discord_id
        ),
        nth_dates AS (
          SELECT fo.player_id, MIN(fo.achieved_at) as first_collected_at
          FROM (
            SELECT c.player_id, c.collectible_id, MIN(c.collected_at) as achieved_at,
                   ROW_NUMBER() OVER (PARTITION BY c.player_id ORDER BY MIN(c.collected_at)) as rn
            FROM collections c
            JOIN collectibles col ON c.collectible_id = col.id
            WHERE c.guild_id = $1 AND col.rarity = 'epic'
            GROUP BY c.player_id, c.collectible_id
          ) fo
          JOIN player_counts pc ON pc.player_id = fo.player_id
          WHERE fo.rn = pc.count
          GROUP BY fo.player_id
        )
        SELECT pc.username, pc.discord_id, pc.count, COALESCE(nd.first_collected_at, NOW()) as achieved_at
        FROM player_counts pc
        LEFT JOIN nth_dates nd ON nd.player_id = pc.player_id
        ORDER BY pc.count DESC, achieved_at ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT c.player_id) as count FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND col.rarity = 'epic'
      `, [guildId]);
      statLine = (p) => `**${p.count}** épique${p.count > 1 ? 's' : ''} 💜`;
      break;

    case 'streak':
      // Utilise current_claim_streak (streak du calendrier quotidien) qui persiste entre les thèmes
      data = await db.queryAll(`
        SELECT username, discord_id, current_claim_streak as count, best_claim_streak
        FROM players
        WHERE guild_id = $1 AND (current_claim_streak > 0 OR best_claim_streak > 0)
        ORDER BY current_claim_streak DESC, best_claim_streak DESC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM players
        WHERE guild_id = $1 AND (current_claim_streak > 0 OR best_claim_streak > 0)
      `, [guildId]);
      statLine = (p) => `🔥 **${p.count}** jour${p.count > 1 ? 's' : ''} ${p.best_claim_streak > p.count ? `(record: ${p.best_claim_streak})` : ''}`;
      break;

    case 'mystery_boxes':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM give_logs gl
        JOIN players p ON gl.winner_id = p.discord_id AND gl.guild_id = p.guild_id
        WHERE gl.guild_id = $1 AND gl.winner_id IS NOT NULL
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC, MIN(gl.created_at) ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT winner_id) as count FROM give_logs WHERE guild_id = $1 AND winner_id IS NOT NULL
      `, [guildId]);
      statLine = (p) => `**${p.count}** box${p.count > 1 ? 'es' : ''} 📦`;
      break;

    case 'missions':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM mission_progress mp
        JOIN players p ON mp.player_id = p.id AND mp.guild_id = p.guild_id
        WHERE mp.guild_id = $1 AND mp.status = 'completed'
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC, MIN(mp.completed_at) ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT player_id) as count FROM mission_progress WHERE guild_id = $1 AND status = 'completed'
      `, [guildId]);
      statLine = (p) => `**${p.count}** mission${p.count > 1 ? 's' : ''} ✅`;
      break;

    case 'badges':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM player_badges pb
        JOIN players p ON pb.player_id = p.id AND pb.guild_id = p.guild_id
        WHERE pb.guild_id = $1
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC, MIN(pb.unlocked_at) ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT player_id) as count FROM player_badges WHERE guild_id = $1
      `, [guildId]);
      statLine = (p) => `**${p.count}** badge${p.count > 1 ? 's' : ''} 🎖️`;
      break;

    case 'traps_blocked':
      data = await db.queryAll(`
        SELECT username, discord_id, traps_blocked as count
        FROM players
        WHERE guild_id = $1 AND traps_blocked > 0
        ORDER BY traps_blocked DESC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM players WHERE guild_id = $1 AND traps_blocked > 0
      `, [guildId]);
      statLine = (p) => `**${p.count}** piège${p.count > 1 ? 's' : ''} bloqué${p.count > 1 ? 's' : ''} 🛡️`;
      break;

    case 'trap_victims':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM trap_triggered tt
        JOIN players p ON tt.player_id = p.id AND tt.guild_id = p.guild_id
        WHERE tt.guild_id = $1
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC, MIN(tt.triggered_at) ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT player_id) as count FROM trap_triggered WHERE guild_id = $1
      `, [guildId]);
      statLine = (p) => `**${p.count}** piège${p.count > 1 ? 's' : ''} subi${p.count > 1 ? 's' : ''} 💀`;
      break;

    case 'joker_masters':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM collections c
        JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
        WHERE c.guild_id = $1 AND c.source = 'joker' AND c.lost_at IS NULL
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC, MIN(c.collected_at) ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT player_id) as count FROM collections WHERE guild_id = $1 AND source = 'joker' AND lost_at IS NULL
      `, [guildId]);
      statLine = (p) => `**${p.count}** item${p.count > 1 ? 's' : ''} via Joker 🃏`;
      break;

    case 'veterans':
      data = await db.queryAll(`
        SELECT username, discord_id, created_at,
               EXTRACT(DAY FROM NOW() - created_at)::integer as days_since
        FROM players
        WHERE guild_id = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`SELECT COUNT(*) as count FROM players WHERE guild_id = $1`, [guildId]);
      statLine = (p) => {
        const date = new Date(p.created_at).toLocaleDateString('fr-FR');
        return `Depuis le **${date}** (${p.days_since}j)`;
      };
      break;

    case 'loomix':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, pc.balance as count
        FROM player_currency pc
        JOIN players p ON pc.player_id = p.id AND pc.guild_id = p.guild_id
        WHERE pc.guild_id = $1 AND pc.currency_type = 'loomix' AND pc.balance > 0
        ORDER BY pc.balance DESC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM player_currency
        WHERE guild_id = $1 AND currency_type = 'loomix' AND balance > 0
      `, [guildId]);
      statLine = (p) => `**${p.count.toLocaleString('fr-FR')}** Loomix 💰`;
      break;

    case 'finishers':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM player_progress pp
        JOIN players p ON pp.player_id = p.id AND pp.guild_id = p.guild_id
        WHERE pp.guild_id = $1 AND pp.is_completed = TRUE
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC, MIN(pp.completed_at) ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT player_id) as count FROM player_progress
        WHERE guild_id = $1 AND is_completed = TRUE
      `, [guildId]);
      statLine = (p) => `**${p.count}** collection${p.count > 1 ? 's' : ''} complétée${p.count > 1 ? 's' : ''} 🏅`;
      break;

    case 'mint_masters':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM collections c
        JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
        WHERE c.guild_id = $1 AND c.mint_number = 1 AND c.lost_at IS NULL
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC, MIN(c.collected_at) ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT player_id) as count FROM collections
        WHERE guild_id = $1 AND mint_number = 1 AND lost_at IS NULL
      `, [guildId]);
      statLine = (p) => `**${p.count}** Mint #1 🥇`;
      break;

    case 'tictactoe_wins':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, ts.games_won as count, ts.games_lost, ts.games_draw, ts.games_played
        FROM tictactoe_stats ts
        JOIN players p ON ts.player_id = p.id AND ts.guild_id = p.guild_id
        WHERE ts.guild_id = $1 AND ts.games_won > 0
        ORDER BY ts.games_won DESC, ts.games_played ASC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM tictactoe_stats
        WHERE guild_id = $1 AND games_won > 0
      `, [guildId]);
      statLine = (p) => `**${p.count}** victoire${p.count > 1 ? 's' : ''} 🏆 (${p.games_played} parties)`;
      break;

    case 'tictactoe_winrate':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id,
               ts.games_won, ts.games_lost, ts.games_draw, ts.games_played,
               ROUND(ts.games_won::numeric / NULLIF(ts.games_played, 0) * 100, 1) as winrate
        FROM tictactoe_stats ts
        JOIN players p ON ts.player_id = p.id AND ts.guild_id = p.guild_id
        WHERE ts.guild_id = $1 AND ts.games_played >= 5
        ORDER BY winrate DESC, ts.games_won DESC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM tictactoe_stats
        WHERE guild_id = $1 AND games_played >= 5
      `, [guildId]);
      statLine = (p) => `**${p.winrate}%** win rate 📊 (${p.games_won}W/${p.games_lost}L/${p.games_draw}D)`;
      break;

    default:
      return {
        embed: new EmbedBuilder()
          .setTitle('❌ Type inconnu')
          .setColor('#E74C3C')
          .setDescription('Ce type de classement n\'existe pas.'),
        totalPages: 1,
        hasMore: false
      };
  }

  const hasMore = data.length > ITEMS_PER_PAGE;
  const displayData = data.slice(0, ITEMS_PER_PAGE);
  const totalPages = Math.ceil((totalCount?.count || 0) / ITEMS_PER_PAGE);

  if (displayData.length === 0) {
    const header = buildHeader(config);
    return {
      embed: new EmbedBuilder()
        .setTitle(buildTitle(config))
        .setColor(config.color)
        .setDescription(header + '\n*Aucune donnée disponible pour ce classement.*'),
      totalPages: 1,
      hasMore: false
    };
  }

  const lines = displayData.map((player, index) => {
    const rank = offset + index;
    const medal = getMedal(rank);
    const isRequester = player.discord_id === requesterId;
    const nameDisplay = isRequester ? `**${player.username}** ⭐` : player.username;

    return `${medal} ${nameDisplay}\n┗ ${statLine(player)}`;
  });

  const header = buildHeader(config);
  const embed = new EmbedBuilder()
    .setTitle(buildTitle(config))
    .setColor(config.color)
    .setDescription(header + '\n' + lines.join('\n\n'))
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${totalCount?.count || 0} joueurs` });

  return { embed, totalPages, hasMore };
}

// === UTILITAIRES ===

// Obtenir la médaille selon le rang
function getMedal(index) {
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  if (index < 10) return medals[index];
  return `\`${index + 1}.\``;
}

// Construire une barre de progression visuelle
function buildProgressBar(percentage) {
  // Limiter le pourcentage entre 0 et 100
  const clampedPercentage = Math.max(0, Math.min(100, percentage || 0));
  const filled = Math.round(clampedPercentage / 10);
  const empty = 10 - filled;
  return `${'▓'.repeat(filled)}${'░'.repeat(empty)}`;
}

// Formater une durée en heures/jours
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `${days}j ${remainingHours}h`;
  }
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Ajouter la position du requester si pas visible
async function addRequesterPosition(embed, guildId, requesterId, displayData, type, page) {
  const requesterInPage = displayData.find(p => p.discord_id === requesterId);
  if (requesterInPage) return;

  // Pour l'instant, on garde le footer simple
  // TODO: Calculer la position exacte du joueur pour chaque type
}

// Obtenir le rang d'un joueur spécifique (avec tri par completed_at)
async function getPlayerRank(guildId, discordId, themeId) {
  const result = await db.queryOne(`
    SELECT
      pp.collected_count as collected,
      pp.is_completed,
      (SELECT COUNT(*) + 1
       FROM player_progress pp2
       WHERE pp2.guild_id = $1 AND pp2.theme_id = $2
         AND (
           (pp2.is_completed = TRUE AND pp.is_completed = FALSE)
           OR (pp2.is_completed = pp.is_completed AND pp2.is_completed = TRUE AND pp2.completed_at < pp.completed_at)
           OR (pp2.is_completed = pp.is_completed AND pp2.is_completed = FALSE AND pp2.collected_count > pp.collected_count)
         )
      ) as rank
    FROM player_progress pp
    JOIN players p ON pp.player_id = p.id AND pp.guild_id = p.guild_id
    WHERE pp.guild_id = $1 AND pp.theme_id = $2 AND p.discord_id = $3
  `, [guildId, themeId, discordId]);

  return result;
}
