const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const campaignHandler = require('./campaignHandler');
const audit = require('../utils/auditLogger');

/**
 * Handler pour l'interface d'administration des campagnes
 */
class CampaignAdminHandler {
  constructor() {
    // Stockage temporaire des données de création de campagne (par userId)
    this.campaignDrafts = new Map();
  }

  /**
   * Menu principal de gestion des campagnes (depuis Paramétrage)
   * Affichage graphique avec stats des campagnes actives
   */
  async showCampaignsManagementMenu(interaction) {
    await interaction.deferUpdate();

    const theme = await db.getActiveTheme(interaction.guildId);

    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif.',
        embeds: [],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('admin_settings')
              .setLabel('🔙 Retour')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    // Récupérer toutes les campagnes actives
    const activeCampaigns = await db.getActiveCampaigns(interaction.guildId);

    // Créer l'embed principal
    const embed = new EmbedBuilder()
      .setTitle('📊 GESTION DES CAMPAGNES')
      .setDescription(
        `**Thème actif:** ${theme.name}\n\n` +
        `Gérez vos campagnes de distribution de MysteryBox.`
      )
      .setColor('#9b59b6')
      .setTimestamp();

    // Ajouter les stats des campagnes actives
    if (activeCampaigns.length === 0) {
      embed.addFields({
        name: '📭 Aucune campagne active',
        value: 'Utilisez le bouton **📢 Lancer une Campagne** du menu principal pour créer une nouvelle campagne.',
        inline: false
      });
    } else {
      for (const campaign of activeCampaigns.slice(0, 5)) { // Limite à 5 pour ne pas surcharger
        const progressBar = this.createProgressBar(campaign.total_gives_posted, campaign.burst_count || 10);
        const statusEmoji = campaign.status === 'running' ? '🟢' : campaign.status === 'paused' ? '⏸️' : '⏹️';

        let fieldValue = '';

        if (campaign.campaign_type === 'burst') {
          fieldValue =
            `${statusEmoji} **${campaign.campaign_type.toUpperCase()}** - ID: #${campaign.id}\n` +
            `📦 Progression: ${campaign.total_gives_posted}/${campaign.burst_count}\n` +
            `${progressBar}\n` +
            `⏱️ Intervalle: ${campaign.burst_interval}s\n` +
            `🎯 Canaux: ${campaign.mode === 'random' ? 'Aléatoire' : 'Spécifiques'}`;
        } else {
          fieldValue =
            `${statusEmoji} **${campaign.campaign_type.toUpperCase()}** - ID: #${campaign.id}\n` +
            `📦 Boîtes lancées: ${campaign.total_gives_posted}\n` +
            `⚡ Fréquence: Toutes les ${campaign.scheduled_interval}h\n` +
            `⏱️ Durée: ${campaign.scheduled_duration} jours\n` +
            `🎯 Canaux: ${campaign.mode === 'random' ? 'Aléatoire' : 'Spécifiques'}`;
        }

        embed.addFields({
          name: `${campaign.name || `Campagne #${campaign.id}`}`,
          value: fieldValue,
          inline: false
        });
      }

      if (activeCampaigns.length > 5) {
        embed.setFooter({ text: `... et ${activeCampaigns.length - 5} autre(s) campagne(s)` });
      }
    }

    // Boutons de gestion
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('campaign_refresh')
        .setLabel('🔄 Rafraîchir')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('campaign_view_all')
        .setLabel('📋 Campagnes Actives')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(activeCampaigns.length === 0),
      new ButtonBuilder()
        .setCustomId('campaign_history')
        .setLabel('📜 Historique')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_settings')
        .setLabel('🔙 Retour au Paramétrage')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Afficher toutes les campagnes avec boutons d'action
   */
  async showAllCampaigns(interaction) {
    await interaction.deferUpdate();

    const campaigns = await db.getActiveCampaigns(interaction.guildId);

    if (campaigns.length === 0) {
      return this.showCampaignsManagementMenu(interaction);
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 TOUTES LES CAMPAGNES ACTIVES')
      .setDescription(`Sélectionnez une campagne pour voir les détails et les actions disponibles.`)
      .setColor('#9b59b6');

    // Créer un menu select avec toutes les campagnes
    const options = campaigns.map(campaign => ({
      label: `#${campaign.id} - ${campaign.campaign_type.toUpperCase()} - ${campaign.total_gives_posted} boîtes`,
      description: campaign.status === 'running' ? '🟢 Active' : campaign.status === 'paused' ? '⏸️ En pause' : '⏹️ Arrêtée',
      value: `campaign_select_${campaign.id}`
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('campaign_select')
      .setPlaceholder('Sélectionner une campagne')
      .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('campaign_manage_back')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Afficher l'historique des campagnes (complétées/arrêtées)
   */
  async showCampaignsHistory(interaction) {
    await interaction.deferUpdate();

    const historyCampaigns = await db.getCampaignsByStatus(interaction.guildId, ['completed', 'stopped']);

    const embed = new EmbedBuilder()
      .setTitle('📜 HISTORIQUE DES CAMPAGNES')
      .setColor('#95a5a6');

    if (historyCampaigns.length === 0) {
      embed.setDescription('Aucune campagne terminée ou arrêtée dans l\'historique.');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('campaign_manage_back')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    }

    embed.setDescription(`Sélectionnez une campagne pour voir les détails et la supprimer si nécessaire.\n\n**Total: ${historyCampaigns.length} campagne(s)**`);

    // Créer un menu select avec les campagnes terminées/arrêtées
    const options = historyCampaigns.slice(0, 25).map(campaign => {
      const statusIcon = campaign.status === 'completed' ? '✅' : '⏹️';
      const statusText = campaign.status === 'completed' ? 'Terminée' : 'Arrêtée';

      return {
        label: `#${campaign.id} - ${campaign.campaign_type.toUpperCase()} - ${campaign.total_gives_posted} boîtes`,
        description: `${statusIcon} ${statusText}`,
        value: `campaign_select_${campaign.id}`
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('campaign_select')
      .setPlaceholder('Sélectionner une campagne')
      .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('campaign_manage_back')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    if (historyCampaigns.length > 25) {
      embed.setFooter({ text: `Affichage des 25 premières campagnes sur ${historyCampaigns.length}` });
    }

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Afficher les détails d'une campagne spécifique avec stats
   */
  async showCampaignDetails(interaction, campaignId) {
    await interaction.deferUpdate();

    const campaign = await db.getCampaignById(interaction.guildId, campaignId);

    if (!campaign) {
      return interaction.editReply({
        content: '❌ Campagne introuvable.',
        components: []
      });
    }

    // Créer l'embed détaillé
    const embed = new EmbedBuilder()
      .setTitle(`📊 CAMPAGNE #${campaign.id}`)
      .setColor(campaign.status === 'running' ? '#2ecc71' : campaign.status === 'paused' ? '#f39c12' : '#95a5a6');

    // Informations générales
    const statusEmoji = campaign.status === 'running' ? '🟢' : campaign.status === 'paused' ? '⏸️' : '⏹️';
    embed.addFields({
      name: '📌 Informations',
      value:
        `**Statut:** ${statusEmoji} ${campaign.status.toUpperCase()}\n` +
        `**Mode:** ${campaign.campaign_type.toUpperCase()}\n` +
        `**Thème:** ${campaign.theme_id}\n` +
        `**Canaux:** ${campaign.mode === 'random' ? 'Aléatoire' : 'Spécifiques'}`,
      inline: true
    });

    // Stats de progression
    if (campaign.campaign_type === 'burst') {
      const progressBar = this.createProgressBar(campaign.total_gives_posted, campaign.burst_count);
      embed.addFields({
        name: '📈 Progression',
        value:
          `**Lancées:** ${campaign.total_gives_posted}/${campaign.burst_count}\n` +
          `${progressBar}\n` +
          `**Intervalle:** ${campaign.burst_interval}s`,
        inline: true
      });
    } else {
      const now = new Date();
      const startedAt = new Date(campaign.started_at);
      const daysRunning = Math.floor((now - startedAt) / (1000 * 60 * 60 * 24));

      embed.addFields({
        name: '📈 Progression',
        value:
          `**Boîtes lancées:** ${campaign.total_gives_posted}\n` +
          `**Fréquence:** Toutes les ${campaign.scheduled_interval}h\n` +
          `**Durée:** ${daysRunning}/${campaign.scheduled_duration} jours`,
        inline: true
      });
    }

    // Dates
    embed.addFields({
      name: '📅 Dates',
      value:
        `**Démarrée:** ${campaign.started_at ? `<t:${Math.floor(new Date(campaign.started_at).getTime() / 1000)}:R>` : 'Pas encore'}`,
      inline: false
    });

    // Boutons de contrôle
    const controlButtons = new ActionRowBuilder();

    if (campaign.status === 'running') {
      controlButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`campaign_pause_${campaign.id}`)
          .setLabel('⏸️ Mettre en Pause')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`campaign_stop_${campaign.id}`)
          .setLabel('⏹️ Arrêter')
          .setStyle(ButtonStyle.Danger)
      );
    } else if (campaign.status === 'paused') {
      controlButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`campaign_resume_${campaign.id}`)
          .setLabel('▶️ Reprendre')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`campaign_stop_${campaign.id}`)
          .setLabel('⏹️ Arrêter')
          .setStyle(ButtonStyle.Danger)
      );
    } else if (campaign.status === 'stopped' || campaign.status === 'completed') {
      // Pour les campagnes terminées/arrêtées : bouton de suppression
      controlButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`campaign_delete_${campaign.id}`)
          .setLabel('🗑️ Supprimer')
          .setStyle(ButtonStyle.Danger)
      );
    }

    controlButtons.addComponents(
      new ButtonBuilder()
        .setCustomId('campaign_view_all')
        .setLabel('🔙 Liste des Campagnes')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [controlButtons]
    });
  }

  /**
   * Wizard de création de campagne - Étape 1: Choix du mode
   */
  async showCampaignWizardStep1(interaction) {
    await interaction.deferUpdate();

    const embed = new EmbedBuilder()
      .setTitle('🚀 CRÉER UNE CAMPAGNE - Étape 1/4')
      .setDescription(
        '**Choisissez le mode de votre campagne:**\n\n' +
        '🔥 **BURST (Rafale)**\n' +
        '• Lance un nombre défini de boîtes\n' +
        '• Avec un intervalle fixe entre chaque\n' +
        '• Idéal pour: Events ponctuels, happy hours\n' +
        '• Exemple: 10 boîtes espacées de 30 secondes\n\n' +
        '📅 **SCHEDULE (Planifié)**\n' +
        '• Lance des boîtes automatiquement\n' +
        '• Sur une durée définie avec fréquence\n' +
        '• Idéal pour: Events longue durée, journées spéciales\n' +
        '• Exemple: 1 boîte toutes les 2h pendant 24h'
      )
      .setColor('#e74c3c')
      .setFooter({ text: 'Étape 1/4 - Choix du mode' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('campaign_wizard_mode_burst')
        .setLabel('🔥 BURST (Rafale)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('campaign_wizard_mode_schedule')
        .setLabel('📅 SCHEDULE (Planifié)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_back')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  }

  /**
   * Créer une barre de progression visuelle
   */
  createProgressBar(current, total, length = 20) {
    const percentage = total > 0 ? Math.min(current / total, 1) : 0;
    const filled = Math.floor(percentage * length);
    const empty = length - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = Math.floor(percentage * 100);

    return `\`${bar}\` ${percent}%`;
  }

  /**
   * Gérer les interactions (appelé depuis adminPanelHandler)
   */
  async handleInteraction(interaction) {
    const customId = interaction.customId;

    // Menu principal de gestion
    if (customId === 'admin_campaigns_manage' || customId === 'campaign_refresh' || customId === 'campaign_manage_back') {
      return this.showCampaignsManagementMenu(interaction);
    }

    // Voir toutes les campagnes
    if (customId === 'campaign_view_all') {
      return this.showAllCampaigns(interaction);
    }

    // Voir l'historique des campagnes
    if (customId === 'campaign_history') {
      return this.showCampaignsHistory(interaction);
    }

    // Sélection d'une campagne
    if (customId === 'campaign_select') {
      const selectedValue = interaction.values[0];
      const campaignId = parseInt(selectedValue.split('_').pop());
      return this.showCampaignDetails(interaction, campaignId);
    }

    // Contrôles de campagne
    if (customId.startsWith('campaign_pause_')) {
      const campaignId = parseInt(customId.split('_').pop());
      await campaignHandler.pauseCampaign(interaction.guildId, campaignId);
      return this.showCampaignDetails(interaction, campaignId);
    }

    if (customId.startsWith('campaign_resume_')) {
      const campaignId = parseInt(customId.split('_').pop());
      await campaignHandler.resumeCampaign(interaction.guildId, campaignId);

      // Logger l'action
      await audit.logCampaignStarted(
        interaction.guildId,
        interaction.user.id,
        { campaign_id: campaignId }
      );

      return this.showCampaignDetails(interaction, campaignId);
    }

    if (customId.startsWith('campaign_stop_')) {
      const campaignId = parseInt(customId.split('_').pop());
      await campaignHandler.stopCampaign(interaction.guildId, campaignId);

      // Logger l'action
      await audit.logCampaignStopped(
        interaction.guildId,
        interaction.user.id,
        { campaign_id: campaignId }
      );

      return this.showCampaignsManagementMenu(interaction);
    }

    // Confirmation de suppression (DOIT ÊTRE AVANT campaign_delete_ pour intercepter confirm en premier)
    if (customId.startsWith('campaign_delete_confirm_')) {
      const campaignId = parseInt(customId.split('_').pop());

      await interaction.deferUpdate();

      try {
        await db.deleteCampaign(interaction.guildId, campaignId);

        // Logger l'action
        await audit.logCampaignDeleted(
          interaction.guildId,
          interaction.user.id,
          { campaign_id: campaignId }
        );

        const embed = new EmbedBuilder()
          .setTitle('✅ CAMPAGNE SUPPRIMÉE')
          .setDescription(`La campagne **#${campaignId}** a été supprimée avec succès.`)
          .setColor('#2ecc71');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('campaign_history')
            .setLabel('🔙 Retour à l\'Historique')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({
          embeds: [embed],
          components: [row]
        });
      } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error);

        const embed = new EmbedBuilder()
          .setTitle('❌ ERREUR')
          .setDescription('Une erreur est survenue lors de la suppression de la campagne.')
          .setColor('#e74c3c');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('campaign_history')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({
          embeds: [embed],
          components: [row]
        });
      }
    }

    // Suppression de campagne (afficher confirmation)
    if (customId.startsWith('campaign_delete_')) {
      const campaignId = parseInt(customId.split('_').pop());
      const campaign = await db.getCampaignById(interaction.guildId, campaignId);

      if (!campaign) {
        return interaction.update({
          content: '❌ Campagne introuvable.',
          embeds: [],
          components: []
        });
      }

      // Afficher confirmation
      const embed = new EmbedBuilder()
        .setTitle('⚠️ CONFIRMATION DE SUPPRESSION')
        .setDescription(
          `Êtes-vous sûr de vouloir supprimer la campagne **#${campaign.id}** ?\n\n` +
          `**Type:** ${campaign.campaign_type.toUpperCase()}\n` +
          `**Boîtes lancées:** ${campaign.total_gives_posted}\n` +
          `**Statut:** ${campaign.status === 'completed' ? '✅ Terminée' : '⏹️ Arrêtée'}\n\n` +
          `⚠️ **Cette action est irréversible et supprimera également tous les logs associés.**`
        )
        .setColor('#e74c3c');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`campaign_delete_confirm_${campaign.id}`)
          .setLabel('✅ Confirmer la Suppression')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('campaign_history')
          .setLabel('❌ Annuler')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        embeds: [embed],
        components: [row]
      });
    }

    // Wizard de création
    if (customId === 'admin_launch_campaign') {
      return this.showCampaignWizardStep1(interaction);
    }

    if (customId === 'campaign_wizard_mode_burst') {
      // Récupérer le draft existant et ajouter le mode
      const draft = this.campaignDrafts.get(interaction.user.id) || {};
      draft.mode = 'burst';
      this.campaignDrafts.set(interaction.user.id, draft);
      return this.showCampaignWizardStep2Burst(interaction);
    }

    if (customId === 'campaign_wizard_mode_schedule') {
      // Récupérer le draft existant et ajouter le mode
      const draft = this.campaignDrafts.get(interaction.user.id) || {};
      draft.mode = 'scheduled';
      this.campaignDrafts.set(interaction.user.id, draft);
      return this.showCampaignWizardStep2Schedule(interaction);
    }

    // Étape 3 - Choix des canaux
    if (customId === 'campaign_wizard_channels_random') {
      console.log('🔧 [AUDIT] Bouton "Aléatoire" cliqué');
      console.log('🔧 [AUDIT] User:', interaction.user.id, interaction.user.username);
      console.log('🔧 [AUDIT] Interaction type:', interaction.type);
      return this.showCampaignWizardStep4(interaction, 'random');
    }

    if (customId === 'campaign_wizard_channels_specific') {
      console.log('🔧 [AUDIT] Bouton "Canaux Spécifiques" cliqué');
      console.log('🔧 [AUDIT] User:', interaction.user.id, interaction.user.username);
      console.log('🔧 [AUDIT] Interaction type:', interaction.type);
      return this.showChannelSelector(interaction);
    }

    // Sélection des canaux spécifiques
    if (customId === 'campaign_channels_select') {
      const selectedChannels = interaction.values;
      console.log('🔧 [AUDIT] Canaux sélectionnés:', selectedChannels);
      return this.showCampaignWizardStep4(interaction, 'specific', selectedChannels);
    }

    // Confirmation et annulation
    if (customId === 'campaign_wizard_confirm') {
      return this.confirmAndCreateCampaign(interaction);
    }

    if (customId === 'campaign_wizard_cancel') {
      return this.cancelCampaignWizard(interaction);
    }
  }

  /**
   * Gérer les modals (appelé depuis modalHandler)
   */
  async handleModalSubmit(interaction) {
    const customId = interaction.customId;

    if (customId === 'campaign_modal_burst_config') {
      return this.handleModalBurstConfig(interaction);
    }

    if (customId === 'campaign_modal_schedule_config') {
      return this.handleModalScheduleConfig(interaction);
    }
  }

  /**
   * Wizard Étape 2 - Configuration BURST
   */
  async showCampaignWizardStep2Burst(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('campaign_modal_burst_config')
      .setTitle('🔥 Campagne BURST - Configuration');

    const countInput = new TextInputBuilder()
      .setCustomId('burst_count')
      .setLabel('Nombre de boîtes à lancer')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 10')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    const intervalInput = new TextInputBuilder()
      .setCustomId('burst_interval')
      .setLabel('Intervalle entre chaque (en secondes)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 30')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(4);

    const nameInput = new TextInputBuilder()
      .setCustomId('campaign_name')
      .setLabel('Nom de la campagne (optionnel)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Event Halloween')
      .setRequired(false)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(countInput),
      new ActionRowBuilder().addComponents(intervalInput),
      new ActionRowBuilder().addComponents(nameInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Wizard Étape 2 - Configuration SCHEDULE
   */
  async showCampaignWizardStep2Schedule(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('campaign_modal_schedule_config')
      .setTitle('📅 Campagne SCHEDULE - Configuration');

    const durationInput = new TextInputBuilder()
      .setCustomId('schedule_duration_days')
      .setLabel('Durée totale (en jours)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 7')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    const frequencyInput = new TextInputBuilder()
      .setCustomId('schedule_frequency_hours')
      .setLabel('Fréquence (toutes les X heures)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 2')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2);

    const nameInput = new TextInputBuilder()
      .setCustomId('campaign_name')
      .setLabel('Nom de la campagne (optionnel)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Event de Noël')
      .setRequired(false)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(durationInput),
      new ActionRowBuilder().addComponents(frequencyInput),
      new ActionRowBuilder().addComponents(nameInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Handler de modal - Configuration BURST
   */
  async handleModalBurstConfig(interaction) {
    console.log('🔧 [AUDIT] handleModalBurstConfig appelé');
    console.log('🔧 [AUDIT] Interaction type:', interaction.type);
    console.log('🔧 [AUDIT] Interaction customId:', interaction.customId);
    console.log('🔧 [AUDIT] User:', interaction.user.id, interaction.user.username);

    const count = parseInt(interaction.fields.getTextInputValue('burst_count'));
    const interval = parseInt(interaction.fields.getTextInputValue('burst_interval'));
    const name = interaction.fields.getTextInputValue('campaign_name') || null;

    console.log('🔧 [AUDIT] Valeurs extraites - count:', count, 'interval:', interval, 'name:', name);

    // Validation
    if (isNaN(count) || count < 1 || count > 100) {
      console.log('❌ [AUDIT] Validation count échouée');
      return interaction.reply({
        content: '❌ Le nombre de boîtes doit être entre 1 et 100.',
        flags: 64
      });
    }

    if (isNaN(interval) || interval < 10 || interval > 3600) {
      console.log('❌ [AUDIT] Validation interval échouée');
      return interaction.reply({
        content: '❌ L\'intervalle doit être entre 10 et 3600 secondes (1h max).',
        flags: 64
      });
    }

    console.log('✅ [AUDIT] Validations passées');

    // Récupérer le draft et le message original
    const draft = this.campaignDrafts.get(interaction.user.id) || { mode: 'burst' };
    draft.totalCount = count;
    draft.intervalSeconds = interval;
    draft.name = name;
    this.campaignDrafts.set(interaction.user.id, draft);

    // Créer l'embed de l'étape 3
    const embed = new EmbedBuilder()
      .setTitle('🚀 CRÉER UNE CAMPAGNE - Étape 3/4')
      .setDescription(
        '**Où lancer les boîtes mystères ?**\n\n' +
        '⚙️ **Canaux Prédéfinis (Recommandé)**\n' +
        '• Utilise les canaux/catégories configurés dans **Paramétrage**\n' +
        '• Les boîtes apparaissent aléatoirement parmi ces canaux\n' +
        '• Configuration centralisée et facile à gérer\n' +
        '• Idéal pour maximiser la participation\n\n' +
        '📍 **Canaux Spécifiques**\n' +
        '• Choisissez manuellement les canaux pour cette campagne\n' +
        '• Les boîtes apparaîtront aléatoirement parmi ces canaux\n' +
        '• Idéal pour cibler une zone précise'
      )
      .setColor('#3498db')
      .setFooter({ text: 'Étape 3/4 - Choix des canaux' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('campaign_wizard_channels_random')
        .setLabel('⚙️ Canaux Prédéfinis')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('campaign_wizard_channels_specific')
        .setLabel('📍 Canaux Spécifiques')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('campaign_wizard_cancel')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );

    // Envoyer un message éphémère avec l'étape 3
    console.log('🔧 [AUDIT] Avant interaction.reply()');
    console.log('🔧 [AUDIT] Interaction replied:', interaction.replied);
    console.log('🔧 [AUDIT] Interaction deferred:', interaction.deferred);

    try {
      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64 // Éphémère
      });
      console.log('✅ [AUDIT] interaction.reply() réussi !');
    } catch (error) {
      console.error('❌ [AUDIT] Erreur dans interaction.reply():', error);
      console.error('❌ [AUDIT] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Handler de modal - Configuration SCHEDULE
   */
  async handleModalScheduleConfig(interaction) {
    const duration = parseInt(interaction.fields.getTextInputValue('schedule_duration_days'));
    const frequency = parseInt(interaction.fields.getTextInputValue('schedule_frequency_hours'));
    const name = interaction.fields.getTextInputValue('campaign_name') || null;

    // Validation
    if (isNaN(duration) || duration < 1 || duration > 365) {
      return interaction.reply({
        content: '❌ La durée doit être entre 1 et 365 jours.',
        flags: 64
      });
    }

    if (isNaN(frequency) || frequency < 1 || frequency > 24) {
      return interaction.reply({
        content: '❌ La fréquence doit être entre 1 et 24 heures.',
        flags: 64
      });
    }

    // Récupérer le draft et le message original
    const draft = this.campaignDrafts.get(interaction.user.id) || { mode: 'scheduled' };
    draft.durationDays = duration;
    draft.frequencyHours = frequency;
    draft.name = name;
    this.campaignDrafts.set(interaction.user.id, draft);

    // Créer l'embed de l'étape 3
    const embed = new EmbedBuilder()
      .setTitle('🚀 CRÉER UNE CAMPAGNE - Étape 3/4')
      .setDescription(
        '**Où lancer les boîtes mystères ?**\n\n' +
        '⚙️ **Canaux Prédéfinis (Recommandé)**\n' +
        '• Utilise les canaux/catégories configurés dans **Paramétrage**\n' +
        '• Les boîtes apparaissent aléatoirement parmi ces canaux\n' +
        '• Configuration centralisée et facile à gérer\n' +
        '• Idéal pour maximiser la participation\n\n' +
        '📍 **Canaux Spécifiques**\n' +
        '• Choisissez manuellement les canaux pour cette campagne\n' +
        '• Les boîtes apparaîtront aléatoirement parmi ces canaux\n' +
        '• Idéal pour cibler une zone précise'
      )
      .setColor('#3498db')
      .setFooter({ text: 'Étape 3/4 - Choix des canaux' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('campaign_wizard_channels_random')
        .setLabel('⚙️ Canaux Prédéfinis')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('campaign_wizard_channels_specific')
        .setLabel('📍 Canaux Spécifiques')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('campaign_wizard_cancel')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );

    // Envoyer un message éphémère avec l'étape 3
    console.log('🔧 [AUDIT] Avant interaction.reply()');
    console.log('🔧 [AUDIT] Interaction replied:', interaction.replied);
    console.log('🔧 [AUDIT] Interaction deferred:', interaction.deferred);

    try {
      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64 // Éphémère
      });
      console.log('✅ [AUDIT] interaction.reply() réussi !');
    } catch (error) {
      console.error('❌ [AUDIT] Erreur dans interaction.reply():', error);
      console.error('❌ [AUDIT] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Afficher le sélecteur de canaux spécifiques
   */
  async showChannelSelector(interaction) {
    const guild = interaction.guild;

    // Récupérer tous les canaux textuels du serveur
    const textChannels = guild.channels.cache.filter(
      channel => channel.isTextBased() && !channel.isThread() && channel.type === 0 // Type 0 = GUILD_TEXT
    );

    if (textChannels.size === 0) {
      return interaction.update({
        content: '❌ Aucun canal textuel trouvé sur ce serveur.',
        embeds: [],
        components: []
      });
    }

    // Créer les options pour le select menu (max 25 options)
    const options = Array.from(textChannels.values())
      .slice(0, 25)
      .map(channel => ({
        label: `# ${channel.name}`,
        description: channel.parent ? `Catégorie: ${channel.parent.name}` : 'Pas de catégorie',
        value: channel.id
      }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('campaign_channels_select')
      .setPlaceholder('Sélectionnez les canaux (min: 1, max: 25)')
      .setMinValues(1)
      .setMaxValues(Math.min(options.length, 25))
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('📍 SÉLECTION DES CANAUX')
      .setDescription(
        'Sélectionnez les canaux où les boîtes mystères seront lancées.\n\n' +
        'Les boîtes apparaîtront **aléatoirement** parmi les canaux sélectionnés.\n\n' +
        `**Canaux disponibles:** ${textChannels.size}\n` +
        `**Canaux affichés:** ${Math.min(textChannels.size, 25)}`
      )
      .setColor('#3498db')
      .setFooter({ text: 'Sélectionnez au moins 1 canal' });

    await interaction.update({
      embeds: [embed],
      components: [row]
    });
  }

  /**
   * Wizard Étape 4 - Confirmation et lancement
   */
  async showCampaignWizardStep4(interaction, channelMode, targetChannels = null) {
    console.log('🔧 [AUDIT] showCampaignWizardStep4 appelé');
    console.log('🔧 [AUDIT] channelMode:', channelMode);
    console.log('🔧 [AUDIT] targetChannels:', targetChannels);
    console.log('🔧 [AUDIT] Récupération du thème...');

    // Récupérer le thème et le draft AVANT toute interaction
    const theme = await db.getActiveTheme(interaction.guildId);
    console.log('🔧 [AUDIT] Thème récupéré:', theme ? theme.name : 'null');

    const draft = this.campaignDrafts.get(interaction.user.id);
    console.log('🔧 [AUDIT] Draft récupéré:', draft ? 'OK' : 'NULL');

    if (!draft) {
      return interaction.update({
        content: '❌ Session expirée. Veuillez recommencer.',
        embeds: [],
        components: []
      });
    }

    // Sauvegarder le mode de canal
    draft.channelMode = channelMode;
    draft.targetChannels = targetChannels;
    this.campaignDrafts.set(interaction.user.id, draft);

    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('🚀 CRÉER UNE CAMPAGNE - Confirmation')
      .setDescription('Vérifiez les paramètres avant de lancer la campagne.')
      .setColor('#2ecc71');

    // Résumé de la configuration
    let summary = `**Thème:** ${theme.name}\n`;
    summary += `**Nom:** ${draft.name || 'Sans nom'}\n`;
    summary += `**Mode:** ${draft.mode.toUpperCase()}\n\n`;

    if (draft.mode === 'burst') {
      summary += `**📦 Configuration BURST:**\n`;
      summary += `• Nombre de boîtes: ${draft.totalCount}\n`;
      summary += `• Intervalle: ${draft.intervalSeconds}s\n`;
      summary += `• Durée totale: ~${Math.floor(draft.totalCount * draft.intervalSeconds / 60)}min\n\n`;
    } else {
      summary += `**📅 Configuration SCHEDULE:**\n`;
      summary += `• Durée: ${draft.durationDays} jour(s)\n`;
      summary += `• Fréquence: Toutes les ${draft.frequencyHours}h\n`;
      summary += `• Boîtes prévues: ~${Math.floor(draft.durationDays * 24 / draft.frequencyHours)}\n\n`;
    }

    summary += `**🎯 Canaux:**\n`;
    if (channelMode === 'random') {
      summary += '• Mode aléatoire\n';
    } else {
      summary += '• Canaux spécifiques:\n';
      if (targetChannels && targetChannels.length > 0) {
        for (const channelId of targetChannels) {
          const channel = interaction.guild.channels.cache.get(channelId);
          if (channel) {
            summary += `  - # ${channel.name}\n`;
          }
        }
      }
    }

    embed.setDescription(summary);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('campaign_wizard_confirm')
        .setLabel('✅ Lancer la Campagne')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('campaign_wizard_cancel')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );

    console.log('🔧 [AUDIT] Avant interaction.update() - Étape 4');
    console.log('🔧 [AUDIT] Interaction replied:', interaction.replied);
    console.log('🔧 [AUDIT] Interaction deferred:', interaction.deferred);

    try {
      const result = await interaction.update({
        embeds: [embed],
        components: [row]
      });
      console.log('✅ [AUDIT] interaction.update() réussi - Étape 4 !');
      return result;
    } catch (error) {
      console.error('❌ [AUDIT] Erreur dans interaction.update() - Étape 4:', error);
      console.error('❌ [AUDIT] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Confirmation finale et création de la campagne
   */
  async confirmAndCreateCampaign(interaction) {
    await interaction.deferUpdate();

    const draft = this.campaignDrafts.get(interaction.user.id);

    if (!draft) {
      return interaction.editReply({
        content: '❌ Session expirée.',
        embeds: [],
        components: []
      });
    }

    try {
      const theme = await db.getActiveTheme(interaction.guildId);

      // Créer la campagne dans la base de données
      const campaignData = {
        guild_id: interaction.guildId,
        theme_id: theme.id,
        name: draft.name,
        mode: draft.mode,
        channel_mode: draft.channelMode,
        target_channels: draft.targetChannels || [],
        admin_id: interaction.user.id
      };

      if (draft.mode === 'burst') {
        campaignData.total_count = draft.totalCount;
        campaignData.interval_seconds = draft.intervalSeconds;
      } else {
        campaignData.duration_days = draft.durationDays;
        campaignData.frequency_hours = draft.frequencyHours;
      }

      const campaign = await db.createCampaign(campaignData);

      // Logger l'action de création
      await audit.logCampaignCreated(
        interaction.guildId,
        interaction.user.id,
        {
          campaign_id: campaign.id,
          mode: draft.mode,
          channel_mode: draft.channelMode,
          timing: draft.mode === 'burst' ?
            `${draft.totalCount} gives every ${draft.intervalSeconds}s` :
            `Every ${draft.frequencyHours}h for ${draft.durationDays} days`
        }
      );

      // Lancer la campagne
      if (draft.mode === 'burst') {
        await campaignHandler.startBurstCampaign(interaction.client, campaign);
      } else {
        await campaignHandler.startScheduleCampaign(interaction.client, campaign);
      }

      // Nettoyer le draft
      this.campaignDrafts.delete(interaction.user.id);

      // Confirmation
      const embed = new EmbedBuilder()
        .setTitle('✅ CAMPAGNE LANCÉE !')
        .setDescription(
          `La campagne **#${campaign.id}** a été créée et démarrée avec succès.\n\n` +
          `**Mode:** ${draft.mode.toUpperCase()}\n` +
          `**Thème:** ${theme.name}\n\n` +
          `Utilisez le menu **📊 Gérer les Campagnes** pour suivre l'avancement.`
        )
        .setColor('#2ecc71')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_campaigns_manage')
          .setLabel('📊 Voir les Campagnes')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_back')
          .setLabel('🏠 Menu Principal')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Erreur lors de la création de la campagne:', error);

      return interaction.editReply({
        content: `❌ Erreur lors de la création: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Annuler la création de campagne
   */
  async cancelCampaignWizard(interaction) {
    await interaction.deferUpdate();

    this.campaignDrafts.delete(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('❌ Création Annulée')
      .setDescription('La création de campagne a été annulée.')
      .setColor('#95a5a6');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_back')
        .setLabel('🏠 Menu Principal')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  }
}

module.exports = new CampaignAdminHandler();
