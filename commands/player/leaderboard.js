const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Voir les classements du serveur')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type de classement à afficher')
        .setRequired(false)
        .addChoices(
          { name: '🏆 Collection (thème actif)', value: 'collection' },
          { name: '💎 Chasseurs Légendaires', value: 'legendary' },
          { name: '💜 Chasseurs Épiques', value: 'epic' },
          { name: '🔥 Meilleurs Streaks', value: 'streak' },
          { name: '📦 Mystery Boxes ouvertes', value: 'mystery_boxes' },
          { name: '✅ Missions complétées', value: 'missions' },
          { name: '🎖️ Collection de Badges', value: 'badges' },
          { name: '🛡️ Survivants (pièges bloqués)', value: 'traps_blocked' },
          { name: '💀 Victimes des Pièges', value: 'trap_victims' },
          { name: '🃏 Maîtres du Joker', value: 'joker_masters' },
          { name: '⭐ Vétérans', value: 'veterans' }
        )),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      const type = interaction.options.getString('type') || 'collection';

      const embed = await buildLeaderboardEmbed(guildId, type, interaction.user.id);
      const selectMenu = buildSelectMenu(type);

      await interaction.editReply({
        embeds: [embed],
        components: [selectMenu]
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

      const embed = await buildLeaderboardEmbed(guildId, type, interaction.user.id);
      const selectMenu = buildSelectMenu(type);

      await interaction.editReply({
        embeds: [embed],
        components: [selectMenu]
      });
    } catch (error) {
      console.error('🔴 Erreur leaderboard select:', error);
    }
  }
};

// Construire le select menu
function buildSelectMenu(currentType) {
  const options = Object.entries(LEADERBOARD_TYPES).map(([value, config]) => ({
    label: config.name,
    description: config.description.substring(0, 50),
    value: value,
    emoji: config.emoji,
    default: value === currentType
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('leaderboard_type_select')
    .setPlaceholder('Changer de classement...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

// Construire l'embed du leaderboard
async function buildLeaderboardEmbed(guildId, type, requesterId) {
  const config = LEADERBOARD_TYPES[type];
  let data, title, statLine;

  switch (type) {
    case 'collection':
      return await buildCollectionLeaderboard(guildId, requesterId, config);

    case 'legendary':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*) as count
        FROM collections c
        JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND col.rarity = 'legendary' AND c.lost_at IS NULL
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT 10
      `, [guildId]);
      title = 'Chasseurs Légendaires';
      statLine = (p) => `**${p.count}** légendaire${p.count > 1 ? 's' : ''}`;
      break;

    case 'streak':
      data = await db.queryAll(`
        SELECT username, discord_id, current_login_streak as count, best_login_streak
        FROM players
        WHERE guild_id = $1 AND (current_login_streak > 0 OR best_login_streak > 0)
        ORDER BY current_login_streak DESC, best_login_streak DESC
        LIMIT 10
      `, [guildId]);
      title = 'Meilleurs Streaks';
      statLine = (p) => `🔥 **${p.count}** jour${p.count > 1 ? 's' : ''} ${p.best_login_streak > p.count ? `(record: ${p.best_login_streak})` : ''}`;
      break;

    case 'mystery_boxes':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*) as count
        FROM collections c
        JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
        WHERE c.guild_id = $1 AND c.source IN ('mystery_box', 'campaign')
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT 10
      `, [guildId]);
      title = 'Mystery Boxes Ouvertes';
      statLine = (p) => `**${p.count}** box${p.count > 1 ? 'es' : ''}`;
      break;

    case 'missions':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*) as count
        FROM mission_progress mp
        JOIN players p ON mp.player_id = p.id AND mp.guild_id = p.guild_id
        WHERE mp.guild_id = $1 AND mp.status = 'completed'
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT 10
      `, [guildId]);
      title = 'Maîtres des Missions';
      statLine = (p) => `**${p.count}** mission${p.count > 1 ? 's' : ''} ✅`;
      break;

    case 'badges':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*) as count
        FROM player_badges pb
        JOIN players p ON pb.player_id = p.id
        WHERE p.guild_id = $1
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT 10
      `, [guildId]);
      title = 'Collectionneurs de Badges';
      statLine = (p) => `**${p.count}** badge${p.count > 1 ? 's' : ''} 🎖️`;
      break;

    case 'traps_blocked':
      data = await db.queryAll(`
        SELECT username, discord_id, traps_blocked as count
        FROM players
        WHERE guild_id = $1 AND traps_blocked > 0
        ORDER BY traps_blocked DESC
        LIMIT 10
      `, [guildId]);
      title = 'Survivants';
      statLine = (p) => `**${p.count}** piège${p.count > 1 ? 's' : ''} bloqué${p.count > 1 ? 's' : ''} 🛡️`;
      break;

    case 'epic':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*) as count
        FROM collections c
        JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND col.rarity = 'epic' AND c.lost_at IS NULL
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT 10
      `, [guildId]);
      title = 'Chasseurs Épiques';
      statLine = (p) => `**${p.count}** épique${p.count > 1 ? 's' : ''} 💜`;
      break;

    case 'trap_victims':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*) as count
        FROM trap_triggered tt
        JOIN players p ON tt.player_id = p.id AND tt.guild_id = p.guild_id
        WHERE tt.guild_id = $1
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT 10
      `, [guildId]);
      title = 'Victimes des Pièges';
      statLine = (p) => `**${p.count}** piège${p.count > 1 ? 's' : ''} subi${p.count > 1 ? 's' : ''} 💀`;
      break;

    case 'joker_masters':
      data = await db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(*) as count
        FROM collections c
        JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
        WHERE c.guild_id = $1 AND c.source = 'joker' AND c.lost_at IS NULL
        GROUP BY p.id, p.username, p.discord_id
        ORDER BY count DESC
        LIMIT 10
      `, [guildId]);
      title = 'Maîtres du Joker';
      statLine = (p) => `**${p.count}** item${p.count > 1 ? 's' : ''} via Joker 🃏`;
      break;

    case 'veterans':
      data = await db.queryAll(`
        SELECT username, discord_id, created_at,
               EXTRACT(DAY FROM NOW() - created_at)::integer as days_since
        FROM players
        WHERE guild_id = $1
        ORDER BY created_at ASC
        LIMIT 10
      `, [guildId]);
      title = 'Vétérans';
      statLine = (p) => {
        const date = new Date(p.created_at).toLocaleDateString('fr-FR');
        return `Depuis le **${date}** (${p.days_since} jours)`;
      };
      break;

    default:
      return await buildCollectionLeaderboard(guildId, requesterId, config);
  }

  return buildGenericEmbed(data, title, config, statLine, requesterId);
}

// Embed pour collection (cas spécial avec thème)
async function buildCollectionLeaderboard(guildId, requesterId, config) {
  const theme = await db.getActiveTheme(guildId);

  if (!theme) {
    return new EmbedBuilder()
      .setTitle('❌ Aucun thème actif')
      .setColor('#E74C3C')
      .setDescription('Il n\'y a pas de thème actif sur ce serveur.');
  }

  const leaderboard = await db.getLeaderboard(guildId, theme.id, 10);

  if (leaderboard.length === 0) {
    return new EmbedBuilder()
      .setTitle(`${config.emoji} ${theme.name}`)
      .setColor(config.color)
      .setDescription('Aucun joueur n\'a encore participé à ce thème.');
  }

  // Construire le classement avec barres de progression
  const lines = leaderboard.map((player, index) => {
    const medal = getMedal(index);
    const percentage = Math.round((player.collected_count / theme.required_items) * 100);
    const progressBar = buildProgressBar(percentage);

    const isRequester = player.discord_id === requesterId;
    const nameDisplay = isRequester ? `**${player.username}** ⭐` : player.username;

    if (player.is_completed) {
      return `${medal} ${nameDisplay}\n┗ ✅ **COLLECTION COMPLÈTE** 🎉`;
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
    .setFooter({ text: 'Mis à jour' });

  // Position du joueur si pas dans le top 10
  const requesterInTop = leaderboard.find(p => p.discord_id === requesterId);
  if (!requesterInTop) {
    const requesterRank = await getPlayerRank(guildId, requesterId, theme.id);
    if (requesterRank) {
      embed.setFooter({
        text: `Ta position: #${requesterRank.rank} • ${requesterRank.collected}/${theme.required_items}`
      });
    }
  }

  return embed;
}

// Embed générique pour autres types
function buildGenericEmbed(data, title, config, statLine, requesterId) {
  if (!data || data.length === 0) {
    return new EmbedBuilder()
      .setTitle(`${config.emoji} ${title}`)
      .setColor(config.color)
      .setDescription('Aucune donnée disponible pour ce classement.');
  }

  const lines = data.map((player, index) => {
    const medal = getMedal(index);
    const isRequester = player.discord_id === requesterId;
    const nameDisplay = isRequester ? `**${player.username}** ⭐` : player.username;

    return `${medal} ${nameDisplay}\n┗ ${statLine(player)}`;
  });

  return new EmbedBuilder()
    .setTitle(`${config.emoji} ${title}`)
    .setColor(config.color)
    .setDescription(lines.join('\n\n'))
    .setTimestamp()
    .setFooter({ text: `Top ${data.length} joueurs • Mis à jour` });
}

// Obtenir la médaille selon le rang
function getMedal(index) {
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  return medals[index] || `${index + 1}.`;
}

// Construire une barre de progression visuelle
function buildProgressBar(percentage) {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;

  const filledChar = '▓';
  const emptyChar = '░';

  return `${filledChar.repeat(filled)}${emptyChar.repeat(empty)}`;
}

// Obtenir le rang d'un joueur spécifique
async function getPlayerRank(guildId, discordId, themeId) {
  const result = await db.queryOne(`
    SELECT
      pp.collected_count as collected,
      (SELECT COUNT(*) + 1
       FROM player_progress pp2
       WHERE pp2.guild_id = $1 AND pp2.theme_id = $2
         AND pp2.collected_count > pp.collected_count) as rank
    FROM player_progress pp
    JOIN players p ON pp.player_id = p.id AND pp.guild_id = p.guild_id
    WHERE pp.guild_id = $1 AND pp.theme_id = $2 AND p.discord_id = $3
  `, [guildId, themeId, discordId]);

  return result;
}
