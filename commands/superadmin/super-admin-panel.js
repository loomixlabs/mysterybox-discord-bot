/**
 * Commande /super-admin-panel
 *
 * Interface de gestion multi-serveur réservée aux super-admins
 * (développeurs du bot uniquement)
 */

const { SlashCommandBuilder } = require('discord.js');
const superAdminHandler = require('../../handlers/superAdminHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('super-admin-panel')
    .setDescription('[DEV] Interface de gestion multi-serveur'),

  async execute(interaction) {
    // Vérifier si l'utilisateur est super-admin
    const isSuperAdmin = await superAdminHandler.isSuperAdmin(interaction.user.id);

    if (!isSuperAdmin) {
      return interaction.reply({
        content: '❌ Cette commande est réservée aux développeurs du bot.',
        flags: 64
      });
    }

    // Afficher le panneau principal
    await superAdminHandler.showMainPanel(interaction);
  }
};
