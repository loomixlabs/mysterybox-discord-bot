const { SlashCommandBuilder } = require('discord.js');
const { showTutorialHome } = require('../../views/tutorialView');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tutoriel')
    .setDescription('Guide interactif pour comprendre le jeu MysteryBox'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 }); // Éphémère

    try {
      const content = await showTutorialHome(interaction);
      await interaction.editReply(content);

    } catch (error) {
      console.error('🔴 Erreur /tutoriel:', error);
      await interaction.editReply({
        content: '❌ Une erreur est survenue. Réessaye plus tard.',
        components: []
      });
    }
  }
};
