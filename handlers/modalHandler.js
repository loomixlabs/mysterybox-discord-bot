const db = require('../utils/database-pg');
const adminPanelHandler = require('./adminPanelHandler');
const campaignAdminHandler = require('./campaignAdminHandler');
const giveUniqueHandler = require('./giveUniqueHandler');
const trapAdminHandler = require('./trapAdminHandler');
const probabilityHandler = require('./probabilityHandler');
const audit = require('../utils/auditLogger');
const { EmbedBuilder } = require('discord.js');
const { canAccessAdminPanel } = require('../utils/permissions');
const { getLoomixFooter, getLoomixFooterWithCustomText } = require('../utils/footerHelper');

/**
 * Handler pour les soumissions de modals
 */
class ModalHandler {

  /**
   * Gérer les soumissions de modals
   */
  async handleModalSubmit(interaction) {
    const customId = interaction.customId;

    // Vérifier les permissions (système à 3 niveaux)
    if (!(await canAccessAdminPanel(interaction))) {
      return interaction.reply({
        content: '❌ Accès refusé. Seuls les administrateurs peuvent utiliser ce panneau.',
        flags: 64
      });
    }

    // Router selon le customId (chaque méthode gèrera son propre deferReply)

    // Gestion des probabilités (délégation vers probabilityHandler)
    if (customId.startsWith('probability_modal_')) {
      return probabilityHandler.handleInteraction(interaction);
    }
    // Modals de configuration du thème
    if (customId === 'modal_image') {
      await this.handleImage(interaction);
    } else if (customId === 'modal_title') {
      await this.handleTitle(interaction);
    } else if (customId === 'modal_duration') {
      await this.handleDuration(interaction);
    } else if (customId === 'modal_winner_message') {
      await this.handleWinnerMessage(interaction);
    } else if (customId.startsWith('modal_add_collectible_')) {
      // Déférer immédiatement pour éviter l'expiration (pas de flags pour éviter que ça aille dans le thread)
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
      await this.handleAddCollectible(interaction);
    } else if (customId === 'modal_create_theme') {
      await this.handleCreateTheme(interaction);
    } else if (customId === 'modal_extend_theme') {
      await this.handleExtendTheme(interaction);
    }
    // Gestion des campagnes (délégation)
    else if (customId.startsWith('campaign_modal_')) {
      return campaignAdminHandler.handleModalSubmit(interaction);
    }
    // Gestion des canaux
    else if (customId === 'modal_add_category') {
      await this.handleAddCategory(interaction);
    } else if (customId === 'modal_add_channel') {
      await this.handleAddChannel(interaction);
    }
    // Gestion des templates d'annonces
    else if (customId.startsWith('modal_template_text_')) {
      await this.handleTemplateText(interaction);
    } else if (customId.startsWith('modal_template_color_')) {
      await this.handleTemplateColor(interaction);
    } else if (customId.startsWith('modal_image_url_')) {
      await this.handleImageUrl(interaction);
    }
    // Gestion du canal d'annonces manuel
    else if (customId === 'modal_manual_announcement_channel') {
      await this.handleManualAnnouncementChannel(interaction);
    }
    // Gestion des modals Give Unique (délégation vers giveUniqueHandler)
    else if (customId.startsWith('give_unique_announcement_modal:') || customId.startsWith('give_unique_schedule_modal:')) {
      return giveUniqueHandler.handleModalSubmit(interaction);
    }
    // Gestion des modals missions
    else if (customId.startsWith('modal_mission_add_')) {
      await this.handleAddMission(interaction);
    }
    // Gestion des modals pièges (délégation vers trapAdminHandler)
    else if (customId.startsWith('modal_trap_')) {
      return trapAdminHandler.handleInteraction(interaction);
    }
    // Gestion des modals de mots-clés
    else if (customId.startsWith('modal_keyword_add_')) {
      await this.handleAddKeyword(interaction);
    }
    // Gestion des modals de quiz
    else if (customId.startsWith('modal_quiz_add_')) {
      await this.handleAddQuizQuestion(interaction);
    }
    // Gestion du timeout de mission
    else if (customId.startsWith('modal_mission_timeout_')) {
      await this.handleMissionTimeout(interaction);
    }
    // Gestion des modals super-admin (délégation)
    else if (customId.startsWith('superadmin_add_role_modal_')) {
      const superAdminHandler = require('./superAdminHandler');
      const guildId = customId.replace('superadmin_add_role_modal_', '');
      return superAdminHandler.handleAddAdminRole(interaction, guildId);
    }
    // Gestion des modals trial super-admin
    else if (customId.startsWith('superadmin_start_trial_modal_')) {
      const superAdminHandler = require('./superAdminHandler');
      const guildId = customId.replace('superadmin_start_trial_modal_', '');
      return superAdminHandler.handleStartTrial(interaction, guildId);
    }
    else if (customId.startsWith('superadmin_extend_trial_modal_')) {
      const superAdminHandler = require('./superAdminHandler');
      const guildId = customId.replace('superadmin_extend_trial_modal_', '');
      return superAdminHandler.handleExtendTrial(interaction, guildId);
    }
    // Gestion des modals server-config (délégation)
    else if (customId.startsWith('modal_edit_')) {
      const ServerConfigHandler = require('./serverConfigHandler');
      const handler = new ServerConfigHandler();
      return handler.handleModalSubmit(interaction);
    }
  }

  /**
   * Traiter l'image de la boîte mystère
   */
  async handleImage(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const imageUrl = interaction.fields.getTextInputValue('mystery_box_image');

      // Validation basique de l'URL
      if (imageUrl && !imageUrl.startsWith('http')) {
        return interaction.editReply({
          content: '❌ L\'URL doit commencer par http:// ou https://',
          flags: 64
        });
      }

      const theme = await db.getActiveTheme(interaction.guildId);

      // Récupérer l'ancienne valeur
      const oldConfig = await db.queryOne(
        `SELECT mystery_box_image FROM theme_config WHERE guild_id = $1 AND theme_id = $2`,
        [interaction.guildId, theme.id]
      );

      await db.query(
        `UPDATE theme_config
         SET mystery_box_image = $1
         WHERE guild_id = $2 AND theme_id = $3`,
        [imageUrl || null, interaction.guildId, theme.id]
      );

      // Logger l'action
      await audit.logMysteryBoxImageUpdated(
        interaction.guildId,
        interaction.user.id,
        imageUrl || null,
        oldConfig?.mystery_box_image || null
      );

      return interaction.editReply({
        content: `✅ **Image de la boîte mystère mise à jour !**\n\n${imageUrl ? `URL: ${imageUrl}` : 'Image supprimée.'}`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de l\'image:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Traiter le titre et la description
   */
  async handleTitle(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const title = interaction.fields.getTextInputValue('mystery_box_title');
      const description = interaction.fields.getTextInputValue('mystery_box_description');

      const theme = await db.getActiveTheme(interaction.guildId);

      // Récupérer les anciennes valeurs
      const oldConfig = await db.queryOne(
        `SELECT mystery_box_title, mystery_box_description FROM theme_config WHERE guild_id = $1 AND theme_id = $2`,
        [interaction.guildId, theme.id]
      );

      await db.query(
        `UPDATE theme_config
         SET mystery_box_title = $1,
             mystery_box_description = $2
         WHERE guild_id = $3 AND theme_id = $4`,
        [title, description, interaction.guildId, theme.id]
      );

      // Logger l'action (titre uniquement, la description est incluse dans les détails)
      await audit.logMysteryBoxTitleUpdated(
        interaction.guildId,
        interaction.user.id,
        title,
        oldConfig?.mystery_box_title || null
      );

      return interaction.editReply({
        content: `✅ **Titre et description mis à jour !**\n\n` +
          `**Titre:** ${title}\n` +
          `**Description:** ${description}`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du titre:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Modifier la durée restante du thème
   */
  async handleDuration(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const newRemainingDays = parseInt(interaction.fields.getTextInputValue('new_duration'));

      // Validation
      if (isNaN(newRemainingDays) || newRemainingDays < 0) {
        return interaction.editReply({
          content: '❌ La durée restante doit être un nombre positif (0 pour illimitée).',
          flags: 64
        });
      }

      if (newRemainingDays > 9999) {
        return interaction.editReply({
          content: '❌ La durée maximale est de 9999 jours.',
          flags: 64
        });
      }

      const theme = await db.getActiveTheme(interaction.guildId);
      const themeExpirationHandler = require('./themeExpirationHandler');
      const expirationInfo = themeExpirationHandler.calculateExpiration(theme);

      let newTotalDuration;

      // Si durée illimitée demandée
      if (newRemainingDays === 0) {
        newTotalDuration = 0;
      }
      // Si le thème n'est pas encore activé
      else if (expirationInfo.notActivated) {
        newTotalDuration = newRemainingDays;
      }
      // Si le thème est activé : calculer la nouvelle durée totale
      else {
        const now = new Date();
        const activatedAt = new Date(theme.activated_at);
        const daysElapsed = Math.floor((now - activatedAt) / (24 * 60 * 60 * 1000));

        // Nouvelle durée totale = jours écoulés + jours restants souhaités
        newTotalDuration = daysElapsed + newRemainingDays;

        // Sécurité : s'assurer que la durée totale est positive
        if (newTotalDuration < 0) {
          newTotalDuration = newRemainingDays;
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
      await audit.logDurationUpdated(
        interaction.guildId,
        interaction.user.id,
        newTotalDuration,
        theme.duration_days
      );

      // Recalculer les informations d'expiration
      const updatedTheme = await db.getActiveTheme(interaction.guildId);
      const updatedExpirationInfo = themeExpirationHandler.calculateExpiration(updatedTheme);

      let statusText = '';
      let expirationDate = '';

      if (newRemainingDays === 0) {
        statusText = '♾️ **Durée illimitée**';
      } else if (updatedExpirationInfo.notActivated) {
        statusText = `⏸️ Thème non activé (${newRemainingDays} jours configurés)`;
      } else {
        statusText = `⏱️ **${updatedExpirationInfo.daysRemaining} jours restants** (${updatedExpirationInfo.percentageRemaining}%)`;
        if (updatedExpirationInfo.expirationDate) {
          const timestamp = Math.floor(updatedExpirationInfo.expirationDate.getTime() / 1000);
          expirationDate = `\n**Date d'expiration:** <t:${timestamp}:D> à <t:${timestamp}:t>`;
        }
      }

      return interaction.editReply({
        content: `✅ **Durée restante mise à jour avec succès !**\n\n` +
          `**Durée restante:** ${newRemainingDays === 0 ? 'Illimitée' : `${newRemainingDays} jours`}\n` +
          `**Statut:** ${statusText}${expirationDate}\n\n` +
          `💡 **Note:** Le thème expirera dans ${newRemainingDays} jours à partir de maintenant.`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la durée:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer la modification du message de félicitations d'ouverture de mysterybox
   */
  async handleWinnerMessage(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const winnerMessage = interaction.fields.getTextInputValue('mystery_box_winner_message');
      const celebrationGif = interaction.fields.getTextInputValue('mystery_box_celebration_gif');
      const celebrationEmojis = interaction.fields.getTextInputValue('mystery_box_celebration_emojis');

      // Validation
      if (!winnerMessage || winnerMessage.trim().length === 0) {
        return interaction.editReply({
          content: '❌ Le message de félicitations ne peut pas être vide.',
          flags: 64
        });
      }

      const theme = await db.getActiveTheme(interaction.guildId);
      const config = await db.getThemeConfig(interaction.guildId, theme.id);

      // Mettre à jour la config de célébration dans la base de données
      await db.query(
        `UPDATE theme_config
         SET mystery_box_winner_message = $1,
             mystery_box_celebration_gif = $2,
             mystery_box_celebration_emojis = $3
         WHERE guild_id = $4 AND theme_id = $5`,
        [
          winnerMessage,
          celebrationGif || 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
          celebrationEmojis || '🎉,🎊,✨,🌟',
          interaction.guildId,
          theme.id
        ]
      );

      // Logger l'action
      await audit.logWinnerMessageUpdated(
        interaction.guildId,
        interaction.user.id,
        winnerMessage,
        config?.mystery_box_winner_message || null
      );

      // Préparer l'aperçu des emojis
      const emojisPreview = (celebrationEmojis || '🎉,🎊,✨,🌟')
        .split(',')
        .map(e => e.trim())
        .join(' ');

      return interaction.editReply({
        content: `✅ **Célébration d'ouverture mise à jour avec succès !**\n\n` +
          `**Message:** ${winnerMessage}\n\n` +
          `**GIF:** ${celebrationGif || 'Par défaut (confettis)'}\n\n` +
          `**Réactions:** ${emojisPreview}\n\n` +
          `💡 **Astuce:** Cherchez des GIFs sur [Giphy](https://giphy.com) ou [Tenor](https://tenor.com), clic droit → "Copier l'adresse du lien"`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la célébration:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Ajouter un collectible
   */
  async handleAddCollectible(interaction) {
    // Le deferReply est déjà fait dans handleModalSubmit
    try {
      // Récupérer le branding dès le début
      const branding = await db.getGuildBranding(interaction.guildId);

      // Récupérer la rareté et le themeId depuis le customId
      // Format: modal_add_collectible_{rarity} ou modal_add_collectible_{rarity}_{themeId}
      const parts = interaction.customId.split('_');
      const rarity = parts[3]; // modal_add_collectible_{rarity}
      const themeId = parts[4] ? parseInt(parts[4]) : null; // modal_add_collectible_{rarity}_{themeId}

      // Récupérer les champs du modal
      const name = interaction.fields.getTextInputValue('collectible_name');
      const collectibleId = interaction.fields.getTextInputValue('collectible_id');
      const revealMessage = interaction.fields.getTextInputValue('collectible_message');

      // Récupérer l'image depuis le cache
      const cachedImage = adminPanelHandler.imageUploadCache.get(interaction.user.id);
      if (!cachedImage || !cachedImage.url) {
        return interaction.editReply({
          content: '❌ Aucune image trouvée dans le cache. Veuillez réessayer en uploadant une image d\'abord.',
          flags: 64
        });
      }

      const imageUrl = cachedImage.url;

      // Validation de la rareté (par sécurité)
      const validRarities = ['common', 'rare', 'epic', 'legendary'];
      if (!validRarities.includes(rarity.toLowerCase())) {
        return interaction.editReply({
          content: `❌ Rareté invalide. Utilise: ${validRarities.join(', ')}`,
          flags: 64
        });
      }

      // Récupérer le thème : soit l'ID spécifique, soit le thème actif
      const theme = themeId ? await db.getThemeById(interaction.guildId, themeId) : await db.getActiveTheme(interaction.guildId);

      // Vérifier si l'ID existe déjà
      const existing = await db.queryOne(
        'SELECT * FROM collectibles WHERE guild_id = $1 AND theme_id = $2 AND collectible_id = $3',
        [interaction.guildId, theme.id, collectibleId]
      );

      if (existing) {
        return interaction.editReply({
          content: `❌ Un collectible avec l'ID **${collectibleId}** existe déjà.`,
          flags: 64
        });
      }

      // Insérer le collectible avec guild_id
      await db.query(
        `INSERT INTO collectibles (guild_id, theme_id, collectible_id, name, rarity, image_url, reveal_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [interaction.guildId, theme.id, collectibleId, name, rarity.toLowerCase(), imageUrl, revealMessage || null]
      );

      // Logger l'action (try-catch pour ne pas bloquer si erreur de logging)
      try {
        await audit.logCollectibleAdded(
          interaction.guildId,
          interaction.user.id,
          {
            collectible_id: collectibleId,
            name: name,
            rarity: rarity.toLowerCase(),
            theme_id: theme.id
          }
        );
      } catch (logError) {
        console.error('⚠️ Erreur de logging (non-bloquante):', logError.message);
      }

      // Mettre à jour automatiquement required_items dans le thème
      const collectiblesCount = await db.queryOne(
        'SELECT COUNT(*) as count FROM collectibles WHERE guild_id = $1 AND theme_id = $2',
        [interaction.guildId, theme.id]
      );

      await db.query(
        'UPDATE themes SET required_items = $1 WHERE id = $2',
        [collectiblesCount.count, theme.id]
      );

      console.log(`✅ Thème mis à jour: ${collectiblesCount.count} collectibles requis`);

      // Récupérer l'ID du thread depuis le cache
      const cachedData = adminPanelHandler.imageUploadCache.get(interaction.user.id);
      const threadId = cachedData?.threadId;
      const cachedThemeId = cachedData?.themeId;

      console.log('🔍 DEBUG cachedData:', {
        hasData: !!cachedData,
        hasAdminPanelMessage: !!cachedData?.adminPanelMessage,
        hasAdminPanelChannelId: !!cachedData?.adminPanelChannelId,
        channelId: cachedData?.adminPanelChannelId,
        keys: cachedData ? Object.keys(cachedData) : []
      });

      // Supprimer l'image du cache après création réussie
      adminPanelHandler.imageUploadCache.delete(interaction.user.id);

      console.log(`✅ Collectible créé avec succès - Thread ID: ${threadId}`);

      // Rafraîchir complètement l'interface des collectibles dans le panneau admin
      if (cachedData?.adminPanelMessage && cachedData?.adminPanelChannelId) {
        console.log('🔄 Tentative de rafraîchissement de l\'interface admin...');
        try {
          // Récupérer le message frais depuis le canal avec son ID
          // Cette méthode évite les problèmes de cache obsolète
          const channel = await interaction.client.channels.fetch(cachedData.adminPanelChannelId);
          const message = await channel.messages.fetch(cachedData.adminPanelMessage.id).catch(err => {
            console.warn('⚠️ Impossible de récupérer le message:', err.message);
            return null;
          });

          if (!message) {
            console.warn('⚠️ Message du panneau admin introuvable ou supprimé');
            // Ne pas faire return ici - on doit quand même répondre à l'interaction du modal
          } else {

          // Récupérer les collectibles et le thème mis à jour
          const updatedCollectibles = await db.getCollectiblesByTheme(interaction.guildId, theme.id);

          // Construire l'embed mis à jour
          const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');

          const embed = new EmbedBuilder()
            .setTitle('🎁 Gestion des Collectibles')
            .setDescription(`**Thème:** ${theme.name}\n**Total:** ${updatedCollectibles.length}/${collectiblesCount.count}`)
            .setColor(branding.secondary_color)
            .setFooter(await getLoomixFooter(interaction.guildId));

          if (updatedCollectibles.length > 0) {
            const list = updatedCollectibles.map(c => `• **${c.name}** (${c.rarity})`).join('\n');
            embed.addFields({
              name: 'Liste des collectibles',
              value: list.length > 1024 ? list.substring(0, 1021) + '...' : list
            });
          } else {
            embed.addFields({
              name: 'Liste des collectibles',
              value: 'Aucun collectible créé.'
            });
          }

          const components = [];

          // Select menu si des collectibles existent
          if (updatedCollectibles.length > 0) {
            const selectRow = new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('select_collectible')
                .setPlaceholder('🗑️ Choisir un collectible à supprimer')
                .addOptions(
                  updatedCollectibles.map(c => ({
                    label: c.name,
                    value: c.id.toString(),
                    description: `${c.rarity} - ID: ${c.collectible_id}`,
                    emoji: c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪'
                  }))
                )
            );
            components.push(selectRow);
          }

          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('collectible_add')
              .setLabel('➕ Ajouter un collectible')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('admin_settings')
              .setLabel('🔙 Retour')
              .setStyle(ButtonStyle.Secondary)
          );
          components.push(buttonRow);

          // Éditer le message frais
          await message.edit({
            embeds: [embed],
            components: components
          });

          console.log(`✅ Interface des collectibles rafraîchie avec le nouveau collectible`);
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors du rafraîchissement de l\'interface:', error);
        }
      } else {
        console.log('⏭️ Rafraîchissement ignoré - message admin panel non disponible dans le cache');
      }

      // Créer un embed avec les détails du collectible
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      const rarityEmojis = {
        common: '⚪',
        rare: '🔷',
        epic: '💎',
        legendary: '⭐'
      };

      const rarityColors = {
        common: '#95a5a6',
        rare: '#3498db',
        epic: '#9b59b6',
        legendary: '#f1c40f'
      };

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Collectible créé avec succès !')
        .setDescription(`${rarityEmojis[rarity]} **${name}**`)
        .addFields(
          { name: '🎨 Thème', value: theme.name, inline: true },
          { name: '💎 Rareté', value: rarity.charAt(0).toUpperCase() + rarity.slice(1), inline: true },
          { name: '🆔 ID', value: collectibleId, inline: true }
        )
        .setColor(rarityColors[rarity])
        .setFooter(await getLoomixFooter(interaction.guildId))
        .setTimestamp();

      if (imageUrl) {
        successEmbed.setImage(imageUrl);
      }

      let components = [];

      // Bouton pour retourner au panneau admin
      if (cachedData?.adminPanelMessage && cachedData?.adminPanelChannelId) {
        const messageLink = `https://discord.com/channels/${interaction.guildId}/${cachedData.adminPanelChannelId}/${cachedData.adminPanelMessage.id}`;

        const returnButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('📋 Retourner aux paramétrages des collectibles')
            .setStyle(ButtonStyle.Link)
            .setURL(messageLink)
        );

        components = [returnButton];
      }

      // Archiver le thread après création du collectible
      if (interaction.channel.isThread()) {
        await interaction.channel.setArchived(true).catch(err => {
          console.warn('⚠️ Impossible d\'archiver le thread:', err.message);
        });
        console.log(`📁 Thread ${interaction.channel.id} archivé automatiquement`);
      }

      return interaction.editReply({
        content: null,
        embeds: [successEmbed],
        components: components
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du collectible:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Créer un nouveau thème avec rôle Discord
   */
  async handleCreateTheme(interaction) {
    try {
      // Extraire les valeurs du modal
      const themeId = interaction.fields.getTextInputValue('theme_id').trim().toLowerCase();
      const themeName = interaction.fields.getTextInputValue('theme_name').trim();
      const durationInput = interaction.fields.getTextInputValue('theme_duration').trim();
      const roleName = interaction.fields.getTextInputValue('theme_role').trim();

      // Durée optionnelle (0 = illimité)
      const durationDays = durationInput ? parseInt(durationInput) : 0;

      // Validation
      if (!themeId || !themeName || !roleName) {
        return interaction.reply({
          content: '❌ Les champs ID, nom et rôle sont requis.',
          flags: 64
        });
      }

      if (durationInput && (isNaN(durationDays) || durationDays < 0 || durationDays > 365)) {
        return interaction.reply({
          content: '❌ La durée doit être un nombre entre 0 et 365 jours (0 = illimité).',
          flags: 64
        });
      }

      // Vérifier si le theme_id existe déjà
      const allThemes = await db.getAllThemes(interaction.guildId);
      if (allThemes.some(t => t.theme_id === themeId)) {
        return interaction.reply({
          content: `❌ Un thème avec l'ID \`${themeId}\` existe déjà.`,
          flags: 64
        });
      }

      // Validations OK, maintenant on peut defer l'update
      await interaction.deferUpdate();

      // Créer le rôle Discord
      console.log(`🎨 Création du rôle Discord: ${roleName}`);
      const role = await interaction.guild.roles.create({
        name: roleName,
        color: '#FFD700', // Or par défaut
        reason: `Création du thème ${themeName}`
      });

      console.log(`✅ Rôle créé: ${role.name} (${role.id})`);

      // Créer le thème dans la DB (required_items = 0 par défaut, sera calculé automatiquement)
      const themeData = {
        guild_id: interaction.guildId,
        themeId: themeId,
        name: themeName,
        duration_days: durationDays,
        required_items: 0, // Calculé automatiquement en fonction des collectibles ajoutés
        final_role_name: roleName,
        final_role_color: '#FFD700',
        final_role_discord_id: role.id  // ✅ FIX: Utiliser le bon nom de colonne
      };

      const newTheme = await db.createTheme(interaction.guildId, themeData);

      console.log(`✅ Thème créé dans la DB: ${newTheme.name} (ID: ${newTheme.id})`);

      // NOTE: Les pièges par défaut sont maintenant créés automatiquement
      // dans db.createTheme() (après le COMMIT de la transaction principale)

      // Logger l'action
      await audit.logThemeCreated(
        interaction.guildId,
        interaction.user.id,
        {
          id: newTheme.id,
          theme_id: themeId,
          name: themeName,
          duration_days: durationDays,
          required_items: 0
        }
      );

      // Boutons pour gérer le thème et ajouter des collectibles
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`collectible_add_${newTheme.id}`)
          .setLabel('➕ Ajouter un Collectible')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('admin_themes')
          .setLabel('🔙 Retour aux thèmes')
          .setStyle(ButtonStyle.Secondary)
      );

      // Mettre à jour directement le message original avec le message de succès
      return interaction.editReply({
        content:
          `✅ **Thème créé avec succès !**\n\n` +
          `🎨 **Nom:** ${themeName}\n` +
          `🆔 **ID:** \`${themeId}\`\n` +
          `⏱️ **Durée:** ${durationDays === 0 ? 'Illimitée' : `${durationDays} jours`}\n` +
          `🎭 **Rôle créé:** ${role} (ID: \`${role.id}\`)\n\n` +
          `💡 **Configuration par défaut:**\n` +
          `- Probabilités: 50% collectibles, 25% missions, 15% pièges, 10% super bonus\n` +
          `- Items requis: Sera calculé automatiquement selon les collectibles ajoutés\n\n` +
          `⚠️ **Important:** Ajoute au moins un collectible pour que les joueurs puissent participer !\n\n` +
          `🏅 **Optionnel:** Tu peux configurer des **rôles de progression** intermédiaires (25%, 50%, 75%) via 🎨 Gérer les Thèmes → 🏅 Rôles de Progression.`,
        components: [row],
        embeds: []
      });

    } catch (error) {
      console.error('❌ Erreur lors de la création du thème:', error);

      // Message d'erreur personnalisé selon le type d'erreur
      let errorMessage = `❌ Une erreur est survenue: ${error.message}`;

      if (error.code === 50013) {
        // Missing Permissions
        errorMessage =
          `❌ **Permissions insuffisantes**\n\n` +
          `Le bot n'a pas les permissions nécessaires pour créer le rôle.\n\n` +
          `**Solutions:**\n` +
          `1. Va dans **Paramètres du serveur** → **Rôles**\n` +
          `2. Active la permission **"Gérer les rôles"** pour le bot\n` +
          `3. Monte le rôle du bot **au-dessus** de l'endroit où tu veux créer le rôle final\n\n` +
          `💡 Une fois fait, réessaye de créer le thème.`;
      }

      // Si l'interaction a été deferred, utiliser editReply, sinon reply
      if (interaction.deferred) {
        return interaction.editReply({
          content: errorMessage,
          components: []
        });
      } else {
        return interaction.reply({
          content: errorMessage,
          flags: 64
        });
      }
    }
  }

  /**
   * Handler pour prolonger un thème actif
   */
  async handleExtendTheme(interaction) {
    try {
      // Extraire la valeur du modal
      const additionalDaysInput = interaction.fields.getTextInputValue('additional_days').trim();

      // Validation
      const additionalDays = parseInt(additionalDaysInput);

      if (isNaN(additionalDays) || additionalDays <= 0 || additionalDays > 365) {
        return interaction.reply({
          content: '❌ Le nombre de jours doit être un nombre entre 1 et 365.',
          flags: 64
        });
      }

      // Validation OK, defer l'update
      await interaction.deferUpdate();

      // Prolonger le thème
      const updatedTheme = await db.extendTheme(interaction.guildId, additionalDays);

      console.log(`✅ Thème prolongé: ${updatedTheme.name} (+${additionalDays} jours)`);

      // Logger l'action
      await audit.logThemeUpdated(
        interaction.guildId,
        interaction.user.id,
        {
          id: updatedTheme.id,
          name: updatedTheme.name,
          changes: { duration_days: `+${additionalDays} jours` }
        }
      );

      // Refresh le menu des thèmes
      const adminPanelHandler = require('./adminPanelHandler');
      await adminPanelHandler.showThemesMenu(interaction);

    } catch (error) {
      console.error('🔴 Erreur handleExtendTheme:', error);

      const errorMsg = {
        content: `❌ Erreur: ${error.message}`,
        flags: 64
      };

      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    }
  }

  /**
   * Handler pour ajouter une catégorie
   */
  async handleAddCategory(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const categoryId = interaction.fields.getTextInputValue('category_id').trim();

      // Vérifier que l'ID n'existe pas déjà
      const exists = await db.giveChannelExists(categoryId);
      if (exists) {
        return interaction.editReply({
          content: `❌ Cette catégorie est déjà configurée.`,
          flags: 64
        });
      }

      // Récupérer la catégorie depuis Discord
      const category = await interaction.guild.channels.fetch(categoryId).catch(() => null);

      if (!category || category.type !== 4) { // 4 = GuildCategory
        return interaction.editReply({
          content: `❌ ID invalide ou ce n'est pas une catégorie.`,
          flags: 64
        });
      }

      // Ajouter la catégorie
      await db.addGiveChannel('category', categoryId, category.name, interaction.user.id);

      // Logger l'action
      await audit.logCategoryAdded(
        interaction.guildId,
        interaction.user.id,
        { category_id: categoryId, category_name: category.name }
      );

      // Envoyer la confirmation éphémère
      return interaction.editReply({
        content: `✅ **Catégorie ajoutée !**\n\n` +
          `📂 **Nom:** ${category.name}\n` +
          `🆔 **ID:** \`${categoryId}\`\n\n` +
          `Les boîtes mystères pourront maintenant être lancées dans les canaux de cette catégorie.\n\n` +
          `💡 **Astuce:** Utilise le bouton 🔙 **Retour au Paramétrage** puis **📍 Gérer Canaux/Catégories** pour voir la liste mise à jour.`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout de la catégorie:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour ajouter un canal
   */
  async handleAddChannel(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const channelInputId = interaction.fields.getTextInputValue('channel_id').trim();

      // Vérifier que l'ID n'existe pas déjà
      const exists = await db.giveChannelExists(channelInputId);
      if (exists) {
        return interaction.editReply({
          content: `❌ Ce canal est déjà configuré.`,
          flags: 64
        });
      }

      // Récupérer le canal depuis Discord
      const channel = await interaction.guild.channels.fetch(channelInputId).catch(() => null);

      if (!channel || !channel.isTextBased()) {
        return interaction.editReply({
          content: `❌ ID invalide ou ce n'est pas un canal textuel.`,
          flags: 64
        });
      }

      // Récupérer l'ID de la catégorie parente si elle existe
      const parentCategoryId = channel.parent?.id || null;

      // Ajouter le canal
      await db.addGiveChannel('channel', channelInputId, channel.name, interaction.user.id, parentCategoryId);

      // Logger l'action
      await audit.logChannelAdded(
        interaction.guildId,
        interaction.user.id,
        { channel_id: channelInputId, channel_name: channel.name }
      );

      // Envoyer la confirmation éphémère
      return interaction.editReply({
        content: `✅ **Canal ajouté !**\n\n` +
          `📍 **Nom:** ${channel.name}\n` +
          `🆔 **ID:** \`${channelInputId}\`\n` +
          `📂 **Catégorie:** ${channel.parent ? channel.parent.name : 'Aucune'}\n\n` +
          `Les boîtes mystères pourront maintenant être lancées dans ce canal.\n\n` +
          `💡 **Astuce:** Utilise le bouton 🔙 **Retour au Paramétrage** puis **📍 Gérer Canaux/Catégories** pour voir la liste mise à jour.`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du canal:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour l'édition du texte d'un template
   */
  async handleTemplateText(interaction) {
    await interaction.deferReply({ flags: 64 });

    const templateType = interaction.customId.replace('modal_template_text_', '');

    try {
      const title = interaction.fields.getTextInputValue('template_title');
      const description = interaction.fields.getTextInputValue('template_description');
      const footer = interaction.fields.getTextInputValue('template_footer');

      // Récupérer le template actuel
      const template = await db.getAnnouncementTemplate(templateType, interaction.guildId);

      if (!template) {
        return interaction.editReply({
          content: '❌ Template introuvable.',
          flags: 64
        });
      }

      // Mettre à jour le template
      await db.updateAnnouncementTemplate(templateType, {
        ...template,
        title,
        description,
        footer_text: footer
      });

      return interaction.editReply({
        content: '✅ Template mis à jour avec succès!',
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du template:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour l'édition de la couleur d'un template
   */
  async handleTemplateColor(interaction) {
    await interaction.deferReply({ flags: 64 });

    const templateType = interaction.customId.replace('modal_template_color_', '');

    try {
      let color = interaction.fields.getTextInputValue('template_color');

      // Validation du format hex
      if (!color.startsWith('#')) {
        color = '#' + color;
      }

      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.editReply({
          content: '❌ Format de couleur invalide. Utilise un format hex (ex: #FF5733 ou FF5733).',
          flags: 64
        });
      }

      // Récupérer le template actuel
      const template = await db.getAnnouncementTemplate(templateType, interaction.guildId);

      if (!template) {
        return interaction.editReply({
          content: '❌ Template introuvable.',
          flags: 64
        });
      }

      // Mettre à jour le template
      await db.updateAnnouncementTemplate(templateType, {
        ...template,
        color
      });

      return interaction.editReply({
        content: `✅ Couleur mise à jour avec succès!\n\n🎨 **Nouvelle couleur:** ${color}`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la couleur:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer l'URL d'image depuis le modal
   */
  async handleImageUrl(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      // Extraire le contexte depuis le customId
      const context = interaction.customId.replace('modal_image_url_', '');
      const imageUrl = interaction.fields.getTextInputValue('image_url');

      // Valider que c'est une URL
      try {
        new URL(imageUrl);
      } catch (e) {
        return interaction.editReply({
          content: '❌ L\'URL fournie n\'est pas valide.',
          flags: 64
        });
      }

      // Cas spécial: Mystery Box
      if (context === 'Mystery Box - Image') {
        const theme = await db.getActiveTheme(interaction.guildId);
        await db.query(
          `UPDATE theme_config SET mystery_box_image = $1 WHERE guild_id = $2 AND theme_id = $3`,
          [imageUrl, interaction.guildId, theme.id]
        );
        return interaction.editReply({
          content: `✅ Image de la boîte mystère mise à jour avec succès!\n\n📷 **URL:** ${imageUrl}`,
          flags: 64
        });
      }

      // Parser le contexte pour déterminer si c'est une image ou un thumbnail
      // Format: "Template <TemplateName> - Image principale" ou "Template <TemplateName> - Thumbnail"
      const isImage = context.includes('Image principale');
      const isThumbnail = context.includes('Thumbnail');

      // Extraire le type de template du contexte
      const templateMatch = context.match(/Template (.+?) -/);

      if (!templateMatch) {
        return interaction.editReply({
          content: '❌ Impossible de déterminer le type.',
          flags: 64
        });
      }

      const templateLabels = {
        'Collectible Légendaire': 'legendary_collectible',
        'Collection Complétée': 'collection_completed',
        'Échange de Collection': 'collection_traded',
        'Collection Perdue': 'collection_lost',
        'Malédiction': 'trap_curse',
        'Mot Deviné': 'mission_word_guessed'
      };

      const templateType = templateLabels[templateMatch[1]];

      if (!templateType) {
        return interaction.editReply({
          content: '❌ Type de template inconnu.',
          flags: 64
        });
      }

      // Mettre à jour le template
      const template = await db.getAnnouncementTemplate(templateType, interaction.guildId);

      if (!template) {
        return interaction.editReply({
          content: '❌ Template introuvable.',
          flags: 64
        });
      }

      const updates = { ...template };
      if (isImage) {
        updates.image_url = imageUrl;
      } else if (isThumbnail) {
        updates.thumbnail_url = imageUrl;
      }

      await db.updateAnnouncementTemplate(templateType, updates);

      await interaction.editReply({
        content: `✅ ${isImage ? 'Image principale' : 'Thumbnail'} mise à jour avec succès!\n\n📷 **URL:** ${imageUrl}`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de l\'image:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour le modal d'annonce personnalisée du Give Unique
   * Format: give_unique_announcement_modal:${mode}:${itemId}:${channelType}:${timing}
   */
  async handleGiveUniqueAnnouncementModal(interaction) {
    try {
      // Parser le customId
      const parts = interaction.customId.split(':');
      const mode = parts[1];
      const itemId = parts[2] === 'none' ? null : parts[2];
      const channelType = parts[3];
      const timing = parts[4]; // 'now' ou autre futur timing

      // Récupérer le message personnalisé
      const customMessage = interaction.fields.getTextInputValue('announcement_message');

      if (!customMessage || customMessage.trim().length === 0) {
        return interaction.reply({
          content: '❌ Le message d\'annonce ne peut pas être vide.',
          flags: 64
        });
      }

      // Si timing === 'now', lancer immédiatement avec le message personnalisé
      if (timing === 'now') {
        return adminPanelHandler.launchGiveUniqueNow(interaction, mode, itemId, channelType, customMessage);
      }

      // Pour d'autres timings futurs, on pourrait gérer différemment
      return interaction.reply({
        content: '❌ Type de timing non supporté actuellement.',
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors du traitement du modal d\'annonce:', error);

      const errorMessage = {
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      };

      if (interaction.replied || interaction.deferred) {
        return interaction.followUp(errorMessage);
      } else {
        return interaction.reply(errorMessage);
      }
    }
  }

  /**
   * Handler pour le modal de programmation horaire du Give Unique
   * Format: give_unique_schedule_modal:${mode}:${itemId}:${channelType}:${announcementType}
   */
  async handleGiveUniqueScheduleModal(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      // Parser le customId
      const parts = interaction.customId.split(':');
      const mode = parts[1];
      const itemId = parts[2] === 'none' ? null : parts[2];
      const channelType = parts[3];
      const announcementType = parts[4]; // 'default' ou 'custom'

      // Récupérer les valeurs du modal
      const dateInput = interaction.fields.getTextInputValue('schedule_date');
      const timeInput = interaction.fields.getTextInputValue('schedule_time');

      // Valider le format de la date (JJ/MM/AAAA)
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const dateMatch = dateInput.match(dateRegex);

      if (!dateMatch) {
        return interaction.editReply({
          content: '❌ Format de date invalide. Utilise le format **JJ/MM/AAAA** (ex: 01/11/2025)',
          flags: 64
        });
      }

      // Valider le format de l'heure (HH:MM)
      const timeRegex = /^(\d{2}):(\d{2})$/;
      const timeMatch = timeInput.match(timeRegex);

      if (!timeMatch) {
        return interaction.editReply({
          content: '❌ Format d\'heure invalide. Utilise le format **HH:MM** (ex: 14:30)',
          flags: 64
        });
      }

      // Construire la date complète
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // Les mois en JS commencent à 0
      const year = parseInt(dateMatch[3]);
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);

      // Validation des valeurs
      if (day < 1 || day > 31) {
        return interaction.editReply({
          content: '❌ Jour invalide (doit être entre 1 et 31)',
          flags: 64
        });
      }

      if (month < 0 || month > 11) {
        return interaction.editReply({
          content: '❌ Mois invalide (doit être entre 1 et 12)',
          flags: 64
        });
      }

      if (hours < 0 || hours > 23) {
        return interaction.editReply({
          content: '❌ Heure invalide (doit être entre 0 et 23)',
          flags: 64
        });
      }

      if (minutes < 0 || minutes > 59) {
        return interaction.editReply({
          content: '❌ Minutes invalides (doivent être entre 0 et 59)',
          flags: 64
        });
      }

      // Créer la date
      const scheduledDate = new Date(year, month, day, hours, minutes);

      // Vérifier que la date est dans le futur
      const now = new Date();
      if (scheduledDate <= now) {
        return interaction.editReply({
          content: '❌ La date programmée doit être dans le futur !',
          flags: 64
        });
      }

      // Si announcementType === 'custom', demander le message personnalisé
      if (announcementType === 'custom') {
        // On devrait afficher un autre modal pour le message personnalisé
        // Mais Discord ne permet pas de chaîner 2 modals directement
        // Solution: Stocker la date en cache et demander le message

        return interaction.editReply({
          content: '⚠️ **Fonctionnalité en développement**\n\n' +
            'La programmation avec message personnalisé n\'est pas encore implémentée.\n' +
            'Utilise plutôt **Programmer + Message par Défaut** pour le moment.',
          flags: 64
        });
      }

      // Pour l'instant, simplement confirmer la programmation (implémentation complète à venir)
      return interaction.editReply({
        content: '⚠️ **Fonctionnalité en développement**\n\n' +
          `La programmation pour le **${dateInput} à ${timeInput}** a été enregistrée mais n'est pas encore fonctionnelle.\n\n` +
          `Cette fonctionnalité sera implémentée prochainement avec un système de tâches programmées.\n\n` +
          `Pour le moment, utilise **Lancer Maintenant** pour envoyer immédiatement.`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors du traitement du modal de programmation:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour ajouter une mission
   */
  async handleAddMission(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const missionType = interaction.customId.replace('modal_mission_add_', '');
      const theme = await db.getActiveTheme(interaction.guildId);

      const missionId = interaction.fields.getTextInputValue('mission_id');
      const name = interaction.fields.getTextInputValue('mission_name');
      const description = interaction.fields.getTextInputValue('mission_description');

      let validationData = {};
      let timeout = 60;

      if (missionType === 'keyword-message') {
        const keyword = interaction.fields.getTextInputValue('mission_keyword');
        timeout = parseInt(interaction.fields.getTextInputValue('mission_timeout')) || 60;
        validationData = { keyword };
      } else if (missionType === 'quiz') {
        const question = interaction.fields.getTextInputValue('mission_question');
        const answer = interaction.fields.getTextInputValue('mission_answer');
        validationData = { question, answer };
        timeout = 300; // 5 minutes par défaut pour quiz
      }

      // Ajouter la mission
      await db.addMission(
        interaction.guildId,  // guildId en premier
        theme.id,             // themeId
        missionId,
        name,
        missionType,
        description,
        JSON.stringify(validationData),
        timeout,
        null,                 // image_url
        'random-collectible', // reward_type
        null                  // reward_data
      );

      // Logger l'action
      await audit.logMissionAdded(
        interaction.guildId,
        interaction.user.id,
        {
          mission_id: missionId,
          name: name,
          type: missionType,
          theme_id: theme.id
        }
      );

      await interaction.editReply({
        content: `✅ **Mission créée !**\n\n` +
          `🔹 **Nom:** ${name}\n` +
          `🔹 **Type:** ${missionType}\n` +
          `🔹 **ID:** \`${missionId}\`\n\n` +
          `La mission a été ajoutée au thème **${theme.name}**.`,
        flags: 64
      });

      // Retourner au menu missions
      setTimeout(() => {
        adminPanelHandler.showMissionsMenu(interaction);
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur lors de la création de la mission:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour ajouter un piège
   */
  async handleAddTrap(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const trapType = interaction.customId.replace('modal_trap_add_', '');
      const theme = await db.getActiveTheme(interaction.guildId);

      const trapId = interaction.fields.getTextInputValue('trap_id');
      const name = interaction.fields.getTextInputValue('trap_name');
      const description = interaction.fields.getTextInputValue('trap_description');

      let typeData = {};

      if (trapType === 'cooldown') {
        const duration = parseInt(interaction.fields.getTextInputValue('trap_cooldown_duration'));
        typeData = { cooldown_duration: duration };
      } else if (trapType === 'public-shame') {
        const message = interaction.fields.getTextInputValue('trap_shame_message');
        typeData = { shame_message: message, shame_channel_id: null };
      }

      // Ajouter le piège
      await db.addTrap(
        theme.id,
        trapId,
        name,
        trapType,
        description,
        null, // image_url
        typeData,
        null  // announcement_message
      );

      // Logger l'action
      await audit.logTrapAdded(
        interaction.guildId,
        interaction.user.id,
        {
          trap_id: trapId,
          name: name,
          type: trapType
        }
      );

      await interaction.editReply({
        content: `✅ **Piège créé !**\n\n` +
          `🔹 **Nom:** ${name}\n` +
          `🔹 **Type:** ${trapType}\n` +
          `🔹 **ID:** \`${trapId}\`\n\n` +
          `Le piège a été ajouté au thème **${theme.name}**.`,
        flags: 64
      });

      // Retourner au menu pièges
      setTimeout(() => {
        adminPanelHandler.showTrapsMenu(interaction);
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur lors de la création du piège:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour ajouter un mot-clé à une mission
   */
  async handleAddKeyword(interaction) {
    try {
      // Extraire missionId et difficulty depuis le customId: modal_keyword_add_{missionId}_{difficulty}
      const parts = interaction.customId.split('_');
      const missionId = parseInt(parts[3]);
      const difficulty = parts[4] || 'medium'; // Fallback si pas de difficulté (ancien format)

      const keyword = interaction.fields.getTextInputValue('keyword').trim().toLowerCase();
      const channelId = interaction.fields.getTextInputValue('channel_id').trim() || null;

      // Validation
      if (!keyword || keyword.length === 0) {
        return interaction.reply({
          content: '❌ **Erreur:** Le mot-clé ne peut pas être vide.',
          flags: 64
        });
      }

      if (keyword.length > 50) {
        return interaction.reply({
          content: '❌ **Erreur:** Le mot-clé ne peut pas dépasser 50 caractères.',
          flags: 64
        });
      }

      // Valider la difficulté (sécurité, normalement déjà validée)
      const validDifficulties = ['easy', 'medium', 'hard'];
      if (!validDifficulties.includes(difficulty)) {
        return interaction.reply({
          content: `❌ **Erreur:** Difficulté invalide: "${difficulty}"`,
          flags: 64
        });
      }

      // Vérifier si le mot-clé existe déjà pour cette mission
      const existingKeywords = await db.getMissionKeywords(interaction.guildId, missionId);
      if (existingKeywords.some(kw => kw.keyword === keyword)) {
        return interaction.reply({
          content: `❌ **Erreur:** Le mot-clé **"${keyword}"** existe déjà pour cette mission.`,
          flags: 64
        });
      }

      // Ajouter le mot-clé avec la difficulté
      await db.addMissionKeyword(interaction.guildId, missionId, keyword, channelId, difficulty);

      // Logger l'action
      await audit.logMissionKeywordAdded(
        interaction.guildId,
        interaction.user.id,
        {
          mission_id: missionId,
          keyword: keyword,
          difficulty: difficulty
        }
      );

      // Emoji de difficulté pour l'affichage
      const difficultyEmojis = {
        'easy': '🟢',
        'medium': '🟡',
        'hard': '🔴'
      };

      // Récupérer le branding
      const branding = await db.getGuildBranding(interaction.guildId);

      // Message de succès éphémère
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Mot-clé ajouté avec succès !')
        .setDescription('Le mot-clé a été ajouté à la mission.\n\n💡 **Utilise le bouton "Rafraîchir" pour voir la liste actualisée.**')
        .addFields(
          { name: '🔤 Mot-clé', value: keyword, inline: true },
          { name: '📍 Canal', value: channelId ? `<#${channelId}>` : 'Tous les canaux', inline: true },
          { name: '⚡ Difficulté', value: `${difficultyEmojis[difficulty]} ${difficulty}`, inline: true }
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId))
        .setTimestamp();

      await interaction.reply({
        embeds: [successEmbed],
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du mot-clé:', error);

      return interaction.reply({
        content: `❌ **Erreur:** Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour ajouter une question de quiz
   */
  async handleAddQuizQuestion(interaction) {
    try {
      // Extraire missionId et difficulty du customId: modal_quiz_add_${missionId}_${difficulty}
      const parts = interaction.customId.split('_');
      const missionId = parseInt(parts[3]); // modal_quiz_add_123_easy -> 123
      const difficulty = parts[4] || 'medium'; // modal_quiz_add_123_easy -> easy

      // Extraire les valeurs des champs
      const questionText = interaction.fields.getTextInputValue('question').trim();
      const correctAnswer = interaction.fields.getTextInputValue('correct_answer').trim();
      const hint = interaction.fields.getTextInputValue('hint')?.trim() || null;

      // Validation de base
      if (!questionText || questionText.length === 0) {
        return interaction.reply({
          content: '❌ **Erreur:** La question ne peut pas être vide.',
          flags: 64
        });
      }

      if (!correctAnswer || correctAnswer.length === 0) {
        return interaction.reply({
          content: '❌ **Erreur:** La réponse correcte ne peut pas être vide.',
          flags: 64
        });
      }

      // Valider la difficulté
      const validDifficulties = ['easy', 'medium', 'hard'];
      const finalDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'medium';

      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      if (!mission || mission.type !== 'quiz') {
        return interaction.reply({
          content: '❌ **Erreur:** Mission introuvable ou n\'est pas de type Quiz.',
          flags: 64
        });
      }

      // Ajouter la question (sans mauvaises réponses - le joueur peut essayer autant de fois qu'il veut)
      // mission_id en dernier argument pour lier la question à cette mission spécifique
      await db.addQuizQuestion(
        interaction.guildId,
        mission.theme_id,
        questionText,
        correctAnswer,
        [], // Pas de mauvaises réponses prédéfinies
        hint,
        finalDifficulty,
        mission.id // mission_id pour quiz indépendants
      );

      // Logger l'action
      await audit.logMissionQuizQuestionAdded(
        interaction.guildId,
        interaction.user.id,
        missionId,
        questionText,
        finalDifficulty
      );

      // Message de succès éphémère
      const difficultyEmoji = {
        'easy': '🟢',
        'medium': '🟡',
        'hard': '🔴'
      };

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Question ajoutée avec succès !')
        .setDescription('La question a été ajoutée au quiz.\n\n💡 Le joueur pourra essayer autant de fois qu\'il veut dans le temps imparti.\n\n**Utilise le bouton "Rafraîchir" pour voir la liste actualisée.**')
        .addFields(
          { name: '📝 Question', value: questionText.substring(0, 100) + (questionText.length > 100 ? '...' : ''), inline: false },
          { name: '✅ Réponse correcte', value: correctAnswer, inline: true },
          { name: '💡 Difficulté', value: `${difficultyEmoji[finalDifficulty]} ${finalDifficulty}`, inline: true }
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId))
        .setTimestamp();

      if (hint) {
        successEmbed.addFields({
          name: '💭 Indice',
          value: hint,
          inline: false
        });
      }

      await interaction.reply({
        embeds: [successEmbed],
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout de la question:', error);

      return interaction.reply({
        content: `❌ **Erreur:** Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Handler pour configurer le timeout d'une mission
   */
  async handleMissionTimeout(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      // Extraire missionId depuis le customId: modal_mission_timeout_{missionId}
      const missionId = parseInt(interaction.customId.split('_')[3]);
      const timeoutValue = interaction.fields.getTextInputValue('timeout').trim();

      // Validation: doit être un nombre
      const timeout = parseInt(timeoutValue);

      if (isNaN(timeout) || timeout <= 0) {
        return interaction.editReply({
          content: '❌ **Erreur:** Le timeout doit être un nombre positif supérieur à 0.',
          flags: 64
        });
      }

      // Validation: timeout raisonnable (entre 1 seconde et 1 heure = 3600 secondes)
      if (timeout > 3600) {
        return interaction.editReply({
          content: '❌ **Erreur:** Le timeout maximum est de 3600 secondes (1 heure).',
          flags: 64
        });
      }

      // Récupérer la mission pour vérifier qu'elle existe
      const mission = await db.getMissionById(interaction.guildId, missionId);

      if (!mission) {
        return interaction.editReply({
          content: '❌ **Erreur:** Mission introuvable.',
          flags: 64
        });
      }

      // Mettre à jour le timeout dans la base de données
      await db.query(
        `UPDATE missions
         SET timeout = $1
         WHERE id = $2 AND guild_id = $3`,
        [timeout, missionId, interaction.guildId]
      );

      // Formater l'affichage du timeout
      let timeoutDisplay = `${timeout} secondes`;
      if (timeout >= 60) {
        const minutes = Math.floor(timeout / 60);
        const seconds = timeout % 60;
        timeoutDisplay = seconds > 0
          ? `${minutes} min ${seconds} sec`
          : `${minutes} minutes`;
      }

      // Message de succès
      return interaction.editReply({
        content: `✅ **Timeout mis à jour avec succès !**\n\n` +
          `🎯 **Mission:** ${mission.name}\n` +
          `⏱️ **Nouveau timeout:** ${timeoutDisplay}\n\n` +
          `Les joueurs auront maintenant **${timeoutDisplay}** pour compléter cette mission.`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du timeout:', error);
      return interaction.editReply({
        content: `❌ **Erreur:** Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer la saisie manuelle du canal d'annonces (ID ou nom)
   */
  async handleManualAnnouncementChannel(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const input = interaction.fields.getTextInputValue('channel_id_input').trim();
      let channel = null;

      // Vérifier si c'est un ID (nombre de 17-20 chiffres)
      if (/^\d{17,20}$/.test(input)) {
        // Recherche par ID
        channel = await interaction.guild.channels.fetch(input).catch(() => null);
      } else {
        // Recherche par nom (insensible à la casse)
        const searchName = input.toLowerCase().replace(/^#/, ''); // Enlever le # si présent
        const textChannels = interaction.guild.channels.cache.filter(
          c => c.isTextBased() && !c.isThread() && !c.isDMBased()
        );

        // Recherche exacte d'abord
        channel = textChannels.find(c => c.name.toLowerCase() === searchName);

        // Sinon recherche partielle
        if (!channel) {
          channel = textChannels.find(c => c.name.toLowerCase().includes(searchName));
        }
      }

      if (!channel) {
        // Afficher les canaux disponibles pour aider
        const textChannels = interaction.guild.channels.cache
          .filter(c => c.isTextBased() && !c.isThread() && !c.isDMBased())
          .map(c => `\`${c.name}\``)
          .slice(0, 15)
          .join(', ');

        return interaction.editReply({
          content: `❌ **Canal introuvable**\n\nAucun canal correspondant à \`${input}\` n'a été trouvé.\n\n💡 **Tu peux entrer:**\n• Le nom du canal (ex: \`annonces\` ou \`general\`)\n• L'ID du canal (ex: \`1234567890123456789\`)\n\n📋 **Quelques canaux disponibles:** ${textChannels}...`,
          flags: 64
        });
      }

      // Vérifier que c'est un canal textuel
      if (!channel.isTextBased() || channel.isThread() || channel.isDMBased()) {
        return interaction.editReply({
          content: `❌ **Type de canal invalide**\n\nLe canal <#${channel.id}> n'est pas un canal textuel valide pour les annonces.`,
          flags: 64
        });
      }

      // Enregistrer le canal
      await db.setAnnouncementChannel(interaction.guildId, channel.id);

      // Message de confirmation
      return interaction.editReply({
        content: `✅ **Canal d'annonces configuré !**\n\n📢 Les annonces seront maintenant envoyées dans <#${channel.id}>`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de la configuration du canal d\'annonces:', error);
      return interaction.editReply({
        content: `❌ **Erreur:** ${error.message}`,
        flags: 64
      });
    }
  }
}

module.exports = new ModalHandler();
