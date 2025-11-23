const giveHandler = require('../handlers/giveHandler');
const missionHandler = require('../handlers/missionHandler');
const mysteryBoxHandler = require('../handlers/mysteryBoxHandler');
const adminPanelHandler = require('../handlers/adminPanelHandler');
const giveUniqueHandler = require('../handlers/giveUniqueHandler');
const modalHandler = require('../handlers/modalHandler');
const superAdminHandler = require('../handlers/superAdminHandler');
const setupHandler = require('../handlers/setupHandler');
const profileHandler = require('../handlers/profileHandler');
const ServerConfigHandler = require('../handlers/serverConfigHandler');
const progressionRoleAdminHandler = require('../handlers/progressionRoleAdminHandler');

// Pour le tracking des connexions et badges Engagement
const db = require('../utils/database-pg');
const badgeHandler = require('../handlers/badgeHandler');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Gérer les commandes slash
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`❌ Commande ${interaction.commandName} introuvable`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`🔴 Erreur lors de l'exécution de ${interaction.commandName}:`, error);

        // Ne pas réessayer si l'interaction a expiré (Unknown interaction)
        if (error.code === 10062) {
          console.error('⏱️  Interaction expirée - Timeout dépassé');
          return;
        }

        try {
          const errorMessage = {
            content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.',
            flags: 64 // EPHEMERAL
          };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (replyError) {
          // Ignorer si la réponse échoue aussi (interaction déjà expirée)
          console.error('🔴 Impossible de répondre à l\'interaction:', replyError.message);
        }
      }
    }

    // Gérer les boutons
    else if (interaction.isButton()) {
      const customId = interaction.customId;

      try {
        // Boutons de profil (profile_* et activate_bonus:*)
        if (customId.startsWith('profile_') || customId.startsWith('activate_bonus:')) {
          await profileHandler.handleProfileInteraction(interaction);
        }

        // Bouton "Voir mes badges" depuis MP (view_my_badges:guildId)
        else if (customId.startsWith('view_my_badges:')) {
          await interaction.deferReply({ flags: 64 }); // Ephemeral

          const guildId = customId.split(':')[1];
          const player = await db.getPlayerByDiscordId(guildId, interaction.user.id);

          if (!player) {
            return interaction.editReply({
              content: '❌ Tu n\'es pas enregistré sur ce serveur. Utilise `/profile` sur le serveur pour t\'inscrire.',
            });
          }

          const theme = await db.getActiveTheme(guildId);
          const state = {
            currentView: 'badges',
            badgesPage: 0,
            badgesCategory: 'all',
            badgesRarity: 'all'
          };

          // BUG 16 FIX: showBadges est dans views/profileView, pas handlers/profileHandler
          const { showBadges } = require('../views/profileView');
          const content = await showBadges(interaction, player, theme, guildId, state.badgesCategory, state.badgesRarity, state.badgesPage);

          await interaction.editReply(content);
        }

        // Boutons de configuration serveur (server_config_*, toggle_notify_*)
        // Note: edit_bot_, edit_primary_, edit_secondary_, edit_footer_, edit_language, edit_timezone sont pour ServerConfigHandler
        // Note: toggle_notify_* pour les notifications missions (thread/mention)
        // edit_announcement_templates, edit_template_* sont pour adminPanelHandler (ligne 199)
        else if (customId.startsWith('server_config_') || customId.startsWith('toggle_notify_') || customId.startsWith('edit_bot_') || customId.startsWith('edit_primary_') || customId.startsWith('edit_secondary_') || customId.startsWith('edit_footer_') || customId === 'edit_language' || customId === 'edit_timezone' || customId === 'show_role_tutorial') {
          const handler = new ServerConfigHandler();
          await handler.handleButtonInteraction(interaction);
        }

        // Boutons de boîte mystère (mystery_open_type_id)
        else if (customId.startsWith('mystery_open_')) {
          await mysteryBoxHandler.handleMysteryBoxOpen(interaction);
        }

        // 👁️ Vision Divine - Boutons Accept/Decline
        else if (customId.startsWith('vision_divine_accept:')) {
          await mysteryBoxHandler.handleVisionDivineAccept(interaction);
        }
        else if (customId.startsWith('vision_divine_decline:')) {
          await mysteryBoxHandler.handleVisionDivineDecline(interaction);
        }

        // Boutons Give Unique (admin) - DOIT ÊTRE AVANT give_ normal
        else if (customId.startsWith('give_unique_')) {
          await adminPanelHandler.handleAdminInteraction(interaction);
        }

        // Boutons de give (give_collectible_123 ou give_trap_456)
        else if (customId.startsWith('give_')) {
          await giveHandler.handleGiveClick(interaction);
        }

        // Boutons de mission
        else if (customId.startsWith('mission_start_')) {
          await missionHandler.handleMissionStart(interaction);
        }
        else if (customId.startsWith('mission_submit_')) {
          await missionHandler.handleMissionSubmit(interaction);
        }
        else if (customId.startsWith('mission_approve_')) {
          await missionHandler.approveMission(interaction);
        }
        else if (customId.startsWith('mission_reject_')) {
          await missionHandler.rejectMission(interaction);
        }
        else if (customId.startsWith('mission_quiz_questions_')) {
          // Extraire la page si présente dans le customId (format: mission_quiz_questions_123:page)
          const page = customId.includes(':') ? parseInt(customId.split(':')[1]) : 0;
          await missionHandler.handleQuizQuestionsManagement(interaction, page);
        }
        else if (customId.startsWith('mission_quiz_page_')) {
          // Pagination quiz: mission_quiz_page_123:page
          const page = parseInt(customId.split(':')[1]);
          await missionHandler.handleQuizQuestionsManagement(interaction, page);
        }
        else if (customId.startsWith('mission_quiz_add_')) {
          await missionHandler.handleQuizAdd(interaction);
        }
        else if (customId.startsWith('mission_quiz_delete_')) {
          await missionHandler.handleQuizDelete(interaction);
        }
        else if (customId.startsWith('mission_keyword_add_')) {
          await missionHandler.handleKeywordAddMenu(interaction);
        }
        else if (customId.startsWith('mission_keyword_back_')) {
          await missionHandler.handleKeywordEdit(interaction);
        }
        else if (customId.startsWith('mission_keyword_delete_')) {
          await missionHandler.handleKeywordDelete(interaction);
        }
        else if (customId.startsWith('mission_keywords_manage_')) {
          await adminPanelHandler.handleMissionKeywordsManage(interaction);
        }
        else if (customId.startsWith('mission_keyword_edit_')) {
          await missionHandler.handleKeywordEdit(interaction);
        }
        else if (customId.startsWith('mission_edit_')) {
          await missionHandler.handleMissionEdit(interaction);
        }
        else if (customId.startsWith('mission_channels_config_')) {
          await missionHandler.handleChannelConfiguration(interaction);
        }
        else if (customId.startsWith('mission_channels_reset_')) {
          await missionHandler.handleChannelReset(interaction);
        }
        else if (customId.startsWith('mission_timeout_config_')) {
          await adminPanelHandler.handleMissionTimeoutConfig(interaction);
        }
        else if (customId.startsWith('mission_max_attempts_config_')) {
          await missionHandler.handleMaxAttemptsConfig(interaction);
        }
        // Boutons admin des missions (add, delete, modify)
        else if (customId === 'mission_add' || customId.startsWith('mission_delete_confirm_') || customId === 'mission_modify') {
          await adminPanelHandler.handleAdminInteraction(interaction);
        }

        // Bouton retour à la mission (depuis config canaux)
        else if (customId.startsWith('select_mission_')) {
          await adminPanelHandler.handleMissionSelection(interaction);
        }

        // Bouton fermer thread
        else if (customId.startsWith('thread_close_')) {
          await handleThreadClose(interaction);
        }

        // Boutons du panneau admin
        else if (customId.startsWith('admin_') || customId.startsWith('theme_') || customId.startsWith('mystery_box_') || customId.startsWith('duration_') || customId.startsWith('collectible_') || customId.startsWith('channel_') || customId.startsWith('give_unique_') || customId.startsWith('toggle_') || customId.startsWith('change_') || customId.startsWith('delete_') || customId.startsWith('edit_') || customId.startsWith('template_') || customId.startsWith('rarity_') || customId.startsWith('campaign_') || customId.startsWith('announcements_') || customId.startsWith('trap_') || customId.startsWith('probability_') || customId.startsWith('super_bonus_') || customId === 'thread_cancel_collectible') {
          await adminPanelHandler.handleAdminInteraction(interaction);
        }

        // Boutons Super-Admin
        else if (customId.startsWith('superadmin_')) {
          await handleSuperAdminButton(interaction);
        }

        // Boutons Setup
        else if (customId === 'setup_validate_roles') {
          await setupHandler.handleValidateRoles(interaction);
        }
        else if (customId === 'setup_reset_roles') {
          await setupHandler.handleResetRoles(interaction);
        }
        else if (customId === 'setup_skip_to_checklist') {
          await setupHandler.handleSkipToChecklist(interaction);
        }
        else if (customId === 'setup_back_to_roles') {
          await setupHandler.handleBackToRoles(interaction);
        }
        else if (customId === 'setup_finish') {
          await setupHandler.handleFinish(interaction);
        }
        // Boutons Setup - Thèmes préconfigurés
        else if (customId.startsWith('setup_import_theme:')) {
          const themeId = customId.split(':')[1];
          await setupHandler.handleThemeImport(interaction, themeId);
        }
        else if (customId === 'setup_theme_back') {
          await setupHandler.handleThemeBack(interaction);
        }
        else if (customId === 'setup_skip_theme') {
          await setupHandler.handleSkipTheme(interaction);
        }
        else if (customId === 'setup_theme_done') {
          // Simple bouton "Compris" après import de thème - efface juste les composants
          await interaction.deferUpdate();
          await interaction.editReply({
            content: '✅ **Thème importé avec succès !**\n\nVous pouvez maintenant utiliser `/admin-panel` pour gérer vos thèmes et configurer votre serveur.',
            embeds: [],
            components: []
          });
        }
        else if (customId === 'setup_add_another_theme') {
          // Bouton "Ajouter un autre thème" - renvoie vers le sélecteur de thèmes préconfigurés
          await interaction.deferUpdate();
          await setupHandler.showThemeSelection(interaction);
        }
        else if (customId === 'theme_admin_main') {
          // Bouton "Gérer les Thèmes" - renvoie vers le menu thèmes du panneau admin
          await adminPanelHandler.handleAdminInteraction(interaction);
        }
        // Boutons Progression Roles Admin (gère progression_roles_ ET progression_role_)
        else if (customId.startsWith('progression_roles_') || customId.startsWith('progression_role_')) {
          await progressionRoleAdminHandler.handleInteraction(interaction);
        }

        else {
          console.warn(`⚠️  Bouton non géré: ${customId}`);
        }
      } catch (error) {
        console.error(`🔴 Erreur lors du traitement du bouton ${customId}:`, error);

        // Ne pas réessayer si l'interaction a expiré
        if (error.code === 10062) {
          console.error('⏱️  Interaction expirée - Timeout dépassé');
          return;
        }

        try {
          const errorMessage = {
            content: '❌ Une erreur est survenue. Réessaye ou contacte un administrateur.',
            flags: 64 // EPHEMERAL
          };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (replyError) {
          console.error('🔴 Impossible de répondre à l\'interaction:', replyError.message);
        }
      }
    }

    // Gérer les modals
    else if (interaction.isModalSubmit()) {
      try {
        // Modals Progression Roles Admin (AVANT modal_edit_ car plus spécifique)
        if (interaction.customId === 'modal_add_progression_role' || interaction.customId.startsWith('modal_edit_progression_role:')) {
          await progressionRoleAdminHandler.handleModalSubmit(interaction);
        }
        // Modals de server-config
        else if (interaction.customId.startsWith('modal_edit_')) {
          const handler = new ServerConfigHandler();
          await handler.handleModalSubmit(interaction);
        }
        // Modal de couleur personnalisée du profil
        else if (interaction.customId === 'profile_color_custom_modal') {
          const profileColorHandler = require('../handlers/profileColorHandler');
          await profileColorHandler.handleCustomColorModal(interaction);
        }
        // Autres modals
        else {
          await modalHandler.handleModalSubmit(interaction);
        }
      } catch (error) {
        console.error(`🔴 Erreur lors du traitement du modal ${interaction.customId}:`, error);

        const errorMessage = {
          content: '❌ Une erreur est survenue. Réessaye ou contacte un administrateur.',
          flags: 64
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }

    // Gérer les select menus
    else if (interaction.isStringSelectMenu()) {
      try {
        // Select menu de sélection de couleur (server-config)
        if (interaction.customId.startsWith('color_select_')) {
          const handler = new ServerConfigHandler();
          await handler.handleSelectMenu(interaction);
        }
        // Select menu du profil (filtrage inventaire)
        else if (interaction.customId.startsWith('profile_')) {
          await profileHandler.handleProfileInteraction(interaction);
        }
        // Select menus des missions
        else if (interaction.customId.startsWith('select_keyword_delete_')) {
          await missionHandler.handleKeywordDeleteConfirm(interaction);
        }
        else if (interaction.customId.startsWith('select_quiz_delete_')) {
          await missionHandler.handleQuizDeleteConfirm(interaction);
        }
        else if (interaction.customId.startsWith('difficulty_select_')) {
          await missionHandler.handleDifficultySelect(interaction);
        }
        else if (interaction.customId.startsWith('quiz_difficulty_select_')) {
          await missionHandler.handleQuizDifficultySelect(interaction);
        }
        else if (interaction.customId.startsWith('mission_max_attempts_select_')) {
          await missionHandler.handleMaxAttemptsSelect(interaction);
        }
        // Select menus du panneau admin
        else if (interaction.customId.startsWith('select_') ||
            interaction.customId.startsWith('edit_bonus_duration_') ||
            interaction.customId.startsWith('template_color_select_') ||
            interaction.customId.startsWith('give_unique_') ||
            interaction.customId.startsWith('campaign_') ||
            interaction.customId.startsWith('trap_') ||
            interaction.customId.startsWith('super_bonus_')) {
          await adminPanelHandler.handleSelectMenu(interaction);
        }
        // Select menu Setup - Sélection de thème préconfigurés
        else if (interaction.customId === 'setup_theme_select') {
          await setupHandler.handleThemeSelect(interaction);
        }
        // Select menus Super-Admin
        else if (interaction.customId.startsWith('superadmin_')) {
          await handleSuperAdminSelect(interaction);
        }
        // Select menus Progression Roles Admin
        else if (interaction.customId.startsWith('progression_role_select_')) {
          await progressionRoleAdminHandler.handleInteraction(interaction);
        }
        else {
          console.warn(`⚠️ Select menu non géré: ${interaction.customId}`);
        }
      } catch (error) {
        console.error(`🔴 Erreur lors du traitement du select menu ${interaction.customId}:`, error);

        const errorMessage = {
          content: '❌ Une erreur est survenue. Réessaye ou contacte un administrateur.',
          flags: 64
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }

    // Gérer les channel select menus
    else if (interaction.isChannelSelectMenu()) {
      try {
        if (interaction.customId.startsWith('mission_channels_select_')) {
          await missionHandler.handleChannelSelect(interaction);
        }
        else if (interaction.customId === 'select_announcement_channel') {
          await adminPanelHandler.handleAnnouncementChannelSelection(interaction);
        }
        else if (interaction.customId.startsWith('give_unique_channels_select:')) {
          await giveUniqueHandler.handleGiveUniqueChannelsSelect(interaction);
        }
        else {
          console.warn(`⚠️ Channel select menu non géré: ${interaction.customId}`);
        }
      } catch (error) {
        console.error(`🔴 Erreur lors du traitement du channel select menu ${interaction.customId}:`, error);

        const errorMessage = {
          content: '❌ Une erreur est survenue. Réessaye ou contacte un administrateur.',
          flags: 64
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }

    // Gérer les role select menus
    else if (interaction.isRoleSelectMenu()) {
      try {
        if (interaction.customId === 'setup_role_select') {
          await setupHandler.handleRoleSelect(interaction);
        }
        else {
          console.warn(`⚠️ Role select menu non géré: ${interaction.customId}`);
        }
      } catch (error) {
        console.error(`🔴 Erreur lors du traitement du role select menu ${interaction.customId}:`, error);

        const errorMessage = {
          content: '❌ Une erreur est survenue. Réessaye ou contacte un administrateur.',
          flags: 64
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }

    // 📅 Tracking de connexion pour badges Engagement (async, ne bloque pas)
    handleLoginTracking(interaction, client).catch(err => {
      console.error('🔴 Erreur handleLoginTracking:', err);
    });
  }
};

/**
 * Fermer un thread privé
 */
async function handleThreadClose(interaction) {
  // Vérifier que l'utilisateur a le rôle co-fondateur
  const coFounderRoleId = process.env.CO_FOUNDER_ROLE_ID;

  if (!coFounderRoleId || !interaction.member.roles.cache.has(coFounderRoleId)) {
    return interaction.reply({
      content: '❌ Seuls les co-fondateurs peuvent fermer ce thread.',
      flags: 64
    });
  }

  await interaction.channel.send('🔒 **Thread fermé par un administrateur.**');
  await interaction.reply({
    content: '✅ Thread en cours de fermeture...',
    flags: 64
  });

  // Archiver le thread après 3 secondes
  setTimeout(async () => {
    await interaction.channel.setArchived(true);
  }, 3000);
}

/**
 * Gérer les boutons super-admin
 */
async function handleSuperAdminButton(interaction) {
  const customId = interaction.customId;

  // Vérifier les permissions super-admin
  if (!await superAdminHandler.isSuperAdmin(interaction.user.id)) {
    return interaction.reply({
      content: '❌ Accès refusé.',
      flags: 64
    });
  }

  // Retour au panneau principal
  if (customId === 'superadmin_back') {
    return await superAdminHandler.showMainPanel(interaction);
  }

  // Gérer les serveurs
  if (customId === 'superadmin_guilds') {
    return await superAdminHandler.showGuildsList(interaction);
  }

  // Statistiques
  if (customId === 'superadmin_stats') {
    return await superAdminHandler.showGlobalStats(interaction);
  }

  // Logs
  if (customId === 'superadmin_logs') {
    return await superAdminHandler.showLogs(interaction);
  }

  // Super admins list
  if (customId === 'superadmin_admins') {
    return await superAdminHandler.showSuperAdminsList(interaction);
  }

  // Activer/Désactiver serveur
  if (customId.startsWith('superadmin_toggle_')) {
    const guildId = customId.replace('superadmin_toggle_', '');
    return await superAdminHandler.toggleGuild(interaction, guildId);
  }

  // Réinitialiser serveur
  if (customId.startsWith('superadmin_reset_')) {
    const guildId = customId.replace('superadmin_reset_', '');
    return await superAdminHandler.resetGuild(interaction, guildId);
  }

  // Confirmer réinitialisation
  if (customId.startsWith('superadmin_reset_confirm_')) {
    const guildId = customId.replace('superadmin_reset_confirm_', '');
    return await superAdminHandler.confirmResetGuild(interaction, guildId);
  }

  // Supprimer serveur
  if (customId.startsWith('superadmin_delete_')) {
    const guildId = customId.replace('superadmin_delete_', '');
    return await superAdminHandler.deleteGuild(interaction, guildId);
  }

  // Confirmer suppression
  if (customId.startsWith('superadmin_delete_confirm_')) {
    const guildId = customId.replace('superadmin_delete_confirm_', '');
    return await superAdminHandler.confirmDeleteGuild(interaction, guildId);
  }

  // Gérer les permissions d'un serveur
  if (customId.startsWith('superadmin_permissions_')) {
    const guildId = customId.replace('superadmin_permissions_', '');
    return await superAdminHandler.showGuildPermissions(interaction, guildId);
  }

  // Afficher modal pour ajouter un rôle admin
  if (customId.startsWith('superadmin_add_role_')) {
    const guildId = customId.replace('superadmin_add_role_', '');
    return await superAdminHandler.handleAddAdminRoleModal(interaction, guildId);
  }

  // Voir stats détaillées d'un serveur
  if (customId.startsWith('superadmin_guild_stats_')) {
    const guildId = customId.replace('superadmin_guild_stats_', '');
    return await superAdminHandler.showGuildStats(interaction, guildId);
  }

  // Voir logs d'un serveur
  if (customId.startsWith('superadmin_guild_logs_')) {
    const guildId = customId.replace('superadmin_guild_logs_', '');
    return await superAdminHandler.showGuildLogs(interaction, guildId);
  }

  // Voir détails d'un serveur
  if (customId.startsWith('superadmin_guild_')) {
    const guildId = customId.replace('superadmin_guild_', '');
    return await superAdminHandler.showGuildDetails(interaction, guildId);
  }
}

/**
 * Gérer les select menus super-admin
 */
async function handleSuperAdminSelect(interaction) {
  const customId = interaction.customId;

  // Vérifier les permissions super-admin
  if (!await superAdminHandler.isSuperAdmin(interaction.user.id)) {
    return interaction.reply({
      content: '❌ Accès refusé.',
      flags: 64
    });
  }

  // Sélection d'un serveur
  if (customId === 'superadmin_select_guild') {
    const guildId = interaction.values[0];
    return await superAdminHandler.showGuildDetails(interaction, guildId);
  }

  // Retirer un rôle admin d'un serveur
  if (customId.startsWith('superadmin_remove_role_')) {
    const guildId = customId.replace('superadmin_remove_role_', '');
    const roleId = interaction.values[0];
    return await superAdminHandler.handleRemoveAdminRole(interaction, guildId, roleId);
  }
}

/**
 * Gérer le tracking de connexion et déblocage des badges Engagement
 * Cette fonction est appelée pour TOUTES les interactions (slash, button, select, modal)
 * Elle enregistre le login du jour et déclenche les badges si le streak augmente
 */
async function handleLoginTracking(interaction, client) {
  try {
    // Ignorer si pas dans un serveur
    if (!interaction.guildId) {
      return;
    }

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;

    // Récupérer le joueur depuis Discord ID
    const player = await db.getPlayerByDiscordId(guildId, discordId);

    if (!player) {
      // Joueur pas encore enregistré - normal pour les nouveaux utilisateurs
      return;
    }

    // Enregistrer le login du jour et récupérer le streak
    const loginResult = await db.recordLogin(guildId, player.id);

    if (!loginResult) {
      // Erreur lors de l'enregistrement
      return;
    }

    // Si le streak a augmenté, déclencher les badges Engagement
    if (loginResult.isNewStreak) {
      console.log(`📅 Nouveau streak pour ${player.username}: ${loginResult.streak} jours`);

      // Appeler le hook onLoginStreak pour débloquer les badges
      await badgeHandler.onLoginStreak(
        guildId,
        player.id,
        loginResult.streak,
        client
      );
    }

    // Si le streak a été cassé, notifier (optionnel)
    if (loginResult.brokeStreak) {
      console.log(`📅 Streak cassé pour ${player.username} - Redémarre à 1`);
    }
  } catch (error) {
    // Ne pas faire échouer l'interaction si le tracking échoue
    console.error('🔴 Erreur handleLoginTracking:', error);
  }
}
