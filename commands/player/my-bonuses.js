const { SlashCommandBuilder } = require('discord.js');
const { createActiveBonusesEmbed } = require('../../handlers/superBonusHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('my-bonuses')
    .setDescription('Voir mes super bonus actifs'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const embed = await createActiveBonusesEmbed(
        interaction.user.id,
        interaction.user.username
      );

      return interaction.editReply({
        embeds: [embed],
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage des bonus actifs:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }
};
