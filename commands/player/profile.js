const { SlashCommandBuilder } = require('discord.js');
const db = require('../../utils/database-pg');
const { showOverview } = require('../../views/profileView');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Voir ta progression et tes statistiques avec interface interactive'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 }); // Éphémère par défaut

    try {
      const guildId = interaction.guildId;

      // Récupérer le thème actif
      const theme = await db.getActiveTheme(guildId);

      if (!theme) {
        return interaction.editReply({
          content: '❌ Aucun thème actif pour le moment.',
        });
      }

      // Récupérer le joueur (AVEC guildId)
      let player = await db.getPlayerByDiscordId(guildId, interaction.user.id);

      if (!player) {
        // Créer automatiquement le joueur s'il n'existe pas
        const newPlayerId = await db.createPlayer(
          guildId,
          interaction.user.id,
          interaction.user.username
        );

        // Créer la progression pour le thème actif avec collected_count=0
        await db.query(`
          INSERT INTO player_progress (guild_id, player_id, theme_id, collected_count, started_at)
          VALUES ($1, $2, $3, 0, NOW())
          ON CONFLICT (guild_id, player_id, theme_id) DO NOTHING
        `, [guildId, newPlayerId, theme.id]);

        // Récupérer le nouveau joueur
        player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
      }

      // Récupérer la progression (AVEC guildId)
      let progress = await db.getPlayerProgress(guildId, player.id, theme.id);

      // Créer la progression si elle n'existe pas
      if (!progress) {
        await db.query(`
          INSERT INTO player_progress (guild_id, player_id, theme_id, collected_count, started_at)
          VALUES ($1, $2, $3, 0, NOW())
          ON CONFLICT (guild_id, player_id, theme_id) DO NOTHING
        `, [guildId, player.id, theme.id]);

        progress = await db.getPlayerProgress(guildId, player.id, theme.id);
      }

      // Afficher la vue Overview (vue par défaut)
      const content = await showOverview(interaction, player, theme, progress);
      await interaction.editReply(content);

    } catch (error) {
      console.error('🔴 Erreur /profile:', error);
      await interaction.editReply({
        content: '❌ Une erreur est survenue. Réessaye ou contacte un administrateur.',
        components: []
      });
    }
  }
};
