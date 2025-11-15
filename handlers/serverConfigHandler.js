const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const BotRoleManager = require('../utils/botRoleManager');
const { getLoomixFooter } = require('../utils/footerHelper');

// Palette de couleurs 2025 avec emojis colorés
const COLOR_PALETTES = {
  basiques: [
    { name: '🔴 Rouge Classique', value: '#FF0000', emoji: '🔴' },
    { name: '🟠 Orange Vibrant', value: '#FFA500', emoji: '🟠' },
    { name: '🟡 Jaune Soleil', value: '#FFD700', emoji: '🟡' },
    { name: '🟢 Vert Émeraude', value: '#00FF00', emoji: '🟢' },
    { name: '🔵 Bleu Ciel', value: '#0099FF', emoji: '🔵' },
    { name: '🟣 Violet Améthyste', value: '#9B59B6', emoji: '🟣' },
    { name: '⚫ Noir Charbon', value: '#2C3E50', emoji: '⚫' },
    { name: '⚪ Blanc Pur', value: '#FFFFFF', emoji: '⚪' }
  ],
  tendances2025: [
    { name: '💎 Bleu Saphir', value: '#3498DB', emoji: '💎' },
    { name: '🌿 Vert Jade', value: '#2ECC71', emoji: '🌿' },
    { name: '🔥 Rouge Cardinal', value: '#E74C3C', emoji: '🔥' },
    { name: '🌸 Rose Sakura', value: '#FF69B4', emoji: '🌸' },
    { name: '🌊 Bleu Océan', value: '#1ABC9C', emoji: '🌊' },
    { name: '🍊 Orange Mandarine', value: '#F39C12', emoji: '🍊' },
    { name: '🌙 Bleu Nuit', value: '#34495E', emoji: '🌙' },
    { name: '☀️ Jaune Doré', value: '#F1C40F', emoji: '☀️' }
  ],
  pastel: [
    { name: '🧁 Rose Pastel', value: '#FFB3D9', emoji: '🧁' },
    { name: '🍰 Bleu Pastel', value: '#AED6F1', emoji: '🍰' },
    { name: '🍡 Violet Pastel', value: '#D7BDE2', emoji: '🍡' },
    { name: '🍃 Vert Pastel', value: '#ABEBC6', emoji: '🍃' },
    { name: '🍑 Pêche Pastel', value: '#FADBD8', emoji: '🍑' },
    { name: '🌈 Lavande Pastel', value: '#E8DAEF', emoji: '🌈' }
  ],
  vives: [
    { name: '⚡ Jaune Électrique', value: '#FFFF00', emoji: '⚡' },
    { name: '💚 Vert Néon', value: '#39FF14', emoji: '💚' },
    { name: '💙 Cyan Néon', value: '#00FFFF', emoji: '💙' },
    { name: '💜 Magenta Vif', value: '#FF00FF', emoji: '💜' },
    { name: '🧡 Orange Fluo', value: '#FF6600', emoji: '🧡' }
  ],
  professionnelles: [
    { name: '💼 Bleu Corporate', value: '#2C3E50', emoji: '💼' },
    { name: '📊 Gris Ardoise', value: '#95A5A6', emoji: '📊' },
    { name: '🎯 Rouge Entreprise', value: '#C0392B', emoji: '🎯' },
    { name: '📈 Vert Business', value: '#27AE60', emoji: '📈' },
    { name: '⭐ Or Premium', value: '#D4AF37', emoji: '⭐' }
  ]
};

/**
 * Trouver le nom d'une couleur à partir de son code hexadécimal
 * @param {string} hexColor - Code hexadécimal de la couleur
 * @returns {string} Nom de la couleur avec emoji, ou le code hex si non trouvé
 */
function getColorName(hexColor) {
  const upperHex = hexColor.toUpperCase();

  // Parcourir toutes les palettes
  for (const palette of Object.values(COLOR_PALETTES)) {
    const color = palette.find(c => c.value.toUpperCase() === upperHex);
    if (color) {
      // Retourner le nom sans l'emoji au début (on l'ajoute séparément)
      return color.name;
    }
  }

  // Si la couleur n'est pas dans les palettes, retourner le code hex
  return `Couleur personnalisée (${hexColor})`;
}

class ServerConfigHandler {
  /**
   * Afficher le menu principal de configuration
   */
  async showMainMenu(interaction, isUpdate = false) {
    const branding = await db.getGuildBranding(interaction.guildId);

    // Récupérer les noms des couleurs depuis la base de données
    const primaryColorInfo = await db.getColorByHex(branding.primary_color);
    const secondaryColorInfo = await db.getColorByHex(branding.secondary_color);

    const primaryColorText = primaryColorInfo
      ? `${primaryColorInfo.emoji} ${primaryColorInfo.name}`
      : branding.primary_color;

    const secondaryColorText = secondaryColorInfo
      ? `${secondaryColorInfo.emoji} ${secondaryColorInfo.name}`
      : branding.secondary_color;

    const embed = new EmbedBuilder()
      .setTitle('⚙️ CONFIGURATION DU SERVEUR')
      .setDescription(
        '**Personnalisez l\'apparence et le comportement du bot**\n\n' +
        'Configurez le branding, les paramètres et les modules de votre serveur.'
      )
      .addFields(
        {
          name: '🎨 Personnalisation',
          value:
            `> **Nom affiché:** ${branding.bot_display_name}\n` +
            `> **Couleur principale:** ${primaryColorText}\n` +
            `> **Couleur secondaire:** ${secondaryColorText}`,
          inline: false
        },
        {
          name: '📝 Paramètres',
          value:
            `> **Footer embeds:** ${branding.embed_footer_text}\n` +
            `> **Langue:** ${branding.language === 'fr' ? 'Français 🇫🇷' : branding.language}\n` +
            `> **Fuseau horaire:** ${branding.timezone}`,
          inline: false
        },
        {
          name: '🔧 Modules',
          value:
            `> **Modules actifs:** ${branding.modules_enabled.length}\n` +
            `> ${branding.modules_enabled.map(m => `• ${m} ✅`).join('\n> ')}`,
          inline: false
        }
      )
      .setColor(branding.secondary_color)
      .setFooter(await getLoomixFooter(interaction.guildId))
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('server_config_branding')
        .setLabel('Branding')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('server_config_parameters')
        .setLabel('Paramètres')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('server_config_modules')
        .setLabel('Modules')
        .setEmoji('🔧')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('server_config_close')
        .setLabel('Fermer')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    const payload = {
      embeds: [embed],
      components: [row]
    };

    // Si appelé depuis un bouton, utiliser update(), sinon editReply()
    if (isUpdate) {
      await interaction.update(payload);
    } else {
      await interaction.editReply(payload);
    }
  }

  /**
   * Afficher le menu de branding
   */
  async showBrandingMenu(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const statusText = branding.bot_status ?
      `${branding.bot_status.type || 'Custom'}: ${branding.bot_status.text || 'MysteryBox'}` :
      'Custom: MysteryBox';

    // Récupérer les noms des couleurs depuis la base de données
    const primaryColorInfo = await db.getColorByHex(branding.primary_color);
    const secondaryColorInfo = await db.getColorByHex(branding.secondary_color);

    const primaryColorText = primaryColorInfo
      ? `${primaryColorInfo.emoji} ${primaryColorInfo.name}`
      : branding.primary_color;

    const secondaryColorText = secondaryColorInfo
      ? `${secondaryColorInfo.emoji} ${secondaryColorInfo.name}`
      : branding.secondary_color;

    const embed = new EmbedBuilder()
      .setTitle('🎨 PERSONNALISATION DU BRANDING')
      .setDescription(
        '**Configurez l\'apparence visuelle du bot**\n\n' +
        'Personnalisez le nom, les couleurs, le statut et le footer affichés par le bot.'
      )
      .addFields(
        {
          name: '🏷️ Nom affiché du bot',
          value: `\`\`\`${branding.bot_display_name}\`\`\``,
          inline: false
        },
        {
          name: '🎭 Statut du bot',
          value: `\`\`\`${statusText}\`\`\``,
          inline: false
        },
        {
          name: '🎨 Couleurs',
          value:
            `**Couleur du bot:** ${primaryColorText}\n` +
            `**Couleur des embeds:** ${secondaryColorText}`,
          inline: false
        },
        {
          name: '📝 Footer des embeds',
          value: `\`\`\`${branding.embed_footer_text}\`\`\``,
          inline: false
        }
      )
      .setColor(branding.secondary_color)
      .setFooter(await getLoomixFooter(interaction.guildId));

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_bot_display_name')
        .setLabel('Modifier le nom')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_bot_status')
        .setLabel('Modifier le statut')
        .setEmoji('🎭')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_primary_color')
        .setLabel('Couleur du bot')
        .setEmoji('🤖')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_secondary_color')
        .setLabel('Couleur des embeds')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_footer_text')
        .setLabel('Modifier le footer')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('show_role_tutorial')
        .setLabel('Tutoriel : Positionner le rôle')
        .setEmoji('📚')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('server_config_back')
        .setLabel('Retour')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
      embeds: [embed],
      components: [row1, row2, row3]
    });
  }

  /**
   * Afficher le menu des paramètres
   */
  async showParametersMenu(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle('📝 PARAMÈTRES DU BOT')
      .setDescription(
        '**Configurez les paramètres généraux du bot**\n\n' +
        'Langue, fuseau horaire et autres réglages.'
      )
      .addFields(
        {
          name: '🌐 Langue',
          value: `\`\`\`${branding.language === 'fr' ? 'Français' : branding.language}\`\`\``,
          inline: true
        },
        {
          name: '🕐 Fuseau horaire',
          value: `\`\`\`${branding.timezone}\`\`\``,
          inline: true
        }
      )
      .setColor(branding.secondary_color)
      .setFooter(await getLoomixFooter(interaction.guildId));

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_language')
        .setLabel('Modifier la langue')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_timezone')
        .setLabel('Modifier le fuseau horaire')
        .setEmoji('🕐')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('server_config_back')
        .setLabel('Retour')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Afficher le menu des modules
   */
  async showModulesMenu(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle('🔧 GESTION DES MODULES')
      .setDescription(
        '**Activez ou désactivez les modules du bot**\n\n' +
        '⚠️ *Cette fonctionnalité sera disponible dans une future version*\n' +
        'Elle permettra d\'activer/désactiver les différents modules (MysteryBox, Economy, etc.)'
      )
      .addFields(
        {
          name: '✅ Modules actifs',
          value: branding.modules_enabled.map(m => `• ${m}`).join('\n') || 'Aucun',
          inline: false
        }
      )
      .setColor(branding.secondary_color)
      .setFooter(await getLoomixFooter(interaction.guildId));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('server_config_back')
        .setLabel('Retour')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
      embeds: [embed],
      components: [row]
    });
  }

  /**
   * Gérer les interactions avec les boutons
   */
  async handleButtonInteraction(interaction) {
    const { customId } = interaction;

    try {
      if (customId === 'server_config_branding') {
        await this.showBrandingMenu(interaction);
      }
      else if (customId === 'server_config_parameters') {
        await this.showParametersMenu(interaction);
      }
      else if (customId === 'server_config_modules') {
        await this.showModulesMenu(interaction);
      }
      else if (customId === 'server_config_back') {
        await this.showMainMenu(interaction, true);
      }
      else if (customId === 'server_config_close') {
        await interaction.update({
          content: '✅ Configuration fermée.',
          embeds: [],
          components: []
        });
      }
      // Modals d'édition
      else if (customId === 'edit_bot_display_name') {
        await this.showEditBotNameModal(interaction);
      }
      else if (customId === 'edit_bot_status') {
        await this.showEditBotStatusModal(interaction);
      }
      else if (customId === 'edit_primary_color') {
        await this.showColorPalette(interaction, 'primary');
      }
      else if (customId === 'edit_secondary_color') {
        await this.showColorPalette(interaction, 'secondary');
      }
      else if (customId === 'edit_primary_color_custom') {
        await this.showEditPrimaryColorModal(interaction);
      }
      else if (customId === 'edit_secondary_color_custom') {
        await this.showEditSecondaryColorModal(interaction);
      }
      else if (customId === 'edit_footer_text') {
        await this.showEditFooterModal(interaction);
      }
      else if (customId === 'show_role_tutorial') {
        await this.showRoleTutorial(interaction);
      }
      else if (customId === 'edit_language') {
        await this.showEditLanguageModal(interaction);
      }
      else if (customId === 'edit_timezone') {
        await this.showEditTimezoneModal(interaction);
      }
    } catch (error) {
      console.error('❌ Erreur dans handleButtonInteraction:', error);

      // Vérifier si l'interaction a déjà été répondue
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: '❌ Une erreur est survenue.',
            flags: 64
          });
        } catch (replyError) {
          console.error('🔴 Impossible de répondre à l\'interaction:', replyError.message);
        }
      }
    }
  }

  /**
   * Afficher la palette de couleurs graphique
   */
  async showColorPalette(interaction, colorType) {
    const branding = await db.getGuildBranding(interaction.guildId);
    const currentColor = colorType === 'primary' ? branding.primary_color : branding.secondary_color;
    const title = colorType === 'primary' ? 'Couleur du Bot' : 'Couleur des Embeds';

    const embed = new EmbedBuilder()
      .setTitle(`🎨 Sélectionner la ${title}`)
      .setDescription(
        `**Couleur actuelle:** ${currentColor}\n\n` +
        '**Choisissez une couleur dans les catégories ci-dessous:**\n' +
        '• Couleurs basiques\n' +
        '• Tendances 2025\n' +
        '• Palette pastel\n' +
        '• Couleurs vives\n' +
        '• Couleurs professionnelles\n\n' +
        '*Ou utilisez le bouton "Code Hex personnalisé" pour entrer votre propre couleur*'
      )
      .setColor(currentColor);

    // Créer les select menus pour chaque catégorie
    const selectRows = [];

    // Basiques + Tendances 2025 (combinées pour libérer une row)
    const basiquesTendancesSelect = new StringSelectMenuBuilder()
      .setCustomId(`color_select_${colorType}_basiques_tendances`)
      .setPlaceholder('🎨 Basiques | ✨ Tendances 2025')
      .addOptions([
        ...COLOR_PALETTES.basiques.map(color => ({
          label: color.name,
          value: color.value,
          description: color.value,
          emoji: color.emoji
        })),
        ...COLOR_PALETTES.tendances2025.map(color => ({
          label: color.name,
          value: color.value,
          description: color.value,
          emoji: color.emoji
        }))
      ]);
    selectRows.push(new ActionRowBuilder().addComponents(basiquesTendancesSelect));

    // Pastel
    const pastelSelect = new StringSelectMenuBuilder()
      .setCustomId(`color_select_${colorType}_pastel`)
      .setPlaceholder('🌸 Couleurs pastel')
      .addOptions(COLOR_PALETTES.pastel.map(color => ({
        label: color.name,
        value: color.value,
        description: color.value,
        emoji: color.emoji
      })));
    selectRows.push(new ActionRowBuilder().addComponents(pastelSelect));

    // Vives
    const vivesSelect = new StringSelectMenuBuilder()
      .setCustomId(`color_select_${colorType}_vives`)
      .setPlaceholder('⚡ Couleurs vives')
      .addOptions(COLOR_PALETTES.vives.map(color => ({
        label: color.name,
        value: color.value,
        description: color.value,
        emoji: color.emoji
      })));
    selectRows.push(new ActionRowBuilder().addComponents(vivesSelect));

    // Professionnelles
    const professionnellesSelect = new StringSelectMenuBuilder()
      .setCustomId(`color_select_${colorType}_professionnelles`)
      .setPlaceholder('💼 Couleurs professionnelles')
      .addOptions(COLOR_PALETTES.professionnelles.map(color => ({
        label: color.name,
        value: color.value,
        description: color.value,
        emoji: color.emoji
      })));
    selectRows.push(new ActionRowBuilder().addComponents(professionnellesSelect));

    // Boutons (Code custom + Retour)
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_${colorType}_color_custom`)
        .setLabel('Code Hex personnalisé')
        .setEmoji('🔢')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('server_config_branding')
        .setLabel('Retour')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary)
    );
    selectRows.push(buttonRow);

    await interaction.update({
      embeds: [embed],
      components: selectRows
    });
  }

  /**
   * Gérer les sélections de menu
   */
  async handleSelectMenu(interaction) {
    const { customId, values } = interaction;

    try {
      // Color selection
      if (customId.startsWith('color_select_')) {
        const parts = customId.split('_');
        const colorType = parts[2]; // 'primary' or 'secondary'
        const selectedColor = values[0];

        const fieldName = colorType === 'primary' ? 'primary_color' : 'secondary_color';
        await db.updateGuildBranding(interaction.guildId, {
          [fieldName]: selectedColor
        });

        const colorName = getColorName(selectedColor);
        const colorTypeLabel = colorType === 'primary' ? 'Couleur du bot' : 'Couleur des embeds';

        const embed = new EmbedBuilder()
          .setTitle(`✅ ${colorTypeLabel} mise à jour`)
          .setDescription(`**${colorName}**`)
          .setColor(selectedColor)
          .addFields({
            name: 'Code hexadécimal',
            value: `\`${selectedColor}\``,
            inline: true
          });

        // Si c'est la couleur principale, appliquer au rôle du bot
        if (colorType === 'primary') {
          try {
            const result = await BotRoleManager.changeBotRoleColor(interaction.guild, selectedColor);
            embed.addFields(
              {
                name: '🎨 Rôle Discord',
                value: `✅ Rôle **${result.role.name}** mis à jour`,
                inline: false
              },
              {
                name: '⚠️ Membres affectés',
                value: `**${result.memberCount}** membre(s)`,
                inline: true
              }
            );
            embed.setFooter({ text: '💡 Pour que la couleur soit visible, assurez-vous que le rôle est bien positionné dans la hiérarchie.' });
          } catch (error) {
            console.error('❌ Erreur lors de la mise à jour du rôle:', error);
            embed.addFields({
              name: '⚠️ Avertissement',
              value: `Couleur sauvegardée mais non appliquée au rôle Discord.\nRaison: ${error.message}`,
              inline: false
            });
          }
        }

        await interaction.reply({
          embeds: [embed],
          flags: 64
        });
      }
    } catch (error) {
      console.error('❌ Erreur dans handleSelectMenu:', error);

      // Vérifier si l'interaction a déjà été répondue
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: '❌ Une erreur est survenue.',
            flags: 64
          });
        } catch (replyError) {
          console.error('🔴 Impossible de répondre à l\'interaction:', replyError.message);
        }
      }
    }
  }

  // ==================== MODALS ====================


  async showEditBotStatusModal(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);
    const currentStatus = branding.bot_status || { type: 'Custom', text: 'MysteryBox' };

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_bot_status')
      .setTitle('🎭 Modifier le statut du bot');

    const typeInput = new TextInputBuilder()
      .setCustomId('status_type_input')
      .setLabel('Type (Playing/Watching/Listening/Custom)')
      .setStyle(TextInputStyle.Short)
      .setValue(currentStatus.type || 'Custom')
      .setPlaceholder('Custom')
      .setRequired(true)
      .setMaxLength(20);

    const textInput = new TextInputBuilder()
      .setCustomId('status_text_input')
      .setLabel('Texte du statut')
      .setStyle(TextInputStyle.Short)
      .setValue(currentStatus.text || 'MysteryBox')
      .setPlaceholder('MysteryBox')
      .setRequired(true)
      .setMaxLength(128);

    modal.addComponents(
      new ActionRowBuilder().addComponents(typeInput),
      new ActionRowBuilder().addComponents(textInput)
    );

    await interaction.showModal(modal);
  }
  async showEditBotNameModal(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_bot_name')
      .setTitle('🏷️ Modifier le nom du bot');

    const nameInput = new TextInputBuilder()
      .setCustomId('bot_name_input')
      .setLabel('Nom affiché du bot')
      .setStyle(TextInputStyle.Short)
      .setValue(branding.bot_display_name)
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput)
    );

    await interaction.showModal(modal);
  }

  async showEditPrimaryColorModal(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_primary_color')
      .setTitle('🎨 Modifier la couleur principale');

    const colorInput = new TextInputBuilder()
      .setCustomId('primary_color_input')
      .setLabel('Code hexadécimal (ex: #3498db)')
      .setStyle(TextInputStyle.Short)
      .setValue(branding.primary_color)
      .setPlaceholder('#3498db')
      .setRequired(true)
      .setMaxLength(7);

    modal.addComponents(
      new ActionRowBuilder().addComponents(colorInput)
    );

    await interaction.showModal(modal);
  }

  async showEditSecondaryColorModal(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_secondary_color')
      .setTitle('🎨 Modifier la couleur secondaire');

    const colorInput = new TextInputBuilder()
      .setCustomId('secondary_color_input')
      .setLabel('Code hexadécimal (ex: #2ecc71)')
      .setStyle(TextInputStyle.Short)
      .setValue(branding.secondary_color)
      .setPlaceholder('#2ecc71')
      .setRequired(true)
      .setMaxLength(7);

    modal.addComponents(
      new ActionRowBuilder().addComponents(colorInput)
    );

    await interaction.showModal(modal);
  }

  async showEditFooterModal(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_footer')
      .setTitle('📝 Modifier le footer');

    const footerInput = new TextInputBuilder()
      .setCustomId('footer_text_input')
      .setLabel('Texte du footer des embeds')
      .setStyle(TextInputStyle.Short)
      .setValue(branding.embed_footer_text)
      .setRequired(true)
      .setMaxLength(200);

    modal.addComponents(
      new ActionRowBuilder().addComponents(footerInput)
    );

    await interaction.showModal(modal);
  }

  async showEditLanguageModal(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_language')
      .setTitle('🌐 Modifier la langue');

    const languageInput = new TextInputBuilder()
      .setCustomId('language_input')
      .setLabel('Code de langue (fr, en, es, de...)')
      .setStyle(TextInputStyle.Short)
      .setValue(branding.language)
      .setPlaceholder('fr')
      .setRequired(true)
      .setMaxLength(5);

    modal.addComponents(
      new ActionRowBuilder().addComponents(languageInput)
    );

    await interaction.showModal(modal);
  }

  async showEditTimezoneModal(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_timezone')
      .setTitle('🕐 Modifier le fuseau horaire');

    const timezoneInput = new TextInputBuilder()
      .setCustomId('timezone_input')
      .setLabel('Fuseau horaire (ex: Europe/Paris)')
      .setStyle(TextInputStyle.Short)
      .setValue(branding.timezone)
      .setPlaceholder('Europe/Paris')
      .setRequired(true)
      .setMaxLength(50);

    modal.addComponents(
      new ActionRowBuilder().addComponents(timezoneInput)
    );

    await interaction.showModal(modal);
  }

  // ==================== MODAL SUBMISSIONS ====================

  async handleModalSubmit(interaction) {
    const { customId } = interaction;

    try {
      await interaction.deferReply({ flags: 64 });

      if (customId === 'modal_edit_bot_status') {
        const newType = interaction.fields.getTextInputValue('status_type_input');
        const newText = interaction.fields.getTextInputValue('status_text_input');

        // Valider le type
        const validTypes = ['Playing', 'Watching', 'Listening', 'Competing', 'Custom'];
        const finalType = validTypes.includes(newType) ? newType : 'Custom';

        await db.updateGuildBranding(interaction.guildId, {
          bot_status: { type: finalType, text: newText }
        });

        // Mettre à jour le statut du bot
        await this.updateBotPresence(interaction.client, finalType, newText);

        await interaction.editReply({
          content: `✅ Statut du bot mis à jour: **${finalType}: ${newText}**`
        });
      }
      else if (customId === 'modal_edit_bot_name') {
        const newName = interaction.fields.getTextInputValue('bot_name_input');
        await db.updateGuildBranding(interaction.guildId, {
          bot_display_name: newName
        });

        // Mettre à jour le nickname du bot
        await this.updateBotNickname(interaction.guild, newName);

        await interaction.editReply({
          content: `✅ Nom du bot mis à jour: **${newName}**`
        });
      }
      else if (customId === 'modal_edit_primary_color') {
        const newColor = interaction.fields.getTextInputValue('primary_color_input');

        // Valider le format hex
        if (!/^#[0-9A-F]{6}$/i.test(newColor)) {
          return interaction.editReply({
            content: '❌ Format de couleur invalide. Utilisez le format hexadécimal (#RRGGBB)'
          });
        }

        await db.updateGuildBranding(interaction.guildId, {
          primary_color: newColor
        });

        const colorName = getColorName(newColor);

        const embed = new EmbedBuilder()
          .setTitle('✅ Couleur du bot mise à jour')
          .setDescription(`**${colorName}**`)
          .setColor(newColor)
          .addFields({
            name: 'Code hexadécimal',
            value: `\`${newColor}\``,
            inline: true
          });

        // Appliquer au rôle du bot
        try {
          const result = await BotRoleManager.changeBotRoleColor(interaction.guild, newColor);
          embed.addFields(
            {
              name: '🎨 Rôle Discord',
              value: `✅ Rôle **${result.role.name}** mis à jour`,
              inline: false
            },
            {
              name: '⚠️ Membres affectés',
              value: `**${result.memberCount}** membre(s)`,
              inline: true
            }
          );
          embed.setFooter({ text: '💡 Pour que la couleur soit visible, assurez-vous que le rôle est bien positionné dans la hiérarchie.' });
        } catch (error) {
          console.error('❌ Erreur lors de la mise à jour du rôle:', error);
          embed.addFields({
            name: '⚠️ Avertissement',
            value: `Couleur sauvegardée mais non appliquée au rôle Discord.\nRaison: ${error.message}`,
            inline: false
          });
        }

        await interaction.editReply({
          embeds: [embed]
        });
      }
      else if (customId === 'modal_edit_secondary_color') {
        const newColor = interaction.fields.getTextInputValue('secondary_color_input');

        if (!/^#[0-9A-F]{6}$/i.test(newColor)) {
          return interaction.editReply({
            content: '❌ Format de couleur invalide. Utilisez le format hexadécimal (#RRGGBB)'
          });
        }

        await db.updateGuildBranding(interaction.guildId, {
          secondary_color: newColor
        });

        const colorName = getColorName(newColor);
        const embed = new EmbedBuilder()
          .setTitle('✅ Couleur des embeds mise à jour')
          .setDescription(`**${colorName}**`)
          .setColor(newColor)
          .addFields({
            name: 'Code hexadécimal',
            value: `\`${newColor}\``,
            inline: true
          });

        await interaction.editReply({
          embeds: [embed]
        });
      }
      else if (customId === 'modal_edit_footer') {
        const newFooter = interaction.fields.getTextInputValue('footer_text_input');
        await db.updateGuildBranding(interaction.guildId, {
          embed_footer_text: newFooter
        });

        await interaction.editReply({
          content: `✅ Footer mis à jour: **${newFooter}**`
        });
      }
      else if (customId === 'modal_edit_language') {
        const newLanguage = interaction.fields.getTextInputValue('language_input');
        await db.updateGuildBranding(interaction.guildId, {
          language: newLanguage
        });

        await interaction.editReply({
          content: `✅ Langue mise à jour: **${newLanguage}**`
        });
      }
      else if (customId === 'modal_edit_timezone') {
        const newTimezone = interaction.fields.getTextInputValue('timezone_input');
        await db.updateGuildBranding(interaction.guildId, {
          timezone: newTimezone
        });

        await interaction.editReply({
          content: `✅ Fuseau horaire mis à jour: **${newTimezone}**`
        });
      }
    } catch (error) {
      console.error('❌ Erreur dans handleModalSubmit:', error);
      await interaction.editReply({
        content: '❌ Une erreur est survenue lors de la mise à jour.'
      });
    }
  }


  /**
   * Afficher le tutoriel de positionnement du rôle
   */
  async showRoleTutorial(interaction) {
    try {
      const tutorial = await BotRoleManager.getRolePositionTutorial(interaction.guild);

      await interaction.reply({
        content: tutorial,
        flags: 64
      });
    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage du tutoriel:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'affichage du tutoriel.',
        flags: 64
      });
    }
  }

  /**
   * Mettre à jour le statut/présence du bot
   */
  async updateBotPresence(client, type, text) {
    try {
      const activityType = {
        'Playing': 0,
        'Streaming': 1,
        'Listening': 2,
        'Watching': 3,
        'Custom': 4,
        'Competing': 5
      }[type] || 4;

      await client.user.setPresence({
        activities: [{
          name: text,
          type: activityType
        }],
        status: 'online'
      });

      console.log(`✅ Statut du bot mis à jour: ${type} - ${text}`);
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du statut:', error.message);
    }
  }
  /**
   * Mettre à jour le nickname du bot sur le serveur
   */
  async updateBotNickname(guild, displayName) {
    try {
      await guild.members.me.setNickname(displayName);
      console.log(`✅ Nickname du bot mis à jour sur ${guild.name}: ${displayName}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour du nickname sur ${guild.name}:`, error.message);
    }
  }
}

module.exports = ServerConfigHandler;
