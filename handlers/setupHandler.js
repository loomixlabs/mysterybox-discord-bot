const permissions = require('../utils/permissions');
const setupCommand = require('../commands/admin/setup');
const announcementTemplates = require('../utils/announcementTemplates');
const BotRoleManager = require('../utils/botRoleManager');
const db = require('../utils/database-pg');
const setupThemeHandler = require('./setupThemeHandler');
const setupDiagnostic = require('../utils/setupDiagnostic');

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
  let botRoleInfo = null;
  let needsRolePositionWarning = true;

  try {
    const branding = await db.getGuildBranding(interaction.guildId);
    const botRole = await BotRoleManager.createOrGetBotRole(
      interaction.guild,
      branding.bot_display_name,
      branding.primary_color
    );

    botRoleInfo = { name: botRole.name, color: botRole.hexColor, position: botRole.position };
    console.log(`✅ Rôle bot créé/récupéré: ${botRole.name} (${botRole.id})`);

    // Vérifier si le rôle est bien positionné (pas tout en bas)
    if (botRole.position > 1) {
      needsRolePositionWarning = false;
    }

    message += `✅ **Rôle couleur:** ${botRole.name}\n` +
               `   • Couleur: ${botRole.hexColor} ■\n` +
               `   • Ce rôle permet de personnaliser la couleur du bot dans Discord\n\n`;
  } catch (error) {
    console.error('❌ Erreur lors de la création du rôle bot:', error);
    message += '⚠️ **Erreur lors de la création du rôle bot** (non bloquant).\n\n';
  }

  // Afficher l'avertissement de positionnement seulement si nécessaire
  if (needsRolePositionWarning) {
    const botUsername = interaction.client.user.username;
    message += '**🔴 Configuration détectée incorrecte**\n' +
               '**Action requise:** Repositionnez les rôles du bot dans la hiérarchie.\n\n' +
               '```\n' +
               'Paramètres serveur → Rôles\n' +
               '─────────────────────────────\n' +
               '@Fondateur         ← peut rester ici\n' +
               '@Administrateur    ← peut rester ici\n' +
               '─────────────────────────────\n' +
               `@${botUsername}    ← REMONTER ICI\n`;
    if (botRoleInfo) {
      message += `@${botRoleInfo.name.replace('🤖 ', '')} ← sous le principal\n`;
    }
    message += '─────────────────────────────\n' +
               '@Rôles de complétion ← EN DESSOUS\n' +
               '─────────────────────────────\n' +
               '```\n' +
               '> 💡 Vos rôles admin/fondateur peuvent rester au-dessus du bot.\n\n';
  }

  message += '**Prochaines étapes:**\n';
  if (needsRolePositionWarning) {
    message += '1. **Remontez les rôles du bot** dans la hiérarchie\n' +
               '2. Utilisez `/admin-panel` pour créer votre premier thème\n' +
               '3. Ajoutez du contenu aux missions (mots-clés + questions)\n' +
               '4. Créez vos collectibles et configurez les canaux de give\n\n';
  } else {
    message += '1. Utilisez `/admin-panel` pour créer votre premier thème\n' +
               '2. Ajoutez du contenu aux missions (mots-clés + questions)\n' +
               '3. Créez vos collectibles et configurez les canaux de give\n\n';
  }
  message += '💡 Vous pouvez relancer `/setup` à tout moment pour modifier les rôles.';

  await interaction.editReply({
    content: message,
    embeds: [],
    components: []
  });
}

/**
 * Continuer le setup malgré les erreurs de hiérarchie/permissions
 */
async function handleContinueAnyway(interaction) {
  await interaction.deferUpdate();
  console.log(`⚠️ Setup: ${interaction.user.tag} continue malgré les erreurs sur ${interaction.guild.name}`);

  // Passer à l'étape 1: Configuration des rôles
  await setupCommand.showRoleConfiguration(interaction);
}

/**
 * Lancer le diagnostic complet (équivalent à /check-setup)
 */
async function handleRunDiagnostic(interaction) {
  await interaction.deferUpdate();

  console.log(`🔍 Setup: Diagnostic complet demandé pour ${interaction.guild.name}`);

  // Exécuter le diagnostic complet
  const { combined, detailed } = await setupDiagnostic.runFullDiagnostic(interaction.guild);

  await interaction.editReply({
    embeds: [combined],
    components: [] // Retirer les boutons après diagnostic
  });

  // Proposer de relancer /setup après lecture du diagnostic
  await interaction.followUp({
    content: '💡 **Pour continuer la configuration**, relancez `/setup` après avoir résolu les problèmes détectés.',
    flags: 64 // EPHEMERAL
  });
}

/**
 * Annuler le setup
 */
async function handleCancel(interaction) {
  await interaction.deferUpdate();

  await interaction.editReply({
    content: '❌ **Configuration annulée**\n\n' +
             'Vous pouvez relancer `/setup` à tout moment.\n\n' +
             '💡 Pour diagnostiquer les problèmes, utilisez `/check-setup`.',
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
  // Nouveaux handlers pour vérification hiérarchie
  handleContinueAnyway,
  handleRunDiagnostic,
  handleCancel,
  // Theme handlers (délégués à setupThemeHandler)
  handleThemeSelect: setupThemeHandler.handleThemeSelect,
  handleThemeImport: setupThemeHandler.handleThemeImport,
  handleThemeBack: setupThemeHandler.handleThemeBack,
  handleSkipTheme: setupThemeHandler.handleSkipTheme,
  showThemeSelection: setupThemeHandler.showThemeSelection
};
