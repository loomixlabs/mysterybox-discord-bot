const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const permissions = require('../../utils/permissions');
const ServerConfigHandler = require('../../handlers/serverConfigHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-config')
    .setDescription('[BOT CORE] Configuration globale du serveur (branding, paramètres)'),
    // Note: Pas de setDefaultMemberPermissions pour permettre aux Super Admins
    // d'accéder même sans rôle Administrator Discord. Vérification dans execute().

  async execute(interaction) {
    try {
      // Déférer IMMÉDIATEMENT
      await interaction.deferReply({ flags: 64 }); // EPHEMERAL

      // Vérifier les permissions (owner, admin roles, ou super-admin)
      const hasAccess = await permissions.canAccessAdminPanel(interaction);

      if (!hasAccess) {
        return interaction.editReply({
          content: '❌ Vous n\'avez pas accès à la configuration du serveur.\n\n' +
                   '💡 Seuls le propriétaire du serveur et les administrateurs autorisés peuvent configurer le bot.'
        });
      }

      // Appeler le handler pour afficher le menu principal
      const handler = new ServerConfigHandler();
      await handler.showMainMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur dans /server-config:', error);

      const errorMessage = {
        content: '❌ Une erreur est survenue lors de l\'accès à la configuration.',
        embeds: [],
        components: []
      };

      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ ...errorMessage, flags: 64 });
      }
    }
  }
};
