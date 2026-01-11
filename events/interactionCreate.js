const giveHandler = require('../handlers/giveHandler');
const missionHandler = require('../handlers/missionHandler');
const mysteryBoxHandler = require('../handlers/mysteryBoxHandler');
const adminPanelHandler = require('../handlers/adminPanelHandler');
const giveUniqueHandler = require('../handlers/giveUniqueHandler');
const campaignAdminHandler = require('../handlers/campaignAdminHandler');
const modalHandler = require('../handlers/modalHandler');
const superAdminHandler = require('../handlers/superAdminHandler');
const setupHandler = require('../handlers/setupHandler');
const profileHandler = require('../handlers/profileHandler');
const ServerConfigHandler = require('../handlers/serverConfigHandler');
const progressionRoleAdminHandler = require('../handlers/progressionRoleAdminHandler');
const subscriptionHandler = require('../handlers/subscriptionHandler');
const mysteryBoxConfigHandler = require('../handlers/mysteryBoxConfigHandler');
const craftingHandler = require('../handlers/craftingHandler');
const tutorialView = require('../views/tutorialView');
const portfolioHandler = require('../handlers/portfolioHandler');
const tictactoeHandler = require('../handlers/tictactoeHandler');
const mysteryGiftHandler = require('../handlers/mysteryGiftHandler');

// Pour le tracking des connexions et badges Engagement
const db = require('../utils/database-pg');
const badgeHandler = require('../handlers/badgeHandler');

// Commandes exemptées du check de subscription (toujours accessibles)
const EXEMPT_COMMANDS = ['super-admin-panel', 'setup', 'check-setup'];

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
        // Vérifier le statut de subscription (sauf pour commandes exemptées)
        if (!EXEMPT_COMMANDS.includes(interaction.commandName)) {
          const isSubscriptionValid = await subscriptionHandler.checkSubscriptionStatus(interaction);
          if (!isSubscriptionValid) {
            return; // Le handler a déjà répondu avec l'embed
          }
        }

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
        // 🔨 Boutons Crafting Config Admin (AVANT craft_ général)
        if (customId.startsWith('craft_config_')) {
          await adminPanelHandler.handleAdminInteraction(interaction);
        }
        // 🔨 Boutons Crafting Joueur (craft_* et recycle_*)
        else if (customId.startsWith('craft_') || customId.startsWith('recycle_')) {
          await craftingHandler.handleCraftingInteraction(interaction);
        }

        // Boutons de profil (profile_*, activate_bonus:*, deactivate_bonus:*)
        else if (customId.startsWith('profile_') || customId.startsWith('activate_bonus:') || customId.startsWith('deactivate_bonus:')) {
          await profileHandler.handleProfileInteraction(interaction);
        }

        // 🃏 Boutons MysteryBox Joker (pagination/annulation)
        else if (customId.startsWith('joker_page_') || customId === 'joker_cancel') {
          await profileHandler.handleJokerInteraction(interaction);
        }

        // 📊 Boutons Leaderboard (pagination prev/next)
        else if (customId.startsWith('leaderboard_prev_') || customId.startsWith('leaderboard_next_')) {
          const leaderboardCommand = interaction.client.commands.get('leaderboard');
          if (leaderboardCommand && leaderboardCommand.handleButton) {
            await leaderboardCommand.handleButton(interaction);
          }
        }

        // 🔧 Boutons Daily Rewards Admin (DOIT ÊTRE AVANT daily_ générique)
        else if (customId.startsWith('daily_admin_')) {
          await adminPanelHandler.handleAdminInteraction(interaction);
        }

        // 🎁 Boutons Daily Claim (daily_claim, daily_calendar, daily_rewards_list, daily_catchup, daily_catchup_buy:*)
        else if (customId.startsWith('daily_')) {
          await profileHandler.handleProfileInteraction(interaction);
        }

        // 📦 Boutons Mystery Box par rareté (mb_open:rarity)
        else if (customId.startsWith('mb_open:')) {
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
          // Signature: showBadges(interaction, player, theme, guildId, mode, selectedCategory, page)
          const { showBadges } = require('../views/profileView');
          const content = await showBadges(interaction, player, theme, guildId, 'overview', state.badgesCategory, state.badgesPage);

          await interaction.editReply(content);
        }

        // Bouton "Voir ma progression" depuis MP (view_badge_progress:guildId)
        else if (customId.startsWith('view_badge_progress:')) {
          await interaction.deferReply({ flags: 64 }); // Ephemeral

          const guildId = customId.split(':')[1];
          const player = await db.getPlayerByDiscordId(guildId, interaction.user.id);

          if (!player) {
            return interaction.editReply({
              content: '❌ Tu n\'es pas enregistré sur ce serveur. Utilise `/profile` sur le serveur pour t\'inscrire.',
            });
          }

          const theme = await db.getActiveTheme(guildId);

          // Afficher les badges en mode progression
          // Signature: showBadges(interaction, player, theme, guildId, mode, selectedCategory, page)
          const { showBadges } = require('../views/profileView');
          const content = await showBadges(interaction, player, theme, guildId, 'progress', 'all', 0);

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

        // 🎁 Cadeau Mystère à un ami - Boutons
        else if (customId.startsWith('mystery_gift_open:') ||
                 customId.startsWith('mystery_gift_confirm_image:') ||
                 customId === 'mystery_gift_cancel') {
          await mysteryGiftHandler.handleInteraction(interaction);
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
        // Boutons d'annulation de mission
        else if (customId.startsWith('mission_cancel_confirm_')) {
          await missionHandler.handleMissionCancelConfirm(interaction);
        }
        else if (customId.startsWith('mission_cancel_back_')) {
          await missionHandler.handleMissionCancelBack(interaction);
        }
        else if (customId.startsWith('mission_cancel_')) {
          await missionHandler.handleMissionCancel(interaction);
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
        // Boutons True-False missions
        else if (customId.startsWith('mission_truefalse_questions_')) {
          // Extraire la page si présente dans le customId (format: mission_truefalse_questions_123:page)
          const page = customId.includes(':') ? parseInt(customId.split(':')[1]) : 0;
          await missionHandler.handleTrueFalseQuestionsManagement(interaction, page);
        }
        else if (customId.startsWith('mission_truefalse_page_')) {
          // Pagination true-false: mission_truefalse_page_123:page
          const page = parseInt(customId.split(':')[1]);
          await missionHandler.handleTrueFalseQuestionsManagement(interaction, page);
        }
        else if (customId.startsWith('mission_truefalse_add_')) {
          await missionHandler.handleTrueFalseAdd(interaction);
        }
        // Boutons Emoji-Puzzle missions
        else if (customId.startsWith('mission_emoji_puzzles_')) {
          await missionHandler.handleEmojiPuzzleManagement(interaction, 0);
        }
        else if (customId.startsWith('mission_emoji_page_')) {
          // Pagination: mission_emoji_page_123_0
          const parts = customId.split('_');
          const page = parseInt(parts[parts.length - 1]);
          await missionHandler.handleEmojiPuzzleManagement(interaction, page);
        }
        else if (customId.startsWith('mission_emoji_add_')) {
          await missionHandler.handleEmojiPuzzleAdd(interaction);
        }
        else if (customId.startsWith('mission_emoji_delete_')) {
          await missionHandler.handleEmojiPuzzleDeleteSelect(interaction);
        }
        // Boutons Unscramble (Lettres Mélangées) missions
        else if (customId.startsWith('mission_unscramble_words_')) {
          await missionHandler.handleUnscrambleWordsManagement(interaction, 0);
        }
        else if (customId.startsWith('mission_unscramble_page_')) {
          // Pagination: mission_unscramble_page_123_0
          const parts = customId.split('_');
          const page = parseInt(parts[parts.length - 1]);
          await missionHandler.handleUnscrambleWordsManagement(interaction, page);
        }
        else if (customId.startsWith('mission_unscramble_add_')) {
          await missionHandler.handleUnscrambleWordAdd(interaction);
        }
        else if (customId.startsWith('mission_unscramble_delete_')) {
          await missionHandler.handleUnscrambleWordDeleteSelect(interaction);
        }
        // Boutons Hangman (Le Pendu) missions
        else if (customId.startsWith('mission_hangman_words_')) {
          await missionHandler.handleHangmanWordsManagement(interaction, 0);
        }
        else if (customId.startsWith('mission_hangman_page_')) {
          // Pagination: mission_hangman_page_123_0
          const parts = customId.split('_');
          const page = parseInt(parts[parts.length - 1]);
          await missionHandler.handleHangmanWordsManagement(interaction, page);
        }
        else if (customId.startsWith('mission_hangman_add_')) {
          await missionHandler.handleHangmanWordAdd(interaction);
        }
        else if (customId.startsWith('mission_hangman_delete_')) {
          await missionHandler.handleHangmanWordDeleteSelect(interaction);
        }
        else if (customId.startsWith('mission_hangman_first_letter_')) {
          await missionHandler.handleHangmanFirstLetterToggle(interaction);
        }
        // Boutons Wordle missions
        else if (customId.startsWith('mission_wordle_words_')) {
          await missionHandler.handleWordleWordsManagement(interaction, 0);
        }
        else if (customId.startsWith('wordle_words_page_')) {
          await missionHandler.handleWordleWordsPage(interaction);
        }
        else if (customId.startsWith('wordle_word_add_')) {
          await missionHandler.handleWordleWordAdd(interaction);
        }
        else if (customId.startsWith('wordle_word_delete_select_')) {
          await missionHandler.handleWordleWordDeleteSelect(interaction);
        }
        else if (customId.startsWith('mission_wordle_first_letter_')) {
          await missionHandler.handleWordleFirstLetterToggle(interaction);
        }
        else if (customId.startsWith('mission_wordle_attempts_')) {
          await missionHandler.handleWordleAttemptsConfig(interaction);
        }
        else if (customId.startsWith('wordle_cfg_')) {
          // wordle_cfg_easy_123, wordle_cfg_medium_123, wordle_cfg_hard_123
          await missionHandler.handleWordleAttemptsDifficultySelect(interaction);
        }
        else if (customId.startsWith('wordle_set_')) {
          // wordle_set_easy_123_6, wordle_set_medium_123_5, etc.
          await missionHandler.handleWordleSetAttempts(interaction);
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
        else if (customId.startsWith('mission_edit_info_')) {
          await missionHandler.handleMissionEditInfo(interaction);
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
        else if (customId.startsWith('mission_image_upload_')) {
          await adminPanelHandler.handleMissionImageUpload(interaction);
        }
        else if (customId.startsWith('mission_image_cancel_')) {
          // Annulation depuis le thread - juste archiver le thread
          await interaction.deferUpdate();
          if (interaction.channel?.isThread()) {
            await interaction.channel.send('❌ **Upload annulé.** Ce thread sera archivé.');
            setTimeout(async () => {
              try {
                await interaction.channel.setArchived(true);
              } catch (err) {
                console.warn('⚠️ Impossible d\'archiver le thread:', err);
              }
            }, 3000);
          }
        }
        else if (customId.startsWith('mission_max_attempts_config_')) {
          await missionHandler.handleMaxAttemptsConfig(interaction);
        }
        else if (customId.startsWith('mission_reward_config_')) {
          await missionHandler.handleRewardConfig(interaction);
        }
        else if (customId.startsWith('mission_reward_type_')) {
          await missionHandler.handleRewardTypeSelect(interaction);
        }
        else if (customId.startsWith('mission_reward_collectible_')) {
          await missionHandler.handleRewardCollectibleSelect(interaction);
        }
        else if (customId.startsWith('mission_reward_back_')) {
          await adminPanelHandler.handleMissionSelection(interaction);
        }
        // Boutons admin des missions (add, delete, modify, gif config, toggle active)
        else if (customId === 'mission_add' || customId.startsWith('mission_delete_ask_') || customId.startsWith('mission_delete_confirm_') || customId.startsWith('mission_delete_cancel_') || customId.startsWith('mission_toggle_active_') || customId === 'mission_modify' || customId === 'mission_revealed_gif_config' || customId === 'mission_channel_config' || customId === 'delete_mission_channel') {
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
        else if (customId.startsWith('admin_') || customId.startsWith('theme_') || customId.startsWith('mystery_box_') || customId.startsWith('mb_config_') || customId.startsWith('duration_') || customId.startsWith('collectible_') || customId.startsWith('collectibles_') || customId.startsWith('channel_') || customId.startsWith('give_unique_') || customId.startsWith('toggle_') || customId.startsWith('change_') || customId.startsWith('delete_') || customId.startsWith('edit_') || customId.startsWith('template_') || customId.startsWith('rarity_') || customId.startsWith('campaign_') || customId.startsWith('announcements_') || customId.startsWith('trap_') || customId.startsWith('probability_') || customId.startsWith('super_bonus_') || customId.startsWith('frames_') || customId.startsWith('frame_wizard_') || customId.startsWith('frame_assign_') || customId.startsWith('frame_edit_') || customId.startsWith('frame_unassign_') || customId.startsWith('role_frame_wizard_') || customId.startsWith('role_frame_edit_') || customId.startsWith('select_trap_cancel_') || customId === 'thread_cancel_collectible' || customId.startsWith('thread_cancel_edit_image_')) {
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
        // Boutons Setup - Vérification hiérarchie/permissions
        else if (customId === 'setup_continue_anyway') {
          await setupHandler.handleContinueAnyway(interaction);
        }
        else if (customId === 'setup_run_diagnostic') {
          await setupHandler.handleRunDiagnostic(interaction);
        }
        else if (customId === 'setup_cancel') {
          await setupHandler.handleCancel(interaction);
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

        // ⚖️ Boutons Fairness Config (système d'équité)
        else if (customId.startsWith('fairness_')) {
          const fairnessConfigHandler = require('../handlers/fairnessConfigHandler');
          await fairnessConfigHandler.handleInteraction(interaction);
        }

        // 📚 Boutons Tutoriel (navigation entre sections)
        else if (customId.startsWith('tutorial_')) {
          await interaction.deferUpdate();

          const viewFunction = tutorialView.VIEWS[customId];
          if (viewFunction) {
            const content = await viewFunction(interaction);
            await interaction.editReply(content);
          } else {
            console.warn(`⚠️  Vue tutoriel non trouvée: ${customId}`);
          }
        }

        // 🖼️ Boutons Portfolio (serveur Showcase Loomix-labs)
        else if (customId.startsWith('portfolio_')) {
          await portfolioHandler.handlePortfolioButton(interaction);
        }

        // 🎮 Boutons Morpion (Tic-Tac-Toe)
        else if (customId.startsWith('ttt_')) {
          await tictactoeHandler.handleInteraction(interaction);
        }

        // 🎮 Boutons gérés par collectors locaux (ignorer)
        else if (
          customId.startsWith('wordle_diff_') ||      // Difficulté wordle (collector dans handleWordleWordAdd)
          customId.startsWith('wordle_add_cancel_') || // Annulation ajout wordle (collector)
          customId.startsWith('hangman_diff_') ||     // Difficulté hangman (collector)
          customId.startsWith('wordle_key_') ||       // Clavier wordle gameplay (collector)
          customId.startsWith('wordle_submit_') ||    // Submit wordle gameplay (collector)
          customId.startsWith('wordle_delete_') ||    // Delete wordle gameplay (collector)
          customId.startsWith('hangman_letter_')      // Lettres hangman gameplay (collector)
        ) {
          // Géré par un collector local, ne rien faire
        }

        // 🎁 Boutons Gift Images Admin (visuels cadeaux mystères)
        else if (customId.startsWith('gift_image_') || customId === 'admin_gift_images') {
          await adminPanelHandler.handleAdminInteraction(interaction);
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
        // Modals d'édition de collectibles (AVANT modal_edit_ car plus spécifique)
        else if (interaction.customId.startsWith('modal_edit_collectible_')) {
          await adminPanelHandler.handleEditCollectibleModalSubmit(interaction);
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
        // Modals Daily Rewards Admin
        else if (interaction.customId.startsWith('daily_admin_')) {
          await adminPanelHandler.handleAdminInteraction(interaction);
        }
        // Modals Mystery Box Config
        else if (interaction.customId.startsWith('mb_config_modal_')) {
          await mysteryBoxConfigHandler.handleInteraction(interaction);
        }
        // Modals Catégories de Thèmes (Super Admin)
        else if (interaction.customId.startsWith('modal_category_')) {
          await superAdminHandler.handleCategoryModalSubmit(interaction);
        }
        // Autres modals (inclut modal_frame_ via modalHandler.js)
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
        // 🔨 Select menus Crafting Config Admin (AVANT craft_ général)
        else if (interaction.customId.startsWith('craft_config_')) {
          await adminPanelHandler.handleAdminInteraction(interaction);
        }
        // 🔨 Select menus Crafting Joueur (craft_upgrade_select, craft_recycle_select)
        else if (interaction.customId.startsWith('craft_')) {
          await craftingHandler.handleCraftingInteraction(interaction);
        }
        // Select menu Daily Rewards Admin (DOIT ÊTRE AVANT daily_)
        else if (interaction.customId.startsWith('daily_admin_')) {
          await adminPanelHandler.handleAdminInteraction(interaction);
        }
        // Select menu Daily Claim (rattrapage)
        else if (interaction.customId.startsWith('daily_')) {
          const dailyClaimHandler = require('../handlers/dailyClaimHandler');
          await dailyClaimHandler.handleDailyClaimInteraction(interaction);
        }
        // Select menu du leaderboard
        else if (interaction.customId === 'leaderboard_type_select') {
          const leaderboardCommand = interaction.client.commands.get('leaderboard');
          if (leaderboardCommand && leaderboardCommand.handleSelectMenu) {
            await leaderboardCommand.handleSelectMenu(interaction);
          }
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
        // Select menus True-False missions
        else if (interaction.customId.startsWith('truefalse_difficulty_select_')) {
          await missionHandler.handleTrueFalseDifficultySelect(interaction);
        }
        else if (interaction.customId.startsWith('truefalse_answer_select_')) {
          await missionHandler.handleTrueFalseAnswerSelect(interaction);
        }
        else if (interaction.customId.startsWith('select_truefalse_delete_')) {
          await missionHandler.handleTrueFalseQuestionDelete(interaction);
        }
        // Select menus Emoji-Puzzle missions
        else if (interaction.customId.startsWith('select_emoji_delete_')) {
          await missionHandler.handleEmojiPuzzleDelete(interaction);
        }
        // Select menus Unscramble missions
        else if (interaction.customId.startsWith('select_unscramble_delete_')) {
          await missionHandler.handleUnscrambleWordDelete(interaction);
        }
        // Select menus Hangman (Le Pendu) missions
        else if (interaction.customId.startsWith('select_hangman_delete_')) {
          await missionHandler.handleHangmanWordDelete(interaction);
        }
        // Select menus Wordle missions
        else if (interaction.customId.startsWith('select_wordle_delete_')) {
          await missionHandler.handleWordleWordDelete(interaction);
        }
        else if (interaction.customId.startsWith('mission_max_attempts_select_')) {
          await missionHandler.handleMaxAttemptsSelect(interaction);
        }
        // Select menus de configuration des récompenses de missions
        else if (interaction.customId.startsWith('mission_reward_type_')) {
          await missionHandler.handleRewardTypeSelect(interaction);
        }
        else if (interaction.customId.startsWith('mission_reward_collectible_')) {
          await missionHandler.handleRewardCollectibleSelect(interaction);
        }
        // Select menus du panneau admin
        else if (interaction.customId.startsWith('select_') ||
            interaction.customId.startsWith('edit_bonus_duration_') ||
            interaction.customId.startsWith('template_color_select_') ||
            interaction.customId.startsWith('give_unique_') ||
            interaction.customId.startsWith('campaign_') ||
            interaction.customId.startsWith('trap_') ||
            interaction.customId.startsWith('super_bonus_') ||
            interaction.customId.startsWith('mission_keyword_select_') ||
            interaction.customId.startsWith('frames_condition_select_') ||
            interaction.customId.startsWith('frame_wizard_') ||
            interaction.customId.startsWith('frame_assign_') ||
            interaction.customId.startsWith('collectible_rarity_select_') ||
            interaction.customId === 'gift_image_manage_select') {
          await adminPanelHandler.handleSelectMenu(interaction);
        }
        // Select menu Setup - Sélection de thème préconfigurés
        else if (interaction.customId === 'setup_theme_select') {
          await setupHandler.handleThemeSelect(interaction);
        }
        // Select menu Setup - Filtrer par catégorie
        else if (interaction.customId === 'setup_theme_category') {
          await setupHandler.handleCategorySelect(interaction);
        }
        // Select menus Super-Admin
        else if (interaction.customId.startsWith('superadmin_')) {
          await handleSuperAdminSelect(interaction);
        }
        // Select menus Progression Roles Admin
        else if (interaction.customId.startsWith('progression_role_select_')) {
          await progressionRoleAdminHandler.handleInteraction(interaction);
        }
        // 🃏 Select menu MysteryBox Joker
        else if (interaction.customId.startsWith('joker_collectible_select')) {
          await profileHandler.handleJokerInteraction(interaction);
        }
        // 🎁 Select menu Cadeau Mystère - Prévisualisation Image
        else if (interaction.customId.startsWith('mystery_gift_preview:')) {
          await mysteryGiftHandler.handleInteraction(interaction);
        }
        // 📦 Select menus Mystery Box Config par rareté
        else if (interaction.customId.startsWith('mb_config_')) {
          const mysteryBoxConfigHandler = require('../handlers/mysteryBoxConfigHandler');
          await mysteryBoxConfigHandler.handleInteraction(interaction);
        }
        // Note: role_frame_wizard_select_role est un RoleSelectMenu, routé dans la section RoleSelectMenu plus bas
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
        // Sélection canal dédié aux missions
        else if (interaction.customId === 'select_mission_channel') {
          await adminPanelHandler.handleMissionChannelSelection(interaction);
        }
        // Sélection canal matchmaking Morpion (ancien customId)
        else if (interaction.customId === 'select_tictactoe_channel') {
          await adminPanelHandler.handleTictactoeChannelSelection(interaction);
        }
        // Sélection canal matchmaking Morpion (nouveau customId avec missionId)
        else if (interaction.customId.startsWith('ttt_select_channel_')) {
          await tictactoeHandler.handleSelectChannel(interaction);
        }
        else if (interaction.customId.startsWith('give_unique_channels_select:')) {
          await giveUniqueHandler.handleGiveUniqueChannelsSelect(interaction);
        }
        // Ajouter un canal de distribution (admin panel)
        else if (interaction.customId === 'select_add_channel') {
          await adminPanelHandler.handleAddChannelSelection(interaction);
        }
        // Sélection canaux pour campagne (campaignAdminHandler)
        else if (interaction.customId === 'campaign_channels_select') {
          await campaignAdminHandler.handleInteraction(interaction);
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
        // Fairness exempt roles (système d'équité)
        else if (interaction.customId === 'fairness_exempt_roles_select') {
          const fairnessConfigHandler = require('../handlers/fairnessConfigHandler');
          await fairnessConfigHandler.handleInteraction(interaction);
        }
        // Role Frame Wizard - sélection de rôle pour frames
        else if (interaction.customId === 'role_frame_wizard_select_role') {
          await adminPanelHandler.handleAdminInteraction(interaction);
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

    // Gérer les user select menus
    else if (interaction.isUserSelectMenu()) {
      try {
        // 🎁 Cadeau Mystère - Sélection du destinataire
        if (interaction.customId.startsWith('mystery_gift_recipient:')) {
          await mysteryGiftHandler.handleInteraction(interaction);
        }
        else {
          console.warn(`⚠️ User select menu non géré: ${interaction.customId}`);
        }
      } catch (error) {
        console.error(`🔴 Erreur lors du traitement du user select menu ${interaction.customId}:`, error);

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
    // Nettoyer les permissions temporaires au cas où c'est un thread de mission
    try {
      await missionHandler.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
    } catch (cleanupError) {
      // Ignorer si pas de permissions temporaires
    }
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

  // Démarrer période d'essai (affiche modal)
  if (customId.startsWith('superadmin_start_trial_')) {
    const guildId = customId.replace('superadmin_start_trial_', '');
    return await superAdminHandler.handleStartTrialModal(interaction, guildId);
  }

  // Convertir en premium
  if (customId.startsWith('superadmin_convert_premium_')) {
    const guildId = customId.replace('superadmin_convert_premium_', '');
    return await superAdminHandler.handleConvertToPremium(interaction, guildId);
  }

  // Prolonger période d'essai (affiche modal)
  if (customId.startsWith('superadmin_extend_trial_')) {
    const guildId = customId.replace('superadmin_extend_trial_', '');
    return await superAdminHandler.handleExtendTrialModal(interaction, guildId);
  }

  // Exporter thèmes d'un serveur (affiche sélection)
  if (customId.startsWith('superadmin_export_themes_')) {
    const guildId = customId.replace('superadmin_export_themes_', '');
    return await superAdminHandler.showThemeExportSelection(interaction, guildId);
  }

  // Télécharger un thème en JSON (format v2.3 avec catégorie - nouveau)
  if (customId.startsWith('superadmin_export_download:')) {
    const parts = customId.replace('superadmin_export_download:', '').split(':');
    const guildId = parts[0];
    const themeId = parts[1];
    const categoryCode = parts[2] || 'custom';
    return await superAdminHandler.handleThemeExportDownload(interaction, guildId, themeId, categoryCode);
  }

  // Télécharger un thème en JSON (format ancien - rétrocompatibilité)
  if (customId.startsWith('superadmin_export_download_')) {
    const parts = customId.replace('superadmin_export_download_', '').split('_');
    const guildId = parts[0];
    const themeId = parts[1];
    return await superAdminHandler.handleThemeExportDownload(interaction, guildId, themeId);
  }

  // Sauvegarder un thème dans les templates (format v2.3 avec catégorie - nouveau)
  if (customId.startsWith('superadmin_export_template:')) {
    const parts = customId.replace('superadmin_export_template:', '').split(':');
    const guildId = parts[0];
    const themeId = parts[1];
    const categoryCode = parts[2] || 'custom';
    return await superAdminHandler.handleThemeExportToTemplates(interaction, guildId, themeId, categoryCode);
  }

  // Sauvegarder un thème dans les templates (format ancien - rétrocompatibilité)
  if (customId.startsWith('superadmin_export_template_')) {
    const parts = customId.replace('superadmin_export_template_', '').split('_');
    const guildId = parts[0];
    const themeId = parts[1];
    // Utiliser la nouvelle fonction avec vérification de conflit d'ID
    return await superAdminHandler.handleThemeExportWithIdCheck(interaction, guildId, themeId);
  }

  // Export avec remplacement (overwrite)
  if (customId.startsWith('superadmin_export_overwrite:')) {
    const parts = customId.replace('superadmin_export_overwrite:', '').split(':');
    const guildId = parts[0];
    const themeId = parts[1];
    return await superAdminHandler.handleThemeExportOverwrite(interaction, guildId, themeId);
  }

  // Export avec renommage (timestamp)
  if (customId.startsWith('superadmin_export_rename:')) {
    const parts = customId.replace('superadmin_export_rename:', '').split(':');
    const guildId = parts[0];
    const themeId = parts[1];
    return await superAdminHandler.handleThemeExportRename(interaction, guildId, themeId);
  }

  // Gestion fichiers thèmes - Accès au panneau
  if (customId === 'superadmin_theme_files') {
    return await superAdminHandler.showThemeFilesManagement(interaction);
  }

  // Gestion fichiers thèmes - Voir détails d'un fichier
  if (customId.startsWith('superadmin_theme_file:')) {
    const parts = customId.replace('superadmin_theme_file:', '').split(':');
    const source = parts[0];
    const filename = parts.slice(1).join(':'); // Au cas où le nom contient des ":"
    return await superAdminHandler.showThemeFileDetails(interaction, source, filename);
  }

  // Gestion fichiers thèmes - Éditer emoji (via chat awaitMessages)
  if (customId.startsWith('superadmin_theme_edit_emoji:')) {
    const parts = customId.replace('superadmin_theme_edit_emoji:', '').split(':');
    const source = parts[0];
    const filename = parts.slice(1).join(':');
    return await superAdminHandler.showThemeEmojiPrompt(interaction, source, filename);
  }

  // Gestion fichiers thèmes - Supprimer (confirmation)
  if (customId.startsWith('superadmin_theme_delete:')) {
    const parts = customId.replace('superadmin_theme_delete:', '').split(':');
    const source = parts[0];
    const filename = parts.slice(1).join(':');
    return await superAdminHandler.confirmThemeFileDeletion(interaction, source, filename);
  }

  // Gestion fichiers thèmes - Confirmer suppression
  if (customId.startsWith('superadmin_theme_delete_confirm:')) {
    const parts = customId.replace('superadmin_theme_delete_confirm:', '').split(':');
    const source = parts[0];
    const filename = parts.slice(1).join(':');
    return await superAdminHandler.deleteThemeFile(interaction, source, filename);
  }

  // Gestion fichiers thèmes - Dupliquer
  if (customId.startsWith('superadmin_theme_duplicate:')) {
    const parts = customId.replace('superadmin_theme_duplicate:', '').split(':');
    const source = parts[0];
    const filename = parts.slice(1).join(':');
    return await superAdminHandler.duplicateThemeFile(interaction, source, filename);
  }

  // Gestion fichiers thèmes - Modifier catégorie
  if (customId.startsWith('superadmin_theme_edit_category:')) {
    const parts = customId.replace('superadmin_theme_edit_category:', '').split(':');
    const source = parts[0];
    const filename = parts.slice(1).join(':');
    return await superAdminHandler.showThemeCategorySelect(interaction, source, filename);
  }

  // Gestion catégories - Panneau principal
  if (customId === 'superadmin_categories_manage') {
    return await superAdminHandler.showCategoriesManagement(interaction);
  }

  // Gestion catégories - Ajouter nouvelle
  if (customId === 'superadmin_category_add') {
    return await superAdminHandler.showCategoryModal(interaction);
  }

  // Gestion catégories - Modifier
  if (customId.startsWith('superadmin_category_edit:')) {
    const categoryId = parseInt(customId.replace('superadmin_category_edit:', ''));
    return await superAdminHandler.showCategoryModal(interaction, categoryId);
  }

  // Gestion catégories - Supprimer (confirmation)
  if (customId.startsWith('superadmin_category_delete:') && !customId.includes('_confirm:')) {
    const categoryId = parseInt(customId.replace('superadmin_category_delete:', ''));
    return await superAdminHandler.deleteCategoryConfirm(interaction, categoryId);
  }

  // Gestion catégories - Supprimer (confirmé)
  if (customId.startsWith('superadmin_category_delete_confirm:')) {
    const categoryId = parseInt(customId.replace('superadmin_category_delete_confirm:', ''));
    return await superAdminHandler.deleteCategory(interaction, categoryId);
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

  // Sélection d'un thème à exporter
  if (customId.startsWith('superadmin_export_theme_select_')) {
    const guildId = customId.replace('superadmin_export_theme_select_', '');
    const themeId = interaction.values[0];
    return await superAdminHandler.handleThemeExport(interaction, guildId, themeId);
  }

  // Sélection d'un fichier thème à gérer
  if (customId === 'superadmin_theme_file_select') {
    const value = interaction.values[0]; // Format: "source:filename"
    const [source, ...filenameParts] = value.split(':');
    const filename = filenameParts.join(':');
    return await superAdminHandler.showThemeFileDetails(interaction, source, filename);
  }

  // Sélection d'une catégorie pour voir ses détails
  if (customId === 'superadmin_category_select') {
    const categoryId = parseInt(interaction.values[0]);
    return await superAdminHandler.showCategoryDetails(interaction, categoryId);
  }

  // Sélection d'une catégorie à assigner à un fichier thème
  if (customId.startsWith('superadmin_theme_set_category:')) {
    const parts = customId.replace('superadmin_theme_set_category:', '').split(':');
    const source = parts[0];
    const filename = parts.slice(1).join(':');
    const categoryCode = interaction.values[0];
    return await superAdminHandler.setThemeCategory(interaction, source, filename, categoryCode);
  }

  // Sélection d'une catégorie lors de l'export d'un thème
  if (customId.startsWith('superadmin_export_category:')) {
    const parts = customId.replace('superadmin_export_category:', '').split(':');
    const guildId = parts[0];
    const themeId = parts[1];
    const selectedCategory = interaction.values[0];
    return await superAdminHandler.handleThemeExport(interaction, guildId, themeId, selectedCategory);
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
