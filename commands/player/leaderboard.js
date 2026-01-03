const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database-pg');

// Configuration des types de leaderboard
const LEADERBOARD_TYPES = {
  collection: {
    name: 'Collection',
    emoji: '🏆',
    description: 'Progression dans la collection actuelle',
    color: '#FFD700'
  },
  legendary: {
    name: 'Chasseurs Légendaires',
    emoji: '💎',
    description: 'Nombre de légendaires obtenus',
    color: '#9B59B6'
  },
  epic: {
    name: 'Chasseurs Épiques',
    emoji: '💜',
    description: 'Nombre d\'épiques obtenus',
    color: '#8E44AD'
  },
  lucky: {
    name: 'Les Chanceux',
    emoji: '🍀',
    description: 'Meilleur ratio de légendaires',
    color: '#27AE60'
  },
  speedrunners: {
    name: 'Speedrunners',
    emoji: '⚡',
    description: 'Collection complétée le plus vite',
    color: '#F1C40F'
  },
  mission_accuracy: {
    name: 'Précision Missions',
    emoji: '🎯',
    description: 'Meilleur taux de réussite missions',
    color: '#3498DB'
  },
  streak: {
    name: 'Streaks',
    emoji: '🔥',
    description: 'Jours consécutifs de connexion',
    color: '#E74C3C'
  },
  mystery_boxes: {
    name: 'Mystery Boxes',
    emoji: '📦',
    description: 'Nombre de mystery boxes ouvertes',
    color: '#3498DB'
  },
  missions: {
    name: 'Missions',
    emoji: '✅',
    description: 'Missions complétées avec succès',
    color: '#2ECC71'
  },
  badges: {
    name: 'Badges',
    emoji: '🎖️',
    description: 'Collection de badges',
    color: '#F39C12'
  },
  traps_blocked: {
    name: 'Survivants',
    emoji: '🛡️',
    description: 'Pièges bloqués avec le bouclier',
    color: '#1ABC9C'
  },
  trap_victims: {
    name: 'Victimes des Pièges',
    emoji: '💀',
    description: 'Nombre de pièges déclenchés',
    color: '#E74C3C'
  },
  joker_masters: {
    name: 'Maîtres du Joker',
    emoji: '🃏',
    description: 'Collectibles obtenus via Joker',
    color: '#E91E63'
  },
  veterans: {
    name: 'Vétérans',
    emoji: '⭐',
    description: 'Les plus anciens joueurs',
    color: '#95A5A6'
  }
};

const ITEMS_PER_PAGE = 10;

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

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} ${config.name}`)
    .setColor(config.color)
    .setDescription(lines.join('\n\n'))
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages} • Min 5 collectibles requis` });

  // Position du joueur
  await addRequesterPosition(embed, guildId, requesterId, displayData, 'lucky', page);

  return { embed, totalPages, hasMore };
}

// Classement Speedrunners
async function buildSpeedrunnerLeaderboard(guildId, requesterId, config, page) {
  const offset = page * ITEMS_PER_PAGE;

  const data = await db.queryAll(`
    SELECT p.username, p.discord_id, pp.started_at, pp.completed_at,
           EXTRACT(EPOCH FROM (pp.completed_at - pp.started_at)) as seconds_to_complete
    FROM player_progress pp
    JOIN players p ON pp.player_id = p.id AND pp.guild_id = p.guild_id
    WHERE pp.guild_id = $1 AND pp.is_completed = TRUE AND pp.completed_at IS NOT NULL
    ORDER BY (pp.completed_at - pp.started_at) ASC
    LIMIT $2 OFFSET $3
  `, [guildId, ITEMS_PER_PAGE + 1, offset]);

  const hasMore = data.length > ITEMS_PER_PAGE;
  const displayData = data.slice(0, ITEMS_PER_PAGE);

  const totalCount = await db.queryOne(`
    SELECT COUNT(*) as count FROM player_progress
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

    return `${medal} ${nameDisplay}\n┗ ⚡ **${duration}** (terminé le ${completedDate})`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} ${config.name}`)
    .setColor(config.color)
    .setDescription(lines.join('\n\n'))
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages} • Temps pour compléter la collection` });

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

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} ${config.name}`)
    .setColor(config.color)
    .setDescription(lines.join('\n\n'))
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages} • Min 3 missions terminées` });

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
    const percentage = Math.round((player.collected_count / theme.required_items) * 100);
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

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} Top Chasseurs - ${theme.name}`)
    .setColor(config.color)
    .setDescription(lines.join('\n\n'))
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
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM collections c
        JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND col.rarity = 'legendary' AND c.lost_at IS NULL
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT c.player_id) as count FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND col.rarity = 'legendary' AND c.lost_at IS NULL
      `, [guildId]);
      statLine = (p) => `**${p.count}** légendaire${p.count > 1 ? 's' : ''} 💎`;
      break;

    case 'epic':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*)::integer as count
        FROM collections c
        JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND col.rarity = 'epic' AND c.lost_at IS NULL
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT $2 OFFSET $3
      `, [guildId, ITEMS_PER_PAGE + 1, offset]);
      totalCount = await db.queryOne(`
        SELECT COUNT(DISTINCT c.player_id) as count FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND col.rarity = 'epic' AND c.lost_at IS NULL
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
        ORDER BY count DESC
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
        ORDER BY count DESC
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
        ORDER BY count DESC
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
        ORDER BY count DESC
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
        ORDER BY count DESC
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
    return {
      embed: new EmbedBuilder()
        .setTitle(`${config.emoji} ${config.name}`)
        .setColor(config.color)
        .setDescription('Aucune donnée disponible pour ce classement.'),
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

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} ${config.name}`)
    .setColor(config.color)
    .setDescription(lines.join('\n\n'))
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
  const filled = Math.round(percentage / 10);
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
