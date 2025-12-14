const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const permissions = require('../../utils/permissions');
const { buildAdminPanelContent } = require('../../handlers/adminPanelHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-panel')
    .setDescription('[ADMIN] Panneau d\'administration et configuration'),
    // Note: Pas de setDefaultMemberPermissions pour permettre aux Super Admins
    // d'accéder même sans rôle Administrator Discord. La vérification se fait
    // via permissions.canAccessAdminPanel() qui gère les 3 niveaux de permissions.

  async execute(interaction) {
    try {
      // Defer IMMEDIATEMENT avant toute autre operation
      await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL

      // Verifier les permissions via le systeme centralise
      const hasAccess = await permissions.canAccessAdminPanel(interaction);

      if (!hasAccess) {
        return interaction.editReply({
          content: '❌ Vous n\'avez pas acces au panneau d\'administration.\n\n' +
                   '💡 Le proprietaire du serveur peut configurer les roles admin via `/setup`.'
        });
      }

      // Utiliser la fonction partagee (meme contenu que le refresh)
      const { embed, components } = await buildAdminPanelContent(interaction.guildId);

      return interaction.editReply({
        embeds: [embed],
        components: components
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage du panneau admin:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`
      });
    }
  }
};
