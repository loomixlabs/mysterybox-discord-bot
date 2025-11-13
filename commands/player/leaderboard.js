const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database-pg');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Voir le classement des meilleurs chasseurs'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Récupérer le thème actif
      const theme = await db.getActiveTheme(interaction.guildId);

      if (!theme) {
        return interaction.editReply({
          content: '❌ Aucun thème actif pour le moment.',
        });
      }

      // Récupérer le leaderboard
      const leaderboard = await db.getLeaderboard(interaction.guildId, theme.id, 10);

      if (leaderboard.length === 0) {
        return interaction.editReply({
          content: '❌ Aucun joueur n\'a encore participé à ce thème.',
        });
      }

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setTitle(`🏆 Top Chasseurs - ${theme.name}`)
        .setColor('#FFD700')
        .setDescription('Les meilleurs collectionneurs du serveur !')
        .setTimestamp();

      // Créer la liste
      const list = leaderboard.map((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const status = player.is_completed
          ? `✅ **COMPLÉTÉ**`
          : `${player.collected_count}/${theme.required_items}`;

        return `${medal} **${player.username}** - ${status}`;
      }).join('\n');

      embed.addFields({
        name: '📊 Classement',
        value: list,
        inline: false
      });

      // Statistiques globales
      const totalPlayers = await db.queryOne(
        'SELECT COUNT(DISTINCT player_id) as count FROM player_progress WHERE theme_id = $1',
        [theme.id]
      );

      const completedPlayers = await db.queryOne(
        'SELECT COUNT(*) as count FROM player_progress WHERE theme_id = $1 AND is_completed = TRUE',
        [theme.id]
      );

      embed.addFields({
        name: '📈 Statistiques',
        value: `Joueurs actifs: ${totalPlayers?.count || 0}\nCollections complétées: ${completedPlayers?.count || 0}`,
        inline: false
      });

      // Position du joueur demandant
      const player = await db.getPlayerByDiscordId(interaction.guildId, interaction.user.id);

      if (player) {
        const progress = await db.getPlayerProgress(interaction.guildId, player.id, theme.id);

        if (progress) {
          const userRank = leaderboard.findIndex(p => p.discord_id === interaction.user.id) + 1;

          if (userRank > 0) {
            embed.setFooter({
              text: `Ta position: ${userRank}ème - ${progress.collected_count}/${theme.required_items}`
            });
          }
        }
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('🔴 Erreur /leaderboard:', error);
      await interaction.editReply({
        content: '❌ Une erreur est survenue.',
      });
    }
  }
};
