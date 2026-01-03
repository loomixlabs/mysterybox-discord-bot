const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const db = require('../utils/database-pg');
const audit = require('../utils/auditLogger');
const themeExpirationHandler = require('./themeExpirationHandler');
const campaignAdminHandler = require('./campaignAdminHandler');
const giveUniqueHandler = require('./giveUniqueHandler');
const trapAdminHandler = require('./trapAdminHandler');
const probabilityHandler = require('./probabilityHandler');
const superBonusHandler = require('./superBonusHandler');
const progressionRoleAdminHandler = require('./progressionRoleAdminHandler');
const dailyRewardsAdminHandler = require('./dailyRewardsAdminHandler');
const mysteryBoxConfigHandler = require('./mysteryBoxConfigHandler');
const craftingConfigHandler = require('./craftingConfigHandler');
const framesConfigHandler = require('./framesConfigHandler');
const { canAccessAdminPanel } = require('../utils/permissions');
const GuildConfig = require('../utils/guildConfig');
const { LOOMIX_BRANDING } = require('../utils/footerHelper');

/**
 * Génère le contenu du panneau admin (embed + components)
 * Fonction partagée utilisée par la commande ET le handler
 * @param {string} guildId - ID du serveur
 * @returns {Promise<{embed: EmbedBuilder, components: ActionRowBuilder[], hasTheme: boolean}>}
 */
async function buildAdminPanelContent(guildId) {
  // Requêtes en PARALLÈLE pour être plus rapide
  const [theme, allThemes, giveChannels, subscriptionStatus] = await Promise.all([
    db.getActiveTheme(guildId),
    db.getAllThemes(guildId),
    db.getAllGiveChannels(guildId),
    GuildConfig.getSubscriptionStatus(guildId)
  ]);

  const config = theme ? await db.getThemeConfig(guildId, theme.id) : null;
  const categories = giveChannels.filter(c => c.type === 'category');
  const channels = giveChannels.filter(c => c.type === 'channel');

  // Helper: Créer la barre de progression mini
  const createMiniProgressBar = (percentage) => {
    const totalBars = 15;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    let fillEmoji = percentage >= 70 ? '🟩' : percentage >= 30 ? '🟨' : '🟥';
    return fillEmoji.repeat(filledBars) + '⬜'.repeat(emptyBars);
  };

  // Générer le texte de durée du thème
  let durationText = '';
  let progressBar = '';

  if (theme) {
    const expirationInfo = themeExpirationHandler.calculateExpiration(theme);

    if (expirationInfo.isUnlimited) {
      durationText = '♾️ **Illimitée**';
    } else if (expirationInfo.notActivated) {
      durationText = `⏸️ Non activé (${theme.duration_days}j configurés)`;
    } else if (expirationInfo.isExpired) {
      durationText = '🔴 **EXPIRÉ**';
      progressBar = '\n' + createMiniProgressBar(0);
    } else {
      const daysText = expirationInfo.daysRemaining === 0 ?
        `⏰ ${expirationInfo.hoursRemaining}h restantes` :
        expirationInfo.daysRemaining === 1 ?
        `⚠️ ${expirationInfo.daysRemaining} jour restant` :
        `⏱️ ${expirationInfo.daysRemaining} jours restants`;

      durationText = `${daysText} (${expirationInfo.percentageRemaining}%)`;
      progressBar = '\n' + createMiniProgressBar(expirationInfo.percentageRemaining);
    }
  }

  // Générer le banner de période d'essai (seulement si trial, rien si premium)
  let subscriptionBanner = '';
  if (subscriptionStatus && subscriptionStatus.status === 'trial') {
    const daysRemaining = subscriptionStatus.days_remaining || 0;
    const expiresAt = subscriptionStatus.expires_at;

    if (daysRemaining <= 0) {
      subscriptionBanner = '🔴 **Période d\'essai expirée**\n\n';
    } else if (daysRemaining <= 3) {
      subscriptionBanner = `⚠️ **Période d'essai:** ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}\n` +
                          `📅 Expire le: <t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:D>\n` +
                          `💎 [Passer en Premium](https://discord.gg/CMfGeQ2Z)\n\n`;
    } else {
      subscriptionBanner = `🆓 **Période d'essai:** ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}\n` +
                          `📅 Expire le: <t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:D>\n\n`;
    }
  }

  // Créer l'embed
  const embed = new EmbedBuilder()
    .setTitle('🎨 PANNEAU D\'ADMINISTRATION')
    .setColor(theme ? '#3498db' : '#e74c3c')
    .setTimestamp();

  if (!theme) {
    // Pas de thème : message d'accueil pour nouveau serveur
    embed.setDescription(
      subscriptionBanner +
      '# 🚀 Bienvenue sur le panneau d\'administration !\n\n' +
      '⚠️ **Aucun thème configuré pour ce serveur**\n\n' +
      '## 📋 Première utilisation ? Lance `/setup`\n\n' +
      'La commande `/setup` est **essentielle** pour configurer le bot :\n' +
      '• ✅ Configure les **rôles administrateurs** du bot\n' +
      '• ✅ Crée le **rôle couleur** pour personnaliser le bot\n' +
      '• ✅ **Vérifie la hiérarchie** des rôles Discord\n' +
      '• ✅ Propose des **thèmes préconfigurés** (Monopoly, Pokémon...)\n' +
      '• ✅ Guide **étape par étape** avec tutoriel intégré\n\n' +
      '**Déjà configuré ?** Utilise "⚙️ Paramétrage" ci-dessous pour créer un thème personnalisé.'
    );
  } else {
    // Thème existant : affichage normal
    embed.setDescription(
      subscriptionBanner +
      `**Thème actif:** ${theme.name}\n` +
      `**Durée:** ${durationText}${progressBar}\n` +
      `**Items requis:** ${theme.required_items}\n` +
      `**Rôle final:** ${theme.final_role_name}\n\n` +
      `**Canaux configurés:**\n` +
      `📂 Catégories: ${categories.length}\n` +
      `📍 Canaux: ${channels.length}\n\n` +
      `Choisis une action ci-dessous :`
    );

    if (config) {
      embed.addFields({
        name: '🎲 Probabilités actuelles',
        value: `🎁 Collectibles: **${config.probability_collectible}%**\n` +
               `📋 Missions: **${config.probability_mission}%**\n` +
               `⚠️ Pièges: **${config.probability_trap}%**\n` +
               `✨ Super Bonus: **${config.probability_super_bonus || 0}%**`,
        inline: true
      });
    }
  }

  // Créer les composants
  const components = [];

  // Select menu pour changer de thème (si plusieurs thèmes existent)
  if (allThemes.length > 1) {
    const themeSelect = new StringSelectMenuBuilder()
      .setCustomId('select_theme')
      .setPlaceholder('🔄 Changer de thème actif')
      .addOptions(
        allThemes.map(t => ({
          label: t.name,
          value: t.id.toString(),
          description: `${t.required_items} items - ${t.duration_days === 0 ? 'Illimité' : `${t.duration_days}j`}`,
          default: t.is_active === 1
        }))
      );
    components.push(new ActionRowBuilder().addComponents(themeSelect));
  }

  // Ligne 1: Give Unique + Lancer Campagne
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_give_unique')
      .setLabel('Lancer un Give Unique')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎁')
      .setDisabled(!theme),
    new ButtonBuilder()
      .setCustomId('admin_launch_campaign')
      .setLabel('Lancer une Campagne')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🚀')
      .setDisabled(!theme)
  );

  // Ligne 2: Paramétrage + Statistiques
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_settings')
      .setLabel('Paramétrage')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚙️'),
    new ButtonBuilder()
      .setCustomId('admin_stats')
      .setLabel('Statistiques')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊')
      .setDisabled(!theme)
  );

  components.push(row1, row2);

  // Bouton "Passer en Premium" uniquement visible en mode trial
  if (subscriptionStatus && subscriptionStatus.status === 'trial') {
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('💎 Passer en Premium')
        .setStyle(ButtonStyle.Link)
        .setURL(LOOMIX_BRANDING.discordInvite)
    );
    components.push(row3);
  }

  return { embed, components, hasTheme: !!theme };
}

/**
 * Handler pour le panneau d'administration
 */
class AdminPanelHandler {
  constructor() {
    // Map pour stocker temporairement les URLs d'images uploadées (pour collectibles et mystery box)
    // Les templates utilisent le système hybride qui met à jour la DB directement
    this.imageUploadCache = new Map();
  }

  /**
   * Gérer les interactions du panneau admin
   */
  async handleAdminInteraction(interaction) {
    const customId = interaction.customId;

    console.log('🔍 [DEBUG ADMIN] handleAdminInteraction appelé');
    console.log('🔍 [DEBUG ADMIN] customId:', customId);
    console.log('🔍 [DEBUG ADMIN] interaction type:', interaction.type);

    // Vérifier les permissions (système à 3 niveaux)
    if (!(await canAccessAdminPanel(interaction))) {
      return interaction.reply({
        content: '❌ Accès refusé. Seuls les administrateurs peuvent utiliser ce panneau.',
        flags: 64
      });
    }

    // Router selon le customId
    if (customId === 'admin_refresh') {
      await this.handleRefresh(interaction);
    }

    // NOUVEAUX MENUS PRINCIPAUX
    // Gestion du Give Unique (délégation vers giveUniqueHandler)
    else if (
      customId === 'admin_give_unique' ||
      customId === 'give_unique_mode_select' ||
      customId.startsWith('give_unique_item_select:') ||
      customId.startsWith('give_unique_channels_select:') ||
      customId === 'give_unique_random' ||
      customId === 'give_unique_here' ||
      customId.startsWith('give_unique_channel_random:') ||
      customId.startsWith('give_unique_channel_specific:') ||
      customId.startsWith('give_unique_channel_back:') ||
      customId.startsWith('give_unique_launch:')
    ) {
      return giveUniqueHandler.handleInteraction(interaction);
    }
    // Gestion des pièges (délégation vers trapAdminHandler)
    else if (customId === 'admin_traps' || customId.startsWith('trap_') || customId.startsWith('select_trap')) {
      return trapAdminHandler.handleInteraction(interaction);
    }
    // Gestion des Mystery Boxes par rareté (délégation vers mysteryBoxConfigHandler)
    else if (customId.startsWith('mb_config_')) {
      return mysteryBoxConfigHandler.handleInteraction(interaction);
    }
    // 🔨 Gestion du Crafting Config (délégation vers craftingConfigHandler)
    else if (customId.startsWith('craft_config_')) {
      return craftingConfigHandler.handleCraftingConfigInteraction(interaction);
    }
    else if (customId === 'admin_settings') {
      await this.showSettingsMenu(interaction);
    } else if (customId === 'admin_stats') {
      await this.showStats(interaction);
    }

    // SOUS-MENU PARAMÉTRAGE
    else if (customId === 'admin_themes' || customId === 'theme_admin_main') {
      await this.showThemesMenu(interaction);
    } else if (customId === 'admin_theme_config') {
      await this.showThemeConfigMenu(interaction);
    } else if (customId === 'admin_collectibles') {
      await this.showCollectiblesMenu(interaction);
    } else if (customId === 'admin_missions') {
      await this.showMissionsMenu(interaction);
    }
    // Gestion des Super Bonus (délégation vers superBonusHandler)
    else if (
      customId === 'admin_super_bonuses' ||
      customId === 'super_bonus_select' ||
      customId === 'super_bonus_enable_all' ||
      customId === 'super_bonus_disable_all' ||
      customId.startsWith('bonus_toggle_')
    ) {
      const superBonusHandler = require('./superBonusHandler');

      // Router vers la fonction appropriée
      if (customId === 'admin_super_bonuses') {
        return superBonusHandler.showSuperBonusesAdminPanel(interaction);
      } else if (customId === 'super_bonus_enable_all') {
        return superBonusHandler.enableAllSuperBonuses(interaction);
      } else if (customId === 'super_bonus_disable_all') {
        return superBonusHandler.disableAllSuperBonuses(interaction);
      } else if (customId.startsWith('bonus_toggle_')) {
        const bonusId = parseInt(customId.split('_')[2]);
        return superBonusHandler.toggleSuperBonus(interaction, bonusId);
      } else if (customId === 'super_bonus_select') {
        // Le select menu retourne le bonusId dans interaction.values[0]
        const selectedValue = interaction.values[0]; // Format: "bonus_toggle_123"
        const bonusId = parseInt(selectedValue.split('_')[2]);
        return superBonusHandler.toggleSuperBonus(interaction, bonusId);
      }
    }
    // Anciens menus d'édition de bonus (garder pour compatibilité)
    else if (customId === 'admin_bonus_edit_rarity') {
      await this.showEditBonusRarityMenu(interaction);
    } else if (customId === 'admin_bonus_edit_duration') {
      await this.showEditBonusDurationMenu(interaction);
    } else if (customId.startsWith('duration_type_permanent:')) {
      await this.handleDurationTypePermanent(interaction);
    } else if (customId.startsWith('duration_type_temporary:')) {
      await this.handleDurationTypeTemporary(interaction);
    } else if (customId.startsWith('duration_type_charges:')) {
      await this.handleDurationTypeCharges(interaction);
    } else if (customId === 'admin_channels') {
      await this.showChannelsMenu(interaction);
    } else if (customId === 'admin_announcements') {
      await this.showAnnouncementsMenu(interaction);
    } else if (customId === 'announcements_collectibles') {
      await this.showAnnouncementsCollectiblesMenu(interaction);
    } else if (customId === 'announcements_missions') {
      await this.showAnnouncementsMissionsMenu(interaction);
    } else if (customId === 'announcements_themes') {
      await this.showAnnouncementsThemesMenu(interaction);
    } else if (customId === 'announcements_traps') {
      await this.showAnnouncementsTrapsMenu(interaction);
    }

    // Gestion des récompenses quotidiennes (délégation vers dailyRewardsAdminHandler)
    else if (customId === 'admin_daily_rewards' || customId.startsWith('daily_admin_')) {
      return dailyRewardsAdminHandler.handleDailyRewardsAdmin(interaction);
    }

    // Gestion du système d'équité (délégation vers fairnessConfigHandler)
    else if (customId === 'admin_fairness' || customId.startsWith('fairness_')) {
      const fairnessConfigHandler = require('./fairnessConfigHandler');
      if (customId === 'admin_fairness') {
        return fairnessConfigHandler.showMainMenu(interaction);
      }
      return fairnessConfigHandler.handleInteraction(interaction);
    }

    // Gestion des probabilités (délégation vers probabilityHandler)
    else if (customId === 'admin_probabilities' || customId.startsWith('probability_')) {
      return probabilityHandler.handleInteraction(interaction);
    }

    // Gestion des rôles de progression (délégation vers progressionRoleAdminHandler)
    else if (
      customId === 'admin_progression_roles' ||
      customId.startsWith('progression_role') ||
      customId === 'modal_add_progression_role' ||
      customId.startsWith('modal_edit_progression_role:')
    ) {
      return progressionRoleAdminHandler.handleInteraction(interaction);
    }

    // Gestion des frames (délégation vers framesConfigHandler)
    else if (
      customId === 'admin_frames' ||
      customId.startsWith('frames_') ||
      customId.startsWith('modal_frame_')
    ) {
      return framesConfigHandler.handleInteraction(interaction);
    }

    // Gestion des campagnes (délégation vers campaignAdminHandler)
    else if (
      customId === 'admin_campaigns_manage' ||
      customId === 'campaign_refresh' ||
      customId === 'campaign_manage_back' ||
      customId === 'campaign_view_all' ||
      customId === 'campaign_history' ||
      customId === 'campaign_select' ||
      customId.startsWith('campaign_pause_') ||
      customId.startsWith('campaign_resume_') ||
      customId.startsWith('campaign_stop_') ||
      customId.startsWith('campaign_delete_') ||
      customId === 'admin_launch_campaign' ||
      customId === 'campaign_wizard_mode_burst' ||
      customId === 'campaign_wizard_mode_schedule' ||
      customId === 'campaign_wizard_channels_random' ||
      customId === 'campaign_wizard_channels_specific' ||
      customId === 'campaign_wizard_confirm' ||
      customId === 'campaign_wizard_cancel'
    ) {
      return campaignAdminHandler.handleInteraction(interaction);
    }

    // Gestion des thèmes (création/suppression)
    else if (customId === 'theme_create') {
      await this.showCreateThemeModal(interaction);
    } else if (customId === 'theme_extend') {
      await this.showExtendThemeModal(interaction);
    } else if (customId.startsWith('theme_delete_confirm_')) {
      await this.handleDeleteTheme(interaction);
    }

    // Configuration du thème
    if (customId === 'theme_image') {
      await this.handleImageUpload(interaction, 'Mystery Box - Image');
    } else if (customId === 'theme_title') {
      await this.showTitleModal(interaction);
    } else if (customId === 'theme_duration') {
      await this.showDurationQuickMenu(interaction);
    } else if (customId.startsWith('duration_quick_')) {
      await this.handleQuickDuration(interaction);
    } else if (customId.startsWith('duration_confirm_')) {
      await this.applyQuickDuration(interaction);
    } else if (customId === 'duration_cancel') {
      await this.cancelDurationChange(interaction);
    } else if (customId === 'duration_custom') {
      await this.showDurationModal(interaction);
    } else if (customId === 'theme_winner_message') {
      await this.showCelebrationTutorial(interaction);
    } else if (customId === 'theme_winner_message_open_modal') {
      await this.showWinnerMessageModal(interaction);
    } else if (customId === 'mystery_box_toggle_auto_delete') {
      await this.toggleAutoDeleteCelebration(interaction);
    } else if (customId === 'mystery_box_image') {
      await this.handleImageUpload(interaction, 'Mystery Box - Image');
    } else if (customId === 'mystery_box_title') {
      await this.showTitleModal(interaction);
    } else if (customId === 'mystery_box_winner_message') {
      await this.showWinnerMessageModal(interaction);
    } else if (customId === 'mystery_box_celebration_gif') {
      await this.showCelebrationTutorial(interaction);
    } else if (customId === 'theme_config_refresh') {
      await this.showThemeConfigMenu(interaction);
    } else if (customId === 'theme_config_back') {
      await this.showSettingsMenu(interaction);
    }

    // Collectibles
    else if (customId === 'collectible_add' || customId.startsWith('collectible_add_')) {
      // Extraire l'ID du thème si présent, sinon utiliser le thème actif
      const themeId = customId.includes('_') && customId !== 'collectible_add' ? parseInt(customId.split('_').pop()) : null;

      // Répondre immédiatement à l'interaction sans modifier le message
      await interaction.deferUpdate();

      console.log(`📝 Création du thread de création de collectible pour themeId: ${themeId}`);

      // Créer le thread directement sans passer par handleImageUpload (qui causerait une erreur d'interaction déjà répondue)
      try {
        const channel = interaction.channel;
        const thread = await channel.threads.create({
          name: `🎁 Ajouter un Collectible - ${interaction.user.username}`,
          autoArchiveDuration: 60,
          type: 12, // PRIVATE_THREAD
          reason: `Création de collectible pour thème ${themeId}`
        });

        await thread.members.add(interaction.user.id);

        // Sauvegarder dans le cache APRÈS la création du thread
        this.imageUploadCache.set(interaction.user.id, {
          themeId,
          adminPanelMessage: interaction.message,
          adminPanelChannelId: interaction.channelId
        });

        // Envoyer les instructions dans le thread
        await thread.send({
          content: `🎁 **CRÉATION D'UN COLLECTIBLE**\n\n` +
            `📝 **Étapes à suivre:**\n\n` +
            `**1️⃣ Upload de l'image**\n` +
            `• Drag & drop ton image du collectible ici\n` +
            `• Ou colle un screenshot (Ctrl+V)\n` +
            `• Formats acceptés: PNG, JPG, GIF, WEBP\n\n` +
            `**2️⃣ Choix de la rareté**\n` +
            `• Une fois l'image uploadée, des boutons apparaîtront\n` +
            `• Clique sur la rareté souhaitée (Common, Rare, Epic, Legendary)\n\n` +
            `**3️⃣ Détails du collectible**\n` +
            `• Un formulaire s'ouvrira automatiquement\n` +
            `• Remplis le nom et la description du collectible\n\n` +
            `⏱️ Tu as **2 minutes** pour uploader l'image\n\n` +
            `💡 Astuce: Choisis une image claire et représentative du collectible !`
        });

        // Envoyer un message éphémère (visible uniquement par l'utilisateur)
        await interaction.followUp({
          content: `🎁 **Thread de création de collectible ouvert !**\n\n` +
            `Rejoins le thread pour créer ton collectible : ${thread}\n\n` +
            `📝 Suis les instructions dans le thread pour compléter la création.`,
          flags: 64 // Ephemeral
        });

        // Créer le collector pour l'upload d'image (attachment OU URL)
        const filter = (m) => {
          if (m.author.id !== interaction.user.id) return false;
          if (m.attachments.size > 0) return true;
          const urlPattern = /https?:\/\/[^\s]+/i;
          if (urlPattern.test(m.content)) return true;
          return false;
        };
        const collector = thread.createMessageCollector({
          filter,
          time: 120000, // 2 minutes
          max: 1
        });

        collector.on('collect', async (message) => {
          let imageUrl;

          // Cas 1: Attachment (fichier uploadé)
          if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

            if (!validImageTypes.includes(attachment.contentType)) {
              await thread.send('❌ Le fichier doit être une image (PNG, JPG, GIF, WEBP).');
              return;
            }

            imageUrl = attachment.url;
          }
          // Cas 2: URL collée
          else {
            const urlPattern = /https?:\/\/[^\s]+/i;
            const match = message.content.match(urlPattern);
            if (match) {
              imageUrl = match[0].replace(/[<>)}\]]+$/, '');
            } else {
              await thread.send('❌ URL invalide. Colle une URL commençant par http:// ou https://');
              return;
            }
          }

          // Sauvegarder l'image dans le cache
          const existingCache = this.imageUploadCache.get(interaction.user.id) || {};
          this.imageUploadCache.set(interaction.user.id, {
            ...existingCache,
            url: imageUrl,
            timestamp: Date.now(),
            context: 'Collectible Creation',
            threadId: thread.id
          });

          console.log(`💾 Image mise en cache pour ${interaction.user.id}: ${imageUrl}`);

          // Créer les boutons de sélection de rareté
          const rarityRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(themeId ? `rarity_common_${themeId}` : 'rarity_common')
              .setLabel('⭐ Common')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(themeId ? `rarity_rare_${themeId}` : 'rarity_rare')
              .setLabel('💎 Rare')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(themeId ? `rarity_epic_${themeId}` : 'rarity_epic')
              .setLabel('🔮 Epic')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(themeId ? `rarity_legendary_${themeId}` : 'rarity_legendary')
              .setLabel('✨ Legendary')
              .setStyle(ButtonStyle.Danger)
          );

          const cancelRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('thread_cancel_collectible')
              .setLabel('❌ Annuler')
              .setStyle(ButtonStyle.Danger)
          );

          const rarityEmbed = new EmbedBuilder()
            .setTitle('🎁 AJOUTER UN COLLECTIBLE')
            .setColor('#2ecc71')
            .setDescription(
              `✅ **Image uploadée avec succès!**\n\n` +
              `Choisis la rareté du collectible ci-dessous:\n\n` +
              `⭐ **Common** - Facile à trouver\n` +
              `💎 **Rare** - Peu commun\n` +
              `🔮 **Epic** - Très rare\n` +
              `✨ **Legendary** - Extrêmement rare\n\n` +
              `Après avoir choisi la rareté, un formulaire s'ouvrira pour compléter les détails du collectible.`
            )
            .setThumbnail(imageUrl)
            .setFooter({ text: '⏱️ Tu as 5 minutes pour choisir' });

          await thread.send({
            embeds: [rarityEmbed],
            components: [rarityRow, cancelRow]
          });

          console.log(`✅ Boutons de rareté envoyés dans le thread pour ${interaction.user.username}`);
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            await thread.send('⏱️ **Temps écoulé.** Aucune image reçue.\n\n🔒 Ce thread sera archivé dans 5 secondes...');
            setTimeout(async () => {
              try {
                await thread.setArchived(true);
              } catch (error) {
                console.warn('⚠️ Impossible d\'archiver le thread:', error);
              }
            }, 5000);
          }
        });

      } catch (error) {
        console.error('❌ Erreur lors de la création du thread:', error);
        await interaction.followUp({
          content: '❌ Une erreur est survenue lors de la création du thread.',
          flags: 64
        });
      }
    }
    // Boutons de rareté dans le thread (rarity_common_13, rarity_rare_13, etc.)
    else if (customId.startsWith('rarity_')) {
      await this.handleRaritySelection(interaction);
    }
    // Annuler l'upload d'image
    else if (customId === 'collectible_cancel') {
      // Récupérer le themeId avant de supprimer le cache
      const cachedData = this.imageUploadCache.get(interaction.user.id);
      const themeId = cachedData?.themeId;

      // Supprimer le cache
      this.imageUploadCache.delete(interaction.user.id);

      // Simuler une interaction avec le themeId pour afficher le panneau
      if (themeId) {
        // Créer un customId temporaire avec le themeId
        const originalCustomId = interaction.customId;
        interaction.customId = `theme_manage_collectibles_${themeId}`;
        await this.showManageCollectiblesMenu(interaction);
        interaction.customId = originalCustomId;
      } else {
        // Utiliser le thème actif
        const theme = await db.getActiveTheme(interaction.guildId);
        interaction.customId = `theme_manage_collectibles_${theme.id}`;
        await this.showManageCollectiblesMenu(interaction);
      }
    } else if (customId.startsWith('collectible_delete_confirm_')) {
      // Confirmation de suppression (nouveau flow)
      await this.showDeleteCollectibleConfirmation(interaction);
    } else if (customId.startsWith('collectible_delete_')) {
      await this.handleDeleteCollectible(interaction);
    } else if (customId.startsWith('collectible_edit_image_')) {
      // Édition de l'image via thread
      await this.handleEditCollectibleImage(interaction);
    } else if (customId.startsWith('collectible_edit_')) {
      // Édition des infos du collectible (modal)
      await this.showEditCollectibleModal(interaction);
    } else if (customId.startsWith('collectibles_page_')) {
      // Pagination des collectibles
      const page = parseInt(customId.split('_').pop());
      await this.showCollectiblesMenu(interaction, page);
    } else if (customId === 'collectibles_refresh') {
      // Rafraîchir la liste (page 0)
      await this.showCollectiblesMenu(interaction, 0);
    } else if (customId.startsWith('collectible_refresh_')) {
      // Rafraîchir les détails du collectible
      const collectibleId = customId.split('_')[2];
      interaction.values = [collectibleId];
      await this.handleManageCollectibleSelection(interaction);
    } else if (customId === 'admin_close_message') {
      // Fermer complètement l'éphémère
      await interaction.update({
        content: 'Message fermé.',
        embeds: [],
        components: []
      });
    } else if (customId.startsWith('theme_manage_collectibles_')) {
      await this.showManageCollectiblesMenu(interaction);
    }
    // Boutons de sélection de rareté depuis le thread
    else if (customId.startsWith('rarity_')) {
      await this.handleRaritySelection(interaction);
    }
    // Bouton annuler depuis le thread
    else if (customId === 'thread_cancel_collectible') {
      await this.handleThreadCancelCollectible(interaction);
    }
    // Bouton annuler édition image depuis le thread
    else if (customId.startsWith('thread_cancel_edit_image_')) {
      await this.handleThreadCancelEditImage(interaction);
    }

    // Gestion des canaux
    else if (customId === 'channel_add_category') {
      await this.showAddCategorySelector(interaction);
    } else if (customId === 'channel_add_single') {
      await this.showAddChannelSelector(interaction);
    } else if (customId === 'channel_delete_category') {
      await this.showDeleteCategorySelector(interaction);
    } else if (customId === 'channel_delete_single') {
      await this.showDeleteChannelSelector(interaction);
    }

    // Gestion des annonces
    else if (customId === 'change_announcement_channel') {
      await this.showChangeAnnouncementChannelSelector(interaction);
    } else if (customId === 'delete_announcement_channel') {
      await this.handleDeleteAnnouncementChannel(interaction);
    } else if (customId === 'manual_announcement_channel_id') {
      await this.showManualAnnouncementChannelModal(interaction);
    } else if (customId.startsWith('toggle_')) {
      await this.handleToggleAnnouncementSetting(interaction);
    } else if (customId === 'edit_announcement_templates') {
      await this.showTemplatesListMenu(interaction);
    } else if (customId === 'select_template_to_edit') {
      await this.showEditTemplateMenu(interaction);
    } else if (customId.startsWith('edit_template_')) {
      await this.showEditTemplateMenu(interaction);
    } else if (customId.startsWith('template_edit_text_')) {
      await this.showTemplateTextModal(interaction);
    } else if (customId.startsWith('template_preview_')) {
      await this.handleTemplatePreview(interaction);
    } else if (customId.startsWith('template_edit_color_')) {
      await this.showTemplateColorModal(interaction);
    } else if (customId.startsWith('template_upload_image_')) {
      const templateType = customId.replace('template_upload_image_', '');
      const templateLabels = {
        legendary_collectible: 'Collectible Légendaire',
        collection_completed: 'Collection Complétée',
        collection_traded: 'Échange de Collection',
        collection_lost: 'Collection Perdue',
        trap_cooldown: 'Piège Cooldown',
        trap_lose_collectible: 'Piège Voleur',
        trap_public_shame: 'Piège de la Honte',
        trap_empty_box: 'Boîte Vide',
        trap_lose_all_collectibles: 'Piège Dévastateur',
        mission_word_guessed: 'Mot Deviné',
        mission_started: 'Mission Lancée',
        mission_completed: 'Mission Réussie',
        mission_failed: 'Mission Échouée',
        mission_approved: 'Mission Approuvée',
        mission_rejected: 'Mission Refusée',
        theme_expired: 'Thème Expiré',
        theme_expiring_soon: 'Expiration Prochaine'
      };
      const context = `Template ${templateLabels[templateType]} - Image principale`;
      await this.handleImageUpload(interaction, context);
    } else if (customId.startsWith('template_upload_thumbnail_')) {
      const templateType = customId.replace('template_upload_thumbnail_', '');
      const templateLabels = {
        legendary_collectible: 'Collectible Légendaire',
        collection_completed: 'Collection Complétée',
        collection_traded: 'Échange de Collection',
        collection_lost: 'Collection Perdue',
        trap_cooldown: 'Piège Cooldown',
        trap_lose_collectible: 'Piège Voleur',
        trap_public_shame: 'Piège de la Honte',
        trap_empty_box: 'Boîte Vide',
        trap_lose_all_collectibles: 'Piège Dévastateur',
        mission_word_guessed: 'Mot Deviné',
        mission_started: 'Mission Lancée',
        mission_completed: 'Mission Réussie',
        mission_failed: 'Mission Échouée',
        mission_approved: 'Mission Approuvée',
        mission_rejected: 'Mission Refusée',
        theme_expired: 'Thème Expiré',
        theme_expiring_soon: 'Expiration Prochaine'
      };
      const context = `Template ${templateLabels[templateType]} - Thumbnail`;
      await this.handleImageUpload(interaction, context);
    } else if (customId.startsWith('template_reset_')) {
      await this.handleTemplateReset(interaction);
    }

    // Gestion des missions
    else if (customId === 'mission_add') {
      await this.showMissionTypeSelector(interaction);
    } else if (customId === 'mission_revealed_gif_config') {
      await this.handleImageUpload(interaction, 'Mission Revealed GIF');
    } else if (customId.startsWith('mission_delete_confirm_')) {
      await this.handleDeleteMission(interaction);
    } else if (customId === 'mission_modify') {
      await this.showMissionEditModal(interaction);
    } else if (customId.startsWith('mission_timeout_config_')) {
      await this.handleMissionTimeoutConfig(interaction);
    } else if (customId.startsWith('mission_channels_config_')) {
      await this.handleMissionChannelsConfig(interaction);
    } else if (customId.startsWith('mission_channels_clear_')) {
      await this.handleMissionChannelsClear(interaction);
    }
    // Gestion des mots-clés de mission
    else if (customId.startsWith('mission_keywords_manage_')) {
      await this.handleMissionKeywordsManage(interaction);
    } else if (customId.startsWith('mission_keyword_add_')) {
      await this.handleMissionKeywordAdd(interaction);
    } else if (customId.startsWith('mission_keyword_edit_')) {
      await this.handleMissionKeywordEdit(interaction);
    } else if (customId.startsWith('mission_keyword_delete_')) {
      await this.handleMissionKeywordDelete(interaction);
    }

    // Gestion des pièges (délégation vers trapAdminHandler)
    else if (customId.startsWith('trap_')) {
      return trapAdminHandler.handleInteraction(interaction);
    }

    // Retour au menu principal
    else if (customId === 'admin_back' || customId === 'admin_panel_home') {
      await this.handleRefresh(interaction);
    }
  }

  /**
   * Gérer les select menus
   */
  async handleSelectMenu(interaction) {
    const customId = interaction.customId;

    // ⚠️ IMPORTANT: Déléguer AVANT de déférer pour éviter double defer
    // Give Unique - Déléguer à giveUniqueHandler (qui fera son propre defer)
    if (customId.startsWith('give_unique_')) {
      return giveUniqueHandler.handleInteraction(interaction);
    }

    // Campagnes - Déléguer à campaignAdminHandler (qui fera son propre defer)
    if (customId.startsWith('campaign_')) {
      return campaignAdminHandler.handleInteraction(interaction);
    }

    // Pièges - Déléguer à trapAdminHandler (qui fera son propre defer)
    if (customId === 'select_trap' || customId === 'select_trap_type' ||
        customId.startsWith('select_trap_severity_') || customId.startsWith('select_change_trap_severity_')) {
      return trapAdminHandler.handleInteraction(interaction);
    }

    // Super Bonus - Déléguer à superBonusHandler (qui fera son propre defer)
    if (customId === 'super_bonus_select') {
      // Le select menu retourne le bonusId dans interaction.values[0]
      const selectedValue = interaction.values[0]; // Format: "bonus_toggle_123"
      const bonusId = parseInt(selectedValue.split('_')[2]);
      return superBonusHandler.toggleSuperBonus(interaction, bonusId);
    }
    if (customId === 'select_duration_for_bonus') {
      return superBonusHandler.handleBonusDurationSelect(interaction);
    }
    if (customId.startsWith('edit_bonus_duration_hours:')) {
      return superBonusHandler.handleEditBonusDurationHours(interaction);
    }
    if (customId.startsWith('edit_bonus_duration_days:')) {
      return superBonusHandler.handleEditBonusDurationDays(interaction);
    }
    if (customId.startsWith('edit_bonus_duration_charges:')) {
      return superBonusHandler.handleEditBonusDurationCharges(interaction);
    }
    // select_mission_type doit afficher un modal - PAS de deferUpdate avant showModal
    if (customId === 'select_mission_type') {
      return this.handleMissionTypeSelection(interaction);
    }

    // Rôles de Progression - Déléguer à progressionRoleAdminHandler (qui fera son propre defer)
    if (customId === 'progression_role_select_edit' || customId === 'progression_role_select_delete') {
      return progressionRoleAdminHandler.handleInteraction(interaction);
    }

    // Mystery Box Config - Déléguer à mysteryBoxConfigHandler (qui fera son propre defer)
    if (customId.startsWith('mb_config_')) {
      return mysteryBoxConfigHandler.handleInteraction(interaction);
    }

    // 🔨 Crafting Config - Déléguer à craftingConfigHandler
    if (customId.startsWith('craft_config_')) {
      return craftingConfigHandler.handleCraftingConfigInteraction(interaction);
    }

    // 🖼️ Frames Config - Déléguer à framesConfigHandler (qui fera son propre defer)
    if (customId.startsWith('frames_condition_select_')) {
      return framesConfigHandler.handleInteraction(interaction);
    }

    // ✅ CRITIQUE: Déférer IMMÉDIATEMENT (sauf pour les délégations ci-dessus)
    await interaction.deferUpdate();

    // Vérifier les permissions (système à 3 niveaux)
    if (!(await canAccessAdminPanel(interaction))) {
      return interaction.editReply({
        content: '❌ Accès refusé. Seuls les administrateurs peuvent utiliser ce panneau.',
        components: []
      });
    }

    // Router selon le customId
    if (customId === 'select_theme') {
      await this.handleThemeSelection(interaction);
    } else if (customId === 'select_theme_delete') {
      await this.handleThemeDeleteConfirmation(interaction);
    } else if (customId === 'select_collectible' || customId.startsWith('select_collectible_page_')) {
      await this.handleCollectibleSelection(interaction);
    }
    // Changement de rareté d'un collectible depuis la vue détail
    else if (customId.startsWith('collectible_rarity_select_')) {
      await this.handleCollectibleRarityChange(interaction);
    }
    // Sélections pour l'édition de rareté des super bonuses (AVANT select_rarity_ pour éviter conflit)
    else if (customId === 'select_bonus_for_rarity_edit') {
      await this.handleBonusRaritySelect(interaction);
    } else if (customId.startsWith('select_rarity_for_bonus:')) {
      await this.saveBonusRarity(interaction);
    }
    // Ancien système (rétrocompatibilité - à supprimer plus tard)
    else if (customId.startsWith('select_duration_days:')) {
      await this.handleSelectDurationDays(interaction);
    } else if (customId.startsWith('select_duration_hours:')) {
      await this.handleSelectDurationHours(interaction);
    } else if (customId.startsWith('select_duration_charges:')) {
      await this.handleSelectDurationCharges(interaction);
    }
    // Sélections pour les collectibles (rareté)
    else if (customId === 'select_rarity' || customId.startsWith('select_rarity_')) {
      await this.handleRaritySelection(interaction);
    } else if (customId === 'select_manage_collectible') {
      await this.handleManageCollectibleSelection(interaction);
    } else if (customId === 'select_template_to_edit') {
      await this.showEditTemplateMenu(interaction);
    }
    // Sélections pour la gestion des canaux
    else if (customId === 'select_add_category') {
      await this.handleAddCategorySelection(interaction);
    } else if (customId === 'select_add_channel') {
      await this.handleAddChannelSelection(interaction);
    } else if (customId === 'select_delete_category') {
      await this.handleDeleteCategorySelection(interaction);
    } else if (customId === 'select_delete_channel') {
      await this.handleDeleteChannelSelection(interaction);
    }
    // Sélections pour les annonces
    else if (customId === 'select_announcement_channel') {
      await this.handleAnnouncementChannelSelection(interaction);
    }
    // Sélection de couleur pour les templates
    else if (customId.startsWith('template_color_select_')) {
      await this.handleTemplateColorSelection(interaction);
    }
    // Sélections pour les missions (select_mission_type est traité plus haut, AVANT deferUpdate)
    else if (customId === 'select_mission' || customId.startsWith('select_mission_')) {
      await this.handleMissionSelection(interaction);
    } else if (customId.startsWith('select_mission_channels_')) {
      await this.handleMissionChannelsSelection(interaction);
    }
    // Sélection d'un mot-clé à modifier/supprimer
    else if (customId.startsWith('mission_keyword_select_')) {
      await this.handleMissionKeywordSelection(interaction);
    }
  }

  /**
   * Rafraîchir le panneau principal - Utilise la fonction partagée
   */
  async handleRefresh(interaction) {
    const { embed, components } = await buildAdminPanelContent(interaction.guildId);

    return interaction.update({
      embeds: [embed],
      components: components
    });
  }

  /**
   * Gérer la sélection d'un thème
   * NOTE: L'interaction est déjà déférée par handleSelectMenu() - utiliser editReply
   */
  async handleThemeSelection(interaction) {
    try {
      const themeId = parseInt(interaction.values[0]);
      const guildId = interaction.guildId;

      await db.setActiveTheme(guildId, themeId);

      const newTheme = await db.getActiveTheme(guildId);

      // Rafraîchir l'embed avec editReply (car déjà déféré par handleSelectMenu)
      const { embed, components } = await buildAdminPanelContent(guildId);
      await interaction.editReply({
        embeds: [embed],
        components: components
      });

      // Message de confirmation
      await interaction.followUp({
        content: `✅ Thème actif changé : **${newTheme.name}**`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors du changement de thème:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Menu gestion des thèmes (création/suppression)
   */
  async showThemesMenu(interaction) {
    try {
      const allThemes = await db.getAllThemes(interaction.guildId);

      // Calculer les informations d'expiration pour chaque thème
      const themesWithExpiration = allThemes.map(theme => {
        const expirationInfo = themeExpirationHandler.calculateExpiration(theme);
        return { theme, expirationInfo };
      });

      // Fonction pour créer la barre de progression mini
      const createMiniProgressBar = (percentage) => {
        const totalBars = 10;
        const filledBars = Math.round((percentage / 100) * totalBars);
        const emptyBars = totalBars - filledBars;

        let fillEmoji;
        if (percentage >= 70) fillEmoji = '🟩';
        else if (percentage >= 30) fillEmoji = '🟨';
        else fillEmoji = '🟥';

        return fillEmoji.repeat(filledBars) + '⬜'.repeat(emptyBars);
      };

      // Créer la description avec les thèmes et leurs barres de progression
      const themesDescription = themesWithExpiration.map(({ theme, expirationInfo }) => {
        let statusEmoji = theme.is_active ? '✅' : '⭐';
        let durationText = '';
        let progressBar = '';

        if (expirationInfo.isUnlimited) {
          durationText = '♾️ Illimitée';
        } else if (expirationInfo.notActivated) {
          durationText = `⏸️ Non activé (${theme.duration_days}j configurés)`;
        } else if (expirationInfo.isExpired) {
          statusEmoji = '🔴';
          durationText = '❌ EXPIRÉ';
          progressBar = '\n' + createMiniProgressBar(0);
        } else {
          const daysText = expirationInfo.daysRemaining === 0 ?
            `⏰ ${expirationInfo.hoursRemaining}h restantes` :
            expirationInfo.daysRemaining === 1 ?
            `⚠️ ${expirationInfo.daysRemaining} jour restant` :
            `⏱️ ${expirationInfo.daysRemaining} jours restants`;

          durationText = `${daysText} (${expirationInfo.percentageRemaining}%)`;
          progressBar = '\n' + createMiniProgressBar(expirationInfo.percentageRemaining);
        }

        return (
          `${statusEmoji} **${theme.name}**\n` +
          `└ 🆔 ID: \`${theme.theme_id}\`\n` +
          `└ ⏱️ Durée: ${durationText}\n` +
          (progressBar ? `└ ${progressBar}\n` : '') +
          `└ 🎯 Items: ${theme.required_items} | 🎭 Rôle: ${theme.final_role_name || 'Non défini'}`
        );
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle('🎨 GESTION DES THÈMES')
        .setDescription(
          `📚 **${allThemes.length} thème(s) existant(s)**\n\n` +
          (allThemes.length > 0 ? themesDescription : '❌ Aucun thème créé') +
          '\n\n━━━━━━━━━━━━━━━━━━━━\n\n' +
          '**💡 Légende:**\n' +
          '✅ Actif | ⭐ Inactif | 🔴 Expiré\n' +
          '🟩 Bonne durée | 🟨 Moyenne | 🟥 Critique\n\n' +
          '**Actions disponibles:**'
        )
        .setColor('#9b59b6')
        .setTimestamp();

      const components = [];

      // Boutons d'action
      const row1Buttons = [
        new ButtonBuilder()
          .setCustomId('theme_create')
          .setLabel('➕ Créer un Thème')
          .setStyle(ButtonStyle.Success)
      ];

      // Ajouter bouton prolongation si un thème actif existe
      const activeTheme = allThemes.find(t => t.is_active);
      if (activeTheme && activeTheme.duration_days !== null) {
        row1Buttons.push(
          new ButtonBuilder()
            .setCustomId('theme_extend')
            .setLabel('⏰ Prolonger le Thème Actif')
            .setStyle(ButtonStyle.Primary)
        );
      }

      // Bouton Rôles de Progression (nécessite un thème actif)
      row1Buttons.push(
        new ButtonBuilder()
          .setCustomId('admin_progression_roles')
          .setLabel('🏅 Rôles de Progression')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!activeTheme)
      );

      // Bouton Frames (nécessite un thème actif)
      row1Buttons.push(
        new ButtonBuilder()
          .setCustomId('admin_frames')
          .setLabel('🖼️ Frames')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!activeTheme)
      );

      const row1 = new ActionRowBuilder().addComponents(...row1Buttons);
      components.push(row1);

      // Select menu pour supprimer un thème (si au moins 1 thème existe)
      if (allThemes.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_theme_delete')
          .setPlaceholder('🗑️ Sélectionner un thème à supprimer')
          .addOptions(
            allThemes.map(t => ({
              label: `${t.name} ${t.is_active ? '(ACTIF)' : ''}`,
              value: t.id.toString(),
              description: `${t.theme_id} - ${t.required_items} items - ${t.duration_days} jours`,
              emoji: t.is_active ? '✅' : '⭐'
            }))
          );

        const row2 = new ActionRowBuilder().addComponents(selectMenu);
        components.push(row2);
      }

      // Bouton retour
      const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_refresh')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );
      components.push(rowBack);

      return interaction.update({
        embeds: [embed],
        components: components
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage du menu thèmes:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Afficher le modal de création d'un thème
   */
  async showCreateThemeModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_create_theme')
      .setTitle('➕ Créer un nouveau thème');

    const themeIdInput = new TextInputBuilder()
      .setCustomId('theme_id')
      .setLabel('ID du thème (slug)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('blanche-neige')
      .setRequired(true)
      .setMaxLength(50);

    const nameInput = new TextInputBuilder()
      .setCustomId('theme_name')
      .setLabel('Nom du thème')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Blanche-Neige')
      .setRequired(true)
      .setMaxLength(100);

    const durationInput = new TextInputBuilder()
      .setCustomId('theme_duration')
      .setLabel('Durée (en jours, 0 = illimité)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('30 (ou 0 pour illimité)')
      .setRequired(false)
      .setMaxLength(3);

    const roleInput = new TextInputBuilder()
      .setCustomId('theme_role')
      .setLabel('Nom du rôle Discord à créer')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Vainqueur Blanche-Neige')
      .setRequired(true)
      .setMaxLength(100);

    const row1 = new ActionRowBuilder().addComponents(themeIdInput);
    const row2 = new ActionRowBuilder().addComponents(nameInput);
    const row3 = new ActionRowBuilder().addComponents(durationInput);
    const row4 = new ActionRowBuilder().addComponents(roleInput);

    modal.addComponents(row1, row2, row3, row4);

    await interaction.showModal(modal);
  }

  /**
   * Confirmer la suppression d'un thème
   */
  async handleThemeDeleteConfirmation(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    const themeId = interaction.values[0];
    const theme = await db.getThemeById(interaction.guildId, parseInt(themeId));

    if (!theme) {
      return interaction.followUp({
        content: '❌ Thème introuvable.',
        flags: 64
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('⚠️ CONFIRMATION DE SUPPRESSION')
      .setDescription(
        `**Tu es sur le point de supprimer le thème suivant :**\n\n` +
        `🎨 **${theme.name}**\n` +
        `└ ID: \`${theme.theme_id}\`\n` +
        `└ Durée: ${theme.duration_days} jours\n` +
        `└ Items: ${theme.required_items}\n` +
        `└ Rôle: ${theme.final_role_name || 'Non défini'}\n\n` +
        `⚠️ **ATTENTION : Cette action est IRRÉVERSIBLE !**\n\n` +
        `**Sera également supprimé :**\n` +
        `❌ Tous les collectibles du thème\n` +
        `❌ Toutes les missions du thème\n` +
        `❌ Tous les pièges du thème\n` +
        `❌ Toutes les campagnes du thème\n` +
        `❌ Toute la progression des joueurs\n` +
        `❌ Toute la configuration du thème\n\n` +
        `${theme.is_active ? '🔴 **CE THÈME EST ACTUELLEMENT ACTIF !**' : ''}`
      )
      .setColor('#e74c3c')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`theme_delete_confirm_${themeId}`)
        .setLabel('🗑️ Confirmer la suppression')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('admin_themes')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
      flags: 64
    });
  }

  /**
   * Supprimer un thème
   */
  async handleDeleteTheme(interaction) {
    await interaction.deferUpdate();

    const themeId = parseInt(interaction.customId.split('_').pop());

    try {
      const theme = await db.getThemeById(interaction.guildId, themeId);

      if (!theme) {
        return interaction.followUp({
          content: '❌ Thème introuvable.',
          flags: 64
        });
      }

      // Ne PAS supprimer le rôle Discord - les joueurs qui l'ont gagné doivent le garder
      if (theme.final_role_id) {
        console.log(`ℹ️ Le rôle Discord "${theme.final_role_name}" (${theme.final_role_id}) est conservé pour les joueurs qui l'ont gagné.`);
      }

      // Supprimer le thème de la DB (cascade delete)
      await db.deleteTheme(interaction.guildId, themeId);

      // Logger l'action
      await audit.logThemeDeleted(
        interaction.guildId,
        interaction.user.id,
        {
          theme_id: themeId,
          theme_name: theme.name
        }
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ THÈME SUPPRIMÉ')
        .setDescription(
          `Le thème **${theme.name}** a été supprimé avec succès.\n\n` +
          `Toutes les données associées ont également été supprimées.`
        )
        .setColor('#2ecc71')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_themes')
          .setLabel('🔙 Retour aux thèmes')
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [row],
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la suppression du thème:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue lors de la suppression: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Menu configuration du thème
   */
  async showThemeConfigMenu(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const config = await db.getThemeConfig(interaction.guildId, theme.id);

    // Créer la barre de progression pour les probabilités
    const createMiniProgressBar = (percentage) => {
      const totalBars = 10;
      const filledBars = Math.round((percentage / 100) * totalBars);
      const emptyBars = totalBars - filledBars;
      return '🟦'.repeat(filledBars) + '⬜'.repeat(emptyBars);
    };

    // Statut du toggle archivage
    const autoDeleteStatus = config.auto_delete_celebration_message ? '✅ ON' : '⬜ OFF';
    const autoDeleteEmoji = config.auto_delete_celebration_message ? '🟢' : '⚪';

    const embed = new EmbedBuilder()
      .setTitle('🎁 Gérer la Mystery Box')
      .setDescription(
        `**Thème actif:** ${theme.name}\n\n` +
        `Configure l'apparence et le comportement des mystery boxes :`
      )
      .setColor('#9b59b6')
      .addFields(
        {
          name: '🎲 Probabilités de contenu',
          value:
            `🎁 Collectibles: **${config.probability_collectible}%**\n${createMiniProgressBar(config.probability_collectible)}\n\n` +
            `📋 Missions: **${config.probability_mission}%**\n${createMiniProgressBar(config.probability_mission)}\n\n` +
            `⚠️ Pièges: **${config.probability_trap}%**\n${createMiniProgressBar(config.probability_trap)}\n\n` +
            `✨ Super Bonus: **${config.probability_super_bonus || 0}%**\n${createMiniProgressBar(config.probability_super_bonus || 0)}`,
          inline: false
        },
        {
          name: '🖼️ Apparence de la boîte',
          value:
            `**Titre:** ${config.mystery_box_title || 'Boîte Mystère'}\n` +
            `**Image:** ${config.mystery_box_image ? '✅ Définie' : '❌ Par défaut'}`,
          inline: false
        },
        {
          name: '🎉 Message de félicitations',
          value:
            `**Texte:** ${config.mystery_box_winner_message ? '✅ Personnalisé' : '❌ Par défaut'}\n` +
            `**GIF:** ${config.mystery_box_celebration_gif ? '✅ Personnalisé' : '❌ Par défaut'}`,
          inline: false
        },
        {
          name: `${autoDeleteEmoji} Archivage automatique`,
          value:
            `**Statut:** ${autoDeleteStatus}\n` +
            `Les messages de félicitation ${config.auto_delete_celebration_message ? 'seront supprimés après 10 secondes' : 'restent affichés dans le salon'}`,
          inline: false
        }
      )
      .setFooter({ text: '💡 Clique sur 🔄 Rafraîchir après chaque modification pour voir les changements' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mystery_box_image')
        .setLabel('🖼️ Modifier l\'image')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('mystery_box_title')
        .setLabel('📝 Modifier le titre')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mystery_box_winner_message')
        .setLabel('✉️ Message de félicitations')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('mystery_box_celebration_gif')
        .setLabel('🎬 GIF de célébration')
        .setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mystery_box_toggle_auto_delete')
        .setLabel(`${autoDeleteEmoji} Archivage auto: ${config.auto_delete_celebration_message ? 'ON' : 'OFF'}`)
        .setStyle(config.auto_delete_celebration_message ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('theme_config_back')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('theme_config_refresh')
        .setLabel('🔄 Rafraîchir')
        .setStyle(ButtonStyle.Secondary)
    );

    // Utiliser editReply si deferred, sinon update
    if (interaction.deferred) {
      return interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3, row4]
      });
    } else {
      return interaction.update({
        embeds: [embed],
        components: [row1, row2, row3, row4]
      });
    }
  }

  /**
   * Toggle archivage automatique des messages de félicitation
   */
  async toggleAutoDeleteCelebration(interaction) {
    await interaction.deferUpdate();

    const theme = await db.getActiveTheme(interaction.guildId);
    const config = await db.getThemeConfig(interaction.guildId, theme.id);

    // Inverser le statut
    const newStatus = !config.auto_delete_celebration_message;

    // Mettre à jour dans la base de données
    await db.query(
      `UPDATE theme_config
       SET auto_delete_celebration_message = $1
       WHERE guild_id = $2 AND theme_id = $3`,
      [newStatus, interaction.guildId, theme.id]
    );

    console.log(`✅ [MYSTERY BOX] Archivage auto ${newStatus ? 'ACTIVÉ' : 'DÉSACTIVÉ'} pour ${interaction.guildId}`);

    // Logger l'action
    await audit.logAdminAction(
      interaction.guildId,
      interaction.user.id,
      'mystery_box_auto_delete_toggled',
      {
        theme_id: theme.id,
        theme_name: theme.name,
        new_status: newStatus
      }
    );

    // Rafraîchir le menu pour afficher le changement
    await this.showThemeConfigMenu(interaction);
  }

  /**
   * Modal pour prolonger la durée du thème actif
   */
  async showExtendThemeModal(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const expirationInfo = themeExpirationHandler.calculateExpiration(theme);

    const modal = new ModalBuilder()
      .setCustomId('modal_extend_theme')
      .setTitle('⏰ Prolonger le Thème');

    let currentInfo = '';
    if (expirationInfo.isUnlimited) {
      currentInfo = 'Durée actuelle: ♾️ Illimitée';
    } else if (expirationInfo.notActivated) {
      currentInfo = `Durée configurée: ${theme.duration_days} jours (non activé)`;
    } else {
      currentInfo = `Jours restants: ${expirationInfo.daysRemaining} jours`;
    }

    const daysInput = new TextInputBuilder()
      .setCustomId('additional_days')
      .setLabel(`Jours à AJOUTER (${currentInfo})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 7 pour ajouter 7 jours')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(4);

    modal.addComponents(
      new ActionRowBuilder().addComponents(daysInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Modal pour modifier la durée du thème
   */
  async showDurationModal(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const expirationInfo = themeExpirationHandler.calculateExpiration(theme);

    const modal = new ModalBuilder()
      .setCustomId('modal_duration')
      .setTitle('⏱️ Modifier la Durée Restante');

    // Déterminer la valeur par défaut à afficher
    let defaultValue;
    if (expirationInfo.isUnlimited) {
      defaultValue = '0';
    } else if (expirationInfo.notActivated) {
      defaultValue = theme.duration_days.toString();
    } else {
      defaultValue = expirationInfo.daysRemaining.toString();
    }

    const durationInput = new TextInputBuilder()
      .setCustomId('new_duration')
      .setLabel('Nouvelle durée RESTANTE (jours, 0 = illimité)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 45 (ou 0 pour illimité)')
      .setValue(defaultValue)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(4);

    let helpText = '';
    if (expirationInfo.isUnlimited) {
      helpText = 'Durée actuelle: Illimitée';
    } else if (expirationInfo.notActivated) {
      helpText = `Durée configurée: ${theme.duration_days} jours (non activé)`;
    } else {
      helpText = `Temps restant actuel: ${expirationInfo.daysRemaining} jours (${expirationInfo.percentageRemaining}%)`;
    }

    const helpInput = new TextInputBuilder()
      .setCustomId('duration_help')
      .setLabel('ℹ️ Information')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(
        helpText + '\n\n' +
        '💡 Entre la durée RESTANTE souhaitée.\n' +
        'Ex: Si tu mets 45, le thème expirera dans 45j\n' +
        'à partir de maintenant.\n' +
        '0 = durée illimitée'
      )
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(durationInput),
      new ActionRowBuilder().addComponents(helpInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Menu rapide pour modifier la durée avec des boutons prédéfinis
   */
  async showDurationQuickMenu(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const expirationInfo = themeExpirationHandler.calculateExpiration(theme);

    // Créer l'embed avec les informations actuelles
    const embed = new EmbedBuilder()
      .setTitle('⏱️ Modifier la Durée du Thème')
      .setColor('#3498db');

    let statusText = '';
    if (expirationInfo.isUnlimited) {
      statusText = '♾️ **Durée actuelle:** Illimitée';
    } else if (expirationInfo.notActivated) {
      statusText = `⏸️ **Statut:** Non activé (${theme.duration_days} jours configurés)`;
    } else {
      statusText =
        `⏰ **Temps restant actuel:** ${expirationInfo.daysRemaining} jours (${expirationInfo.percentageRemaining}%)\n` +
        `📅 **Expire le:** <t:${Math.floor(expirationInfo.expirationDate.getTime() / 1000)}:D>`;
    }

    embed.setDescription(
      statusText + '\n\n' +
      '💡 **Prolonger le thème de combien ?**\n' +
      'Choisis une durée prédéfinie ou personnalise :'
    );

    // Boutons de durée prédéfinie
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('duration_quick_7')
        .setLabel('+7 jours')
        .setEmoji('📅')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('duration_quick_14')
        .setLabel('+14 jours')
        .setEmoji('📅')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('duration_quick_30')
        .setLabel('+30 jours')
        .setEmoji('📅')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('duration_quick_60')
        .setLabel('+2 mois (60j)')
        .setEmoji('📆')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('duration_quick_90')
        .setLabel('+3 mois (90j)')
        .setEmoji('📆')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('duration_custom')
        .setLabel('✏️ Personnalisé...')
        .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('theme_config_back')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [embed],
      components: [row1, row2, row3]
    });
  }

  /**
   * Gérer les boutons de durée rapide - Afficher la confirmation
   */
  async handleQuickDuration(interaction) {
    try {
      // Extraire le nombre de jours depuis le customId
      const days = parseInt(interaction.customId.replace('duration_quick_', ''));

      const theme = await db.getActiveTheme(interaction.guildId);
      const themeExpirationHandler = require('./themeExpirationHandler');
      const expirationInfo = themeExpirationHandler.calculateExpiration(theme);

      let newTotalDuration;
      let daysToAdd = days;

      // Si durée illimitée demandée
      if (days === 0) {
        newTotalDuration = 0;
      }
      // Si le thème n'est pas encore activé
      else if (expirationInfo.notActivated) {
        newTotalDuration = days;
      }
      // Si le thème est activé : AJOUTER les jours aux jours restants
      else {
        const now = new Date();
        const activatedAt = new Date(theme.activated_at);
        const daysElapsed = Math.floor((now - activatedAt) / (24 * 60 * 60 * 1000));

        // CORRECTION: Nouvelle durée totale = jours écoulés + jours restants actuels + jours à ajouter
        newTotalDuration = daysElapsed + expirationInfo.daysRemaining + days;

        // Sécurité : s'assurer que la durée totale est positive
        if (newTotalDuration < daysElapsed) {
          newTotalDuration = daysElapsed + days;
        }
      }

      // Calculer les nouvelles infos d'expiration (simulation)
      const simulatedTheme = { ...theme, duration_days: newTotalDuration };
      const newExpirationInfo = themeExpirationHandler.calculateExpiration(simulatedTheme);

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setTitle('⚠️ Confirmation de Modification')
        .setColor('#f39c12');

      let descriptionText = '';

      if (days === 0) {
        descriptionText =
          `Tu es sur le point de définir ce thème comme **illimité**.\n\n` +
          `📊 **Durée actuelle:** ${expirationInfo.daysRemaining} jour(s) restant(s)\n` +
          `📊 **Nouvelle durée:** ♾️ Illimitée\n\n` +
          `⚠️ **Cette action va retirer toute date d'expiration.**`;
      } else if (expirationInfo.notActivated) {
        descriptionText =
          `Le thème n'est pas encore activé.\n\n` +
          `Tu vas définir une durée de **${days} jour(s)** qui commencera dès l'activation.`;
      } else {
        descriptionText =
          `Tu es sur le point d'**ajouter ${days} jour(s)** à la durée du thème.\n\n` +
          `📊 **Durée restante actuelle:** ${expirationInfo.daysRemaining} jour(s)\n` +
          `➕ **Jours à ajouter:** ${days} jour(s)\n` +
          `📊 **Nouvelle durée restante:** ${newExpirationInfo.daysRemaining} jour(s)\n\n`;

        if (expirationInfo.expirationDate) {
          const oldTimestamp = Math.floor(expirationInfo.expirationDate.getTime() / 1000);
          descriptionText += `🗓️ **Expiration actuelle:** <t:${oldTimestamp}:D>\n`;
        }

        if (newExpirationInfo.expirationDate) {
          const newTimestamp = Math.floor(newExpirationInfo.expirationDate.getTime() / 1000);
          descriptionText += `🗓️ **Nouvelle expiration:** <t:${newTimestamp}:D>\n\n`;
        }

        descriptionText += `⏰ Le thème expirera le <t:${Math.floor(newExpirationInfo.expirationDate.getTime() / 1000)}:F>`;
      }

      embed.setDescription(descriptionText);
      embed.setFooter({ text: '💡 Confirme ou annule cette action' });

      // Boutons de confirmation
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`duration_confirm_${days}`)
          .setLabel('✅ Confirmer')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('duration_cancel')
          .setLabel('❌ Annuler')
          .setStyle(ButtonStyle.Danger)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('theme_duration')
          .setLabel('◀️ Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        embeds: [embed],
        components: [row1, row2]
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage de la confirmation:', error);
      return interaction.reply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        ephemeral: true
      });
    }
  }

  /**
   * Appliquer la durée après confirmation
   */
  async applyQuickDuration(interaction) {
    await interaction.deferUpdate();

    try {
      // Extraire le nombre de jours depuis le customId
      const days = parseInt(interaction.customId.replace('duration_confirm_', ''));

      const theme = await db.getActiveTheme(interaction.guildId);
      const themeExpirationHandler = require('./themeExpirationHandler');
      const expirationInfo = themeExpirationHandler.calculateExpiration(theme);

      let newTotalDuration;

      // Si durée illimitée demandée
      if (days === 0) {
        newTotalDuration = 0;
      }
      // Si le thème n'est pas encore activé
      else if (expirationInfo.notActivated) {
        newTotalDuration = days;
      }
      // Si le thème est activé : AJOUTER les jours aux jours restants
      else {
        const now = new Date();
        const activatedAt = new Date(theme.activated_at);
        const daysElapsed = Math.floor((now - activatedAt) / (24 * 60 * 60 * 1000));

        // CORRECTION: Nouvelle durée totale = jours écoulés + jours restants actuels + jours à ajouter
        newTotalDuration = daysElapsed + expirationInfo.daysRemaining + days;

        // Sécurité : s'assurer que la durée totale est positive
        if (newTotalDuration < daysElapsed) {
          newTotalDuration = daysElapsed + days;
        }
      }

      // Mettre à jour la durée dans la base de données
      await db.query(
        `UPDATE themes
         SET duration_days = $1,
             updated_at = NOW()
         WHERE guild_id = $2 AND id = $3`,
        [newTotalDuration, interaction.guildId, theme.id]
      );

      // Logger l'action
      const audit = require('../utils/auditLogger');
      await audit.logDurationUpdated(
        interaction.guildId,
        interaction.user.id,
        newTotalDuration,
        theme.duration_days
      );

      // Recalculer les informations d'expiration
      const updatedTheme = await db.getActiveTheme(interaction.guildId);
      const updatedExpirationInfo = themeExpirationHandler.calculateExpiration(updatedTheme);

      // Créer l'embed de succès
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Durée Modifiée avec Succès')
        .setColor('#2ecc71');

      let successText = '';

      if (days === 0) {
        successText =
          `♾️ **Le thème est maintenant illimité !**\n\n` +
          `Il restera actif jusqu'à désactivation manuelle.`;
      } else if (updatedExpirationInfo.notActivated) {
        successText =
          `⏸️ **Durée configurée:** ${days} jour(s)\n\n` +
          `Le décompte commencera dès l'activation du thème.`;
      } else {
        const timestamp = Math.floor(updatedExpirationInfo.expirationDate.getTime() / 1000);
        successText =
          `⏱️ **${days} jour(s) ajouté(s) avec succès !**\n\n` +
          `📊 **Temps restant:** ${updatedExpirationInfo.daysRemaining} jour(s) (${updatedExpirationInfo.percentageRemaining}%)\n` +
          `🗓️ **Expire le:** <t:${timestamp}:D>\n` +
          `⏰ **Date d'expiration:** <t:${timestamp}:F>`;
      }

      successEmbed.setDescription(successText);

      // Bouton retour
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('theme_config_back')
          .setLabel('◀️ Retour à la configuration')
          .setStyle(ButtonStyle.Secondary)
      );

      // Mettre à jour le message avec le résultat
      await interaction.editReply({
        embeds: [successEmbed],
        components: [row]
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la durée:', error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur')
        .setDescription(`Une erreur est survenue lors de la modification:\n\`\`\`${error.message}\`\`\``)
        .setColor('#e74c3c');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('theme_duration')
          .setLabel('◀️ Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [errorEmbed],
        components: [row]
      });
    }
  }

  /**
   * Annuler la modification de durée
   */
  async cancelDurationChange(interaction) {
    return this.showDurationQuickMenu(interaction);
  }

  /**
   * Modal pour modifier le titre et description
   */
  async showTitleModal(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const config = await db.getThemeConfig(interaction.guildId, theme.id);

    const modal = new ModalBuilder()
      .setCustomId('modal_title')
      .setTitle('📝 Titre & Description');

    const titleInput = new TextInputBuilder()
      .setCustomId('mystery_box_title')
      .setLabel('Titre de la boîte mystère')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 🎁 BOÎTE MYSTÉRIEUSE')
      .setValue(config?.mystery_box_title || '🎁 BOÎTE MYSTÉRIEUSE')
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('mystery_box_description')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Description affichée sur la boîte...')
      .setValue(config?.mystery_box_description || 'Que contient-elle ?')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Modal pour modifier le message de félicitations d'ouverture de box
   */
  /**
   * Afficher le tutoriel de personnalisation de célébration (wizard step 1)
   */
  async showCelebrationTutorial(interaction) {
    await interaction.deferUpdate();

    const tutorialEmbed = new EmbedBuilder()
      .setTitle('🎊 Personnalisation de la Célébration')
      .setDescription(
        '**Bienvenue dans l\'assistant de configuration !**\n\n' +
        'Vous pouvez personnaliser 3 éléments pour rendre l\'ouverture des mysterybox grandiose :\n\n' +
        '**1️⃣ Message de félicitations**\n' +
        'Le texte affiché quand un joueur ouvre une box. Utilisez `{player}` pour mentionner le joueur.\n\n' +
        '**2️⃣ GIF de célébration**\n' +
        'Une animation festive (confettis, feux d\'artifice, etc.). Cliquez sur les boutons ci-dessous pour trouver des GIFs :\n' +
        '• **Giphy** : Recherche "confetti", "fireworks", "celebration"\n' +
        '• **Tenor** : Recherche "party", "congrats"\n\n' +
        '**3️⃣ Emojis de réaction**\n' +
        'Les emojis qui seront automatiquement ajoutés au message (séparés par des virgules).\n\n' +
        '**💡 Astuce pour copier l\'URL d\'un GIF :**\n' +
        '1. Cliquez sur un GIF qui vous plaît\n' +
        '2. Faites clic droit → "Copier l\'adresse du lien"\n' +
        '3. Collez l\'URL dans le formulaire\n\n' +
        'Cliquez sur **✅ Ouvrir le formulaire** quand vous êtes prêt !'
      )
      .setColor('#FFD700')
      .setFooter({ text: 'Astuce : Vous pouvez utiliser vos propres GIFs uploadés sur Discord !' });

    // Boutons de liens vers les sites de GIFs
    const linkRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🔍 Giphy - Confetti')
        .setURL('https://giphy.com/search/confetti')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('🎆 Giphy - Fireworks')
        .setURL('https://giphy.com/search/fireworks')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('🎉 Tenor - Celebration')
        .setURL('https://tenor.com/search/celebration-gifs')
        .setStyle(ButtonStyle.Link)
    );

    // Boutons d'action
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('theme_config_refresh')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('theme_winner_message_open_modal')
        .setLabel('✅ Ouvrir le formulaire')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      embeds: [tutorialEmbed],
      components: [linkRow, actionRow]
    });
  }

  /**
   * Afficher le modal de personnalisation de célébration (wizard step 2)
   */
  async showWinnerMessageModal(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const config = await db.getThemeConfig(interaction.guildId, theme.id);

    const modal = new ModalBuilder()
      .setCustomId('modal_winner_message')
      .setTitle('🎊 Célébration d\'Ouverture');

    const messageInput = new TextInputBuilder()
      .setCustomId('mystery_box_winner_message')
      .setLabel('Message de félicitations')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: 🎉 **{player}** a ouvert la boîte mystère !')
      .setValue(config?.mystery_box_winner_message || '🎉 **{player}** a ouvert la boîte mystère !')
      .setRequired(true)
      .setMaxLength(500);

    const gifInput = new TextInputBuilder()
      .setCustomId('mystery_box_celebration_gif')
      .setLabel('GIF de célébration (URL Giphy/Tenor)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://media.giphy.com/media/g9582DNuQppxC/giphy.gif')
      .setValue(config?.mystery_box_celebration_gif || 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif')
      .setRequired(false)
      .setMaxLength(500);

    const emojisInput = new TextInputBuilder()
      .setCustomId('mystery_box_celebration_emojis')
      .setLabel('Emojis de réaction (ex: 🎉,🎊,✨)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('🎉,🎊,✨,🌟')
      .setValue(config?.mystery_box_celebration_emojis || '🎉,🎊,✨,🌟')
      .setRequired(false)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(messageInput),
      new ActionRowBuilder().addComponents(gifInput),
      new ActionRowBuilder().addComponents(emojisInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Modal pour modifier l'image de la boîte mystère
   */
  async showImageModal(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const config = await db.getThemeConfig(interaction.guildId, theme.id);

    const modal = new ModalBuilder()
      .setCustomId('modal_image')
      .setTitle('🖼️ Image de la Boîte Mystère');

    const imageInput = new TextInputBuilder()
      .setCustomId('mystery_box_image')
      .setLabel('URL de l\'image')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://example.com/image.png')
      .setValue(config?.mystery_box_image || '')
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(imageInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Afficher le menu de gestion des collectibles avec pagination
   * @param {number} page - Numéro de page (0-indexed)
   */
  async showCollectiblesMenu(interaction, page = 0) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const allCollectibles = await db.getCollectiblesByTheme(interaction.guildId, theme.id);

    const ITEMS_PER_PAGE = 20; // Max 25 pour Discord, on garde 20 pour lisibilité
    const totalPages = Math.ceil(allCollectibles.length / ITEMS_PER_PAGE) || 1;

    // S'assurer que la page est valide
    page = Math.max(0, Math.min(page, totalPages - 1));

    // Collectibles pour cette page
    const startIdx = page * ITEMS_PER_PAGE;
    const collectibles = allCollectibles.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    // Compter par rareté
    const rarityCounts = {
      legendary: allCollectibles.filter(c => c.rarity === 'legendary').length,
      epic: allCollectibles.filter(c => c.rarity === 'epic').length,
      rare: allCollectibles.filter(c => c.rarity === 'rare').length,
      common: allCollectibles.filter(c => c.rarity === 'common').length
    };

    const embed = new EmbedBuilder()
      .setTitle('🎁 Gestion des Collectibles')
      .setDescription(
        `**Thème:** ${theme.name}\n` +
        `**Total:** ${allCollectibles.length} collectible(s)\n\n` +
        `⭐ Légendaires: ${rarityCounts.legendary} | 💎 Épiques: ${rarityCounts.epic}\n` +
        `🔷 Rares: ${rarityCounts.rare} | ⚪ Communs: ${rarityCounts.common}`
      )
      .setColor('#2ecc71')
      .setFooter({ text: `Page ${page + 1}/${totalPages} • Sélectionnez un collectible pour le gérer` });

    if (collectibles.length > 0) {
      const list = collectibles.map(c => {
        const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
        return `${emoji} **${c.name}**`;
      }).join('\n');
      embed.addFields({
        name: `Collectibles (${startIdx + 1}-${startIdx + collectibles.length})`,
        value: list.length > 1024 ? list.substring(0, 1021) + '...' : list
      });
    } else {
      embed.addFields({
        name: 'Liste des collectibles',
        value: 'Aucun collectible créé.'
      });
    }

    const components = [];

    // Select menu pour choisir un collectible (limité à la page courante)
    if (collectibles.length > 0) {
      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`select_collectible_page_${page}`)
          .setPlaceholder('🔧 Sélectionner un collectible à gérer')
          .addOptions(
            collectibles.map(c => ({
              label: c.name.substring(0, 100), // Discord limite à 100 chars
              value: c.id.toString(),
              description: `${c.rarity} - ${c.collectible_id}`.substring(0, 100),
              emoji: c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪'
            }))
          )
      );
      components.push(selectRow);
    }

    // Boutons de pagination
    const paginationRow = new ActionRowBuilder();

    paginationRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`collectibles_page_${page - 1}`)
        .setLabel('◀️ Précédent')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`collectibles_page_${page + 1}`)
        .setLabel('Suivant ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
    components.push(paginationRow);

    // Boutons d'action
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('collectible_add')
        .setLabel('➕ Ajouter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('collectibles_refresh')
        .setLabel('🔄 Actualiser')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_settings')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );
    components.push(buttonRow);

    return interaction.update({
      embeds: [embed],
      components: components
    });
  }

  /**
   * Gérer la sélection d'un collectible (afficher détails avec options éditer/supprimer)
   */
  async handleCollectibleSelection(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    try {
      const collectibleId = parseInt(interaction.values[0]);
      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

      if (!collectible) {
        return interaction.editReply({
          embeds: [],
          content: '❌ Collectible introuvable.',
          components: []
        });
      }

      // Emojis de rareté
      const rarityEmojis = {
        legendary: '⭐',
        epic: '💎',
        rare: '🔷',
        common: '⚪'
      };

      const rarityColors = {
        legendary: '#FFD700',
        epic: '#9b59b6',
        rare: '#3498db',
        common: '#95a5a6'
      };

      // Créer l'embed avec les détails du collectible
      const embed = new EmbedBuilder()
        .setTitle(`${rarityEmojis[collectible.rarity] || '❓'} ${collectible.name}`)
        .setDescription(
          `**ID Interne:** \`${collectible.collectible_id}\`\n` +
          `**Rareté:** ${collectible.rarity.charAt(0).toUpperCase() + collectible.rarity.slice(1)}\n` +
          `**Thème ID:** ${collectible.theme_id}\n\n` +
          `**Message de révélation:**\n${collectible.reveal_message || '*Aucun message défini*'}`
        )
        .setColor(rarityColors[collectible.rarity] || '#2ecc71');

      // Ajouter l'image si elle existe
      if (collectible.image_url && collectible.image_url.trim()) {
        embed.setThumbnail(collectible.image_url);
      }

      // Sélecteur de rareté
      const raritySelectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`collectible_rarity_select_${collectibleId}`)
          .setPlaceholder('🎯 Changer la rareté')
          .addOptions([
            {
              label: 'Commun',
              description: 'Rareté de base',
              value: 'common',
              emoji: '⚪',
              default: collectible.rarity === 'common'
            },
            {
              label: 'Rare',
              description: 'Plus difficile à obtenir',
              value: 'rare',
              emoji: '🔷',
              default: collectible.rarity === 'rare'
            },
            {
              label: 'Épique',
              description: 'Très recherché',
              value: 'epic',
              emoji: '💎',
              default: collectible.rarity === 'epic'
            },
            {
              label: 'Légendaire',
              description: 'Extrêmement rare',
              value: 'legendary',
              emoji: '⭐',
              default: collectible.rarity === 'legendary'
            }
          ])
      );

      // Boutons d'action
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`collectible_edit_${collectibleId}`)
          .setLabel('✏️ Modifier Textes')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`collectible_edit_image_${collectibleId}`)
          .setLabel('🖼️ Changer Image')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`collectible_delete_confirm_${collectibleId}`)
          .setLabel('🗑️ Supprimer')
          .setStyle(ButtonStyle.Danger)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_collectibles')
          .setLabel('◀️ Retour aux Collectibles')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [embed],
        content: null,
        components: [raritySelectRow, row1, row2]
      });

    } catch (error) {
      console.error('❌ Erreur lors de la sélection du collectible:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`
      });
    }
  }

  /**
   * Gérer le changement de rareté d'un collectible via le sélecteur
   * Note: deferUpdate() est déjà fait dans handleSelectMenu()
   */
  async handleCollectibleRarityChange(interaction) {
    try {
      const collectibleId = parseInt(interaction.customId.replace('collectible_rarity_select_', ''));
      const newRarity = interaction.values[0];

      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

      if (!collectible) {
        return interaction.editReply({
          content: '❌ Collectible introuvable.'
        });
      }

      const oldRarity = collectible.rarity;

      // Si la rareté n'a pas changé, juste rafraîchir sans update DB
      if (oldRarity === newRarity) {
        // Rafraîchir la vue
        interaction.values = [collectibleId.toString()];
        return this.handleCollectibleSelection(interaction);
      }

      // Mettre à jour la rareté en DB
      await db.query(
        `UPDATE collectibles SET rarity = $1 WHERE id = $2 AND guild_id = $3`,
        [newRarity, collectibleId, interaction.guildId]
      );

      // Logger l'action
      await audit.logCollectibleEdited(
        interaction.guildId,
        interaction.user.id,
        collectible,
        {
          old_rarity: oldRarity,
          new_rarity: newRarity
        }
      );

      const rarityEmojis = {
        legendary: '⭐',
        epic: '💎',
        rare: '🔷',
        common: '⚪'
      };

      console.log(`✅ Rareté modifiée: "${collectible.name}" ${rarityEmojis[oldRarity]} ${oldRarity} → ${rarityEmojis[newRarity]} ${newRarity}`);

      // Rafraîchir la vue avec les nouvelles données
      interaction.values = [collectibleId.toString()];
      return this.handleCollectibleSelection(interaction);

    } catch (error) {
      console.error('❌ Erreur handleCollectibleRarityChange:', error);
      return interaction.editReply({
        content: `❌ Erreur: ${error.message}`
      });
    }
  }

  /**
   * Supprimer un collectible
   */
  async handleDeleteCollectible(interaction) {
    try {
      const collectibleId = parseInt(interaction.customId.split('_')[2]);
      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

      if (!collectible) {
        return interaction.reply({
          content: '❌ Collectible introuvable.',
          flags: 64
        });
      }

      const collectibleName = collectible.name;
      const themeId = collectible.theme_id;

      // Supprimer le collectible
      await db.deleteCollectible(interaction.guildId, collectibleId);

      // Logger l'action
      await audit.logCollectibleDeleted(
        interaction.guildId,
        interaction.user.id,
        {
          collectible_id: collectibleId,
          name: collectibleName
        }
      );

      // Mettre à jour automatiquement required_items dans le thème
      const collectiblesCount = await db.queryOne(
        'SELECT COUNT(*) as count FROM collectibles WHERE theme_id = $1',
        [themeId]
      );

      await db.query(
        'UPDATE themes SET required_items = $1 WHERE id = $2',
        [collectiblesCount.count, themeId]
      );

      console.log(`✅ Collectible "${collectibleName}" supprimé - Thème mis à jour: ${collectiblesCount.count} collectibles requis`);

      // Message de confirmation succinct
      const embed = new EmbedBuilder()
        .setDescription(`✅ **${collectibleName}** a été supprimé avec succès!`)
        .setColor('#2ecc71');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_collectibles')
          .setLabel('◀️ Retour aux Collectibles')
          .setStyle(ButtonStyle.Secondary)
      );

      // Mettre à jour le message du panel avec le résultat
      await interaction.update({
        content: null,
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('❌ Erreur lors de la suppression du collectible:', error);

      // Essayer de répondre avec une erreur
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: `❌ Une erreur est survenue: ${error.message}`,
          flags: 64
        });
      } else {
        return interaction.followUp({
          content: `❌ Une erreur est survenue: ${error.message}`,
          flags: 64
        });
      }
    }
  }

  /**
   * Afficher la confirmation de suppression d'un collectible
   */
  async showDeleteCollectibleConfirmation(interaction) {
    await interaction.deferUpdate();

    try {
      const collectibleId = parseInt(interaction.customId.split('_').pop());
      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

      if (!collectible) {
        return interaction.editReply({
          content: '❌ Collectible introuvable.',
          embeds: [],
          components: []
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Confirmer la suppression')
        .setDescription(
          `**Collectible:** ${collectible.name}\n` +
          `**Rareté:** ${collectible.rarity}\n` +
          `**ID:** \`${collectible.collectible_id}\`\n\n` +
          `⚠️ **ATTENTION:** Cette action est irréversible et supprimera également toutes les collections de ce collectible chez les joueurs !`
        )
        .setColor('#e74c3c');

      if (collectible.image_url && collectible.image_url.trim()) {
        embed.setThumbnail(collectible.image_url);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`collectible_delete_${collectibleId}`)
          .setLabel('🗑️ Confirmer la suppression')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('admin_collectibles')
          .setLabel('❌ Annuler')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [embed],
        content: null,
        components: [row]
      });

    } catch (error) {
      console.error('❌ Erreur showDeleteCollectibleConfirmation:', error);
      return interaction.editReply({
        content: `❌ Erreur: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher le modal d'édition d'un collectible
   */
  async showEditCollectibleModal(interaction) {
    try {
      const collectibleId = parseInt(interaction.customId.split('_').pop());
      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

      if (!collectible) {
        return interaction.reply({
          content: '❌ Collectible introuvable.',
          flags: 64
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_collectible_${collectibleId}`)
        .setTitle(`✏️ Modifier: ${collectible.name.substring(0, 30)}`);

      const nameInput = new TextInputBuilder()
        .setCustomId('collectible_name')
        .setLabel('Nom du collectible')
        .setStyle(TextInputStyle.Short)
        .setValue(collectible.name || '')
        .setRequired(true)
        .setMaxLength(100);

      const messageInput = new TextInputBuilder()
        .setCustomId('collectible_message')
        .setLabel('Message de révélation (optionnel)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(collectible.reveal_message || '')
        .setRequired(false)
        .setMaxLength(500);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(messageInput)
      );

      return interaction.showModal(modal);

    } catch (error) {
      console.error('❌ Erreur showEditCollectibleModal:', error);
      return interaction.reply({
        content: `❌ Erreur: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer l'édition de l'image d'un collectible via thread
   */
  async handleEditCollectibleImage(interaction) {
    try {
      const collectibleId = parseInt(interaction.customId.split('_').pop());
      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

      if (!collectible) {
        return interaction.reply({
          content: '❌ Collectible introuvable.',
          flags: 64
        });
      }

      // Stocker le collectibleId pour l'édition d'image + infos pour le bouton retour
      this.imageUploadCache.set(interaction.user.id, {
        context: 'edit_collectible_image',
        collectibleId: collectibleId,
        collectibleName: collectible.name,
        themeId: collectible.theme_id,
        adminPanelChannelId: interaction.channelId,
        adminPanelMessageId: interaction.message?.id,
        guildId: interaction.guildId
      });

      // Créer un thread pour l'upload d'image
      const channel = interaction.channel;

      if (!channel || !channel.threads) {
        return interaction.reply({
          content: '❌ Impossible de créer un thread dans ce canal.',
          flags: 64
        });
      }

      const thread = await channel.threads.create({
        name: `🖼️ Modifier Image - ${collectible.name.substring(0, 50)}`,
        autoArchiveDuration: 60,
        type: 11, // GUILD_PRIVATE_THREAD
        reason: `Modification image collectible ${collectibleId}`
      });

      await thread.members.add(interaction.user.id);

      // Message d'instructions dans le thread
      const instructionsEmbed = new EmbedBuilder()
        .setTitle('🖼️ Modifier l\'image du collectible')
        .setDescription(
          `**Collectible:** ${collectible.name}\n` +
          `**Rareté:** ${collectible.rarity}\n\n` +
          `📤 **Glisse-dépose ta nouvelle image ici**\n` +
          `📎 **Ou colle une URL d'image** (https://...)\n\n` +
          `Formats acceptés: PNG, JPG, GIF, WEBP\n` +
          `L'image sera automatiquement mise à jour.`
        )
        .setColor('#3498db');

      if (collectible.image_url && collectible.image_url.trim()) {
        instructionsEmbed.setThumbnail(collectible.image_url);
        instructionsEmbed.addFields({
          name: 'Image actuelle',
          value: 'Visible en miniature ci-contre →'
        });
      }

      const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`thread_cancel_edit_image_${collectibleId}`)
          .setLabel('❌ Annuler')
          .setStyle(ButtonStyle.Danger)
      );

      await thread.send({
        embeds: [instructionsEmbed],
        components: [cancelRow]
      });

      // Collecter les messages (images ou URLs)
      const filter = (m) => {
        if (m.author.id !== interaction.user.id) return false;
        if (m.attachments.size > 0) return true;
        const urlPattern = /https?:\/\/[^\s]+/i;
        if (urlPattern.test(m.content)) return true;
        return false;
      };
      const collector = thread.createMessageCollector({ filter, time: 120000, max: 1 });

      collector.on('collect', async (message) => {
        let imageUrl;

        // Cas 1: Attachment (fichier uploadé)
        if (message.attachments.size > 0) {
          const attachment = message.attachments.first();

          if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
            await thread.send('❌ Le fichier doit être une image (PNG, JPG, GIF, WEBP).');
            return;
          }

          imageUrl = attachment.url;
        }
        // Cas 2: URL collée
        else {
          const urlPattern = /https?:\/\/[^\s]+/i;
          const match = message.content.match(urlPattern);
          if (match) {
            imageUrl = match[0].replace(/[<>)}\]]+$/, '');
          } else {
            await thread.send('❌ URL invalide. Colle une URL commençant par http:// ou https://');
            return;
          }
        }

        // Mettre à jour l'image dans la base de données
        await db.query(
          'UPDATE collectibles SET image_url = $1 WHERE id = $2 AND guild_id = $3',
          [imageUrl, collectibleId, interaction.guildId]
        );

        console.log(`✅ Image du collectible "${collectible.name}" mise à jour: ${imageUrl}`);

        // Récupérer les infos du cache AVANT de le supprimer
        const cachedData = this.imageUploadCache.get(interaction.user.id);

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Image mise à jour !')
          .setDescription(`L'image du collectible **${collectible.name}** a été modifiée avec succès.`)
          .setThumbnail(imageUrl)
          .setColor('#2ecc71');

        // Construire le bouton de retour si on a les infos du message admin panel
        const components = [];
        if (cachedData?.adminPanelChannelId && cachedData?.adminPanelMessageId && cachedData?.guildId) {
          const messageLink = `https://discord.com/channels/${cachedData.guildId}/${cachedData.adminPanelChannelId}/${cachedData.adminPanelMessageId}`;

          const returnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('📋 Retourner aux collectibles')
              .setStyle(ButtonStyle.Link)
              .setURL(messageLink)
          );
          components.push(returnRow);
          successEmbed.setDescription(`L'image du collectible **${collectible.name}** a été modifiée avec succès.\n\n🔒 Ce thread sera archivé dans 10 secondes...`);
        } else {
          // Fallback si pas d'infos
          const parentChannel = thread.parent;
          const parentMention = parentChannel ? `<#${parentChannel.id}>` : 'le canal principal';
          successEmbed.setDescription(
            `L'image du collectible **${collectible.name}** a été modifiée avec succès.\n\n` +
            `👉 **Retourne dans ${parentMention}** et utilise \`/admin-panel\` pour gérer tes collectibles.\n\n` +
            `🔒 Ce thread sera archivé dans 10 secondes...`
          );
        }

        await thread.send({ embeds: [successEmbed], components });

        // Nettoyer le cache
        this.imageUploadCache.delete(interaction.user.id);

        // Archiver le thread après 10 secondes
        setTimeout(async () => {
          try {
            await thread.setArchived(true);
          } catch (e) {
            console.log('Thread déjà archivé ou erreur:', e.message);
          }
        }, 10000);
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await thread.send('⏱️ **Temps écoulé.** Aucune image reçue.\n\n🔒 Ce thread sera archivé dans 5 secondes...');
          this.imageUploadCache.delete(interaction.user.id);
          setTimeout(async () => {
            try {
              await thread.setArchived(true);
            } catch (e) {
              console.log('Erreur archivage thread:', e.message);
            }
          }, 5000);
        }
      });

      // Répondre à l'interaction originale
      return interaction.reply({
        content: `🖼️ **Thread ouvert !**\n\nRejoins le thread pour modifier l'image : ${thread}\n\n💡 Tu as 2 minutes pour uploader une image.`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur handleEditCollectibleImage:', error);
      return interaction.reply({
        content: `❌ Erreur: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer la soumission du modal d'édition de collectible
   */
  async handleEditCollectibleModalSubmit(interaction) {
    await interaction.deferUpdate();

    try {
      const collectibleId = parseInt(interaction.customId.split('_').pop());
      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

      if (!collectible) {
        return interaction.followUp({
          content: '❌ Collectible introuvable.',
          flags: 64
        });
      }

      // Récupérer les valeurs du modal (sans la rareté - gérée par le sélecteur)
      const newName = interaction.fields.getTextInputValue('collectible_name');
      const newMessage = interaction.fields.getTextInputValue('collectible_message') || null;

      // Mettre à jour le collectible (sans la rareté)
      await db.query(
        `UPDATE collectibles
         SET name = $1, reveal_message = $2
         WHERE id = $3 AND guild_id = $4`,
        [newName, newMessage, collectibleId, interaction.guildId]
      );

      // Logger l'action
      await audit.logCollectibleEdited(
        interaction.guildId,
        interaction.user.id,
        collectible,
        {
          old_name: collectible.name,
          new_name: newName,
          old_message: collectible.reveal_message,
          new_message: newMessage
        }
      );

      console.log(`✅ Collectible modifié: "${collectible.name}" → "${newName}"`);

      // Rafraîchir l'embed avec les nouvelles données
      interaction.values = [collectibleId.toString()];
      return this.handleCollectibleSelection(interaction);

    } catch (error) {
      console.error('❌ Erreur handleEditCollectibleModalSubmit:', error);
      return interaction.followUp({
        content: `❌ Erreur: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer l'annulation de l'édition d'image via thread
   */
  async handleThreadCancelEditImage(interaction) {
    await interaction.deferUpdate();

    try {
      const thread = interaction.channel;

      // Archiver et supprimer le thread
      if (thread?.isThread()) {
        await thread.send('❌ Édition d\'image annulée.');
        await thread.setArchived(true);
        await thread.delete().catch(() => {});
      } else {
        await interaction.editReply({
          content: '❌ Édition d\'image annulée.',
          components: []
        });
      }
    } catch (error) {
      console.error('❌ Erreur handleThreadCancelEditImage:', error);
    }
  }

  /**
   * Gérer l'upload d'une image (hybride: thread ou modal selon le canal)
   */
  async handleImageUpload(interaction, context = 'general') {
    try {
      // Récupérer le canal
      let channel = interaction.channel;
      if (!channel && interaction.channelId) {
        channel = await interaction.client.channels.fetch(interaction.channelId);
      }

      // Vérifier si le canal supporte les threads
      const supportsThreads = channel && channel.threads && channel.isTextBased() && !channel.isThread();

      if (supportsThreads) {
        // Essayer d'utiliser la méthode thread
        try {
          return await this.handleImageUploadViaThread(interaction, context);
        } catch (threadError) {
          console.warn('⚠️ Impossible de créer un thread, basculement sur modal:', threadError.message);
          // Si le thread échoue, basculer automatiquement sur le modal
        }
      }

      // Fallback sur le modal (soit le canal ne supporte pas les threads, soit le thread a échoué)
      const modal = new ModalBuilder()
        .setCustomId(`modal_image_url_${context}`)
        .setTitle('📷 Ajouter une image');

      const imageUrlInput = new TextInputBuilder()
        .setCustomId('image_url')
        .setLabel('URL de l\'image')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://i.imgur.com/example.png')
        .setRequired(true)
        .setMaxLength(500);

      const row = new ActionRowBuilder().addComponents(imageUrlInput);
      modal.addComponents(row);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('❌ Erreur fatale lors de handleImageUpload:', error);
      // Dernier recours en cas d'erreur totale
      try {
        const modal = new ModalBuilder()
          .setCustomId(`modal_image_url_${context}`)
          .setTitle('📷 Ajouter une image');

        const imageUrlInput = new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel('URL de l\'image')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://i.imgur.com/example.png')
          .setRequired(true)
          .setMaxLength(500);

        const row = new ActionRowBuilder().addComponents(imageUrlInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
      } catch (modalError) {
        console.error('❌ Impossible d\'afficher le modal:', modalError);
        await interaction.reply({
          content: '❌ Une erreur est survenue. Veuillez réessayer.',
          flags: 64
        });
      }
    }
  }

  /**
   * Mettre à jour les boutons du panneau collectibles selon l'état du cache
   */
  async updateCollectiblesPanelButtons(message, userId) {
    try {
      const cachedData = this.imageUploadCache.get(userId);
      const hasImage = cachedData && cachedData.url;

      // Récupérer les composants existants du message
      const existingComponents = message.components;

      // Trouver et modifier la ligne avec le bouton "Ajouter un Collectible"
      const updatedComponents = existingComponents.map(row => {
        const actionRow = ActionRowBuilder.from(row);
        const buttons = row.components;

        // Vérifier si cette ligne contient le bouton collectible_add
        const hasCollectibleButton = buttons.some(btn =>
          btn.customId && (btn.customId === 'collectible_add' || btn.customId.startsWith('collectible_add_'))
        );

        if (hasCollectibleButton) {
          // Reconstruire la ligne avec les bons boutons
          const newRow = new ActionRowBuilder();

          if (hasImage) {
            // Image uploadée → Afficher "Valider l'image" + "Annuler"
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId('collectible_validate')
                .setLabel('✅ Valider l\'image')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('collectible_cancel')
                .setLabel('❌ Annuler')
                .setStyle(ButtonStyle.Danger)
            );
          } else {
            // Pas d'image → Afficher "Ajouter un Collectible" + "Retour"
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId('collectible_add')
                .setLabel('➕ Ajouter un Collectible')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('admin_refresh')
                .setLabel('🔙 Retour')
                .setStyle(ButtonStyle.Secondary)
            );
          }

          return newRow;
        }

        return actionRow;
      });

      await message.edit({ components: updatedComponents });
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour des boutons du panneau:', error);
    }
  }

  /**
   * Gérer l'upload d'une image via thread (méthode privilégiée)
   */
  async handleImageUploadViaThread(interaction, context = 'general') {
    try {
      const channel = interaction.channel;

      // Créer un thread privé pour l'upload
      const threadName = context === 'Collectible Creation'
        ? `🎁 Ajouter un Collectible - ${interaction.user.username}`
        : `📷 Upload Image - ${interaction.user.username}`;

      const thread = await channel.threads.create({
      name: threadName,
      autoArchiveDuration: 60, // 1 heure
      type: 12, // PRIVATE_THREAD
      reason: `Upload d'image pour: ${context}`
    });

    // Ajouter l'utilisateur au thread
    await thread.members.add(interaction.user.id);

    // Répondre à l'interaction sans message visible
    if (interaction.isButton()) {
      await interaction.deferUpdate();
    } else {
      await interaction.reply({
        content: `✅ Thread créé`,
        flags: 64
      });
    }

    // Message dans le thread
    if (context === 'Collectible Creation') {
      await thread.send({
        content: `🎁 **CRÉATION D'UN COLLECTIBLE**\n\n` +
          `📝 **Étapes à suivre:**\n\n` +
          `**1️⃣ Upload de l'image**\n` +
          `• Drag & drop ton image du collectible ici\n` +
          `• Ou colle un screenshot (Ctrl+V)\n` +
          `• Formats acceptés: PNG, JPG, GIF, WEBP\n\n` +
          `**2️⃣ Choix de la rareté**\n` +
          `• Une fois l'image uploadée, des boutons apparaîtront\n` +
          `• Clique sur la rareté souhaitée (Common, Rare, Epic, Legendary)\n\n` +
          `**3️⃣ Détails du collectible**\n` +
          `• Un formulaire s'ouvrira automatiquement\n` +
          `• Remplis le nom et la description du collectible\n\n` +
          `⏱️ Tu as **2 minutes** pour uploader l'image\n\n` +
          `💡 Astuce: Choisis une image claire et représentative du collectible !`
      });

      // Envoyer un message dans le salon principal avec lien vers le thread
      try {
        await channel.send({
          content: `🎁 **Thread de création de collectible ouvert !**\n\n` +
            `${interaction.user}, rejoins le thread pour créer ton collectible : ${thread}\n\n` +
            `📝 Suis les instructions dans le thread pour compléter la création.`
        });
      } catch (error) {
        console.warn('⚠️ Impossible d\'envoyer le message dans le salon:', error);
      }
    } else {
      await thread.send({
        content: `📸 **Upload d'image**\n\n` +
          `**Contexte:** ${context}\n\n` +
          `🎯 **Instructions:**\n` +
          `• Drag & drop ton image ici\n` +
          `• Ou colle un screenshot (Ctrl+V)\n` +
          `• Formats acceptés: PNG, JPG, GIF, WEBP\n\n` +
          `⏱️ Tu as **2 minutes**\n\n` +
          `💡 L'URL sera automatiquement sauvegardée et utilisée dans ta configuration.`
      });
    }

    // Créer un message collector dans le thread (attachment OU URL)
    const filter = (m) => {
      if (m.author.id !== interaction.user.id) return false;
      if (m.attachments.size > 0) return true;
      const urlPattern = /https?:\/\/[^\s]+/i;
      if (urlPattern.test(m.content)) return true;
      return false;
    };

    const collector = thread.createMessageCollector({
      filter,
      time: 120000, // 2 minutes
      max: 1
    });

    collector.on('collect', async (message) => {
      let imageUrl;

      // Cas 1: Attachment (fichier uploadé)
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();

        // Vérifier que c'est une image
        const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        if (!validImageTypes.includes(attachment.contentType)) {
          await thread.send('❌ Le fichier doit être une image (PNG, JPG, GIF, WEBP).');
          return;
        }

        imageUrl = attachment.url;
      }
      // Cas 2: URL collée
      else {
        const urlPattern = /https?:\/\/[^\s]+/i;
        const match = message.content.match(urlPattern);
        if (match) {
          imageUrl = match[0].replace(/[<>)}\]]+$/, '');
        } else {
          await thread.send('❌ URL invalide. Colle une URL commençant par http:// ou https://');
          return;
        }
      }

      // Déterminer le type de contexte et mettre à jour la DB directement
      try {
        // Cas 1: Mystery Box
        if (context === 'Mystery Box - Image') {
          const theme = await db.getActiveTheme(interaction.guildId);
          await db.query(
            `UPDATE theme_config SET mystery_box_image = $1 WHERE theme_id = $2`,
            [imageUrl, theme.id]
          );

          await thread.send({
            content: `✅ **Image de la boîte mystère mise à jour avec succès!**\n\n` +
              `📷 **URL:** ${imageUrl}\n\n` +
              `🔒 Ce thread sera archivé dans 10 secondes...`
          });
        }
        // Cas 1b: Mission Revealed GIF (annonce éphémère "Mission Débloquée")
        else if (context === 'Mission Revealed GIF') {
          const theme = await db.getActiveTheme(interaction.guildId);

          // Insérer ou mettre à jour dans theme_messages
          await db.query(`
            INSERT INTO theme_messages (guild_id, theme_id, key, content)
            VALUES ($1, $2, 'mission_revealed_gif', $3)
            ON CONFLICT (guild_id, theme_id, key)
            DO UPDATE SET content = $3
          `, [interaction.guildId, theme.id, imageUrl]);

          await thread.send({
            content: `✅ **GIF/Image de l'annonce "Mission Débloquée" mis à jour avec succès!**\n\n` +
              `📷 **URL:** ${imageUrl}\n` +
              `🎯 **Thème:** ${theme.name}\n\n` +
              `💡 Cette image s'affichera quand un joueur déclenche une mission secrète.\n\n` +
              `🔒 Ce thread sera archivé dans 10 secondes...`
          });
        }
        // Cas 2: Templates d'annonces
        else if (context.startsWith('Template ')) {
          // Parser le contexte pour extraire le type de template
          const isImage = context.includes('Image principale');
          const isThumbnail = context.includes('Thumbnail');
          const templateMatch = context.match(/Template (.+?) -/);

          if (templateMatch) {
            const templateLabels = {
              'Collectible Légendaire': 'legendary_collectible',
              'Collection Complétée': 'collection_completed',
              'Échange de Collection': 'collection_traded',
              'Collection Perdue': 'collection_lost',
              'Piège Cooldown': 'trap_cooldown',
              'Piège Voleur': 'trap_lose_collectible',
              'Piège de la Honte': 'trap_public_shame',
              'Boîte Vide': 'trap_empty_box',
              'Piège Dévastateur': 'trap_lose_all_collectibles',
              'Mot Deviné': 'mission_word_guessed',
              'Mission Lancée': 'mission_started',
              'Mission Réussie': 'mission_completed',
              'Mission Échouée': 'mission_failed',
              'Mission Approuvée': 'mission_approved',
              'Mission Refusée': 'mission_rejected',
              'Thème Expiré': 'theme_expired',
              'Expiration Prochaine': 'theme_expiring_soon'
            };

            const templateType = templateLabels[templateMatch[1]];
            if (templateType) {
              const template = await db.getAnnouncementTemplate(templateType, interaction.guildId);
              const updates = { ...template };

              if (isImage) {
                updates.image_url = imageUrl;
              } else if (isThumbnail) {
                updates.thumbnail_url = imageUrl;
              }

              // Mettre à jour le bon template selon theme_id
              if (template.theme_id) {
                await db.updateAnnouncementTemplateForTheme(templateType, updates, interaction.guildId, template.theme_id);
              } else {
                await db.updateAnnouncementTemplate(templateType, updates, interaction.guildId);
              }

              await thread.send({
                content: `✅ **${isImage ? 'Image principale' : 'Thumbnail'} mise à jour avec succès!**\n\n` +
                  `📷 **URL:** ${imageUrl}\n` +
                  `📋 **Template:** ${templateMatch[1]}\n\n` +
                  `🔒 Ce thread sera archivé dans 10 secondes...`
              });
            }
          }
        }
        // Cas 3: Collectibles (garde l'ancien système avec cache)
        else {
          // Récupérer les données existantes du cache
          const existingCache = this.imageUploadCache.get(interaction.user.id) || {};

          this.imageUploadCache.set(interaction.user.id, {
            ...existingCache,
            url: imageUrl,
            timestamp: Date.now(),
            context: context,
            threadId: thread.id  // Stocker l'ID du thread pour l'archiver plus tard
          });

          console.log(`💾 Image mise en cache pour ${interaction.user.id}:`, {
            url: imageUrl,
            context,
            threadId: thread.id,
            existingCache
          });

          // Message différent selon le contexte
          if (context === 'Collectible Creation') {
            // Récupérer le themeId depuis le cache
            const cachedData = this.imageUploadCache.get(message.author.id);
            const themeId = cachedData?.themeId;

            // Créer les boutons de sélection de rareté directement dans le thread
            const rarityRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(themeId ? `rarity_common_${themeId}` : 'rarity_common')
                  .setLabel('⭐ Common')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId(themeId ? `rarity_rare_${themeId}` : 'rarity_rare')
                  .setLabel('💎 Rare')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId(themeId ? `rarity_epic_${themeId}` : 'rarity_epic')
                  .setLabel('🔮 Epic')
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId(themeId ? `rarity_legendary_${themeId}` : 'rarity_legendary')
                  .setLabel('✨ Legendary')
                  .setStyle(ButtonStyle.Danger)
              );

            const cancelRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('thread_cancel_collectible')
                  .setLabel('❌ Annuler')
                  .setStyle(ButtonStyle.Danger)
              );

            // Créer l'embed
            const rarityEmbed = new EmbedBuilder()
              .setTitle('🎁 AJOUTER UN COLLECTIBLE')
              .setColor('#2ecc71')
              .setDescription(
                `✅ **Image uploadée avec succès!**\n\n` +
                `Choisis la rareté du collectible ci-dessous:\n\n` +
                `⭐ **Common** - Facile à trouver\n` +
                `💎 **Rare** - Peu commun\n` +
                `🔮 **Epic** - Très rare\n` +
                `✨ **Legendary** - Extrêmement rare\n\n` +
                `Après avoir choisi la rareté, un formulaire s'ouvrira pour compléter les détails du collectible.`
              )
              .setThumbnail(imageUrl)
              .setFooter({ text: '⏱️ Tu as 5 minutes pour choisir' });

            await thread.send({
              embeds: [rarityEmbed],
              components: [rarityRow, cancelRow]
            });

            console.log(`✅ Boutons de rareté envoyés dans le thread pour ${message.author.username}`);
          } else {
            await thread.send({
              content: `✅ **Image enregistrée avec succès!**\n\n` +
                `📷 **URL:** ${imageUrl}\n` +
                `📁 **Contexte:** ${context}\n\n` +
                `✨ Cette URL sera automatiquement utilisée dans ta prochaine configuration.\n\n` +
                `🔒 Ce thread sera archivé dans 10 secondes...`
            });
          }
        }
      } catch (error) {
        console.error('❌ Erreur lors de la mise à jour de l\'image:', error);
        await thread.send(`❌ Erreur: ${error.message}`);
      }

      // Archiver le thread après 10 secondes (sauf pour les collectibles qui attendent une action utilisateur)
      if (context !== 'Collectible Creation') {
        setTimeout(async () => {
          try {
            await thread.setArchived(true);
          } catch (error) {
            console.warn('⚠️ Impossible d\'archiver le thread:', error);
          }
        }, 10000);
      }
      // Pour les collectibles, le thread sera archivé manuellement après création complète
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await thread.send('⏱️ **Temps écoulé.** Aucune image reçue.\n\n🔒 Ce thread sera archivé dans 5 secondes...');

        setTimeout(async () => {
          try {
            await thread.setArchived(true);
          } catch (error) {
            console.warn('⚠️ Impossible d\'archiver le thread:', error);
          }
        }, 5000);
      }
    });
    } catch (error) {
      console.error('❌ Erreur lors de la création du thread:', error);
      throw error; // Laisser handleImageUpload gérer l'erreur
    }
  }

  /**
   * Afficher le sélecteur de rareté avant d'ajouter un collectible
   */
  async showRaritySelector(interaction, themeId = null) {
    const embed = new EmbedBuilder()
      .setTitle('🎁 AJOUTER UN COLLECTIBLE')
      .setColor('#2ecc71')
      .setDescription(
        `Choisis la rareté du collectible\n\n` +
        `La rareté détermine la difficulté d'obtention et le prestige.`
      );

    // Inclure le themeId dans le customId si fourni
    const customId = themeId ? `select_rarity_${themeId}` : 'select_rarity';

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder('🎲 Sélectionner une rareté')
      .addOptions([
        {
          label: 'Common',
          value: 'common',
          description: 'Facile à trouver - Récompense standard',
          emoji: '⭐'
        },
        {
          label: 'Rare',
          value: 'rare',
          description: 'Peu commun - Récompense appréciable',
          emoji: '💎'
        },
        {
          label: 'Epic',
          value: 'epic',
          description: 'Difficile à obtenir - Grande récompense',
          emoji: '🔷'
        },
        {
          label: 'Legendary',
          value: 'legendary',
          description: 'Extrêmement rare - Récompense exceptionnelle',
          emoji: '⚪'
        }
      ]);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    if (interaction.replied || interaction.deferred) {
      return interaction.editReply({
        embeds: [embed],
        components: [selectRow],
        flags: 64
      });
    } else {
      return interaction.reply({
        embeds: [embed],
        components: [selectRow],
        flags: 64
      });
    }
  }

  /**
   * Gérer la sélection de rareté
   */
  async handleRaritySelection(interaction) {
    const customId = interaction.customId;
    let rarity, themeId;

    // Bouton depuis le thread (format: rarity_common_13, rarity_rare_13, etc.)
    const parts = customId.split('_');
    rarity = parts[1]; // common, rare, epic, legendary

    // Vérifier si un themeId est présent à la fin
    const lastPart = parts[parts.length - 1];
    themeId = !isNaN(parseInt(lastPart)) ? parseInt(lastPart) : null;

    console.log(`🎲 Rareté sélectionnée dans le thread: ${rarity}, themeId: ${themeId}`);

    // Récupérer les données du cache pour avoir l'URL de l'image
    const cachedData = this.imageUploadCache.get(interaction.user.id);
    if (!cachedData || !cachedData.url) {
      return interaction.reply({
        content: '❌ Aucune image trouvée. Veuillez recommencer.',
        flags: 64
      });
    }

    // Ouvrir le modal avec la rareté sélectionnée et le themeId
    await this.showAddCollectibleModal(interaction, rarity, themeId);

    // NE PAS archiver le thread ici - il sera archivé après soumission réussie du modal
  }

  /**
   * Gérer l'annulation de l'upload d'image depuis le thread
   */
  async handleThreadCancelCollectible(interaction) {
    try {
      // Supprimer le cache
      this.imageUploadCache.delete(interaction.user.id);
      console.log(`❌ Upload d'image annulé pour ${interaction.user.username}`);

      // Répondre dans le thread
      await interaction.reply({
        content: '❌ **Upload annulé**\n\nL\'image a été supprimée du cache. Ce thread va être archivé.',
        flags: 0
      });

      // Archiver le thread après 3 secondes
      setTimeout(async () => {
        try {
          await interaction.channel.setArchived(true);
        } catch (error) {
          console.warn('⚠️ Impossible d\'archiver le thread:', error);
        }
      }, 3000);

    } catch (error) {
      console.error('❌ Erreur lors de l\'annulation:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'annulation.',
        flags: 64
      });
    }
  }

  /**
   * Afficher le menu de gestion des collectibles (liste avec édition/suppression)
   */
  async showManageCollectiblesMenu(interaction) {
    await interaction.deferUpdate();

    try {
      const themeId = parseInt(interaction.customId.split('_').pop());
      const theme = await db.getThemeById(themeId);

      if (!theme) {
        return interaction.followUp({
          content: '❌ Thème introuvable.',
          flags: 64
        });
      }

      const collectibles = await db.query(
        'SELECT * FROM collectibles WHERE theme_id = $1 ORDER BY rarity, name',
        [themeId]
      );

      const rarityEmojis = {
        common: '⭐',
        rare: '💎',
        epic: '🔷',
        legendary: '⚪'
      };

      const embed = new EmbedBuilder()
        .setTitle(`🎁 COLLECTIBLES DU THÈME "${theme.name}"`)
        .setDescription(
          collectibles.length > 0
            ? `**${collectibles.length} collectible(s)**\n\nSélectionne un collectible pour le gérer :`
            : '❌ Aucun collectible pour ce thème.'
        )
        .setColor('#9b59b6');

      const components = [];

      if (collectibles.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_manage_collectible')
          .setPlaceholder('🔧 Sélectionner un collectible')
          .addOptions(
            collectibles.map(c => ({
              label: c.name,
              value: `${c.id}`,
              description: `${c.collectible_id} - ${c.rarity}`,
              emoji: rarityEmojis[c.rarity] || '❓'
            }))
          );

        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        components.push(row1);
      }

      // Vérifier s'il y a une image en cache pour cet utilisateur
      const cachedImage = this.imageUploadCache.get(interaction.user.id);
      console.log(`🔍 DEBUG Cache pour ${interaction.user.id}:`, cachedImage);

      const row2 = new ActionRowBuilder();

      if (cachedImage && cachedImage.url) {
        console.log(`✅ Image en cache détectée, affichage des boutons "Valider/Annuler"`);
        // Image en cache → Afficher "Valider l'image" + "Annuler"
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId('collectible_validate')
            .setLabel('✅ Valider l\'image uploadée')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('collectible_cancel')
            .setLabel('❌ Annuler l\'upload')
            .setStyle(ButtonStyle.Danger)
        );
      } else {
        // Pas d'image → Afficher "Ajouter un Collectible"
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId('collectible_add')
            .setLabel('➕ Ajouter un Collectible')
            .setStyle(ButtonStyle.Success)
        );
      }

      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`theme_manage_collectibles_${themeId}`)
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_theme_config')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      components.push(row2);

      return interaction.editReply({
        embeds: [embed],
        components: components,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage du menu de gestion:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer la sélection d'un collectible à éditer/supprimer
   */
  async handleManageCollectibleSelection(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    try{
      const collectibleId = parseInt(interaction.values[0]);
      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

      if (!collectible) {
        return interaction.followUp({
          content: '❌ Collectible introuvable.',
          flags: 64
        });
      }

      const rarityEmojis = {
        common: '⭐',
        rare: '💎',
        epic: '🔷',
        legendary: '⚪'
      };

      const embed = new EmbedBuilder()
        .setTitle(`${rarityEmojis[collectible.rarity]} ${collectible.name}`)
        .setDescription(
          `**ID:** \`${collectible.collectible_id}\`\n` +
          `**Rareté:** ${collectible.rarity}\n` +
          `**Message:** ${collectible.reveal_message || 'Aucun'}`
        )
        .setColor('#9b59b6');

      // Image uniquement si URL valide (non vide)
      if (collectible.image_url && collectible.image_url.trim()) {
        embed.setImage(collectible.image_url);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`collectible_delete_${collectibleId}`)
          .setLabel('🗑️ Supprimer')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`collectible_refresh_${collectibleId}`)
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`theme_manage_collectibles_${collectible.theme_id}`)
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [row],
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la sélection du collectible:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Modal pour ajouter un collectible
   */
  async showAddCollectibleModal(interaction, rarity = 'common', themeId = null) {
    // Inclure la rareté et le themeId dans le customId
    const customId = themeId
      ? `modal_add_collectible_${rarity}_${themeId}`
      : `modal_add_collectible_${rarity}`;

    const rarityEmojis = {
      common: '⭐',
      rare: '💎',
      epic: '🔷',
      legendary: '⚪'
    };

    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle(`${rarityEmojis[rarity]} Collectible ${rarity.toUpperCase()}`);

    const nameInput = new TextInputBuilder()
      .setCustomId('collectible_name')
      .setLabel('Nom du collectible')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Simplet')
      .setRequired(true);

    const idInput = new TextInputBuilder()
      .setCustomId('collectible_id')
      .setLabel('ID unique (slug)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: simplet')
      .setRequired(true);

    const messageInput = new TextInputBuilder()
      .setCustomId('collectible_message')
      .setLabel('Message de révélation (optionnel)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Félicitations ! Tu as trouvé...')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(idInput),
      new ActionRowBuilder().addComponents(messageInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Menu missions
   */
  async showMissionsMenu(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const missions = await db.getMissionsByTheme(interaction.guildId, theme.id);

    // Récupérer le GIF d'annonce de mission configuré
    const missionRevealedGif = await db.queryOne(`
      SELECT content FROM theme_messages
      WHERE guild_id = $1 AND theme_id = $2 AND key = 'mission_revealed_gif'
    `, [interaction.guildId, theme.id]);

    // Types de missions avec leurs emojis
    const missionTypes = {
      'keyword-message': { emoji: '🔤', label: 'Mot Deviné' },
      'quiz': { emoji: '❓', label: 'Quiz' },
      'true-false': { emoji: '✅', label: 'Vrai/Faux' },
      'emoji-puzzle': { emoji: '🧩', label: 'Emoji Devinette' },
      'wordle': { emoji: '🟩', label: 'Wordle' },
      'unscramble': { emoji: '🔀', label: 'Anagramme' },
      'hangman': { emoji: '☠️', label: 'Pendu' },
      'reaction-message': { emoji: '👍', label: 'Réaction' },
      'voice-join': { emoji: '🔊', label: 'Vocal' }
    };

    // Compter les missions par type
    const typeCounts = {};
    missions.forEach(m => {
      typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
    });

    // Construire le résumé par type
    let typesSummary = '';
    if (missions.length > 0) {
      const typeLines = Object.entries(typeCounts)
        .map(([type, count]) => {
          const typeInfo = missionTypes[type] || { emoji: '📋', label: type };
          return `${typeInfo.emoji} ${typeInfo.label}: **${count}**`;
        });
      typesSummary = typeLines.join(' • ');
    }

    const embed = new EmbedBuilder()
      .setTitle('🎯 GESTION DES MISSIONS')
      .setDescription(
        `**🎨 Thème:** ${theme.name}\n` +
        `**📊 Total:** ${missions.length} mission${missions.length > 1 ? 's' : ''}\n\n` +
        (typesSummary ? `${typesSummary}\n\n` : '') +
        `*Sélectionne une mission pour la modifier ou en créer une nouvelle.*`
      )
      .setColor('#9B59B6')
      .setFooter({ text: `🎮 Types disponibles: Mot Deviné, Quiz, Vrai/Faux, Emoji Devinette...` });

    // Ajouter le thumbnail si un GIF d'annonce est configuré
    if (missionRevealedGif?.content) {
      embed.setThumbnail(missionRevealedGif.content);
    }

    // Afficher la liste des missions (max 10 pour éviter surcharge)
    if (missions.length > 0) {
      const displayMissions = missions.slice(0, 10);

      displayMissions.forEach(mission => {
        const typeInfo = missionTypes[mission.type] || { emoji: '📋', label: mission.type };
        const timeoutDisplay = mission.timeout ? `⏱️${mission.timeout}s` : '';
        const attemptsDisplay = mission.max_attempts ? `🎯${mission.max_attempts}` : '';
        const extras = [timeoutDisplay, attemptsDisplay].filter(x => x).join(' ');

        embed.addFields({
          name: `${typeInfo.emoji} ${mission.name}`,
          value: `\`${mission.mission_id}\` ${extras ? `• ${extras}` : ''}`,
          inline: true
        });
      });

      if (missions.length > 10) {
        embed.addFields({
          name: '📦 Et plus...',
          value: `+${missions.length - 10} autres missions`,
          inline: true
        });
      }
    } else {
      embed.addFields({
        name: '📭 Aucune mission',
        value: 'Clique sur **➕ Ajouter** pour créer ta première mission !'
      });
    }

    const components = [];

    // Boutons d'action
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mission_add')
        .setLabel('➕ Ajouter une mission')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('mission_revealed_gif_config')
        .setLabel('🖼️ GIF Annonce')
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(actionRow);

    // Si des missions existent, afficher le select menu
    if (missions.length > 0) {
      // Fonction pour obtenir l'emoji du type de mission
      const getTypeEmoji = (type) => {
        const emojis = {
          'keyword-message': '🔤',
          'quiz': '❓',
          'true-false': '✅',
          'emoji-puzzle': '🧩',
          'wordle': '🟩',
          'unscramble': '🔀',
          'hangman': '☠️',
          'reaction-message': '👍',
          'voice-join': '🔊'
        };
        return emojis[type] || '📋';
      };

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_mission')
        .setPlaceholder('📝 Sélectionne une mission à modifier')
        .addOptions(
          missions.slice(0, 25).map(mission => ({
            label: mission.name.substring(0, 100),
            value: mission.id.toString(),
            description: `${missionTypes[mission.type]?.label || mission.type} • ${mission.mission_id}`.substring(0, 100),
            emoji: getTypeEmoji(mission.type)
          }))
        );

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    // Bouton retour
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_settings')
        .setLabel('🔙 Retour au Paramétrage')
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(backRow);

    return interaction.update({
      embeds: [embed],
      components,
      content: null
    });
  }

  /**
   * Menu pièges
   */
  async showTrapsMenu(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const traps = await db.getTrapsByTheme(interaction.guildId, theme.id);

    const embed = new EmbedBuilder()
      .setTitle('⚠️ GESTION DES PIÈGES')
      .setDescription(
        `**Thème actuel:** ${theme.name}\n` +
        `**Pièges configurés:** ${traps.length}\n\n` +
        `Ajoute, modifie ou supprime des pièges pour ton jeu.`
      )
      .setColor('#e74c3c');

    // Afficher la liste des pièges
    if (traps.length > 0) {
      const trapTypes = {
        'cooldown': '⏱️ Cooldown',
        'lose-collectible': '💀 Perte collectible',
        'public-shame': '😱 Shame public'
      };

      traps.forEach(trap => {
        const typeLabel = trapTypes[trap.type] || trap.type;
        embed.addFields({
          name: `${typeLabel} - ${trap.name}`,
          value: `**ID:** \`${trap.trap_id}\`\n**Description:** ${trap.description.substring(0, 60)}...`,
          inline: true
        });
      });
    } else {
      embed.addFields({
        name: 'Aucun piège',
        value: 'Clique sur "➕ Ajouter" pour créer ton premier piège !'
      });
    }

    const components = [];

    // Boutons d'action
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('trap_add')
        .setLabel('➕ Ajouter un piège')
        .setStyle(ButtonStyle.Danger)
    );

    components.push(actionRow);

    // Si des pièges existent, afficher le select menu
    if (traps.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_trap')
        .setPlaceholder('Sélectionne un piège à modifier/supprimer')
        .addOptions(
          traps.map(trap => ({
            label: trap.name,
            value: trap.id.toString(),
            description: `${trap.type} - ${trap.trap_id}`,
            emoji: trap.type === 'cooldown' ? '⏱️' : trap.type === 'lose-collectible' ? '💀' : '⚠️'
          }))
        );

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    // Bouton retour
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_settings')
        .setLabel('🔙 Retour au Paramétrage')
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(backRow);

    return interaction.update({
      embeds: [embed],
      components,
      content: null
    });
  }

  /**
   * Statistiques (TODO)
   */
  async showStats(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const collectibles = await db.getCollectiblesByTheme(interaction.guildId, theme.id);
    const missions = await db.getMissionsByTheme(interaction.guildId, theme.id);
    const traps = await db.getTrapsByTheme(interaction.guildId, theme.id);

    const embed = new EmbedBuilder()
      .setTitle('📊 Statistiques')
      .setDescription(`**Thème:** ${theme.name}`)
      .setColor('#9b59b6')
      .addFields(
        {
          name: '🎁 Collectibles',
          value: `Total: ${collectibles.length}`,
          inline: true
        },
        {
          name: '📋 Missions',
          value: `Total: ${missions.length}`,
          inline: true
        },
        {
          name: '⚠️ Pièges',
          value: `Total: ${traps.length}`,
          inline: true
        }
      );

    return interaction.update({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_back')
            .setLabel('◀️ Retour')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  // ============================================
  // NOUVEAUX MENUS (RESTRUCTURATION)
  // ============================================

  /**
   * Menu Paramétrage (sous-menu)
   */
  async showSettingsMenu(interaction) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const allThemes = await db.getAllThemes(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ PARAMÉTRAGE')
      .setColor(theme ? '#3498db' : '#e74c3c');

    if (!theme) {
      // Pas de thème : message invitant à créer le premier
      embed.setDescription(
        '# 🎨 Création de ton premier thème\n\n' +
        '⚠️ **Aucun thème configuré**\n\n' +
        'Commence par créer un thème pour définir la collection que tes joueurs pourront compléter.\n\n' +
        '👉 **Clique sur "🎨 Gérer les Thèmes" ci-dessous pour créer ton premier thème.**\n\n' +
        '💡 Les autres options seront disponibles une fois le thème créé.'
      );
    } else {
      // Thème existant : affichage normal
      embed.setDescription(
        `**Thème actif:** ${theme.name}\n\n` +
        `Configure tous les aspects du système :`
      );
    }

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_themes')
        .setLabel('🎨 Gérer les Thèmes')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_theme_config')
        .setLabel('🎁 Mystery Box')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme), // Désactivé si pas de thème
      new ButtonBuilder()
        .setCustomId('mb_config_panel')
        .setLabel('📦 MB par Rareté')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme), // Désactivé si pas de thème
      new ButtonBuilder()
        .setCustomId('admin_collectibles')
        .setLabel('🎨 Collectibles')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme) // Désactivé si pas de thème
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_missions')
        .setLabel('📋 Gérer les Missions')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme), // Désactivé si pas de thème
      new ButtonBuilder()
        .setCustomId('admin_traps')
        .setLabel('⚠️ Gérer les Pièges')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme), // Désactivé si pas de thème
      new ButtonBuilder()
        .setCustomId('admin_super_bonuses')
        .setLabel('⭐ Gérer les Super Bonus')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme) // Désactivé si pas de thème
    );

    const row2b = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_channels')
        .setLabel('📍 Gérer Canaux/Catégories')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme), // Désactivé si pas de thème
      new ButtonBuilder()
        .setCustomId('admin_campaigns_manage')
        .setLabel('📊 Gérer les Campagnes')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme), // Désactivé si pas de thème
      new ButtonBuilder()
        .setCustomId('admin_probabilities')
        .setLabel('🎲 Probabilités')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme) // Désactivé si pas de thème
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_daily_rewards')
        .setLabel('📅 Récompenses Quotidiennes')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme), // Désactivé si pas de thème
      new ButtonBuilder()
        .setCustomId('admin_announcements')
        .setLabel('📢 Canal d\'Annonces')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme), // Désactivé si pas de thème
      new ButtonBuilder()
        .setCustomId('craft_config_panel')
        .setLabel('🔨 Crafting')
        .setStyle(ButtonStyle.Primary), // Pas de thème requis - c'est guild-level
      new ButtonBuilder()
        .setCustomId('admin_fairness')
        .setLabel('⚖️ Équité')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!theme) // Désactivé si pas de thème
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_back')
        .setLabel('🔙 Retour au Menu Principal')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [embed],
      components: [row1, row2, row2b, row3, row4]
    });
  }


  /**
   * Menu Gérer Canaux/Catégories
   */
  async showChannelsMenu(interaction) {
    const giveChannels = await db.getAllGiveChannels(interaction.guildId);
    const categories = giveChannels.filter(c => c.type === 'category');
    const channels = giveChannels.filter(c => c.type === 'channel');

    // Calculer le total de canaux (individuels + dans catégories)
    let totalChannels = channels.length;
    for (const cat of categories) {
      // Récupérer la vraie catégorie Discord
      try {
        const discordCategory = await interaction.guild.channels.fetch(cat.discord_id);
        if (discordCategory) {
          // Compter les canaux texte dans cette catégorie
          const textChannels = interaction.guild.channels.cache.filter(
            ch => ch.parentId === cat.discord_id && ch.isTextBased()
          );
          totalChannels += textChannels.size;
        }
      } catch (error) {
        // Si la catégorie n'existe plus, ignorer
        console.error(`Catégorie ${cat.discord_id} introuvable:`, error.message);
      }
    }

    let description = '**Paramètres des canaux de diffusion**\n\n';
    description += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    // Section CATÉGORIES
    if (categories.length > 0) {
      description += `📂 **CATÉGORIES** [${categories.length}]\n\n`;

      for (const cat of categories) {
        // Récupérer les vrais canaux Discord de la catégorie
        let channelCount = 0;
        try {
          const discordCategory = await interaction.guild.channels.fetch(cat.discord_id);
          if (discordCategory) {
            // Compter les canaux texte dans cette catégorie
            const textChannels = interaction.guild.channels.cache.filter(
              ch => ch.parentId === cat.discord_id && ch.isTextBased()
            );
            channelCount = textChannels.size;
          }
        } catch (error) {
          // Si la catégorie n'existe plus, afficher 0
          console.error(`Catégorie ${cat.discord_id} introuvable:`, error.message);
        }

        const statusEmoji = channelCount > 0 ? '🟢' : '🟠';
        description += `${statusEmoji} ${cat.name}\n`;
        description += `   └ ${channelCount} ${channelCount > 1 ? 'canaux actifs' : 'canal actif'}\n\n`;
      }

      description += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    }

    // Section CANAUX INDIVIDUELS
    if (channels.length > 0) {
      description += `📍 **CANAUX SEULS** [${channels.length}]\n\n`;

      const displayLimit = 5;
      for (const ch of channels.slice(0, displayLimit)) {
        description += `• ${ch.name}\n`;
      }

      if (channels.length > displayLimit) {
        description += `... +${channels.length - displayLimit} ${channels.length - displayLimit > 1 ? 'autres' : 'autre'}\n`;
      }

      description += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    }

    // Si rien n'est configuré
    if (categories.length === 0 && channels.length === 0) {
      description += '❌ **Aucune destination configurée**\n\n';
      description += 'Configure des catégories ou canaux pour\n';
      description += 'pouvoir lancer des MysteryBox.\n\n';
      description += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    }

    const embed = new EmbedBuilder()
      .setTitle('🎁 MYSTERYBOX - DISTRIBUTION')
      .setDescription(description)
      .setColor('#9b59b6')
      .setFooter({ text: `📊 ${totalChannels} ${totalChannels > 1 ? 'canaux' : 'canal'} au total | ${categories.length} ${categories.length > 1 ? 'catégories' : 'catégorie'}` });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('channel_add_category')
        .setLabel('➕ Ajouter une Catégorie')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('channel_add_single')
        .setLabel('➕ Ajouter un Canal')
        .setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('channel_delete_category')
        .setLabel('🗑️ Supprimer une Catégorie')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(categories.length === 0),
      new ButtonBuilder()
        .setCustomId('channel_delete_single')
        .setLabel('🗑️ Supprimer un Canal')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(channels.length === 0)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_channels')
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_settings')
        .setLabel('🔙 Retour au Paramétrage')
        .setStyle(ButtonStyle.Secondary)
    );

    // Utiliser editReply si l'interaction a été deferred, sinon update
    if (interaction.deferred) {
      return interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3]
      });
    } else {
      return interaction.update({
        embeds: [embed],
        components: [row1, row2, row3]
      });
    }
  }

  // ============================================
  // HANDLERS GESTION CANAUX (MODALS)
  // ============================================

  /**
   * Sélecteur pour ajouter une catégorie
   */
  async showAddCategorySelector(interaction) {
    // Récupérer toutes les catégories du serveur
    const allCategories = interaction.guild.channels.cache.filter(ch => ch.type === 4); // 4 = GuildCategory

    // Récupérer les catégories déjà configurées
    const configuredCategories = await db.getGiveCategories(interaction.guildId);
    const configuredIds = new Set(configuredCategories.map(c => c.discord_id));

    // Filtrer pour ne garder que celles qui ne sont pas déjà configurées
    const availableCategories = allCategories.filter(cat => !configuredIds.has(cat.id));

    if (availableCategories.size === 0) {
      return interaction.update({
        content: '❌ Aucune catégorie disponible. Toutes les catégories du serveur sont déjà configurées.',
        embeds: [],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('admin_channels')
              .setLabel('🔙 Retour')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_add_category')
      .setPlaceholder('Choisir une catégorie à ajouter')
      .addOptions(
        Array.from(availableCategories.values()).slice(0, 25).map(cat => ({
          label: cat.name,
          value: cat.id,
          description: `ID: ${cat.id}`,
          emoji: '📂'
        }))
      );

    const embed = new EmbedBuilder()
      .setTitle('📂 AJOUTER UNE CATÉGORIE')
      .setDescription('**Sélectionne une catégorie à ajouter:**\n\nLes catégories déjà configurées sont filtrées automatiquement.')
      .setColor('#9b59b6')
      .setFooter({ text: `${availableCategories.size} catégorie(s) disponible(s)` });

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_channels')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Sélecteur pour ajouter un canal (avec recherche native Discord)
   */
  async showAddChannelSelector(interaction) {
    // Utiliser le ChannelSelectMenuBuilder natif Discord avec recherche
    const selectMenu = new ChannelSelectMenuBuilder()
      .setCustomId('select_add_channel')
      .setPlaceholder('🔍 Rechercher et sélectionner un canal...')
      .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]); // Canaux textuels et annonces

    const embed = new EmbedBuilder()
      .setTitle('📍 AJOUTER UN CANAL')
      .setDescription(
        '**Sélectionne un canal à ajouter:**\n\n' +
        '🔍 **Tape pour rechercher** parmi tous les canaux du serveur.\n\n' +
        '> ⚠️ Si le canal est déjà configuré, un message d\'erreur s\'affichera.'
      )
      .setColor('#9b59b6');

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_channels')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Selector pour supprimer une catégorie
   */
  async showDeleteCategorySelector(interaction) {
    const categories = await db.getGiveCategories(interaction.guildId);

    if (categories.length === 0) {
      return interaction.update({
        content: '❌ Aucune catégorie configurée.',
        components: []
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_delete_category')
      .setPlaceholder('Choisir une catégorie à supprimer')
      .addOptions(
        categories.map(cat => ({
          label: cat.name,
          value: cat.discord_id,
          description: `ID: ${cat.discord_id}`
        }))
      );

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_channels')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      content: '**Sélectionne une catégorie à supprimer:**',
      components: [row1, row2]
    });
  }

  /**
   * Selector pour supprimer un canal
   */
  async showDeleteChannelSelector(interaction) {
    const channels = await db.getGiveChannelsList(interaction.guildId);

    if (channels.length === 0) {
      return interaction.update({
        content: '❌ Aucun canal configuré.',
        components: []
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_delete_channel')
      .setPlaceholder('Choisir un canal à supprimer')
      .addOptions(
        channels.slice(0, 25).map(ch => ({
          label: ch.name,
          value: ch.discord_id,
          description: `ID: ${ch.discord_id}`
        }))
      );

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_channels')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      content: '**Sélectionne un canal à supprimer:**',
      components: [row1, row2]
    });
  }

  /**
   * Handler pour l'ajout d'une catégorie
   */
  async handleAddCategorySelection(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    const categoryId = interaction.values[0];

    try {
      // Vérifier que la catégorie n'est pas déjà configurée
      const exists = await db.giveChannelExists(interaction.guildId, categoryId);
      if (exists) {
        await interaction.followUp({
          content: '❌ Cette catégorie est déjà configurée.',
          flags: 64
        });
        return this.showChannelsMenu(interaction);
      }

      // Récupérer la catégorie depuis Discord
      const category = await interaction.guild.channels.fetch(categoryId).catch(() => null);

      if (!category || category.type !== 4) {
        await interaction.followUp({
          content: '❌ ID invalide ou ce n\'est pas une catégorie.',
          flags: 64
        });
        return this.showChannelsMenu(interaction);
      }

      // Ajouter la catégorie
      await db.addGiveChannel(interaction.guildId, 'category', categoryId, category.name, interaction.user.id);

      // Envoyer une confirmation éphémère
      await interaction.followUp({
        content: `✅ **Catégorie ajoutée !**\n\n📂 **Nom:** ${category.name}\n🆔 **ID:** \`${categoryId}\``,
        flags: 64
      });

      // Rafraîchir automatiquement le menu
      return this.showChannelsMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout de la catégorie:', error);
      await interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
      return this.showChannelsMenu(interaction);
    }
  }

  /**
   * Handler pour l'ajout d'un canal (via ChannelSelectMenu natif Discord)
   */
  async handleAddChannelSelection(interaction) {
    // Defer immédiatement (appelé directement depuis interactionCreate.js)
    await interaction.deferUpdate();

    // ChannelSelectMenu natif: utilise interaction.channels (Collection de canaux)
    const channel = interaction.channels?.first();

    if (!channel) {
      await interaction.followUp({
        content: '❌ Aucun canal sélectionné.',
        flags: 64
      });
      return this.showChannelsMenu(interaction);
    }

    const channelId = channel.id;

    try {
      // Vérifier que le canal n'est pas déjà configuré
      const exists = await db.giveChannelExists(interaction.guildId, channelId);
      if (exists) {
        await interaction.followUp({
          content: '❌ Ce canal est déjà configuré.',
          flags: 64
        });
        return this.showChannelsMenu(interaction);
      }

      if (!channel.isTextBased()) {
        await interaction.followUp({
          content: '❌ Ce n\'est pas un canal textuel.',
          flags: 64
        });
        return this.showChannelsMenu(interaction);
      }

      // Récupérer l'ID de la catégorie parente si elle existe
      const parentCategoryId = channel.parent?.id || null;

      // Ajouter le canal
      await db.addGiveChannel(interaction.guildId, 'channel', channelId, channel.name, interaction.user.id, parentCategoryId);

      // Envoyer une confirmation éphémère
      await interaction.followUp({
        content: `✅ **Canal ajouté !**\n\n📍 **Nom:** ${channel.name}\n🆔 **ID:** \`${channelId}\`\n📂 **Catégorie:** ${channel.parent ? channel.parent.name : 'Aucune'}`,
        flags: 64
      });

      // Rafraîchir automatiquement le menu
      return this.showChannelsMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du canal:', error);
      await interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
      return this.showChannelsMenu(interaction);
    }
  }

  /**
   * Handler pour la suppression d'une catégorie
   */
  async handleDeleteCategorySelection(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    const categoryId = interaction.values[0];

    try {
      const category = await db.getGiveChannelById(interaction.guildId, categoryId);

      if (!category) {
        return interaction.editReply({
          content: '❌ Catégorie introuvable.',
          components: []
        });
      }

      await db.deleteGiveChannel(interaction.guildId, categoryId);

      // Logger l'action
      await audit.logCategoryDeleted(
        interaction.guildId,
        interaction.user.id,
        {
          category_id: categoryId,
          category_name: category.name
        }
      );

      // Envoyer une confirmation éphémère dans un followUp
      await interaction.followUp({
        content: `✅ Catégorie **${category.name}** supprimée avec succès !`,
        flags: 64
      });

      // Rafraîchir automatiquement le menu de gestion des canaux
      return this.showChannelsMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la catégorie:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        components: []
      });
    }
  }

  /**
   * Handler pour la suppression d'un canal
   */
  async handleDeleteChannelSelection(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    const channelId = interaction.values[0];

    try {
      const channel = await db.getGiveChannelById(interaction.guildId, channelId);

      if (!channel) {
        return interaction.editReply({
          content: '❌ Canal introuvable.',
          components: []
        });
      }

      await db.deleteGiveChannel(interaction.guildId, channelId);

      // Logger l'action
      await audit.logChannelDeleted(
        interaction.guildId,
        interaction.user.id,
        {
          channel_id: channelId,
          channel_name: channel.name
        }
      );

      // Envoyer une confirmation éphémère dans un followUp
      await interaction.followUp({
        content: `✅ Canal **${channel.name}** supprimé avec succès !`,
        flags: 64
      });

      // Rafraîchir automatiquement le menu de gestion des canaux
      return this.showChannelsMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression du canal:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        components: []
      });
    }
  }

  // ============================================
  // GESTION DES ANNONCES
  // ============================================

  /**
   * Menu de configuration du canal d'annonces
   */
  async showAnnouncementsMenu(interaction) {
    const announcementChannel = await db.getAnnouncementChannel(interaction.guildId);
    const settings = await db.getAnnouncementSettings(interaction.guildId);

    let description = '## 📢 Système d\'Annonces Automatiques\n\n';

    if (announcementChannel) {
      description += `### 📍 Canal Configuré\n\n`;
      description += `> <#${announcementChannel.channel_id}>\n`;
      description += `> \`${announcementChannel.channel_id}\`\n\n`;
    } else {
      description += '### ⚠️ Configuration Requise\n\n';
      description += '> Aucun canal d\'annonces configuré\n';
      description += '> Sélectionne un canal pour activer les notifications\n\n';
    }

    if (settings && announcementChannel) {
      const collectiblesCount = [
        settings.legendary_collectible,
        settings.collection_completed,
        settings.collection_traded,
        settings.collection_lost,
        settings.legendary_super_bonus,
        settings.collectible_level_up,
        settings.collectible_max_level,
        settings.collectible_restored
      ].filter(Boolean).length;

      const missionsCount = [
        settings.mission_started,
        settings.mission_completed,
        settings.mission_failed,
        settings.mission_approved,
        settings.mission_rejected,
        settings.mission_word_guessed
      ].filter(Boolean).length;

      const themesCount = [
        settings.theme_expired,
        settings.theme_expiring_soon
      ].filter(Boolean).length;

      const trapsCount = [
        settings.trap_cooldown,
        settings.trap_lose_collectible,
        settings.trap_public_shame,
        settings.trap_empty_box,
        settings.trap_lose_all_collectibles
      ].filter(Boolean).length;
      const totalActive = collectiblesCount + missionsCount + themesCount + trapsCount;

      description += `### 📊 Vue d'Ensemble\n\n`;
      description += `**Total:** ${totalActive}/21 annonces actives\n\n`;
      description += `\`\`\`\n`;
      description += `📦 Collectibles    ${collectiblesCount}/8\n`;
      description += `⚔️  Missions        ${missionsCount}/6\n`;
      description += `🎨 Thèmes          ${themesCount}/2\n`;
      description += `🎭 Pièges          ${trapsCount}/5\n`;
      description += `\`\`\`\n`;
      description += `\n*Clique sur une catégorie pour configurer*`;
    } else if (announcementChannel) {
      description += '*Configure d\'abord un canal d\'annonces*';
    }

    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor('#5865F2')
      .setFooter({
        text: announcementChannel ? `Canal: #${announcementChannel.channel_name}` : 'Configuration requise',
        iconURL: interaction.guild.iconURL()
      })
      .setTimestamp();

    const components = [];

    if (!announcementChannel) {
      // ChannelSelectMenuBuilder permet de rechercher parmi TOUS les canaux (pas de limite de 25)
      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId('select_announcement_channel')
        .setPlaceholder('📢 Rechercher et sélectionner un canal...')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

      components.push(new ActionRowBuilder().addComponents(selectMenu));

      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_settings')
          .setLabel('Retour')
          .setEmoji('🔙')
          .setStyle(ButtonStyle.Secondary)
      ));
    } else {
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('announcements_collectibles')
          .setLabel('Collectibles & Collections')
          .setEmoji('📦')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('announcements_missions')
          .setLabel('Missions')
          .setEmoji('⚔️')
          .setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('announcements_themes')
          .setLabel('Thèmes')
          .setEmoji('🎨')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('announcements_traps')
          .setLabel('Pièges')
          .setEmoji('🎭')
          .setStyle(ButtonStyle.Primary)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('change_announcement_channel')
          .setLabel('Changer Canal')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('edit_announcement_templates')
          .setLabel('Templates')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('delete_announcement_channel')
          .setLabel('Supprimer')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('admin_settings')
          .setLabel('Retour')
          .setEmoji('🔙')
          .setStyle(ButtonStyle.Secondary)
      );

      components.push(row1, row2, row3);
    }

    if (interaction.deferred) {
      return interaction.editReply({ embeds: [embed], components });
    } else {
      return interaction.update({ embeds: [embed], components });
    }
  }

  /**
   * Sous-menu: Collectibles & Collections
   */
  async showAnnouncementsCollectiblesMenu(interaction) {
    const settings = await db.getAnnouncementSettings(interaction.guildId);

    const activeCount = [
      settings.legendary_collectible,
      settings.collection_completed,
      settings.collection_traded,
      settings.collection_lost,
      settings.legendary_super_bonus,
      settings.collectible_level_up,
      settings.collectible_max_level,
      settings.collectible_restored
    ].filter(Boolean).length;

    let description = '## 📦 Collectibles & Collections\n\n';
    description += `**${activeCount}/8** annonces actives\n\n`;
    description += '### Types d\'annonces\n\n';
    description += `${settings.legendary_collectible ? '✅' : '⬜'} **Collectible Légendaire**\n`;
    description += `> Annonce quand un joueur obtient un collectible légendaire\n\n`;
    description += `${settings.collection_completed ? '✅' : '⬜'} **Collection Complétée**\n`;
    description += `> Annonce quand un joueur termine une collection\n\n`;
    description += `${settings.collection_traded ? '✅' : '⬜'} **Échange de Collection**\n`;
    description += `> Annonce lors d'un échange entre joueurs\n\n`;
    description += `${settings.collection_lost ? '✅' : '⬜'} **Collection Perdue**\n`;
    description += `> Annonce quand un joueur perd une collection\n\n`;
    description += `${settings.legendary_super_bonus ? '✅' : '⬜'} **Super Bonus Obtenu**\n`;
    description += `> Annonce quand un joueur obtient un super bonus légendaire\n\n`;
    description += '### Évolution des Collectibles\n\n';
    description += `${settings.collectible_level_up ? '✅' : '⬜'} **Level Up**\n`;
    description += `> Annonce quand un collectible monte de niveau (fusion)\n\n`;
    description += `${settings.collectible_max_level ? '✅' : '⬜'} **Niveau Maximum**\n`;
    description += `> Annonce quand un collectible atteint le niveau max\n\n`;
    description += `${settings.collectible_restored ? '✅' : '⬜'} **Collectible Restauré**\n`;
    description += `> Annonce quand un collectible perdu est récupéré\n`;

    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor('#3498DB')
      .setFooter({ text: `${activeCount} sur 8 actives`, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_legendary_collectible')
          .setLabel('Légendaire')
          .setEmoji(settings.legendary_collectible ? '✅' : '⬜')
          .setStyle(settings.legendary_collectible ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_collection_completed')
          .setLabel('Complétée')
          .setEmoji(settings.collection_completed ? '✅' : '⬜')
          .setStyle(settings.collection_completed ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_collection_traded')
          .setLabel('Échange')
          .setEmoji(settings.collection_traded ? '✅' : '⬜')
          .setStyle(settings.collection_traded ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_collection_lost')
          .setLabel('Perdue')
          .setEmoji(settings.collection_lost ? '✅' : '⬜')
          .setStyle(settings.collection_lost ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_legendary_super_bonus')
          .setLabel('Super Bonus')
          .setEmoji(settings.legendary_super_bonus ? '✅' : '⬜')
          .setStyle(settings.legendary_super_bonus ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_collectible_level_up')
          .setLabel('Level Up')
          .setEmoji(settings.collectible_level_up ? '✅' : '⬜')
          .setStyle(settings.collectible_level_up ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_collectible_max_level')
          .setLabel('Niveau Max')
          .setEmoji(settings.collectible_max_level ? '✅' : '⬜')
          .setStyle(settings.collectible_max_level ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_collectible_restored')
          .setLabel('Restauré')
          .setEmoji(settings.collectible_restored ? '✅' : '⬜')
          .setStyle(settings.collectible_restored ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_announcements')
          .setLabel('Retour au Menu')
          .setEmoji('🔙')
          .setStyle(ButtonStyle.Secondary)
      )
    ];

    return interaction.update({ embeds: [embed], components });
  }

  /**
   * Sous-menu: Missions
   */
  async showAnnouncementsMissionsMenu(interaction) {
    const settings = await db.getAnnouncementSettings(interaction.guildId);

    const activeCount = [
      settings.mission_started,
      settings.mission_completed,
      settings.mission_failed,
      settings.mission_approved,
      settings.mission_rejected,
      settings.mission_word_guessed
    ].filter(Boolean).length;

    let description = '## ⚔️ Annonces Missions\n\n';
    description += `**${activeCount}/6** annonces actives\n\n`;
    description += '### Cycle de vie des missions\n\n';
    description += `${settings.mission_started ? '✅' : '⬜'} **Mission Lancée**\n`;
    description += `> Annonce quand un joueur démarre une mission\n\n`;
    description += `${settings.mission_completed ? '✅' : '⬜'} **Mission Réussie**\n`;
    description += `> Annonce quand une mission est complétée\n\n`;
    description += `${settings.mission_failed ? '✅' : '⬜'} **Mission Échouée**\n`;
    description += `> Annonce en cas d'échec (timeout, mauvaise réponse)\n\n`;
    description += `${settings.mission_approved ? '✅' : '⬜'} **Mission Approuvée**\n`;
    description += `> Annonce quand un admin valide une mission\n\n`;
    description += `${settings.mission_rejected ? '✅' : '⬜'} **Mission Refusée**\n`;
    description += `> Annonce quand un admin refuse une mission\n\n`;
    description += `${settings.mission_word_guessed ? '✅' : '⬜'} **Mot-clé Deviné**\n`;
    description += `> Annonce quand le mot secret est trouvé\n`;

    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor('#E67E22')
      .setFooter({ text: `${activeCount} sur 6 actives`, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_mission_started')
          .setLabel('Mission Lancée')
          .setEmoji(settings.mission_started ? '✅' : '⬜')
          .setStyle(settings.mission_started ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_mission_completed')
          .setLabel('Mission Réussie')
          .setEmoji(settings.mission_completed ? '✅' : '⬜')
          .setStyle(settings.mission_completed ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_mission_failed')
          .setLabel('Mission Échouée')
          .setEmoji(settings.mission_failed ? '✅' : '⬜')
          .setStyle(settings.mission_failed ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_mission_word_guessed')
          .setLabel('Mot Deviné')
          .setEmoji(settings.mission_word_guessed ? '✅' : '⬜')
          .setStyle(settings.mission_word_guessed ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_mission_approved')
          .setLabel('Mission Approuvée')
          .setEmoji(settings.mission_approved ? '✅' : '⬜')
          .setStyle(settings.mission_approved ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_mission_rejected')
          .setLabel('Mission Refusée')
          .setEmoji(settings.mission_rejected ? '✅' : '⬜')
          .setStyle(settings.mission_rejected ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_announcements')
          .setLabel('Retour au Menu')
          .setEmoji('🔙')
          .setStyle(ButtonStyle.Secondary)
      )
    ];

    return interaction.update({ embeds: [embed], components });
  }

  /**
   * Sous-menu: Thèmes
   */
  async showAnnouncementsThemesMenu(interaction) {
    const settings = await db.getAnnouncementSettings(interaction.guildId);

    const activeCount = [
      settings.theme_expired,
      settings.theme_expiring_soon
    ].filter(Boolean).length;

    let description = '## 🎨 Annonces Thèmes\n\n';
    description += `**${activeCount}/2** annonces actives\n\n`;
    description += '### Gestion des thèmes\n\n';
    description += `${settings.theme_expired ? '✅' : '⬜'} **Thème Expiré**\n`;
    description += `> Annonce quand un thème atteint sa date d'expiration\n\n`;
    description += `${settings.theme_expiring_soon ? '✅' : '⬜'} **Expiration Proche**\n`;
    description += `> Alerte quelques jours avant l'expiration d'un thème\n`;

    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor('#9B59B6')
      .setFooter({ text: `${activeCount} sur 2 actives`, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_theme_expired')
          .setLabel('Thème Expiré')
          .setEmoji(settings.theme_expired ? '✅' : '⬜')
          .setStyle(settings.theme_expired ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_theme_expiring_soon')
          .setLabel('Expiration Proche')
          .setEmoji(settings.theme_expiring_soon ? '✅' : '⬜')
          .setStyle(settings.theme_expiring_soon ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_announcements')
          .setLabel('Retour au Menu')
          .setEmoji('🔙')
          .setStyle(ButtonStyle.Secondary)
      )
    ];

    return interaction.update({ embeds: [embed], components });
  }

  /**
   * Sous-menu: Pièges
   */
  async showAnnouncementsTrapsMenu(interaction) {
    const settings = await db.getAnnouncementSettings(interaction.guildId);

    // Compter les annonces actives (5 types de pièges valides)
    const activeCount = [
      settings.trap_cooldown,
      settings.trap_lose_collectible,
      settings.trap_public_shame,
      settings.trap_empty_box,
      settings.trap_lose_all_collectibles
    ].filter(Boolean).length;

    let description = '## 🎭 Annonces Pièges\n\n';
    description += `**${activeCount}/5** annonces actives\n\n`;
    description += '### Types de pièges\n\n';
    description += `${settings.trap_cooldown ? '✅' : '⬜'} **Piège Cooldown**\n`;
    description += `> Bloque l'ouverture de boîtes temporairement\n\n`;
    description += `${settings.trap_lose_collectible ? '✅' : '⬜'} **Piège Voleur**\n`;
    description += `> Fait perdre un collectible aléatoire\n\n`;
    description += `${settings.trap_public_shame ? '✅' : '⬜'} **Piège de la Honte**\n`;
    description += `> Expose publiquement l'échec du joueur\n\n`;
    description += `${settings.trap_empty_box ? '✅' : '⬜'} **Boîte Vide**\n`;
    description += `> Rien du tout dans la boîte !\n\n`;
    description += `${settings.trap_lose_all_collectibles ? '✅' : '⬜'} **Piège Dévastateur**\n`;
    description += `> Fait perdre TOUS les collectibles !\n`;

    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor('#E74C3C')
      .setFooter({ text: `${activeCount} sur 5 actives`, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_trap_cooldown')
          .setLabel('Cooldown')
          .setEmoji(settings.trap_cooldown ? '✅' : '⬜')
          .setStyle(settings.trap_cooldown ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_trap_lose_collectible')
          .setLabel('Voleur')
          .setEmoji(settings.trap_lose_collectible ? '✅' : '⬜')
          .setStyle(settings.trap_lose_collectible ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_trap_public_shame')
          .setLabel('Honte')
          .setEmoji(settings.trap_public_shame ? '✅' : '⬜')
          .setStyle(settings.trap_public_shame ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('toggle_trap_empty_box')
          .setLabel('Boîte Vide')
          .setEmoji(settings.trap_empty_box ? '✅' : '⬜')
          .setStyle(settings.trap_empty_box ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_trap_lose_all_collectibles')
          .setLabel('Dévastateur')
          .setEmoji(settings.trap_lose_all_collectibles ? '✅' : '⬜')
          .setStyle(settings.trap_lose_all_collectibles ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_announcements')
          .setLabel('Retour au Menu')
          .setEmoji('🔙')
          .setStyle(ButtonStyle.Secondary)
      )
    ];

    return interaction.update({ embeds: [embed], components });
  }

  /**
   * Handler pour la sélection d'un canal d'annonces
   * Supporte ChannelSelectMenuBuilder (interaction.channels) et StringSelectMenuBuilder (interaction.values)
   */
  async handleAnnouncementChannelSelection(interaction) {
    // Defer l'interaction immédiatement
    await interaction.deferUpdate();

    // ChannelSelectMenuBuilder: canaux dans interaction.channels
    // StringSelectMenuBuilder: IDs dans interaction.values
    let channel;
    let channelId;

    if (interaction.channels && interaction.channels.size > 0) {
      // ChannelSelectMenuBuilder - le canal est directement fourni
      channel = interaction.channels.first();
      channelId = channel.id;
    } else if (interaction.values && interaction.values.length > 0) {
      // StringSelectMenuBuilder - on a l'ID, on doit récupérer le canal
      channelId = interaction.values[0];
      channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    }

    try {

      if (!channel || !channel.isTextBased()) {
        await interaction.followUp({
          content: '❌ ID invalide ou ce n\'est pas un canal textuel.',
          flags: 64
        });
        return this.showAnnouncementsMenu(interaction);
      }

      // Définir le canal d'annonces
      await db.setAnnouncementChannel(interaction.guildId, channelId, channel.name);

      // Envoyer une confirmation éphémère
      await interaction.followUp({
        content: `✅ **Canal d'annonces configuré !**\n\n📢 **Canal:** ${channel}\n🆔 **ID:** \`${channelId}\``,
        flags: 64
      });

      // Rafraîchir automatiquement le menu
      return this.showAnnouncementsMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de la configuration du canal:', error);
      await interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
      return this.showAnnouncementsMenu(interaction);
    }
  }

  /**
   * Afficher le sélecteur pour changer de canal d'annonces
   * Utilise ChannelSelectMenuBuilder natif Discord avec recherche
   */
  async showChangeAnnouncementChannelSelector(interaction) {
    // Utiliser le ChannelSelectMenuBuilder natif Discord avec recherche
    const selectMenu = new ChannelSelectMenuBuilder()
      .setCustomId('select_announcement_channel')
      .setPlaceholder('🔍 Rechercher et sélectionner un canal...')
      .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

    const embed = new EmbedBuilder()
      .setTitle('📢 CHANGER LE CANAL D\'ANNONCES')
      .setDescription(
        '**Sélectionne le canal pour les annonces:**\n\n' +
        '🔍 **Tape pour rechercher** parmi tous les canaux du serveur.\n\n' +
        '> Les annonces du bot (collectibles, pièges, missions...) seront envoyées dans ce canal.'
      )
      .setColor('#3498db');

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_announcements')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Handler pour la suppression du canal d'annonces
   */
  async handleDeleteAnnouncementChannel(interaction) {
    await interaction.deferUpdate();

    try {
      const announcementChannel = await db.getAnnouncementChannel(interaction.guildId);

      if (!announcementChannel) {
        await interaction.followUp({
          content: '❌ Aucun canal d\'annonces configuré.',
          flags: 64
        });
        return this.showAnnouncementsMenu(interaction);
      }

      // Supprimer le canal
      await db.deleteAnnouncementChannel();

      // Envoyer une confirmation éphémère
      await interaction.followUp({
        content: `✅ **Canal d'annonces supprimé !**\n\nLe système d'annonces est désactivé.`,
        flags: 64
      });

      // Rafraîchir automatiquement le menu
      return this.showAnnouncementsMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression du canal:', error);
      await interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
      return this.showAnnouncementsMenu(interaction);
    }
  }

  /**
   * Afficher le modal pour saisir le canal d'annonces (nom ou ID)
   */
  async showManualAnnouncementChannelModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_manual_announcement_channel')
      .setTitle('Choisir le Canal d\'Annonces');

    const channelIdInput = new TextInputBuilder()
      .setCustomId('channel_id_input')
      .setLabel('Nom ou ID du Canal')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: annonces, general, ou 1234567890123456789')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(100);

    const row = new ActionRowBuilder().addComponents(channelIdInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  /**
   * Handler pour le toggle d'un paramètre d'annonce
   */
  async handleToggleAnnouncementSetting(interaction) {
    const customId = interaction.customId;
    const settingName = customId.replace('toggle_', '');

    try {
      // Récupérer les paramètres actuels
      const settings = await db.getAnnouncementSettings(interaction.guildId);

      if (!settings) {
        return interaction.reply({
          content: '❌ Erreur lors de la récupération des paramètres.',
          flags: 64
        });
      }

      // Toggle la valeur
      const currentValue = settings[settingName];
      const newValue = !currentValue;

      // Mettre à jour le paramètre
      await db.updateAnnouncementSetting(settingName, newValue, interaction.guildId);

      // Rafraîchir le sous-menu approprié en fonction du type d'annonce
      // Cela met à jour directement le menu avec le nouvel état du toggle
      if (settingName.startsWith('mission_')) {
        return this.showAnnouncementsMissionsMenu(interaction);
      } else if (settingName.startsWith('theme_')) {
        return this.showAnnouncementsThemesMenu(interaction);
      } else if (settingName.startsWith('trap_')) {
        return this.showAnnouncementsTrapsMenu(interaction);
      } else if (settingName.includes('collection') || settingName === 'legendary_collectible' || settingName === 'legendary_super_bonus' || settingName.startsWith('collectible_')) {
        return this.showAnnouncementsCollectiblesMenu(interaction);
      } else {
        // Fallback au menu principal si type inconnu
        return this.showAnnouncementsMenu(interaction);
      }

    } catch (error) {
      console.error('❌ Erreur lors du toggle du paramètre:', error);
      // Vérifier si l'interaction n'a pas déjà été répondue
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: '❌ Une erreur est survenue. Réessaye ou contacte un administrateur.',
          flags: 64
        });
      }
    }
  }

  /**
   * Affiche le menu de sélection des templates d'annonces
   */
  async showTemplatesListMenu(interaction) {
    try {
      await interaction.deferUpdate();

      // Récupérer les templates GLOBAUX uniquement (theme_id IS NULL)
      // pour éviter les doublons et dépasser la limite de 25 options Discord
      const templates = await db.queryAll(`
        SELECT * FROM announcement_templates
        WHERE guild_id = $1 AND theme_id IS NULL
        ORDER BY type
      `, [interaction.guildId]);

      const templateLabels = {
        legendary_collectible: '⭐ Collectible Légendaire',
        collection_completed: '🎉 Collection Complétée',
        collection_traded: '🔄 Échange de Collection',
        collection_lost: '💀 Collection Perdue',
        trap_cooldown: '⏱️ Piège Cooldown',
        trap_lose_collectible: '💀 Piège Voleur',
        trap_public_shame: '😱 Piège de la Honte',
        trap_empty_box: '📦 Boîte Vide',
        trap_lose_all_collectibles: '💥 Piège Dévastateur',
        mission_word_guessed: '🎯 Mot Deviné',
        mission_started: '⚔️ Mission Lancée',
        mission_completed: '✅ Mission Réussie',
        mission_failed: '❌ Mission Échouée',
        mission_approved: '👍 Mission Approuvée',
        mission_rejected: '⛔ Mission Refusée',
        theme_expired: '🔴 Thème Expiré',
        theme_expiring_soon: '⏰ Expiration Prochaine',
        legendary_super_bonus: '🎰 Super Bonus Obtenu'
      };

      const embed = new EmbedBuilder()
        .setTitle('📝 Édition des Templates d\'Annonces')
        .setDescription(
          `**Personnalise chaque type d\'annonce** avec:\n` +
          `• Titre personnalisé\n` +
          `• Description avec variables\n` +
          `• Couleur (hex)\n` +
          `• Image principale\n` +
          `• Thumbnail\n` +
          `• Texte du footer\n\n` +
          `**📋 ${templates.length} templates disponibles**\n` +
          `Sélectionne un template dans le menu ci-dessous pour l\'éditer:`
        )
        .setColor('#3498db');

      // Créer les options du sélecteur dynamiquement à partir des templates
      const selectOptions = templates.map(template => {
        const label = templateLabels[template.type] || template.type;
        const description = template.title.substring(0, 100); // Max 100 caractères pour Discord

        return {
          label: label,
          value: template.type,
          description: description,
          emoji: this.getEmojiForTemplateType(template.type)
        };
      });

      // Créer le sélecteur de templates
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_template_to_edit')
        .setPlaceholder('🎨 Sélectionne un template à éditer')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(selectOptions);

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);

      // Bouton retour
      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_announcements')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [selectRow, backButton]
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage des templates:', error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de l\'affichage des templates.',
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de l\'affichage des templates.',
          flags: 64
        });
      }
    }
  }

  /**
   * Retourne l'emoji approprié pour un type de template
   */
  getEmojiForTemplateType(type) {
    const emojiMap = {
      legendary_collectible: '⭐',
      collection_completed: '🎉',
      collection_traded: '🔄',
      collection_lost: '💀',
      trap_cooldown: '⏱️',
      trap_lose_collectible: '💀',
      trap_public_shame: '😱',
      trap_empty_box: '📦',
      trap_lose_all_collectibles: '💥',
      mission_word_guessed: '🎯',
      mission_started: '⚔️',
      mission_completed: '✅',
      mission_failed: '❌',
      mission_approved: '👍',
      mission_rejected: '⛔',
      theme_expired: '🔴',
      theme_expiring_soon: '⏰'
    };
    return emojiMap[type] || '📄';
  }

  /**
   * Affiche le menu d'édition d'un template spécifique
   */
  async showEditTemplateMenu(interaction) {
    // Support pour StringSelectMenu (interaction.values) et Button (interaction.customId)
    const templateType = interaction.values
      ? interaction.values[0]
      : interaction.customId.replace('edit_template_', '');

    try {
      const template = await db.getAnnouncementTemplate(templateType, interaction.guildId);

      if (!template) {
        const replyMethod = interaction.deferred ? 'editReply' : 'reply';
        return interaction[replyMethod]({
          content: '❌ Template introuvable.',
          flags: 64
        });
      }

      const templateLabels = {
        legendary_collectible: '⭐ Collectible Légendaire',
        collection_completed: '🎉 Collection Complétée',
        collection_traded: '🔄 Échange de Collection',
        collection_lost: '💀 Collection Perdue',
        trap_cooldown: '⏱️ Piège Cooldown',
        trap_lose_collectible: '💀 Piège Voleur',
        trap_public_shame: '😱 Piège de la Honte',
        trap_empty_box: '📦 Boîte Vide',
        trap_lose_all_collectibles: '💥 Piège Dévastateur',
        mission_word_guessed: '🎯 Mot Deviné',
        mission_started: '⚔️ Mission Lancée',
        mission_completed: '✅ Mission Réussie',
        mission_failed: '❌ Mission Échouée',
        mission_approved: '👍 Mission Approuvée',
        mission_rejected: '⛔ Mission Refusée',
        theme_expired: '🔴 Thème Expiré',
        theme_expiring_soon: '⏰ Thème Expire Bientôt',
        legendary_super_bonus: '🎰 Super Bonus Obtenu'
      };

      // Variables disponibles par type
      const availableVars = {
        legendary_collectible: '{userName}, {collectibleName}',
        collection_completed: '{userName}, {themeName}, {roleName}',
        collection_traded: '{user1Name}, {user2Name}, {missionName}',
        collection_lost: '{userName}, {trapName}',
        trap_cooldown: '{userName}, {trapName}, {duration}',
        trap_lose_collectible: '{userName}, {trapName}, {collectible}',
        trap_public_shame: '{userName}, {trapName}',
        trap_empty_box: '{userName}, {trapName}',
        trap_lose_all_collectibles: '{userName}, {trapName}, {count}',
        mission_word_guessed: '{userName}, {word}, {missionName}',
        mission_started: '{userName}, {missionName}, {timeLimit}',
        mission_completed: '{userName}, {missionName}, {rewardName}',
        mission_failed: '{userName}, {missionName}, {failReason}',
        mission_approved: '{userName}, {missionName}, {adminName}, {rewardName}',
        mission_rejected: '{userName}, {missionName}, {adminName}',
        theme_expired: '{themeName}, {durationDays}, {expirationDate}',
        theme_expiring_soon: '{themeName}, {daysRemaining}, {expirationDate}',
        legendary_super_bonus: '{userName}, {bonusName}, {bonusIcon}'
      };

      const embed = new EmbedBuilder()
        .setTitle(`📝 Édition: ${templateLabels[templateType]}`)
        .setDescription('**Configuration actuelle:**')
        .addFields(
          { name: '📌 Titre', value: template.title || 'Non défini', inline: false },
          { name: '📄 Description', value: template.description || 'Non définie', inline: false },
          { name: '🎨 Couleur', value: template.color, inline: true },
          { name: '📷 Image', value: template.image_url || 'Aucune', inline: true },
          { name: '🖼️ Thumbnail', value: template.thumbnail_url || 'Aucune', inline: true },
          { name: '📝 Footer', value: template.footer_text || 'Non défini', inline: false },
          { name: '🔤 Variables disponibles', value: availableVars[templateType] || 'Aucune', inline: false }
        )
        .setColor(template.color);

      // Image uniquement si URL valide (non vide)
      if (template.image_url && template.image_url.trim()) {
        embed.setImage(template.image_url);
      }

      // Thumbnail uniquement si URL valide (non vide)
      if (template.thumbnail_url && template.thumbnail_url.trim()) {
        embed.setThumbnail(template.thumbnail_url);
      }

      // Boutons d'action
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`template_edit_text_${templateType}`)
          .setLabel('✏️ Éditer Texte')
          .setStyle(ButtonStyle.Primary)
      );

      // Menu de sélection de couleur
      const colorMenu = new StringSelectMenuBuilder()
        .setCustomId(`template_color_select_${templateType}`)
        .setPlaceholder('🎨 Choisir une couleur')
        .addOptions([
          {
            label: 'Rouge',
            description: 'Couleur rouge vif',
            value: '#FF0000',
            emoji: '🔴'
          },
          {
            label: 'Vert',
            description: 'Couleur vert positif',
            value: '#57F287',
            emoji: '🟢'
          },
          {
            label: 'Bleu',
            description: 'Couleur bleu classique',
            value: '#3498DB',
            emoji: '🔵'
          },
          {
            label: 'Jaune/Or',
            description: 'Couleur dorée',
            value: '#FFD700',
            emoji: '🟡'
          },
          {
            label: 'Violet',
            description: 'Couleur violet mystique',
            value: '#9B59B6',
            emoji: '🟣'
          }
        ]);

      const rowColor = new ActionRowBuilder().addComponents(colorMenu);

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`template_preview_${templateType}`)
          .setLabel('👁️ Preview')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`template_upload_image_${templateType}`)
          .setLabel('📷 Upload Image')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`template_upload_thumbnail_${templateType}`)
          .setLabel('🖼️ Upload Thumbnail')
          .setStyle(ButtonStyle.Secondary)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`template_reset_${templateType}`)
          .setLabel('🔄 Réinitialiser')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('edit_announcement_templates')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      if (interaction.deferred) {
        return interaction.editReply({
          embeds: [embed],
          components: [row1, rowColor, row2, row3]
        });
      } else {
        return interaction.update({
          embeds: [embed],
          components: [row1, rowColor, row2, row3]
        });
      }

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage du template:', error);
      const replyMethod = interaction.deferred ? 'editReply' : 'reply';
      await interaction[replyMethod]({
        content: '❌ Une erreur est survenue lors de l\'affichage du template.',
        flags: 64
      });
    }
  }


  /**
   * Handler pour réinitialiser un template aux valeurs par défaut
   */
  async handleTemplateReset(interaction) {
    await interaction.deferUpdate();

    const templateType = interaction.customId.replace('template_reset_', '');

    try {
      await db.resetAnnouncementTemplate(templateType);

      await interaction.followUp({
        content: '✅ Template réinitialisé aux valeurs par défaut!',
        flags: 64
      });

      // Rafraîchir le menu d'édition
      // On simule un clic sur le bouton edit_template_X
      interaction.customId = `edit_template_${templateType}`;
      return this.showEditTemplateMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de la réinitialisation du template:', error);
      await interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour afficher un aperçu du template
   */
  async handleTemplatePreview(interaction) {
    await interaction.deferReply({ flags: 64 });

    const templateType = interaction.customId.replace('template_preview_', '');
    const announcementSystem = require('../utils/announcements');

    try {
      // Données de test selon le type de template
      const testData = {
        legendary_collectible: {
          userName: 'JoueurTest',
          collectibleName: 'Dragon Légendaire',
          collectibleImage: 'https://example.com/dragon.png'
        },
        collection_completed: {
          userName: 'JoueurTest',
          themeName: 'Collection de Test',
          roleName: '@CollectionneurPro'
        },
        collection_traded: {
          user1Name: 'Joueur1',
          user2Name: 'Joueur2',
          missionName: 'Mission d\'échange'
        },
        collection_lost: {
          userName: 'JoueurTest',
          trapName: 'Piège Mortel'
        },
        trap_cooldown: {
          userName: 'JoueurTest',
          trapName: 'Piège Temporel',
          duration: '30',
          cooldownMinutes: '30'
        },
        trap_lose_collectible: {
          userName: 'JoueurTest',
          trapName: 'Piège Voleur',
          collectible: 'Dragon Légendaire',
          collectibleLost: 'Dragon Légendaire'
        },
        trap_public_shame: {
          userName: 'JoueurTest',
          trapName: 'Piège de la Honte',
          shameMessage: 'Regardez ce joueur qui a échoué lamentablement !'
        },
        trap_empty_box: {
          userName: 'JoueurTest',
          trapName: 'Coffre Vide'
        },
        trap_lose_all_collectibles: {
          userName: 'JoueurTest',
          trapName: 'Piège Dévastateur',
          count: '15'
        },
        mission_word_guessed: {
          userName: 'JoueurTest',
          word: 'VICTOIRE',
          missionName: 'Mission Énigme'
        },
        theme_expired: {
          themeName: 'Thème Halloween',
          durationDays: '30',
          expirationDate: `<t:${Math.floor(Date.now() / 1000)}:F>`
        },
        theme_expiring_soon: {
          themeName: 'Thème Noël',
          daysRemaining: '3',
          expirationDate: `<t:${Math.floor((Date.now() + 3 * 24 * 60 * 60 * 1000) / 1000)}:F>`
        },
        mission_started: {
          userName: 'JoueurTest',
          missionName: 'Mission Épique',
          timeLimit: '24 heures'
        },
        mission_completed: {
          userName: 'JoueurTest',
          missionName: 'Mission Épique',
          rewardName: 'Dragon Légendaire'
        },
        mission_failed: {
          userName: 'JoueurTest',
          missionName: 'Mission Impossible',
          failReason: 'Temps écoulé'
        },
        mission_approved: {
          userName: 'JoueurTest',
          missionName: 'Mission Secrète',
          adminName: 'AdminTest',
          rewardName: 'Trésor Rare'
        },
        mission_rejected: {
          userName: 'JoueurTest',
          missionName: 'Mission Douteuse',
          adminName: 'AdminTest'
        }
      };

      // Créer l'embed de preview
      const embed = await announcementSystem.createAnnouncementEmbed(
        interaction.guildId,
        templateType,
        testData[templateType]
      );

      if (!embed) {
        return interaction.editReply({
          content: '❌ Impossible de générer l\'aperçu.',
          flags: 64
        });
      }

      await interaction.editReply({
        content: '👁️ **APERÇU DU TEMPLATE**\n\n*Ceci est un aperçu avec des données de test. Seul vous pouvez voir ce message.*',
        embeds: [embed],
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la génération de l\'aperçu:', error);
      await interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Affiche le modal pour éditer le texte d'un template
   */
  async showTemplateTextModal(interaction) {
    const templateType = interaction.customId.replace('template_edit_text_', '');

    try {
      const template = await db.getAnnouncementTemplate(templateType, interaction.guildId);

      if (!template) {
        return interaction.reply({
          content: '❌ Template introuvable.',
          flags: 64
        });
      }

      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      // Variables disponibles par type avec descriptions
      const variableInfo = {
        legendary_collectible: {
          vars: [
            '{userName} = Nom du joueur',
            '{collectibleName} = Nom du collectible'
          ],
          example: '**{userName}** a trouvé **{collectibleName}** !'
        },
        collection_completed: {
          vars: [
            '{userName} = Nom du joueur',
            '{themeName} = Nom de la collection',
            '{roleName} = Nom du rôle obtenu'
          ],
          example: '**{userName}** a complété **{themeName}** !'
        },
        collection_traded: {
          vars: [
            '{user1Name} = Premier joueur',
            '{user2Name} = Second joueur',
            '{missionName} = Nom de la mission'
          ],
          example: '**{user1Name}** et **{user2Name}** ont échangé!'
        },
        collection_lost: {
          vars: [
            '{userName} = Nom du joueur',
            '{trapName} = Nom du piège'
          ],
          example: '**{userName}** a perdu sa collection via **{trapName}**!'
        },
        trap_curse: {
          vars: [
            '{userName} = Nom du joueur',
            '{trapName} = Nom du piège',
            '{trapEffect} = Effet du piège'
          ],
          example: '**{userName}** est maudit par **{trapName}**!'
        },
        mission_word_guessed: {
          vars: [
            '{userName} = Nom du joueur',
            '{word} = Mot deviné',
            '{missionName} = Nom de la mission'
          ],
          example: '**{userName}** a deviné **{word}**!'
        }
      };

      const info = variableInfo[templateType];

      // Extraire seulement les noms des variables (ex: {userName}, {collectibleName})
      const variableNames = info ? info.vars.map(v => v.split(' = ')[0]).join(', ') : '';
      const shortPlaceholder = variableNames.length <= 80 ? `Variables: ${variableNames}` : 'Voir la liste des variables disponibles';

      const modal = new ModalBuilder()
        .setCustomId(`modal_template_text_${templateType}`)
        .setTitle('Éditer le Template');

      const titleInput = new TextInputBuilder()
        .setCustomId('template_title')
        .setLabel('Titre (emojis autorisés)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: ⭐ COLLECTIBLE LÉGENDAIRE !')
        .setValue(template.title)
        .setRequired(true)
        .setMaxLength(256);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('template_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(shortPlaceholder)
        .setValue(template.description)
        .setRequired(true)
        .setMaxLength(2000);

      const footerInput = new TextInputBuilder()
        .setCustomId('template_footer')
        .setLabel('Texte du footer')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Système d\'annonces')
        .setValue(template.footer_text || '')
        .setRequired(false)
        .setMaxLength(256);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(footerInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage du modal:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'affichage du modal.',
        flags: 64
      });
    }
  }

  /**
   * Handler pour la sélection de couleur d'un template
   */
  async handleTemplateColorSelection(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    const templateType = interaction.customId.replace('template_color_select_', '');
    const selectedColor = interaction.values[0];

    try {
      const template = await db.getAnnouncementTemplate(templateType, interaction.guildId);

      if (!template) {
        return interaction.followUp({
          content: '❌ Template introuvable.',
          flags: 64
        });
      }

      // Mettre à jour la couleur - utiliser le bon theme_id
      if (template.theme_id) {
        await db.updateAnnouncementTemplateForTheme(templateType, {
          ...template,
          color: selectedColor
        }, interaction.guildId, template.theme_id);
      } else {
        await db.updateAnnouncementTemplate(templateType, {
          ...template,
          color: selectedColor
        }, interaction.guildId);
      }

      await interaction.followUp({
        content: `✅ Couleur mise à jour avec succès!\n\n🎨 **Nouvelle couleur:** ${selectedColor}`,
        flags: 64
      });

      // Rafraîchir le menu d'édition
      interaction.customId = `edit_template_${templateType}`;
      return this.showEditTemplateMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la couleur:', error);
      await interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  // ============================================
  // SUPER BONUS - Phase 5
  // ============================================

  /**
   * Menu de gestion des Super Bonus
   */
  async showSuperBonusesMenu(interaction) {
    try {
      const allBonuses = await db.getAllSuperBonuses();

      const embed = new EmbedBuilder()
        .setTitle('⭐ GESTION DES SUPER BONUS')
        .setDescription(
          `Les Super Bonus sont des pouvoirs temporaires ou permanents que les joueurs peuvent recevoir.\n\n` +
          `**Total:** ${allBonuses.length} super bonus configurés`
        )
        .setColor('#FFD700');

      // Grouper les bonus par rareté
      const byRarity = {
        legendary: [],
        epic: [],
        rare: [],
        common: []
      };

      for (const bonus of allBonuses) {
        byRarity[bonus.rarity]?.push(bonus);
      }

      // Afficher par rareté
      for (const [rarity, bonuses] of Object.entries(byRarity)) {
        if (bonuses.length > 0) {
          const rarityEmoji = {
            legendary: '🌟',
            epic: '💜',
            rare: '💙',
            common: '⚪'
          }[rarity];

          const bonusList = bonuses.map(b => {
            let durationText = '';
            if (b.duration_type === 'temporary') {
              const days = Math.floor(b.duration_value / 86400);
              const hours = Math.floor((b.duration_value % 86400) / 3600);
              durationText = days > 0 ? `${days}j` : `${hours}h`;
            } else if (b.duration_type === 'charges') {
              durationText = `${b.duration_value} charges`;
            } else {
              durationText = 'permanent';
            }
            return `${b.icon} **${b.name}** (${durationText})`;
          }).join('\n');

          embed.addFields({
            name: `${rarityEmoji} ${rarity.toUpperCase()}`,
            value: bonusList,
            inline: false
          });
        }
      }

      embed.setFooter({
        text: '💡 Choisissez une action ci-dessous pour gérer les super bonus'
      });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_rarity')
          .setLabel('✏️ Éditer Raretés')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_duration')
          .setLabel('⏱️ Régler Durée/Charges')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_back')
          .setLabel('🔙 Retour aux Paramètres')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        embeds: [embed],
        components: [row1]
      });

    } catch (error) {
      console.error('❌ Erreur showSuperBonusesMenu:', error);
      return interaction.update({
        content: `❌ Erreur lors de l'affichage des super bonus: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher le menu pour donner un bonus à un utilisateur
   */
  async showGiveBonusSelectUser(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('🎁 DONNER UN SUPER BONUS')
        .setDescription(
          'Pour donner un super bonus à un joueur, utilisez la commande suivante:\n\n' +
          '```/give-bonus @utilisateur [bonus_id]```\n\n' +
          'Vous pouvez également:\n' +
          '• Mentionner l\'utilisateur directement dans Discord\n' +
          '• Copier l\'ID Discord du joueur\n\n' +
          '**Liste des bonus disponibles:**'
        )
        .setColor('#FFD700');

      const allBonuses = await db.getAllSuperBonuses();

      // Grouper par rareté
      const byRarity = {
        legendary: [],
        epic: [],
        rare: [],
        common: []
      };

      for (const bonus of allBonuses) {
        byRarity[bonus.rarity]?.push(bonus);
      }

      // Afficher par rareté
      for (const [rarity, bonuses] of Object.entries(byRarity)) {
        if (bonuses.length > 0) {
          const rarityEmoji = {
            legendary: '🌟',
            epic: '💜',
            rare: '💙',
            common: '⚪'
          }[rarity];

          const bonusList = bonuses.map(b => {
            return `\`${b.bonus_id}\` - ${b.icon} **${b.name}**`;
          }).join('\n');

          embed.addFields({
            name: `${rarityEmoji} ${rarity.toUpperCase()}`,
            value: bonusList,
            inline: false
          });
        }
      }

      embed.setFooter({
        text: '💡 Utilisez le bonus_id (entre guillemets inversés) dans la commande'
      });

      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('admin_super_bonuses')
              .setLabel('🔙 Retour')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });

    } catch (error) {
      console.error('❌ Erreur showGiveBonusSelectUser:', error);
      return interaction.update({
        content: `❌ Erreur: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher tous les joueurs avec des bonus actifs
   */
  async showActiveBonusesView(interaction) {
    try {
      // Récupérer tous les bonus actifs
      const activeBonuses = await db.query(`
        SELECT
          pab.*,
          sb.name,
          sb.icon,
          sb.bonus_id,
          sb.rarity,
          sb.duration_type
        FROM player_active_bonuses pab
        JOIN super_bonuses sb ON pab.bonus_id = sb.id
        WHERE pab.is_active = 1
        ORDER BY pab.activated_at DESC
        LIMIT 50
      `);

      const embed = new EmbedBuilder()
        .setTitle('👥 BONUS ACTIFS PAR JOUEUR')
        .setColor('#FFD700');

      if (!activeBonuses || activeBonuses.length === 0) {
        embed.setDescription('Aucun joueur n\'a de super bonus actif pour le moment.');

        return interaction.update({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_super_bonuses')
                .setLabel('🔙 Retour')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }

      embed.setDescription(`**Total:** ${activeBonuses.length} bonus actif${activeBonuses.length > 1 ? 's' : ''}\n`);

      // Grouper par utilisateur
      const byUser = {};
      for (const bonus of activeBonuses) {
        if (!byUser[bonus.user_id]) {
          byUser[bonus.user_id] = [];
        }
        byUser[bonus.user_id].push(bonus);
      }

      // Afficher les 10 premiers utilisateurs avec le plus de bonus
      const sortedUsers = Object.entries(byUser)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);

      for (const [userId, userBonuses] of sortedUsers) {
        try {
          const user = await interaction.client.users.fetch(userId).catch(() => null);
          const username = user ? user.tag : `User ${userId}`;

          const bonusList = userBonuses.map(b => {
            const rarityEmoji = {
              legendary: '🌟',
              epic: '💜',
              rare: '💙',
              common: '⚪'
            }[b.rarity] || '⚪';

            let durationInfo = '';
            if (b.duration_type === 'temporary' && b.expires_at) {
              const expiresDate = new Date(b.expires_at);
              const remaining = Math.ceil((expiresDate - Date.now()) / 1000 / 60);
              if (remaining > 60) {
                const hours = Math.floor(remaining / 60);
                durationInfo = ` (${hours}h restantes)`;
              } else {
                durationInfo = ` (${remaining}min restantes)`;
              }
            } else if (b.duration_type === 'charges' && b.remaining_charges !== null) {
              durationInfo = ` (${b.remaining_charges} charges)`;
            }

            return `${rarityEmoji} ${b.icon} **${b.name}**${durationInfo}`;
          }).join('\n');

          embed.addFields({
            name: `${username} (${userBonuses.length} bonus)`,
            value: bonusList,
            inline: false
          });

        } catch (error) {
          console.error(`Erreur lors de la récupération de l'utilisateur ${userId}:`, error);
        }
      }

      if (Object.keys(byUser).length > 10) {
        embed.setFooter({
          text: `Affichage des 10 premiers utilisateurs sur ${Object.keys(byUser).length} total`
        });
      }

      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('admin_super_bonuses')
              .setLabel('🔙 Retour')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });

    } catch (error) {
      console.error('❌ Erreur showActiveBonusesView:', error);
      return interaction.update({
        content: `❌ Erreur lors de l'affichage des bonus actifs: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher le menu d'édition de rareté des bonus
   */
  async showEditBonusRarityMenu(interaction) {
    await interaction.deferUpdate();

    try {
      const guildId = interaction.guildId;
      const allBonuses = await db.getAllSuperBonuses(guildId);

      // Créer le select menu avec tous les bonus
      const options = allBonuses.map(bonus => {
        const rarityEmoji = {
          legendary: '🌟',
          epic: '💜',
          rare: '💙',
          common: '⚪'
        }[bonus.rarity] || '⚪';

        return {
          label: `${bonus.name}`,
          description: `${rarityEmoji} ${bonus.rarity.toUpperCase()}`,
          value: bonus.id.toString(),
          emoji: bonus.icon
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_bonus_for_rarity_edit')
        .setPlaceholder('Choisis un super bonus à éditer')
        .addOptions(options);

      const row1 = new ActionRowBuilder().addComponents(selectMenu);

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_super_bonuses')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle('✏️ ÉDITER LA RARETÉ DES SUPER BONUS')
        .setDescription(
          'Sélectionne un super bonus pour modifier sa rareté.\n\n' +
          '**Raretés disponibles:**\n' +
          '🌟 **Legendary** - Très rare, effets puissants\n' +
          '💜 **Epic** - Rare, effets significatifs\n' +
          '💙 **Rare** - Peu commun\n' +
          '⚪ **Common** - Commun\n\n' +
          '⚠️ La modification impacte la fréquence d\'apparition dans les mystery boxes.'
        )
        .setColor('#FFD700')
        .setFooter({
          text: `Total: ${allBonuses.length} super bonus`
        });

      return interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
      });

    } catch (error) {
      console.error('❌ Erreur showEditBonusRarityMenu:', error);
      return interaction.editReply({
        content: `❌ Erreur lors de l'affichage du menu: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher le sélecteur de rareté pour un bonus
   */
  async handleBonusRaritySelect(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    try {
      const bonusId = parseInt(interaction.values[0]);
      const bonus = await db.queryOne(
        'SELECT * FROM super_bonuses WHERE id = $1',
        [bonusId]
      );

      if (!bonus) {
        return interaction.editReply({
          content: '❌ Super bonus introuvable.',
          embeds: [],
          components: []
        });
      }

      // Select menu pour choisir la rareté
      const rarityOptions = [
        {
          label: 'Legendary',
          description: 'Très rare - Effets puissants',
          value: 'legendary',
          emoji: '🌟',
          default: bonus.rarity === 'legendary'
        },
        {
          label: 'Epic',
          description: 'Rare - Effets significatifs',
          value: 'epic',
          emoji: '💜',
          default: bonus.rarity === 'epic'
        },
        {
          label: 'Rare',
          description: 'Peu commun',
          value: 'rare',
          emoji: '💙',
          default: bonus.rarity === 'rare'
        },
        {
          label: 'Common',
          description: 'Commun',
          value: 'common',
          emoji: '⚪',
          default: bonus.rarity === 'common'
        }
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_rarity_for_bonus:${bonusId}`)
        .setPlaceholder('Choisis la nouvelle rareté')
        .addOptions(rarityOptions);

      const row1 = new ActionRowBuilder().addComponents(selectMenu);

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_rarity')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      const currentRarityEmoji = {
        legendary: '🌟',
        epic: '💜',
        rare: '💙',
        common: '⚪'
      }[bonus.rarity] || '⚪';

      const embed = new EmbedBuilder()
        .setTitle(`✏️ ÉDITER LA RARETÉ - ${bonus.icon} ${bonus.name}`)
        .setDescription(
          `**Rareté actuelle:** ${currentRarityEmoji} ${bonus.rarity.toUpperCase()}\n\n` +
          `Sélectionne la nouvelle rareté pour ce bonus.`
        )
        .setColor(bonus.color || '#FFD700')
        .addFields({
          name: '📋 Informations',
          value:
            `**Type:** ${bonus.effect_type}\n` +
            `**Durée:** ${bonus.duration_type}${bonus.duration_value ? ` (${bonus.duration_value})` : ''}\n` +
            `**Activation:** ${bonus.activation_mode === 'automatic' ? 'Automatique' : 'Manuelle'}`
        });

      return interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
      });

    } catch (error) {
      console.error('❌ Erreur handleBonusRaritySelect:', error);
      return interaction.editReply({
        content: `❌ Erreur: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Sauvegarder la nouvelle rareté d'un bonus
   */
  async saveBonusRarity(interaction) {
    // Note: deferUpdate() est déjà fait dans handleSelectMenu()

    try {
      const [, bonusId] = interaction.customId.split(':');
      const newRarity = interaction.values[0];

      // Récupérer le bonus avant modification
      const bonus = await db.queryOne(
        'SELECT * FROM super_bonuses WHERE id = $1',
        [parseInt(bonusId)]
      );

      if (!bonus) {
        return interaction.editReply({
          content: '❌ Super bonus introuvable.',
          embeds: [],
          components: []
        });
      }

      const oldRarity = bonus.rarity;

      // Mettre à jour la rareté
      await db.query(
        'UPDATE super_bonuses SET rarity = $1 WHERE id = $2',
        [newRarity, parseInt(bonusId)]
      );

      const rarityEmojis = {
        legendary: '🌟',
        epic: '💜',
        rare: '💙',
        common: '⚪'
      };

      const embed = new EmbedBuilder()
        .setTitle('✅ RARETÉ MODIFIÉE')
        .setDescription(
          `La rareté du bonus **${bonus.icon} ${bonus.name}** a été modifiée avec succès.`
        )
        .setColor('#2ecc71')
        .addFields({
          name: '📊 Changement',
          value: `${rarityEmojis[oldRarity]} ${oldRarity.toUpperCase()} → ${rarityEmojis[newRarity]} ${newRarity.toUpperCase()}`
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_rarity')
          .setLabel('✏️ Éditer un autre bonus')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_super_bonuses')
          .setLabel('🔙 Retour au menu')
          .setStyle(ButtonStyle.Secondary)
      );

      // Log dans audit
      console.log(`✅ Rareté du super bonus #${bonusId} modifiée: ${oldRarity} → ${newRarity} par ${interaction.user.tag}`);

      return interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('❌ Erreur saveBonusRarity:', error);
      return interaction.editReply({
        content: `❌ Erreur lors de la sauvegarde: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher le menu d'édition de durée des super bonus
   */
  async showEditBonusDurationMenu(interaction) {
    await interaction.deferUpdate();

    try {
      const guildId = interaction.guildId;
      const allBonuses = await db.getAllSuperBonuses(guildId);

      // Créer le select menu avec tous les bonus
      const options = allBonuses.map(bonus => {
        let durationText = '';
        if (bonus.duration_type === 'temporary') {
          const days = Math.floor(bonus.duration_value / 86400);
          const hours = Math.floor((bonus.duration_value % 86400) / 3600);
          durationText = days > 0 ? `${days}j` : `${hours}h`;
        } else if (bonus.duration_type === 'charges') {
          durationText = `${bonus.duration_value} charges`;
        } else {
          durationText = 'permanent';
        }

        return {
          label: `${bonus.name}`,
          description: `⏱️ ${durationText}`,
          value: bonus.id.toString(),
          emoji: bonus.icon
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_duration_for_bonus')
        .setPlaceholder('Choisis un super bonus à éditer')
        .addOptions(options);

      const row1 = new ActionRowBuilder().addComponents(selectMenu);

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_super_bonuses')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle('⏱️ RÉGLER DURÉE/CHARGES DES SUPER BONUS')
        .setDescription(
          'Sélectionne un super bonus pour modifier sa durée ou ses charges.\n\n' +
          '**Types de durée:**\n' +
          '♾️ **permanent** - Effet permanent\n' +
          '⏰ **temporary** - Durée limitée en temps\n' +
          '🎯 **charges** - Nombre d\'utilisations limité\n\n' +
          '⚠️ La modification impacte tous les nouveaux bonus donnés.'
        )
        .setColor('#FFD700')
        .setFooter({
          text: `Total: ${allBonuses.length} super bonus`
        });

      return interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
      });

    } catch (error) {
      console.error('❌ Erreur showEditBonusDurationMenu:', error);
      return interaction.editReply({
        content: `❌ Erreur lors de l'affichage du menu: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher directement le sélecteur de valeur selon le type de durée en DB
   * Note: Defer ICI car appelé depuis handleSelectMenu AVANT le defer général (ligne 477)
   */
  async handleBonusDurationSelect(interaction) {
    await interaction.deferUpdate();

    try {
      const bonusId = parseInt(interaction.values[0]);
      const bonus = await db.queryOne(
        'SELECT * FROM super_bonuses WHERE id = $1',
        [bonusId]
      );

      if (!bonus) {
        return interaction.editReply({
          content: '❌ Super bonus introuvable.',
          embeds: [],
          components: []
        });
      }

      // Afficher directement le sélecteur selon le type
      if (bonus.duration_type === 'permanent') {
        // Pour les bonus permanents, juste afficher un message
        const embed = new EmbedBuilder()
          .setTitle(`♾️ ${bonus.name}`)
          .setDescription('Ce bonus est **permanent** - il n\'a pas de durée limitée.')
          .setColor('#2ecc71');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_bonus_edit_duration')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });

      } else if (bonus.duration_type === 'temporary') {
        // Afficher sélecteur de jours (1-10)
        const currentDays = Math.floor(bonus.duration_value / 86400);
        const dayOptions = Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1} jour${i > 0 ? 's' : ''}`,
          value: (i + 1).toString(),
          emoji: '📅'
        }));

        const selectDays = new StringSelectMenuBuilder()
          .setCustomId(`edit_bonus_duration_days:${bonusId}`)
          .setPlaceholder('Sélectionne la durée en jours')
          .addOptions(dayOptions);

        const row1 = new ActionRowBuilder().addComponents(selectDays);
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_bonus_edit_duration')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
          .setTitle(`⏰ ${bonus.name}`)
          .setDescription(
            `**Configuration actuelle:** ${currentDays} jour${currentDays > 1 ? 's' : ''}\n\n` +
            '**Choisis la nouvelle durée** (1-10 jours):'
          )
          .setColor('#00D9FF');

        return interaction.editReply({ embeds: [embed], components: [row1, row2] });

      } else if (bonus.duration_type === 'charges') {
        // Afficher sélecteur de charges (1-10)
        const chargeOptions = Array.from({ length: 10 }, (_, i) => ({
          label: `${i + 1} charge${i > 0 ? 's' : ''}`,
          value: (i + 1).toString(),
          emoji: '🎯'
        }));

        const selectCharges = new StringSelectMenuBuilder()
          .setCustomId(`edit_bonus_duration_charges:${bonusId}`)
          .setPlaceholder('Sélectionne le nombre de charges')
          .addOptions(chargeOptions);

        const row1 = new ActionRowBuilder().addComponents(selectCharges);
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_bonus_edit_duration')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
          .setTitle(`🎯 ${bonus.name}`)
          .setDescription(
            `**Configuration actuelle:** ${bonus.duration_value} charge${bonus.duration_value > 1 ? 's' : ''}\n\n` +
            '**Choisis le nouveau nombre de charges** (1-10):'
          )
          .setColor('#00D9FF');

        return interaction.editReply({ embeds: [embed], components: [row1, row2] });
      }

    } catch (error) {
      console.error('❌ Erreur handleBonusDurationSelect:', error);
      return interaction.editReply({
        content: `❌ Erreur: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Sauvegarder la durée en jours (temporary)
   */
  async handleEditBonusDurationDays(interaction) {
    await interaction.deferUpdate();

    try {
      const [, bonusId] = interaction.customId.split(':');
      const days = parseInt(interaction.values[0]);
      const totalSeconds = days * 86400;

      const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [parseInt(bonusId)]);

      if (!bonus) {
        return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
      }

      // Sauvegarder
      await db.query(
        'UPDATE super_bonuses SET duration_value = $1 WHERE id = $2',
        [totalSeconds, parseInt(bonusId)]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ DURÉE MODIFIÉE')
        .setDescription(`Le bonus **${bonus.icon} ${bonus.name}** expirera après **${days} jour${days > 1 ? 's' : ''}**.`)
        .setColor('#2ecc71')
        .addFields({ name: '⏰ Durée', value: `${days} jour${days > 1 ? 's' : ''}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_duration')
          .setLabel('⏱️ Éditer un autre')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_super_bonuses')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      console.log(`✅ Super bonus #${bonusId} → Durée ${days}j par ${interaction.user.tag}`);
      return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('❌ Erreur handleEditBonusDurationDays:', error);
      return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
    }
  }

  /**
   * Sauvegarder le nombre de charges
   */
  async handleEditBonusDurationCharges(interaction) {
    await interaction.deferUpdate();

    try {
      const [, bonusId] = interaction.customId.split(':');
      const charges = parseInt(interaction.values[0]);

      const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [parseInt(bonusId)]);

      if (!bonus) {
        return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
      }

      // Sauvegarder
      await db.query(
        'UPDATE super_bonuses SET duration_value = $1 WHERE id = $2',
        [charges, parseInt(bonusId)]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ CHARGES MODIFIÉES')
        .setDescription(`Le bonus **${bonus.icon} ${bonus.name}** aura **${charges} charge${charges > 1 ? 's' : ''}**.`)
        .setColor('#2ecc71')
        .addFields({ name: '🎯 Charges', value: `${charges} utilisation${charges > 1 ? 's' : ''}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_duration')
          .setLabel('⏱️ Éditer un autre')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_super_bonuses')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      console.log(`✅ Super bonus #${bonusId} → ${charges} charge(s) par ${interaction.user.tag}`);
      return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('❌ Erreur handleEditBonusDurationCharges:', error);
      return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
    }
  }

  /**
   * Gérer le clic sur "Permanent"
   */
  async handleDurationTypePermanent(interaction) {
    await interaction.deferUpdate();

    try {
      const bonusId = parseInt(interaction.customId.split(':')[1]);
      const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [bonusId]);

      if (!bonus) {
        return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
      }

      // Sauvegarder
      await db.query(
        'UPDATE super_bonuses SET duration_type = $1, duration_value = $2 WHERE id = $3',
        ['permanent', 0, bonusId]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ DURÉE MODIFIÉE')
        .setDescription(`Le bonus **${bonus.icon} ${bonus.name}** est maintenant **permanent**.`)
        .setColor('#2ecc71')
        .addFields({ name: '♾️ Effet', value: 'Le bonus restera actif indéfiniment' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_duration')
          .setLabel('⏱️ Éditer un autre')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_super_bonuses')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      console.log(`✅ Super bonus #${bonusId} → Permanent par ${interaction.user.tag}`);
      return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('❌ Erreur handleDurationTypePermanent:', error);
      return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
    }
  }

  /**
   * Gérer le clic sur "Temporaire" - Afficher select jours
   */
  async handleDurationTypeTemporary(interaction) {
    await interaction.deferUpdate();

    try {
      const bonusId = parseInt(interaction.customId.split(':')[1]);
      const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [bonusId]);

      if (!bonus) {
        return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
      }

      // Options jours (1-10)
      const dayOptions = Array.from({ length: 10 }, (_, i) => ({
        label: `${i + 1} jour${i > 0 ? 's' : ''}`,
        value: (i + 1).toString(),
        emoji: '📅'
      }));

      const selectDays = new StringSelectMenuBuilder()
        .setCustomId(`select_duration_days:${bonusId}`)
        .setPlaceholder('Sélectionne le nombre de jours')
        .addOptions(dayOptions);

      const row1 = new ActionRowBuilder().addComponents(selectDays);
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`select_duration_for_bonus`)
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle(`⏰ DURÉE TEMPORAIRE - ${bonus.icon} ${bonus.name}`)
        .setDescription(
          '**Étape 1/2:** Choisis le nombre de jours\n\n' +
          'Le bonus expirera automatiquement après la durée sélectionnée.\n\n' +
          '💡 Tu pourras ensuite choisir les heures (0-23h).'
        )
        .setColor('#00D9FF');

      return interaction.editReply({ embeds: [embed], components: [row1, row2] });

    } catch (error) {
      console.error('❌ Erreur handleDurationTypeTemporary:', error);
      return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
    }
  }

  /**
   * Gérer la sélection des jours - Afficher select heures
   */
  async handleSelectDurationDays(interaction) {
    await interaction.deferUpdate();

    try {
      const [, bonusId] = interaction.customId.split(':');
      const days = parseInt(interaction.values[0]);
      const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [parseInt(bonusId)]);

      if (!bonus) {
        return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
      }

      // Options heures (0-23)
      const hourOptions = Array.from({ length: 24 }, (_, i) => ({
        label: `${i} heure${i > 1 ? 's' : ''}`,
        value: i.toString(),
        emoji: '🕐'
      }));

      const selectHours = new StringSelectMenuBuilder()
        .setCustomId(`select_duration_hours:${bonusId}:${days}`)
        .setPlaceholder('Sélectionne le nombre d\'heures')
        .addOptions(hourOptions);

      const row1 = new ActionRowBuilder().addComponents(selectHours);
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`duration_type_temporary:${bonusId}`)
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle(`⏰ DURÉE TEMPORAIRE - ${bonus.icon} ${bonus.name}`)
        .setDescription(
          `**Étape 2/2:** Choisis le nombre d'heures\n\n` +
          `📅 Durée sélectionnée: **${days} jour${days > 1 ? 's' : ''}** + heures\n\n` +
          '💡 Le bonus expirera après cette durée.'
        )
        .setColor('#00D9FF');

      return interaction.editReply({ embeds: [embed], components: [row1, row2] });

    } catch (error) {
      console.error('❌ Erreur handleSelectDurationDays:', error);
      return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
    }
  }

  /**
   * Gérer la sélection des heures - Sauvegarder
   */
  async handleSelectDurationHours(interaction) {
    await interaction.deferUpdate();

    try {
      const [, bonusId, days] = interaction.customId.split(':');
      const hours = parseInt(interaction.values[0]);
      const totalSeconds = (parseInt(days) * 86400) + (hours * 3600);

      const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [parseInt(bonusId)]);

      if (!bonus) {
        return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
      }

      // Sauvegarder
      await db.query(
        'UPDATE super_bonuses SET duration_type = $1, duration_value = $2 WHERE id = $3',
        ['temporary', totalSeconds, parseInt(bonusId)]
      );

      const durationText = `${days} jour${days > 1 ? 's' : ''}${hours > 0 ? ` et ${hours} heure${hours > 1 ? 's' : ''}` : ''}`;

      const embed = new EmbedBuilder()
        .setTitle('✅ DURÉE MODIFIÉE')
        .setDescription(`Le bonus **${bonus.icon} ${bonus.name}** expirera après **${durationText}**.`)
        .setColor('#2ecc71')
        .addFields({ name: '⏰ Durée', value: durationText });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_duration')
          .setLabel('⏱️ Éditer un autre')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_super_bonuses')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      console.log(`✅ Super bonus #${bonusId} → Temporaire (${durationText}) par ${interaction.user.tag}`);
      return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('❌ Erreur handleSelectDurationHours:', error);
      return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
    }
  }

  /**
   * Gérer le clic sur "Charges" - Afficher select charges
   */
  async handleDurationTypeCharges(interaction) {
    await interaction.deferUpdate();

    try {
      const bonusId = parseInt(interaction.customId.split(':')[1]);
      const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [bonusId]);

      if (!bonus) {
        return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
      }

      // Options charges (1-10)
      const chargeOptions = Array.from({ length: 10 }, (_, i) => ({
        label: `${i + 1} charge${i > 0 ? 's' : ''}`,
        value: (i + 1).toString(),
        emoji: '🎯'
      }));

      const selectCharges = new StringSelectMenuBuilder()
        .setCustomId(`select_duration_charges:${bonusId}`)
        .setPlaceholder('Sélectionne le nombre de charges')
        .addOptions(chargeOptions);

      const row1 = new ActionRowBuilder().addComponents(selectCharges);
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`select_duration_for_bonus`)
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle(`🎯 CHARGES - ${bonus.icon} ${bonus.name}`)
        .setDescription(
          '**Choisis le nombre d\'utilisations**\n\n' +
          'Le bonus expirera après avoir été utilisé ce nombre de fois.\n\n' +
          '💡 Par exemple, "3 charges" = le bonus s\'active 3 fois puis expire.'
        )
        .setColor('#00D9FF');

      return interaction.editReply({ embeds: [embed], components: [row1, row2] });

    } catch (error) {
      console.error('❌ Erreur handleDurationTypeCharges:', error);
      return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
    }
  }

  /**
   * Gérer la sélection des charges - Sauvegarder
   */
  async handleSelectDurationCharges(interaction) {
    await interaction.deferUpdate();

    try {
      const bonusId = parseInt(interaction.customId.split(':')[1]);
      const charges = parseInt(interaction.values[0]);

      const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [bonusId]);

      if (!bonus) {
        return interaction.editReply({ content: '❌ Super bonus introuvable.', embeds: [], components: [] });
      }

      // Sauvegarder
      await db.query(
        'UPDATE super_bonuses SET duration_type = $1, duration_value = $2 WHERE id = $3',
        ['charges', charges, bonusId]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ DURÉE MODIFIÉE')
        .setDescription(`Le bonus **${bonus.icon} ${bonus.name}** s'activera **${charges} fois** avant d'expirer.`)
        .setColor('#2ecc71')
        .addFields({ name: '🎯 Charges', value: `${charges} utilisation${charges > 1 ? 's' : ''}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bonus_edit_duration')
          .setLabel('⏱️ Éditer un autre')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_super_bonuses')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      console.log(`✅ Super bonus #${bonusId} → Charges (${charges}) par ${interaction.user.tag}`);
      return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('❌ Erreur handleSelectDurationCharges:', error);
      return interaction.editReply({ content: `❌ Erreur: ${error.message}`, embeds: [], components: [] });
    }
  }

  // ============================================
  // GESTION DES MISSIONS
  // ============================================

  /**
   * Afficher le sélecteur de type de mission
   */
  async showMissionTypeSelector(interaction) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_mission_type')
      .setPlaceholder('Choisis le type de mission')
      .addOptions([
        {
          label: 'Mot Deviné',
          value: 'keyword-message',
          description: 'Le joueur doit écrire un mot-clé dans un canal',
          emoji: '🔤'
        },
        {
          label: 'Quiz',
          value: 'quiz',
          description: 'Le joueur répond à des questions à choix multiples',
          emoji: '❓'
        },
        {
          label: 'Vrai ou Faux',
          value: 'true-false',
          description: 'Le joueur répond Vrai ou Faux à des affirmations',
          emoji: '✅'
        },
        {
          label: 'Emoji Devinette',
          value: 'emoji-puzzle',
          description: 'Deviner ce que représentent des emojis révélés progressivement',
          emoji: '🧩'
        }
      ]);

    const embed = new EmbedBuilder()
      .setTitle('➕ Créer une nouvelle mission')
      .setDescription(
        'Sélectionne le type de mini-jeu que tu veux créer.\n\n' +
        '**Types disponibles:**\n' +
        '🔤 **Mot Deviné** - Deviner un mot caché\n' +
        '❓ **Quiz** - Questions à choix multiples\n' +
        '✅ **Vrai/Faux** - Répondre à des affirmations\n' +
        '🧩 **Emoji Devinette** - Deviner à partir d\'emojis'
      )
      .setColor('#5865F2')
      .setFooter({ text: '💡 D\'autres types seront bientôt disponibles !' });

    return interaction.update({
      content: null,
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_missions')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  /**
   * Handler pour la sélection du type de mission
   */
  async handleMissionTypeSelection(interaction) {
    const missionType = interaction.values[0];

    // Stocker temporairement le type
    this.imageUploadCache.set(interaction.user.id, { missionType });

    // Afficher le modal correspondant
    await this.showMissionAddModal(interaction, missionType);
  }

  /**
   * Afficher le modal d'ajout de mission
   */
  async showMissionAddModal(interaction, missionType) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_mission_add_${missionType}`)
      .setTitle(`Ajouter une mission ${missionType}`);

    const row1 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('mission_id')
        .setLabel('ID de la mission (unique)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: find-snow-white')
        .setRequired(true)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('mission_name')
        .setLabel('Nom de la mission')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Trouve Blanche-Neige')
        .setRequired(true)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('mission_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Description de la mission...')
        .setRequired(true)
    );

    // Champs spécifiques selon le type
    if (missionType === 'keyword-message') {
      const row4 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_keyword')
          .setLabel('Mot-clé à trouver')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: blanche-neige')
          .setRequired(true)
      );

      const row5 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_timeout')
          .setLabel('Timeout (en secondes)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 60')
          .setValue('60')
          .setRequired(true)
      );

      modal.addComponents(row1, row2, row3, row4, row5);
    } else if (missionType === 'quiz') {
      const row4 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_question')
          .setLabel('Question')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Quelle est la question ?')
          .setRequired(true)
      );

      const row5 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_answer')
          .setLabel('Réponse (sensible à la casse)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('La réponse correcte')
          .setRequired(true)
      );

      modal.addComponents(row1, row2, row3, row4, row5);
    } else if (missionType === 'true-false') {
      // Pour true-false, on n'a besoin que des champs de base
      // Les questions seront ajoutées via le bouton "Gérer les Questions V/F"
      const row4 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_timeout')
          .setLabel('Temps par question (en secondes)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 15')
          .setValue('15')
          .setRequired(true)
      );

      const row5 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_max_attempts')
          .setLabel('Nombre de questions')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 3')
          .setValue('3')
          .setRequired(true)
      );

      modal.addComponents(row1, row2, row3, row4, row5);
    } else if (missionType === 'emoji-puzzle') {
      // Pour emoji-puzzle: temps entre chaque emoji et nombre d'essais
      // Les puzzles seront ajoutés via le bouton "Gérer les Puzzles"
      const row4 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_timeout')
          .setLabel('Temps par emoji (en secondes)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 15 (x3 au dernier)')
          .setValue('15')
          .setRequired(true)
      );

      const row5 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_max_attempts')
          .setLabel('Nombre d\'essais maximum')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 5')
          .setValue('5')
          .setRequired(true)
      );

      modal.addComponents(row1, row2, row3, row4, row5);
    }

    return interaction.showModal(modal);
  }

  /**
   * Handler pour la sélection d'une mission (modifier/supprimer)
   */
  async handleMissionSelection(interaction) {
    console.log('🔍 [MISSION SELECT] Début handleMissionSelection');

    // Gérer les deux cas: select menu (values) ou bouton (customId)
    let missionId;
    if (interaction.values && interaction.values.length > 0) {
      // Cas select menu - deferUpdate déjà fait dans handleSelectMenu()
      console.log('🔍 [MISSION SELECT] Select menu - deferUpdate déjà fait');
      missionId = parseInt(interaction.values[0]);
    } else if (interaction.customId && interaction.customId.startsWith('select_mission_')) {
      // Cas bouton - il faut defer ici
      console.log('🔍 [MISSION SELECT] Bouton - deferUpdate nécessaire');
      await interaction.deferUpdate();
      missionId = parseInt(interaction.customId.replace('select_mission_', ''));
    } else {
      console.error('🔴 [MISSION SELECT] Impossible d\'extraire le missionId');
      return interaction.followUp({
        content: '❌ Erreur: impossible d\'identifier la mission.',
        flags: 64
      });
    }
    console.log(`🔍 [MISSION SELECT] missionId = ${missionId}, guildId = ${interaction.guildId}`);

    const mission = await db.getMissionById(interaction.guildId, missionId);
    console.log(`🔍 [MISSION SELECT] mission trouvée:`, mission);

    if (!mission) {
      console.log('🔍 [MISSION SELECT] Mission introuvable');
      return interaction.followUp({
        content: '❌ Mission introuvable.',
        flags: 64
      });
    }

    // Détecter si la mission est hardcodée (missions créées automatiquement avec les thèmes)
    const isHardcodedMission = mission.name === 'Mot Deviné' || mission.name === 'Quiz';

    const missionTypes = {
      'keyword-message': '🔤 Mot-clé',
      'quiz': '❓ Quiz',
      'true-false': '✅ Vrai ou Faux',
      'emoji-puzzle': '🎭 Emoji Devinette',
      'wordle': '🟩 Wordle',
      'unscramble': '🔀 Anagramme',
      'hangman': '☠️ Pendu',
      'reaction-message': '👍 Réaction',
      'voice-join': '🔊 Vocal'
    };

    // Créer l'embed selon le type de mission
    let embed;

    // Embed spécialisé pour true-false
    if (mission.type === 'true-false') {
      // Récupérer les questions V/F pour cette mission
      const questions = await db.getQuizQuestionsByMission(interaction.guildId, mission.id);

      // Compter par difficulté
      const byDifficulty = {
        easy: questions.filter(q => q.difficulty === 'easy').length,
        medium: questions.filter(q => q.difficulty === 'medium').length,
        hard: questions.filter(q => q.difficulty === 'hard').length
      };
      const totalQuestions = questions.length;

      // Compter Vrai vs Faux
      const vraiCount = questions.filter(q =>
        q.correct_answer && q.correct_answer.toLowerCase() === 'vrai'
      ).length;
      const fauxCount = totalQuestions - vraiCount;

      embed = new EmbedBuilder()
        .setTitle(`✅ ${mission.name}`)
        .setDescription(
          `${mission.description}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setColor('#2ECC71') // Vert pour Vrai/Faux
        .addFields(
          {
            name: '📊 Questions configurées',
            value: totalQuestions > 0
              ? `**${totalQuestions}** question${totalQuestions > 1 ? 's' : ''}`
              : `⚠️ *Aucune question*`,
            inline: true
          },
          {
            name: '🎯 Questions/Session',
            value: `**${mission.max_attempts || 5}** questions`,
            inline: true
          },
          {
            name: '⏱️ Temps/Question',
            value: `**${mission.timeout || 15}** secondes`,
            inline: true
          }
        );

      // Ajouter la répartition par difficulté si des questions existent
      if (totalQuestions > 0) {
        embed.addFields(
          {
            name: '📈 Répartition par difficulté',
            value: `🟢 Facile: **${byDifficulty.easy}**\n🟡 Moyen: **${byDifficulty.medium}**\n🔴 Difficile: **${byDifficulty.hard}**`,
            inline: true
          },
          {
            name: '⚖️ Équilibre Vrai/Faux',
            value: `✅ Vrai: **${vraiCount}**\n❌ Faux: **${fauxCount}**`,
            inline: true
          },
          {
            name: '🆔 Identifiant',
            value: `\`${mission.mission_id}\``,
            inline: true
          }
        );
      } else {
        embed.addFields({
          name: '💡 Astuce',
          value: 'Utilisez le bouton **Gérer les Questions V/F** pour ajouter des questions !',
          inline: false
        });
      }

    // Embed spécialisé pour emoji-puzzle
    } else if (mission.type === 'emoji-puzzle') {
      const puzzles = await db.getQuizQuestionsByMission(interaction.guildId, mission.id);
      const totalPuzzles = puzzles.length;

      const byDifficulty = {
        easy: puzzles.filter(q => q.difficulty === 'easy').length,
        medium: puzzles.filter(q => q.difficulty === 'medium').length,
        hard: puzzles.filter(q => q.difficulty === 'hard').length
      };

      embed = new EmbedBuilder()
        .setTitle(`🧩 ${mission.name}`)
        .setDescription(
          `${mission.description}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setColor('#9B59B6') // Violet pour Emoji Puzzle
        .addFields(
          {
            name: '🧩 Puzzles configurés',
            value: totalPuzzles > 0
              ? `**${totalPuzzles}** puzzle${totalPuzzles > 1 ? 's' : ''}`
              : `⚠️ *Aucun puzzle*`,
            inline: true
          },
          {
            name: '🎯 Essais max',
            value: `**${mission.max_attempts || 3}** essais`,
            inline: true
          },
          {
            name: '⏱️ Temps/Emoji',
            value: `**${mission.timeout || 10}** secondes`,
            inline: true
          }
        );

      if (totalPuzzles > 0) {
        embed.addFields(
          {
            name: '📈 Répartition par difficulté',
            value: `🟢 Facile: **${byDifficulty.easy}**\n🟡 Moyen: **${byDifficulty.medium}**\n🔴 Difficile: **${byDifficulty.hard}**`,
            inline: true
          },
          {
            name: '🆔 Identifiant',
            value: `\`${mission.mission_id}\``,
            inline: true
          }
        );
      } else {
        embed.addFields({
          name: '💡 Astuce',
          value: 'Utilisez le bouton **Gérer les Puzzles** pour ajouter des devinettes emoji !',
          inline: false
        });
      }

    // Embed générique pour les autres types
    } else {
      embed = new EmbedBuilder()
        .setTitle(`${missionTypes[mission.type] || mission.type} - ${mission.name}`)
        .setDescription(
          `${mission.description}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**Informations de la mission:**`
        )
        .setColor('#5865F2')
        .addFields(
          {
            name: '🆔 Identifiant',
            value: `\`${mission.mission_id}\``,
            inline: true
          },
          {
            name: '📋 Type',
            value: `\`${mission.type}\``,
            inline: true
          },
          {
            name: '⏱️ Timeout',
            value: `**${mission.timeout}** secondes`,
            inline: true
          }
        );

      // Afficher les données de validation pour types génériques
      if (mission.validation_data) {
        try {
          const validationData = JSON.parse(mission.validation_data);
          if (validationData.keyword) {
            embed.addFields({
              name: '🔑 Mot-clé',
              value: `\`${validationData.keyword}\``
            });
          }
          if (validationData.question) {
            embed.addFields({
              name: '❓ Question',
              value: validationData.question
            });
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    // Ajouter l'image de la mission si elle existe (thumbnail)
    if (mission.image_url) {
      embed.setThumbnail(mission.image_url);
      embed.addFields({
        name: '🖼️ Image',
        value: '✅ Configurée',
        inline: true
      });
    } else {
      embed.addFields({
        name: '🖼️ Image',
        value: '❌ Non configurée',
        inline: true
      });
    }

    // Badge pour missions hardcodées
    if (isHardcodedMission) {
      embed.setFooter({
        text: '🔒 Mission système - Recréée automatiquement avec chaque nouveau thème'
      });
    }

    const components = [];

    // Boutons de personnalisation selon le type de mission
    if (mission.type === 'quiz') {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_quiz_questions_${missionId}`)
            .setLabel('❓ Gérer les Questions')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`mission_timeout_config_${missionId}`)
            .setLabel('⏱️ Configurer le Timeout')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`mission_max_attempts_config_${missionId}`)
            .setLabel('🎯 Nombre d\'essais')
            .setStyle(ButtonStyle.Secondary)
        )
      );
    } else if (mission.type === 'true-false') {
      // Mission Vrai ou Faux - boutons spécifiques
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_truefalse_questions_${missionId}`)
            .setLabel('✅ Gérer les Questions V/F')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`mission_timeout_config_${missionId}`)
            .setLabel('⏱️ Temps par question')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`mission_max_attempts_config_${missionId}`)
            .setLabel('🎯 Nombre de questions')
            .setStyle(ButtonStyle.Secondary)
        )
      );
    } else if (mission.type === 'emoji-puzzle') {
      // Mission Emoji Devinette - boutons spécifiques
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_emoji_puzzles_${missionId}`)
            .setLabel('🧩 Gérer les Puzzles')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`mission_timeout_config_${missionId}`)
            .setLabel('⏱️ Temps par emoji')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`mission_max_attempts_config_${missionId}`)
            .setLabel('🎯 Nombre d\'essais')
            .setStyle(ButtonStyle.Secondary)
        )
      );
    } else if (mission.type === 'keyword-message') {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_keywords_manage_${missionId}`)
            .setLabel('📝 Gérer les Mots-clés')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`mission_channels_config_${missionId}`)
            .setLabel('⚙️ Configurer les Canaux')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`mission_timeout_config_${missionId}`)
            .setLabel('⏱️ Timeout')
            .setStyle(ButtonStyle.Secondary)
        )
      );
    } else {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_edit_${missionId}`)
            .setLabel('✏️ Modifier')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`mission_timeout_config_${missionId}`)
            .setLabel('⏱️ Configurer le Timeout')
            .setStyle(ButtonStyle.Secondary)
        )
      );
    }

    // Boutons communs à tous les types de missions (Éditer infos + Récompense + Image)
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_edit_info_${missionId}`)
          .setLabel('✏️ Modifier Nom/Description')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`mission_image_upload_${missionId}`)
          .setLabel('🖼️ Image')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`mission_reward_config_${missionId}`)
          .setLabel('🎁 Configurer la Récompense')
          .setStyle(ButtonStyle.Success)
      )
    );

    // Boutons Supprimer (seulement si pas hardcodée) et Retour
    const finalButtons = [];

    // N'ajouter le bouton supprimer QUE si la mission n'est pas hardcodée
    if (!isHardcodedMission) {
      finalButtons.push(
        new ButtonBuilder()
          .setCustomId(`mission_delete_confirm_${missionId}`)
          .setLabel('🗑️ Supprimer')
          .setStyle(ButtonStyle.Danger)
      );
    }

    finalButtons.push(
      new ButtonBuilder()
        .setCustomId('admin_missions')
        .setLabel('↩️ Retour aux missions')
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(new ActionRowBuilder().addComponents(finalButtons));

    return interaction.editReply({
      embeds: [embed],
      components
    });
  }

  /**
   * Handler pour configurer le timeout d'une mission
   */
  async handleMissionTimeoutConfig(interaction) {
    try {
      // Extraire missionId depuis le customId: mission_timeout_config_{missionId}
      const missionId = parseInt(interaction.customId.split('_')[3]);

      // Récupérer la mission
      const mission = await db.getMissionById(interaction.guildId, missionId);

      if (!mission) {
        return interaction.reply({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      // Créer le modal
      const modal = new ModalBuilder()
        .setCustomId(`modal_mission_timeout_${missionId}`)
        .setTitle('⏱️ Configurer le Timeout');

      const timeoutInput = new TextInputBuilder()
        .setCustomId('timeout')
        .setLabel('Timeout (en secondes)')
        .setPlaceholder('Ex: 300 pour 5 minutes')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(mission.timeout.toString())
        .setMinLength(1)
        .setMaxLength(5);

      const row = new ActionRowBuilder().addComponents(timeoutInput);
      modal.addComponents(row);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('🔴 Erreur handleMissionTimeoutConfig:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'affichage du modal.',
        flags: 64
      });
    }
  }

  /**
   * Handler pour uploader une image de mission via thread
   */
  async handleMissionImageUpload(interaction) {
    try {
      const guildId = interaction.guildId;
      const missionId = parseInt(interaction.customId.split('_')[3]);

      // Récupérer la mission
      const mission = await db.getMissionById(guildId, missionId);

      if (!mission) {
        return interaction.reply({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      const channel = interaction.channel;

      // Créer un thread privé pour l'upload
      const threadName = `📷 Image Mission - ${mission.name.substring(0, 50)}`;

      const thread = await channel.threads.create({
        name: threadName.substring(0, 100),
        autoArchiveDuration: 60,
        type: 12, // PRIVATE_THREAD
        reason: `Upload image pour mission ${mission.name}`
      });

      // Ajouter l'utilisateur au thread
      await thread.members.add(interaction.user.id);

      // Defer l'interaction
      await interaction.deferUpdate();

      // Message dans le thread avec les instructions
      let instructions = `🖼️ **UPLOAD IMAGE MISSION**\n\n`;
      instructions += `📋 **Mission:** ${mission.name}\n`;
      instructions += `📝 **Type:** ${mission.type}\n\n`;

      if (mission.image_url) {
        instructions += `📷 **Image actuelle:**\n${mission.image_url}\n\n`;
      } else {
        instructions += `📷 **Image actuelle:** Aucune\n\n`;
      }

      instructions += `🎯 **Instructions:**\n`;
      instructions += `• Drag & drop ton image ici\n`;
      instructions += `• Ou colle un screenshot (Ctrl+V)\n`;
      instructions += `• Ou colle une **URL d'image** (https://...)\n`;
      instructions += `• Formats acceptés: PNG, JPG, GIF, WEBP\n\n`;
      instructions += `⏱️ Tu as **2 minutes**\n\n`;
      instructions += `💡 Cette image sera affichée lors du lancement de la mission.`;

      const cancelButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_image_cancel_${missionId}`)
          .setLabel('❌ Annuler')
          .setStyle(ButtonStyle.Danger)
      );

      await thread.send({ content: instructions, components: [cancelButton] });

      // MessageCollector pour l'image (attachment OU URL)
      const filter = (m) => {
        if (m.author.id !== interaction.user.id) return false;
        // Accepter les attachments
        if (m.attachments.size > 0) return true;
        // Accepter toute URL HTTP/HTTPS (on validera après)
        const urlPattern = /https?:\/\/[^\s]+/i;
        if (urlPattern.test(m.content)) return true;
        return false;
      };

      const collector = thread.createMessageCollector({
        filter,
        time: 120000, // 2 minutes
        max: 1
      });

      collector.on('collect', async (message) => {
        let imageUrl;

        // Cas 1: Attachment (fichier uploadé)
        if (message.attachments.size > 0) {
          const attachment = message.attachments.first();

          // Vérifier que c'est une image
          const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
          if (!attachment.contentType || !validImageTypes.includes(attachment.contentType)) {
            await thread.send('❌ Le fichier doit être une image (PNG, JPG, GIF, WEBP).');
            return;
          }

          imageUrl = attachment.url;
        }
        // Cas 2: URL collée
        else {
          const urlPattern = /https?:\/\/[^\s]+/i;
          const match = message.content.match(urlPattern);
          if (match) {
            imageUrl = match[0];
            // Nettoyer l'URL (enlever caractères de fin indésirables)
            imageUrl = imageUrl.replace(/[<>)}\]]+$/, '');
          } else {
            await thread.send('❌ URL invalide. Colle une URL commençant par http:// ou https://');
            return;
          }
        }

        // Mettre à jour l'image de la mission
        await db.query(`
          UPDATE missions
          SET image_url = $1
          WHERE id = $2 AND guild_id = $3
        `, [imageUrl, missionId, guildId]);

        console.log(`📷 [MISSION] Image configurée pour mission ${missionId}: ${imageUrl}`);

        await thread.send({
          content: `✅ **Image de mission mise à jour !**\n\n` +
            `📋 **Mission:** ${mission.name}\n` +
            `📷 **Nouvelle URL:** ${imageUrl}\n\n` +
            `🔒 Ce thread sera archivé dans 10 secondes...`,
          components: []
        });

        // Archiver le thread après 10 secondes
        setTimeout(async () => {
          try {
            await thread.setArchived(true);
          } catch (err) {
            console.warn('⚠️ Impossible d\'archiver le thread:', err);
          }
        }, 10000);
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await thread.send('⏱️ **Temps écoulé !** Aucune image configurée. Ce thread sera archivé.');
          setTimeout(async () => {
            try {
              await thread.setArchived(true);
            } catch (err) {
              console.warn('⚠️ Impossible d\'archiver le thread:', err);
            }
          }, 5000);
        }
      });

    } catch (error) {
      console.error('🔴 Erreur handleMissionImageUpload:', error);

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '❌ Erreur lors de la création du thread d\'upload.',
          flags: 64
        });
      } else {
        await interaction.reply({
          content: '❌ Erreur lors de la création du thread d\'upload.',
          flags: 64
        });
      }
    }
  }

  /**
   * Handler pour configurer les canaux autorisés pour une mission
   */
  async handleMissionChannelsConfig(interaction) {
    try {
      await interaction.deferUpdate();

      const missionId = parseInt(interaction.customId.split('_')[3]);

      // Récupérer la mission
      const mission = await db.getMissionById(interaction.guildId, missionId);

      if (!mission) {
        return interaction.followUp({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      // Récupérer TOUS les canaux texte du serveur qui supportent les threads
      const guild = interaction.guild;
      const allChannels = guild.channels.cache
        .filter(channel => channel.type === ChannelType.GuildText && !channel.isThread())
        .sort((a, b) => a.position - b.position);

      console.log(`🔍 [MISSION CHANNELS] ${allChannels.size} canaux texte trouvés sur le serveur`);
      allChannels.forEach(ch => {
        console.log(`  - ${ch.name} (ID: ${ch.id})`);
      });

      if (allChannels.size === 0) {
        return interaction.editReply({
          content: '❌ Aucun canal texte disponible sur ce serveur.',
          components: []
        });
      }

      // Récupérer les canaux actuellement configurés
      const currentChannels = mission.allowed_channels || [];

      const hasMoreThan25 = allChannels.size > 25;

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configuration des Canaux - ${mission.name}`)
        .setColor('#3498db')
        .setDescription(
          `**Mission:** ${mission.name}\n` +
          `**Type:** ${mission.type}\n\n` +
          `**📍 Canaux configurés:** ${currentChannels.length > 0 ? currentChannels.length : 'Tous les canaux'}\n\n` +
          (currentChannels.length > 0 ?
            `**Canaux actuels:**\n${currentChannels.map(id => `<#${id}>`).join(', ')}\n\n` :
            '⚠️ **Aucun canal configuré** - La mission peut apparaître dans tous les canaux\n\n') +
          `💡 **Sélectionne les canaux** où cette mission peut être assignée.\n` +
          `Si aucun canal n'est sélectionné, la mission pourra apparaître partout.`
        )
        .setFooter({ text: `Mission ID: ${missionId}` });

      // Créer le select menu (limité à 25 options)
      const channelOptions = allChannels.map(channel => ({
        label: `# ${channel.name}`,
        value: channel.id,
        description: channel.topic ? channel.topic.substring(0, 100) : 'Aucune description',
        default: currentChannels.includes(channel.id)
      })).slice(0, 25); // Discord limite à 25 options

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_mission_channels_${missionId}`)
        .setPlaceholder('🔍 Sélectionne les canaux autorisés...')
        .addOptions(channelOptions)
        .setMinValues(0)
        .setMaxValues(channelOptions.length);

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);

      // Boutons
      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_channels_clear_${missionId}`)
          .setLabel('🗑️ Tout Effacer')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`select_mission_${missionId}`)
          .setLabel('↩️ Retour à la Mission')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [selectRow, buttonsRow]
      });

    } catch (error) {
      console.error('🔴 Erreur handleMissionChannelsConfig:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        components: []
      });
    }
  }

  /**
   * Handler pour sauvegarder la sélection de canaux
   */
  async handleMissionChannelsSelection(interaction) {
    try {
      await interaction.deferUpdate();

      const missionId = parseInt(interaction.customId.split('_')[3]);
      const selectedChannels = interaction.values;

      // Mettre à jour la mission avec les canaux sélectionnés
      await db.query(
        'UPDATE missions SET allowed_channels = $1 WHERE guild_id = $2 AND id = $3',
        [selectedChannels.length > 0 ? selectedChannels : null, interaction.guildId, missionId]
      );

      // Rafraîchir l'affichage
      await this.handleMissionChannelsConfig({
        ...interaction,
        customId: `mission_channels_config_${missionId}`
      });

      // Feedback
      await interaction.followUp({
        content: selectedChannels.length > 0
          ? `✅ ${selectedChannels.length} canal(aux) configuré(s) pour cette mission.`
          : '✅ Configuration effacée - la mission peut apparaître dans tous les canaux.',
        flags: 64
      });

    } catch (error) {
      console.error('🔴 Erreur handleMissionChannelsSelection:', error);
      await interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour effacer tous les canaux configurés
   */
  async handleMissionChannelsClear(interaction) {
    try {
      await interaction.deferUpdate();

      const missionId = parseInt(interaction.customId.split('_')[3]);

      // Effacer tous les canaux (mettre à NULL)
      await db.query(
        'UPDATE missions SET allowed_channels = NULL WHERE guild_id = $1 AND id = $2',
        [interaction.guildId, missionId]
      );

      // Rafraîchir l'affichage
      await this.handleMissionChannelsConfig({
        ...interaction,
        customId: `mission_channels_config_${missionId}`
      });

      // Feedback
      await interaction.followUp({
        content: '✅ Tous les canaux ont été effacés - la mission peut apparaître partout.',
        flags: 64
      });

    } catch (error) {
      console.error('🔴 Erreur handleMissionChannelsClear:', error);
      await interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour gérer les mots-clés d'une mission
   */
  async handleMissionKeywordsManage(interaction) {
    try {
      await interaction.deferUpdate();

      const missionId = parseInt(interaction.customId.split('_')[3]);
      const page = interaction.customId.split('_')[4] ? parseInt(interaction.customId.split('_')[4]) : 0;

      // Récupérer la mission
      const mission = await db.getMissionById(interaction.guildId, missionId);

      if (!mission) {
        return interaction.followUp({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      // Récupérer tous les mots-clés pour cette mission
      const allKeywords = await db.queryAll(
        `SELECT id, keyword, difficulty, target_channel_id
         FROM mission_keywords
         WHERE guild_id = $1 AND mission_id = $2
         ORDER BY difficulty, keyword`,
        [interaction.guildId, missionId]
      );

      // Calculer les statistiques
      const stats = {
        total: allKeywords.length,
        easy: allKeywords.filter(k => k.difficulty === 'easy').length,
        medium: allKeywords.filter(k => k.difficulty === 'medium').length,
        hard: allKeywords.filter(k => k.difficulty === 'hard').length
      };

      // Pagination: 10 mots-clés par page
      const itemsPerPage = 10;
      const totalPages = Math.ceil(allKeywords.length / itemsPerPage);
      const currentPage = Math.max(0, Math.min(page, totalPages - 1));
      const keywords = allKeywords.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

      // Créer l'embed
      const difficultyEmojis = {
        easy: '🟢',
        medium: '🟡',
        hard: '🔴'
      };

      const difficultyLabels = {
        easy: 'Facile',
        medium: 'Moyen',
        hard: 'Difficile'
      };

      const embed = new EmbedBuilder()
        .setTitle(`📝 Gestion des Mots-clés - ${mission.name}`)
        .setColor('#5865F2')
        .setDescription(
          `Gérer les mots-clés utilisés pour les missions de type "Mot Deviné".\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**📊 Statistiques:**\n` +
          `📦 **Total:** ${stats.total} mot${stats.total > 1 ? 's' : ''}-clé${stats.total > 1 ? 's' : ''}\n` +
          `🟢 **Faciles:** ${stats.easy}\n` +
          `🟡 **Moyens:** ${stats.medium}\n` +
          `🔴 **Difficiles:** ${stats.hard}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );

      if (keywords.length > 0) {
        let keywordsList = '';
        keywords.forEach((kw, index) => {
          const emoji = difficultyEmojis[kw.difficulty] || '⚪';
          const diff = difficultyLabels[kw.difficulty] || kw.difficulty;
          keywordsList += `\n${emoji} **${kw.keyword}** - *${diff}*`;
          if (kw.target_channel_id) {
            keywordsList += ` → <#${kw.target_channel_id}>`;
          }
        });

        embed.addFields({
          name: `🔤 Mots-clés (Page ${currentPage + 1}/${totalPages || 1})`,
          value: keywordsList
        });
      } else {
        embed.addFields({
          name: '🔤 Mots-clés',
          value: '*Aucun mot-clé configuré pour le moment.*'
        });
      }

      if (totalPages > 1) {
        embed.setFooter({ text: `Page ${currentPage + 1} sur ${totalPages}` });
      }

      // Créer les boutons
      const components = [];

      // Bouton "Ajouter un mot-clé"
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_keyword_add_${missionId}`)
            .setLabel('➕ Ajouter un mot-clé')
            .setStyle(ButtonStyle.Success)
        )
      );

      // Boutons de pagination si nécessaire
      if (totalPages > 1) {
        const paginationButtons = [];

        paginationButtons.push(
          new ButtonBuilder()
            .setCustomId(`mission_keywords_manage_${missionId}_${Math.max(0, currentPage - 1)}`)
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0)
        );

        paginationButtons.push(
          new ButtonBuilder()
            .setCustomId(`mission_keywords_manage_${missionId}_${Math.min(totalPages - 1, currentPage + 1)}`)
            .setLabel('Suivant ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1)
        );

        components.push(new ActionRowBuilder().addComponents(paginationButtons));
      }

      // Sélecteur pour modifier/supprimer un mot-clé (seulement si il y a des mots-clés)
      // Note: Discord limite les select menus à 25 options maximum
      if (keywords.length > 0) {
        // Limiter à 25 options (limite Discord)
        const limitedKeywords = keywords.slice(0, 25);

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`mission_keyword_select_${missionId}`)
          .setPlaceholder('Sélectionner un mot-clé à modifier/supprimer')
          .addOptions(
            limitedKeywords.map(kw => {
              // Créer le label et le tronquer si nécessaire (max 100 chars)
              let label = `${kw.keyword} (${difficultyLabels[kw.difficulty] || kw.difficulty})`;
              if (label.length > 100) {
                label = kw.keyword.substring(0, 90) + '...';
              }
              // Description aussi limitée à 100 chars
              let description = `Difficulté: ${difficultyLabels[kw.difficulty] || kw.difficulty}`;
              if (description.length > 100) {
                description = description.substring(0, 97) + '...';
              }
              return {
                label,
                value: kw.id.toString(),
                description,
                emoji: difficultyEmojis[kw.difficulty] || '⚪'
              };
            })
          );

        components.push(new ActionRowBuilder().addComponents(selectMenu));
      }

      // Bouton retour
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`select_mission_${missionId}`)
            .setLabel('↩️ Retour à la mission')
            .setStyle(ButtonStyle.Secondary)
        )
      );

      return interaction.editReply({
        embeds: [embed],
        components
      });

    } catch (error) {
      console.error('❌ Erreur handleMissionKeywordsManage:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour la sélection d'un mot-clé (modifier/supprimer)
   * Note: deferUpdate() est déjà fait dans handleSelectMenu()
   */
  async handleMissionKeywordSelection(interaction) {
    try {
      const customId = interaction.customId;
      const missionId = parseInt(customId.replace('mission_keyword_select_', ''));
      const keywordId = parseInt(interaction.values[0]);
      const guildId = interaction.guildId;

      // Récupérer le mot-clé sélectionné
      const keyword = await db.queryOne(
        'SELECT * FROM mission_keywords WHERE id = $1 AND mission_id = $2',
        [keywordId, missionId]
      );

      if (!keyword) {
        return interaction.editReply({
          content: '❌ Mot-clé introuvable.',
          components: []
        });
      }

      const difficultyLabels = {
        easy: 'Facile',
        medium: 'Moyen',
        hard: 'Difficile'
      };

      const difficultyEmojis = {
        easy: '🟢',
        medium: '🟡',
        hard: '🔴'
      };

      // Afficher les options pour ce mot-clé
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🔤 Modifier le mot-clé')
        .setDescription(`**Mot-clé sélectionné:** \`${keyword.keyword}\``)
        .addFields(
          { name: '📊 Difficulté', value: `${difficultyEmojis[keyword.difficulty] || '⚪'} ${difficultyLabels[keyword.difficulty] || keyword.difficulty}`, inline: true },
          { name: '🆔 ID', value: `\`${keyword.id}\``, inline: true }
        )
        .setFooter({ text: 'Choisissez une action ci-dessous' });

      const components = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_keyword_edit_${missionId}_${keywordId}`)
            .setLabel('✏️ Modifier')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`mission_keyword_delete_${missionId}_${keywordId}`)
            .setLabel('🗑️ Supprimer')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`mission_keywords_manage_${missionId}`)
            .setLabel('↩️ Retour')
            .setStyle(ButtonStyle.Secondary)
        )
      ];

      return interaction.editReply({
        embeds: [embed],
        components
      });

    } catch (error) {
      console.error('❌ Erreur handleMissionKeywordSelection:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        components: []
      });
    }
  }

  /**
   * Handler pour ajouter un mot-clé à une mission
   */
  async handleMissionKeywordAdd(interaction) {
    try {
      const missionId = parseInt(interaction.customId.replace('mission_keyword_add_', ''));

      // Créer et afficher le modal d'ajout
      const modal = new ModalBuilder()
        .setCustomId(`modal_add_keyword_${missionId}`)
        .setTitle('Ajouter un mot-clé');

      const keywordInput = new TextInputBuilder()
        .setCustomId('keyword_value')
        .setLabel('Mot-clé')
        .setPlaceholder('Entrez le mot-clé...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const difficultyInput = new TextInputBuilder()
        .setCustomId('keyword_difficulty')
        .setLabel('Difficulté (easy, medium, hard)')
        .setPlaceholder('easy')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);

      modal.addComponents(
        new ActionRowBuilder().addComponents(keywordInput),
        new ActionRowBuilder().addComponents(difficultyInput)
      );

      return interaction.showModal(modal);
    } catch (error) {
      console.error('❌ Erreur handleMissionKeywordAdd:', error);
      return interaction.reply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour modifier un mot-clé
   */
  async handleMissionKeywordEdit(interaction) {
    try {
      const parts = interaction.customId.replace('mission_keyword_edit_', '').split('_');
      const missionId = parseInt(parts[0]);
      const keywordId = parseInt(parts[1]);

      // Récupérer le mot-clé actuel
      const keyword = await db.queryOne(
        'SELECT * FROM mission_keywords WHERE id = $1',
        [keywordId]
      );

      if (!keyword) {
        await interaction.deferUpdate();
        return interaction.editReply({
          content: '❌ Mot-clé introuvable.',
          components: []
        });
      }

      // Créer et afficher le modal d'édition
      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_keyword_${missionId}_${keywordId}`)
        .setTitle('Modifier le mot-clé');

      const keywordInput = new TextInputBuilder()
        .setCustomId('keyword_value')
        .setLabel('Mot-clé')
        .setValue(keyword.keyword)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const difficultyInput = new TextInputBuilder()
        .setCustomId('keyword_difficulty')
        .setLabel('Difficulté (easy, medium, hard)')
        .setValue(keyword.difficulty || 'easy')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);

      modal.addComponents(
        new ActionRowBuilder().addComponents(keywordInput),
        new ActionRowBuilder().addComponents(difficultyInput)
      );

      return interaction.showModal(modal);
    } catch (error) {
      console.error('❌ Erreur handleMissionKeywordEdit:', error);
      return interaction.reply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour supprimer un mot-clé
   */
  async handleMissionKeywordDelete(interaction) {
    await interaction.deferUpdate();

    try {
      const parts = interaction.customId.replace('mission_keyword_delete_', '').split('_');
      const missionId = parseInt(parts[0]);
      const keywordId = parseInt(parts[1]);

      // Supprimer le mot-clé
      await db.query(
        'DELETE FROM mission_keywords WHERE id = $1',
        [keywordId]
      );

      await interaction.followUp({
        content: '✅ Mot-clé supprimé avec succès !',
        flags: 64
      });

      // Retourner à la liste des mots-clés
      interaction.customId = `mission_keywords_manage_${missionId}`;
      return this.handleMissionKeywordsManage(interaction);

    } catch (error) {
      console.error('❌ Erreur handleMissionKeywordDelete:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        components: []
      });
    }
  }

  /**
   * Handler pour supprimer une mission
   */
  async handleDeleteMission(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());

    try {
      const guildId = interaction.guildId;
      const mission = await db.getMissionById(guildId, missionId);

      if (!mission) {
        return interaction.followUp({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      await db.deleteMission(guildId, missionId);

      await interaction.followUp({
        content: `✅ **${mission.name}** a été supprimée avec succès !`,
        flags: 64
      });

      // Retour au menu missions
      return this.showMissionsMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la mission:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  // ============================================
  // GESTION DES PIÈGES
  // ============================================

  /**
   * Afficher le sélecteur de type de piège
   */
  async showTrapTypeSelector(interaction) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_trap_type')
      .setPlaceholder('Choisis le type de piège')
      .addOptions([
        {
          label: '⏱️ Cooldown',
          value: 'cooldown',
          description: 'Empêche le joueur de cliquer pendant X minutes'
        },
        {
          label: '💀 Perte collectible',
          value: 'lose-collectible',
          description: 'Le joueur perd un collectible aléatoire'
        },
        {
          label: '😱 Shame public',
          value: 'public-shame',
          description: 'Message de honte envoyé dans un canal'
        }
      ]);

    return interaction.update({
      content: '**Sélectionne le type de piège à créer:**',
      embeds: [],
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_traps')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  /**
   * Handler pour la sélection du type de piège
   */
  async handleTrapTypeSelection(interaction) {
    const trapType = interaction.values[0];

    // Afficher le modal correspondant
    await this.showTrapAddModal(interaction, trapType);
  }

  /**
   * Afficher le modal d'ajout de piège
   */
  async showTrapAddModal(interaction, trapType) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_trap_add_${trapType}`)
      .setTitle(`Ajouter un piège ${trapType}`);

    const row1 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('trap_id')
        .setLabel('ID du piège (unique)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: trap-cooldown-5min')
        .setRequired(true)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('trap_name')
        .setLabel('Nom du piège')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Cooldown 5 minutes')
        .setRequired(true)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('trap_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Description du piège...')
        .setRequired(true)
    );

    // Champs spécifiques selon le type
    if (trapType === 'cooldown') {
      const row4 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('trap_cooldown_duration')
          .setLabel('Durée du cooldown (en minutes)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 5')
          .setValue('5')
          .setRequired(true)
      );

      modal.addComponents(row1, row2, row3, row4);
    } else if (trapType === 'public-shame') {
      const row4 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('trap_shame_message')
          .setLabel('Message de honte')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('ex: {user} est tombé dans le piège !')
          .setRequired(true)
      );

      modal.addComponents(row1, row2, row3, row4);
    } else if (trapType === 'lose-collectible') {
      // Ce piège n'a pas de paramètre spécifique
      modal.addComponents(row1, row2, row3);
    }

    return interaction.showModal(modal);
  }

  /**
   * Handler pour la sélection d'un piège (modifier/supprimer)
   */
  async handleTrapSelection(interaction) {
    // Utiliser deferUpdate pour mettre à jour le message du panel admin
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.values[0]);
    const trap = await db.getTrapById(interaction.guildId, trapId);

    if (!trap) {
      return interaction.followUp({
        content: '❌ Piège introuvable.',
        flags: 64
      });
    }

    const trapTypes = {
      'cooldown': '⏱️ Cooldown',
      'lose-collectible': '💀 Perte collectible',
      'public-shame': '😱 Shame public'
    };

    const embed = new EmbedBuilder()
      .setTitle(`${trapTypes[trap.type] || trap.type} - ${trap.name}`)
      .setDescription(trap.description)
      .setColor('#e74c3c')
      .addFields(
        { name: 'ID', value: `\`${trap.trap_id}\``, inline: true },
        { name: 'Type', value: trap.type, inline: true }
      );

    // Afficher les paramètres spécifiques
    if (trap.cooldown_duration) {
      embed.addFields({ name: 'Durée cooldown', value: `${trap.cooldown_duration} minutes` });
    }
    if (trap.shame_message) {
      embed.addFields({ name: 'Message de honte', value: trap.shame_message });
    }

    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trap_delete_confirm_${trapId}`)
          .setLabel('🗑️ Supprimer')
          .setStyle(ButtonStyle.Danger)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_traps')
          .setLabel('🔙 Retour aux pièges')
          .setStyle(ButtonStyle.Secondary)
      )
    ];

    return interaction.editReply({
      embeds: [embed],
      components
    });
  }

  /**
   * Handler pour supprimer un piège
   */
  async handleDeleteTrap(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.split('_').pop());

    try {
      const trap = await db.getTrapById(interaction.guildId, trapId);

      if (!trap) {
        return interaction.followUp({
          content: '❌ Piège introuvable.',
          flags: 64
        });
      }

      await db.deleteTrap(trapId);

      await interaction.followUp({
        content: `✅ **${trap.name}** a été supprimé avec succès !`,
        flags: 64
      });

      // Retour au menu pièges
      return this.showTrapsMenu(interaction);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression du piège:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }
}

// Exporter le handler ET la fonction partagée
const adminPanelHandler = new AdminPanelHandler();
module.exports = adminPanelHandler;
module.exports.buildAdminPanelContent = buildAdminPanelContent;
