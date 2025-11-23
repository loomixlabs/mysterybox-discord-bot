const permissions = require('../utils/permissions');
const setupCommand = require('../commands/admin/setup');
const announcementTemplates = require('../utils/announcementTemplates');
const BotRoleManager = require('../utils/botRoleManager');
const db = require('../utils/database-pg');
const setupThemeHandler = require('./setupThemeHandler');

/**
 * Gérer la sélection des rôles admin
 */
async function handleRoleSelect(interaction) {
  await interaction.deferUpdate();

  const selectedRoles = interaction.values; // Array de role IDs

  // Réinitialiser les rôles actuels
  await permissions.resetAdminRoles(interaction.guildId);

  // Ajouter les nouveaux rôles sélectionnés
  for (const roleId of selectedRoles) {
    await permissions.addAdminRole(interaction.guildId, roleId, interaction.user.id);
  }

  console.log(`✅ ${selectedRoles.length} rôle(s) admin configuré(s) pour le serveur ${interaction.guildId}`);

  // Rafraîchir l'affichage
  await setupCommand.showRoleConfiguration(interaction);
}

/**
 * Valider les rôles et passer à l'étape 2 (Sélection du thème)
 */
async function handleValidateRoles(interaction) {
  await interaction.deferUpdate();

  const currentRoles = await permissions.getAdminRoles(interaction.guildId);

  if (currentRoles.length === 0) {
    // Avertir l'utilisateur mais permettre de continuer
    await interaction.followUp({
      content: '⚠️ **Aucun rôle configuré**\n\n' +
               'Tant qu\'aucun rôle n\'est configuré, seul le propriétaire du serveur pourra accéder à `/admin-panel`.\n\n' +
               '💡 Vous pouvez revenir modifier les rôles plus tard avec `/setup`.',
      flags: 64 // EPHEMERAL
    });
  }

  // Passer à l'étape 2 : Sélection du thème préconfigurés
  await setupThemeHandler.showThemeSelection(interaction);
}

/**
 * Réinitialiser tous les rôles admin
 */
async function handleResetRoles(interaction) {
  await interaction.deferUpdate();

  await permissions.resetAdminRoles(interaction.guildId);
  console.log(`✅ Rôles admin réinitialisés pour le serveur ${interaction.guildId}`);

  // Rafraîchir l'affichage
  await setupCommand.showRoleConfiguration(interaction);
}

/**
 * Passer directement à la sélection de thème (sans valider les rôles)
 */
async function handleSkipToChecklist(interaction) {
  await interaction.deferUpdate();
  await setupThemeHandler.showThemeSelection(interaction);
}

/**
 * Retour à la configuration des rôles depuis le checklist
 */
async function handleBackToRoles(interaction) {
  await interaction.deferUpdate();
  await setupCommand.showRoleConfiguration(interaction);
}

/**
 * Terminer la configuration
 */
async function handleFinish(interaction) {
  await interaction.deferUpdate();

  const currentRoles = await permissions.getAdminRoles(interaction.guildId);

  let message = '✅ **Configuration terminée !**\n\n';

  if (currentRoles.length === 0) {
    message += '⚠️ **Aucun rôle configuré:** Seul le propriétaire du serveur peut accéder à `/admin-panel`.\n\n';
  } else {
    message += `✅ **${currentRoles.length} rôle(s) configuré(s)** pour l'accès à l'admin panel.\n\n`;
  }

  // Afficher les informations sur le thème actif s'il y en a un
  try {
    const activeTheme = await db.getActiveTheme(interaction.guildId);
    if (activeTheme) {
      message += `🎨 **Thème actif:** ${activeTheme.name}\n`;
      message += `   • Items requis: ${activeTheme.required_items}\n`;
      message += `   • Durée: ${activeTheme.duration_days} jours\n`;

      // Afficher le rôle de complétion
      if (activeTheme.final_role_discord_id) {
        message += `   • Rôle de complétion: <@&${activeTheme.final_role_discord_id}>\n`;
      } else if (activeTheme.final_role_name) {
        message += `   • Rôle de complétion: ${activeTheme.final_role_name}\n`;
      }
      message += '\n';
    }
  } catch (error) {
    console.error('⚠️ Erreur lors de la récupération du thème actif:', error);
  }

  // Créer automatiquement les templates d'annonces par défaut
  try {
    const templatesCreated = await announcementTemplates.createDefaultTemplatesForGuild(interaction.guildId);
    await announcementTemplates.createDefaultAnnouncementSettings(interaction.guildId);

    if (templatesCreated > 0) {
      console.log(`✅ ${templatesCreated} template(s) d'annonces créé(s) pour le serveur ${interaction.guildId}`);
      message += `✅ **${templatesCreated} template(s) d'annonces** créé(s) automatiquement.\n\n`;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création des templates d\'annonces:', error);
    message += '⚠️ **Erreur lors de la création des templates d\'annonces** (non bloquant).\n\n';
  }

  // Créer le rôle dédié au bot pour la personnalisation de couleur
  try {
    const branding = await db.getGuildBranding(interaction.guildId);
    const botRole = await BotRoleManager.createOrGetBotRole(
      interaction.guild,
      branding.bot_display_name,
      branding.primary_color
    );

    console.log(`✅ Rôle bot créé/récupéré: ${botRole.name} (${botRole.id})`);
    message += `✅ **Rôle bot créé:** ${botRole.name}\n` +
               `   • Couleur: ${botRole.hexColor} ■\n` +
               `   • Ce rôle permet de personnaliser la couleur du bot dans Discord\n\n` +
               `⚠️  **Important:** Pour que la couleur soit visible, vous devez remonter ce rôle dans la hiérarchie.\n` +
               `   → Utilisez \`/server-config\` puis consultez le tutoriel de positionnement du rôle.\n\n`;
  } catch (error) {
    console.error('❌ Erreur lors de la création du rôle bot:', error);
    message += '⚠️ **Erreur lors de la création du rôle bot** (non bloquant).\n\n';
  }

  message += '**Prochaines étapes:**\n' +
             '1. Utilisez `/admin-panel` pour créer votre premier thème\n' +
             '2. Ajoutez du contenu aux missions (mots-clés + questions)\n' +
             '3. Créez vos collectibles\n' +
             '4. Configurez les canaux de give\n\n' +
             '💡 Vous pouvez relancer `/setup` à tout moment pour modifier les rôles.';

  await interaction.editReply({
    content: message,
    embeds: [],
    components: []
  });
}

module.exports = {
  handleRoleSelect,
  handleValidateRoles,
  handleResetRoles,
  handleSkipToChecklist,
  handleBackToRoles,
  handleFinish,
  // Theme handlers (délégués à setupThemeHandler)
  handleThemeSelect: setupThemeHandler.handleThemeSelect,
  handleThemeImport: setupThemeHandler.handleThemeImport,
  handleThemeBack: setupThemeHandler.handleThemeBack,
  handleSkipTheme: setupThemeHandler.handleSkipTheme,
  showThemeSelection: setupThemeHandler.showThemeSelection
};
