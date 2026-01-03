/**
 * Handler pour la configuration du système d'équité
 * Permet de configurer les délais d'ouverture des Mystery Box selon la progression
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const db = require('../utils/database-pg');

class FairnessConfigHandler {

  /**
   * Router principal pour toutes les interactions fairness
   */
  async handleInteraction(interaction) {
    const customId = interaction.customId;

    // Boutons toggle
    if (customId === 'fairness_toggle_enabled') {
      return this.toggleEnabled(interaction);
    }
    if (customId === 'fairness_toggle_countdown') {
      return this.toggleCountdown(interaction);
    }

    // Bouton modifier paliers
    if (customId === 'fairness_edit_steps') {
      return this.showEditStepsModal(interaction);
    }

    // Bouton gérer exemptions
    if (customId === 'fairness_manage_exemptions') {
      return this.showExemptionsMenu(interaction);
    }

    // Bouton retour
    if (customId === 'fairness_back') {
      return this.showMainMenu(interaction);
    }

    // Select menu des rôles exemptés
    if (customId === 'fairness_exempt_roles_select') {
      return this.handleExemptRolesSelect(interaction);
    }

    // Bouton clear exemptions
    if (customId === 'fairness_clear_exemptions') {
      return this.clearExemptions(interaction);
    }

    console.warn(`⚠️ Interaction fairness non gérée: ${customId}`);
  }

  /**
   * Affiche le menu principal du système d'équité
   */
  async showMainMenu(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;

    // Récupérer ou créer la config
    let config = await db.getFairnessConfig(guildId);
    if (!config) {
      config = await db.upsertFairnessConfig(guildId, {});
    }

    const embed = this.buildMainEmbed(config, interaction.guild);
    const components = this.buildMainComponents(config);

    return interaction.editReply({
      embeds: [embed],
      components: components
    });
  }

  /**
   * Construit l'embed principal
   */
  buildMainEmbed(config, guild) {
    const enabledEmoji = config.enabled ? '✅' : '⬜';
    const countdownEmoji = config.show_countdown ? '✅' : '⬜';

    // Formater les paliers
    const steps = config.steps || [];
    let stepsText = '';
    for (const step of steps) {
      const delayText = step.delay === 0 ? 'Immédiat' : `${step.delay}s`;
      if (step.min === step.max) {
        stepsText += `• **${step.min}%** → ${delayText}\n`;
      } else {
        stepsText += `• **${step.min}% - ${step.max}%** → ${delayText}\n`;
      }
    }
    if (!stepsText) {
      stepsText = '*Aucun palier configuré*';
    }

    // Formater les rôles exemptés
    const exemptRoles = config.exempt_roles || [];
    let rolesText = '';
    if (exemptRoles.length > 0) {
      rolesText = exemptRoles.map(roleId => `<@&${roleId}>`).join(', ');
    } else {
      rolesText = '*Aucun rôle exempté*';
    }

    const embed = new EmbedBuilder()
      .setTitle('⚖️ Système d\'Équité')
      .setDescription(
        'Ce système permet de donner un avantage aux joueurs avec une collection incomplète.\n' +
        'Les joueurs avec une progression élevée auront un délai avant de pouvoir ouvrir les Mystery Box.'
      )
      .addFields(
        {
          name: '📊 État du système',
          value: `${enabledEmoji} Système activé\n${countdownEmoji} Afficher compte à rebours`,
          inline: true
        },
        {
          name: '👑 Rôles exemptés',
          value: rolesText,
          inline: true
        },
        {
          name: '📈 Paliers de délai',
          value: stepsText,
          inline: false
        }
      )
      .setColor(config.enabled ? '#2ecc71' : '#95a5a6')
      .setFooter({ text: 'Plus la collection est complète, plus le délai est long' });

    return embed;
  }

  /**
   * Construit les composants du menu principal
   */
  buildMainComponents(config) {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fairness_toggle_enabled')
        .setLabel(config.enabled ? '⬜ Désactiver' : '✅ Activer')
        .setStyle(config.enabled ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('fairness_toggle_countdown')
        .setLabel(config.show_countdown ? '⏱️ Masquer compteur' : '⏱️ Afficher compteur')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fairness_edit_steps')
        .setLabel('📊 Modifier paliers')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('fairness_manage_exemptions')
        .setLabel('👑 Gérer exemptions')
        .setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_back')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2, row3];
  }

  /**
   * Toggle l'état du système
   */
  async toggleEnabled(interaction) {
    await interaction.deferUpdate();

    const config = await db.toggleFairnessEnabled(interaction.guildId);

    console.log(`⚖️ Système d'équité ${config.enabled ? 'activé' : 'désactivé'} sur ${interaction.guild.name}`);

    const embed = this.buildMainEmbed(config, interaction.guild);
    const components = this.buildMainComponents(config);

    return interaction.editReply({
      embeds: [embed],
      components: components
    });
  }

  /**
   * Toggle l'affichage du compte à rebours
   */
  async toggleCountdown(interaction) {
    await interaction.deferUpdate();

    const config = await db.toggleFairnessCountdown(interaction.guildId);

    console.log(`⏱️ Compte à rebours ${config.show_countdown ? 'activé' : 'désactivé'} sur ${interaction.guild.name}`);

    const embed = this.buildMainEmbed(config, interaction.guild);
    const components = this.buildMainComponents(config);

    return interaction.editReply({
      embeds: [embed],
      components: components
    });
  }

  /**
   * Affiche le modal de modification des paliers
   */
  async showEditStepsModal(interaction) {
    const config = await db.getFairnessConfig(interaction.guildId);
    const steps = config?.steps || [];

    // Convertir les paliers en texte éditable
    let stepsText = '';
    for (const step of steps) {
      stepsText += `${step.min}-${step.max}:${step.delay}\n`;
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_fairness_steps')
      .setTitle('📊 Modifier les paliers');

    const stepsInput = new TextInputBuilder()
      .setCustomId('steps_input')
      .setLabel('Paliers (format: min-max:délai)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(stepsText.trim())
      .setPlaceholder('0-25:0\n26-50:5\n51-75:10\n76-99:12\n100-100:15')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(stepsInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Gère la soumission du modal des paliers
   */
  async handleStepsModalSubmit(interaction) {
    await interaction.deferUpdate();

    try {
      const stepsText = interaction.fields.getTextInputValue('steps_input');
      const lines = stepsText.trim().split('\n');

      const steps = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Format attendu: min-max:delay
        const match = trimmed.match(/^(\d+)-(\d+):(\d+)$/);
        if (!match) {
          return interaction.followUp({
            content: `❌ Format invalide: "${trimmed}"\n\nFormat attendu: \`min-max:délai\`\nExemple: \`0-25:0\``,
            flags: 64
          });
        }

        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        const delay = parseInt(match[3]);

        if (min > max) {
          return interaction.followUp({
            content: `❌ Erreur: min (${min}) > max (${max}) sur la ligne "${trimmed}"`,
            flags: 64
          });
        }

        if (min < 0 || max > 100) {
          return interaction.followUp({
            content: `❌ Les pourcentages doivent être entre 0 et 100`,
            flags: 64
          });
        }

        steps.push({ min, max, delay });
      }

      // Trier par min
      steps.sort((a, b) => a.min - b.min);

      // Sauvegarder
      const config = await db.updateFairnessSteps(interaction.guildId, steps);

      console.log(`📊 Paliers d'équité mis à jour sur ${interaction.guild.name}:`, steps);

      const embed = this.buildMainEmbed(config, interaction.guild);
      const components = this.buildMainComponents(config);

      return interaction.editReply({
        embeds: [embed],
        components: components
      });

    } catch (error) {
      console.error('❌ Erreur handleStepsModalSubmit:', error);
      return interaction.followUp({
        content: `❌ Erreur: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Affiche le menu de gestion des exemptions
   */
  async showExemptionsMenu(interaction, alreadyDeferred = false) {
    if (!alreadyDeferred) {
      await interaction.deferUpdate();
    }

    const config = await db.getFairnessConfig(interaction.guildId);
    const exemptRoles = config?.exempt_roles || [];

    let description = 'Sélectionne les rôles qui seront **exemptés** du système d\'équité.\n';
    description += 'Ces joueurs pourront toujours ouvrir immédiatement.\n\n';

    if (exemptRoles.length > 0) {
      description += '**Rôles actuellement exemptés:**\n';
      description += exemptRoles.map(roleId => `• <@&${roleId}>`).join('\n');
    } else {
      description += '*Aucun rôle exempté actuellement*';
    }

    const embed = new EmbedBuilder()
      .setTitle('👑 Gestion des exemptions')
      .setDescription(description)
      .setColor('#f1c40f');

    const row1 = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('fairness_exempt_roles_select')
        .setPlaceholder('Sélectionner les rôles exemptés')
        .setMinValues(0)
        .setMaxValues(10)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fairness_clear_exemptions')
        .setLabel('🗑️ Supprimer toutes les exemptions')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(exemptRoles.length === 0),
      new ButtonBuilder()
        .setCustomId('fairness_back')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Gère la sélection des rôles exemptés
   */
  async handleExemptRolesSelect(interaction) {
    await interaction.deferUpdate();

    const selectedRoles = interaction.values; // Array d'IDs de rôles

    await db.updateFairnessExemptRoles(interaction.guildId, selectedRoles);

    console.log(`👑 Rôles exemptés mis à jour sur ${interaction.guild.name}:`, selectedRoles);

    // Revenir au menu principal
    const config = await db.getFairnessConfig(interaction.guildId);
    const embed = this.buildMainEmbed(config, interaction.guild);
    const components = this.buildMainComponents(config);

    return interaction.editReply({
      embeds: [embed],
      components: components
    });
  }

  /**
   * Supprime toutes les exemptions
   */
  async clearExemptions(interaction) {
    await interaction.deferUpdate();

    await db.updateFairnessExemptRoles(interaction.guildId, []);

    console.log(`🗑️ Exemptions supprimées sur ${interaction.guild.name}`);

    // Revenir au menu des exemptions (déjà déféré)
    return this.showExemptionsMenu(interaction, true);
  }
}

module.exports = new FairnessConfigHandler();
