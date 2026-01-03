/**
 * Handler pour la configuration des frames (collectibles et profil)
 *
 * Frames de Collectibles (3 par thème):
 * - Rare (Level 2), Epic (Level 3), Legendary (Level 4)
 * - Configurable par thème avec fallback sur default_collectible_frames
 *
 * Frames de Profil (2 par thème):
 * - Frame 1 (Argent): Condition par défaut = 5 collectibles niveau 3+
 * - Frame 2 (Or): Condition par défaut = 1 légendaire niveau 4
 * - Configurable par thème avec fallback sur default_profile_frames
 * - Les frames débloquées sont cross-serveur/cross-thème
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../utils/database-pg');

class FramesConfigHandler {

  /**
   * Point d'entrée principal pour les interactions du handler
   */
  async handleInteraction(interaction) {
    const customId = interaction.customId;

    try {
      // Menu principal des frames
      if (customId === 'admin_frames' || customId === 'frames_config_back') {
        await interaction.deferUpdate();
        return this.showMainMenu(interaction);
      }

      // Sous-menus
      if (customId === 'frames_collectibles_menu') {
        await interaction.deferUpdate();
        return this.showCollectibleFramesMenu(interaction);
      }

      if (customId === 'frames_profile_menu') {
        await interaction.deferUpdate();
        return this.showProfileFramesMenu(interaction);
      }

      // Configuration frames de collectibles
      if (customId === 'frames_collectible_rare') {
        return this.showCollectibleFrameModal(interaction, 'rare');
      }
      if (customId === 'frames_collectible_epic') {
        return this.showCollectibleFrameModal(interaction, 'epic');
      }
      if (customId === 'frames_collectible_legendary') {
        return this.showCollectibleFrameModal(interaction, 'legendary');
      }
      if (customId === 'frames_collectible_reset') {
        await interaction.deferUpdate();
        return this.resetCollectibleFrames(interaction);
      }

      // Configuration frames de profil
      if (customId === 'frames_profile_1') {
        return this.showProfileFrameModal(interaction, 1);
      }
      if (customId === 'frames_profile_2') {
        return this.showProfileFrameModal(interaction, 2);
      }
      if (customId === 'frames_profile_condition_1') {
        await interaction.deferUpdate();
        return this.showConditionSelector(interaction, 1);
      }
      if (customId === 'frames_profile_condition_2') {
        await interaction.deferUpdate();
        return this.showConditionSelector(interaction, 2);
      }
      if (customId.startsWith('frames_condition_select_')) {
        await interaction.deferUpdate();
        const frameNumber = parseInt(customId.split('_')[3]);
        return this.handleConditionSelect(interaction, frameNumber);
      }
      if (customId === 'frames_profile_reset') {
        await interaction.deferUpdate();
        return this.resetProfileFrames(interaction);
      }

      // Modals
      if (customId.startsWith('modal_frame_collectible_')) {
        await interaction.deferReply({ flags: 64 });
        const rarity = customId.replace('modal_frame_collectible_', '');
        return this.handleCollectibleFrameModal(interaction, rarity);
      }

      if (customId.startsWith('modal_frame_profile_')) {
        await interaction.deferReply({ flags: 64 });
        const frameNumber = parseInt(customId.replace('modal_frame_profile_', ''));
        return this.handleProfileFrameModal(interaction, frameNumber);
      }

      // Le modal de condition a été remplacé par un select menu (frames_condition_select_X)

    } catch (error) {
      console.error('🔴 Erreur dans FramesConfigHandler:', error);

      const errorMsg = { content: `❌ Erreur: ${error.message}`, flags: 64 };
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(errorMsg);
      } else {
        return interaction.reply(errorMsg);
      }
    }
  }

  /**
   * Menu principal de configuration des frames
   */
  async showMainMenu(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif. Veuillez d\'abord activer un thème.',
        flags: 64
      });
    }

    // Récupérer les frames actuelles
    const collectibleFrames = await db.getThemeCollectibleFrames(guildId, theme.id);
    const profileFrames = await db.getThemeProfileFrames(guildId, theme.id);

    // Déterminer si c'est du fallback ou configuré
    const collectiblesConfigured = await this.areCollectibleFramesConfigured(guildId, theme.id);
    const profileConfigured = await this.areProfileFramesConfigured(guildId, theme.id);

    const embed = new EmbedBuilder()
      .setTitle('🖼️ Configuration des Frames')
      .setDescription(
        `**Thème actif:** ${theme.name}\n\n` +
        `Les frames personnalisent l'apparence des collectibles et des profils joueurs.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `**🎴 Frames de Collectibles** ${collectiblesConfigured ? '✅ Configurées' : '⚙️ Par défaut'}\n` +
        `Bordures autour des cartes de collectibles selon leur niveau d'évolution.\n` +
        `• Level 2 → Frame Rare\n` +
        `• Level 3 → Frame Épique\n` +
        `• Level 4 → Frame Légendaire\n\n` +
        `**👤 Frames de Profil** ${profileConfigured ? '✅ Configurées' : '⚙️ Par défaut'}\n` +
        `Cadres décoratifs pour les profils des joueurs, débloquables en accomplissant des objectifs.\n` +
        `• Frame 1 (Argent): ${profileFrames[0]?.name || 'Non configurée'}\n` +
        `• Frame 2 (Or): ${profileFrames[1]?.name || 'Non configurée'}`
      )
      .setColor('#9b59b6')
      .setFooter({ text: '💡 Les frames par défaut s\'appliquent si aucune configuration spécifique' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('frames_collectibles_menu')
        .setLabel('🎴 Frames Collectibles')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('frames_profile_menu')
        .setLabel('👤 Frames de Profil')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_themes')
        .setLabel('◀️ Retour aux Thèmes')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Menu de configuration des frames de collectibles (3 frames)
   */
  async showCollectibleFramesMenu(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    // Récupérer frames actuelles du thème
    const themeFrames = await db.queryAll(
      `SELECT * FROM theme_collectible_frames WHERE guild_id = $1 AND theme_id = $2`,
      [guildId, theme.id]
    );

    // Récupérer frames par défaut
    const defaultFrames = await db.getDefaultCollectibleFrames();

    // Créer un map des frames configurées
    const configuredFrames = {};
    themeFrames.forEach(f => { configuredFrames[f.rarity] = f; });

    // Frame affichée = configurée ou défaut
    const getFrameInfo = (rarity) => {
      const configured = configuredFrames[rarity];
      const defaultFrame = defaultFrames.find(f => f.rarity === rarity);

      if (configured) {
        return { url: configured.frame_url, isDefault: false };
      } else if (defaultFrame) {
        return { url: defaultFrame.frame_url, isDefault: true };
      }
      return { url: 'Non définie', isDefault: true };
    };

    const rareInfo = getFrameInfo('rare');
    const epicInfo = getFrameInfo('epic');
    const legendaryInfo = getFrameInfo('legendary');

    const embed = new EmbedBuilder()
      .setTitle('🎴 Frames de Collectibles')
      .setDescription(
        `**Thème:** ${theme.name}\n\n` +
        `Ces frames s'affichent autour des cartes de collectibles selon leur niveau d'évolution.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`
      )
      .setColor('#3498db')
      .addFields(
        {
          name: `🔵 Frame Rare (Level 2) ${rareInfo.isDefault ? '⚙️ Défaut' : '✅ Personnalisée'}`,
          value: `\`${this.truncateUrl(rareInfo.url)}\``,
          inline: false
        },
        {
          name: `🟣 Frame Épique (Level 3) ${epicInfo.isDefault ? '⚙️ Défaut' : '✅ Personnalisée'}`,
          value: `\`${this.truncateUrl(epicInfo.url)}\``,
          inline: false
        },
        {
          name: `🟡 Frame Légendaire (Level 4) ${legendaryInfo.isDefault ? '⚙️ Défaut' : '✅ Personnalisée'}`,
          value: `\`${this.truncateUrl(legendaryInfo.url)}\``,
          inline: false
        }
      )
      .setFooter({ text: '💡 Entrez une URL d\'image pour personnaliser chaque frame' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('frames_collectible_rare')
        .setLabel('🔵 Modifier Rare')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('frames_collectible_epic')
        .setLabel('🟣 Modifier Épique')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('frames_collectible_legendary')
        .setLabel('🟡 Modifier Légendaire')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('frames_collectible_reset')
        .setLabel('🔄 Réinitialiser (Défauts)')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('admin_frames')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Menu de configuration des frames de profil (2 frames)
   */
  async showProfileFramesMenu(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    // Récupérer les frames de profil du thème
    const profileFrames = await db.getThemeProfileFrames(guildId, theme.id);

    const frame1 = profileFrames.find(f => f.frame_number === 1);
    const frame2 = profileFrames.find(f => f.frame_number === 2);

    // Formater les conditions
    const formatCondition = (condition) => {
      if (!condition) return 'Non définie';

      if (condition.type === 'collectibles_level') {
        return `${condition.count} collectibles niveau ${condition.min_level}+`;
      } else if (condition.type === 'legendary_level') {
        return `${condition.count} légendaire(s) niveau ${condition.min_level}`;
      }
      return JSON.stringify(condition);
    };

    const embed = new EmbedBuilder()
      .setTitle('👤 Frames de Profil')
      .setDescription(
        `**Thème:** ${theme.name}\n\n` +
        `Ces frames décorent le profil des joueurs. Elles sont débloquées en remplissant des conditions et sont utilisables sur tous les serveurs et thèmes.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`
      )
      .setColor('#e74c3c')
      .addFields(
        {
          name: `🥈 Frame 1: ${frame1?.name || 'Cadre Argent'}`,
          value:
            `**URL:** \`${this.truncateUrl(frame1?.frame_url || 'Non définie')}\`\n` +
            `**Condition:** ${formatCondition(frame1?.unlock_condition)}`,
          inline: false
        },
        {
          name: `🥇 Frame 2: ${frame2?.name || 'Cadre Or'}`,
          value:
            `**URL:** \`${this.truncateUrl(frame2?.frame_url || 'Non définie')}\`\n` +
            `**Condition:** ${formatCondition(frame2?.unlock_condition)}`,
          inline: false
        }
      )
      .setFooter({ text: '💡 Les frames débloquées sont cross-serveur (utilisables partout)' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('frames_profile_1')
        .setLabel('🥈 Modifier Frame 1')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('frames_profile_condition_1')
        .setLabel('⚙️ Condition Frame 1')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('frames_profile_2')
        .setLabel('🥇 Modifier Frame 2')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('frames_profile_condition_2')
        .setLabel('⚙️ Condition Frame 2')
        .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('frames_profile_reset')
        .setLabel('🔄 Réinitialiser (Défauts)')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('admin_frames')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2, row3]
    });
  }

  /**
   * Modal pour modifier une frame de collectible
   */
  async showCollectibleFrameModal(interaction, rarity) {
    const rarityNames = { rare: 'Rare', epic: 'Épique', legendary: 'Légendaire' };

    const modal = new ModalBuilder()
      .setCustomId(`modal_frame_collectible_${rarity}`)
      .setTitle(`🎴 Frame ${rarityNames[rarity]}`);

    const urlInput = new TextInputBuilder()
      .setCustomId('frame_url')
      .setLabel('URL de l\'image de la frame')
      .setPlaceholder('https://exemple.com/frame.png')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
    return interaction.showModal(modal);
  }

  /**
   * Modal pour modifier une frame de profil
   */
  async showProfileFrameModal(interaction, frameNumber) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_frame_profile_${frameNumber}`)
      .setTitle(`👤 Frame de Profil ${frameNumber}`);

    const nameInput = new TextInputBuilder()
      .setCustomId('frame_name')
      .setLabel('Nom de la frame')
      .setPlaceholder(frameNumber === 1 ? 'Cadre Argent' : 'Cadre Or')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const urlInput = new TextInputBuilder()
      .setCustomId('frame_url')
      .setLabel('URL de l\'image de la frame')
      .setPlaceholder('https://exemple.com/frame.png')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('frame_description')
      .setLabel('Description (optionnel)')
      .setPlaceholder('Description de la frame')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(urlInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Afficher le sélecteur de condition avec des options prédéfinies
   */
  async showConditionSelector(interaction, frameNumber) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    // Récupérer la condition actuelle
    const existingFrame = await db.queryOne(
      `SELECT unlock_condition FROM theme_profile_frames
       WHERE guild_id = $1 AND theme_id = $2 AND frame_number = $3`,
      [guildId, theme.id, frameNumber]
    );

    const currentCondition = existingFrame?.unlock_condition;
    let currentLabel = 'Non définie';
    if (currentCondition) {
      if (currentCondition.type === 'legendary_level') {
        currentLabel = `${currentCondition.count} légendaire(s) niveau ${currentCondition.min_level}`;
      } else {
        currentLabel = `${currentCondition.count} collectibles niveau ${currentCondition.min_level}+`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Condition de déblocage - Frame ${frameNumber}`)
      .setDescription(
        `**Condition actuelle:** ${currentLabel}\n\n` +
        `Sélectionnez une condition prédéfinie ci-dessous:`
      )
      .setColor(frameNumber === 1 ? '#C0C0C0' : '#FFD700');

    // Options prédéfinies claires
    const options = [
      {
        label: '3 collectibles niveau 2+',
        description: 'Facile - Avoir 3 items de niveau 2 ou plus',
        value: 'collectibles_3_2',
        emoji: '🟢'
      },
      {
        label: '5 collectibles niveau 2+',
        description: 'Moyen - Avoir 5 items de niveau 2 ou plus',
        value: 'collectibles_5_2',
        emoji: '🟡'
      },
      {
        label: '5 collectibles niveau 3+',
        description: 'Difficile - Avoir 5 items de niveau 3 ou plus',
        value: 'collectibles_5_3',
        emoji: '🟠'
      },
      {
        label: '10 collectibles niveau 3+',
        description: 'Très difficile - Avoir 10 items de niveau 3 ou plus',
        value: 'collectibles_10_3',
        emoji: '🔴'
      },
      {
        label: '1 légendaire niveau 3',
        description: 'Spécial - Avoir 1 légendaire de niveau 3',
        value: 'legendary_1_3',
        emoji: '⭐'
      },
      {
        label: '1 légendaire niveau 4',
        description: 'Ultime - Avoir 1 légendaire de niveau 4 (max)',
        value: 'legendary_1_4',
        emoji: '👑'
      },
      {
        label: '3 légendaires niveau 3+',
        description: 'Expert - Avoir 3 légendaires de niveau 3 ou plus',
        value: 'legendary_3_3',
        emoji: '💎'
      }
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`frames_condition_select_${frameNumber}`)
      .setPlaceholder('🎯 Choisir une condition...')
      .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('frames_profile_menu')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Traiter la sélection d'une condition prédéfinie
   */
  async handleConditionSelect(interaction, frameNumber) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const selectedValue = interaction.values[0];

    // Parser la valeur: "type_count_level"
    const [type, countStr, levelStr] = selectedValue.split('_');
    const count = parseInt(countStr);
    const minLevel = parseInt(levelStr);

    const conditionType = type === 'legendary' ? 'legendary_level' : 'collectibles_level';
    const unlockCondition = { type: conditionType, count, min_level: minLevel };

    // Vérifier si la frame existe
    const existingFrame = await db.queryOne(
      `SELECT * FROM theme_profile_frames
       WHERE guild_id = $1 AND theme_id = $2 AND frame_number = $3`,
      [guildId, theme.id, frameNumber]
    );

    if (existingFrame) {
      // Mettre à jour la condition
      await db.query(
        `UPDATE theme_profile_frames
         SET unlock_condition = $1, updated_at = NOW()
         WHERE guild_id = $2 AND theme_id = $3 AND frame_number = $4`,
        [unlockCondition, guildId, theme.id, frameNumber]
      );
    } else {
      // Créer la frame avec des valeurs par défaut
      const defaultName = frameNumber === 1 ? 'Cadre Argent' : 'Cadre Or';
      const defaultUrl = frameNumber === 1
        ? 'http://72.60.185.62:8080/assets/frames/framesilver.png'
        : 'http://72.60.185.62:8080/assets/frames/framegold.png';

      await db.setThemeProfileFrame(guildId, theme.id, frameNumber, defaultName, null, defaultUrl, unlockCondition);
    }

    // Créer le label de confirmation
    let conditionLabel;
    if (type === 'legendary') {
      conditionLabel = `${count} légendaire(s) niveau ${minLevel}`;
    } else {
      conditionLabel = `${count} collectibles niveau ${minLevel}+`;
    }

    await interaction.followUp({
      content: `✅ Condition de la Frame ${frameNumber} mise à jour!\n\n**Nouvelle condition:** ${conditionLabel}`,
      flags: 64
    });

    // Retourner au menu des frames de profil
    return this.showProfileFramesMenu(interaction);
  }

  /**
   * Traiter la soumission du modal de frame collectible
   */
  async handleCollectibleFrameModal(interaction, rarity) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const frameUrl = interaction.fields.getTextInputValue('frame_url').trim();

    // Valider l'URL
    if (!this.isValidUrl(frameUrl)) {
      return interaction.editReply({
        content: '❌ URL invalide. Veuillez entrer une URL d\'image valide (http:// ou https://).'
      });
    }

    // Sauvegarder la frame
    await db.setThemeCollectibleFrame(guildId, theme.id, rarity, frameUrl);

    const rarityNames = { rare: 'Rare', epic: 'Épique', legendary: 'Légendaire' };
    await interaction.editReply({
      content: `✅ Frame ${rarityNames[rarity]} mise à jour avec succès!\n\n**URL:** ${frameUrl}`
    });
  }

  /**
   * Traiter la soumission du modal de frame profil
   */
  async handleProfileFrameModal(interaction, frameNumber) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const name = interaction.fields.getTextInputValue('frame_name').trim();
    const frameUrl = interaction.fields.getTextInputValue('frame_url').trim();
    const description = interaction.fields.getTextInputValue('frame_description')?.trim() || null;

    // Valider l'URL
    if (!this.isValidUrl(frameUrl)) {
      return interaction.editReply({
        content: '❌ URL invalide. Veuillez entrer une URL d\'image valide (http:// ou https://).'
      });
    }

    // Récupérer la frame existante pour garder la condition
    const existingFrame = await db.queryOne(
      `SELECT unlock_condition FROM theme_profile_frames
       WHERE guild_id = $1 AND theme_id = $2 AND frame_number = $3`,
      [guildId, theme.id, frameNumber]
    );

    // Condition par défaut si nouvelle frame
    let unlockCondition = existingFrame?.unlock_condition;
    if (!unlockCondition) {
      unlockCondition = frameNumber === 1
        ? { type: 'collectibles_level', count: 5, min_level: 3 }
        : { type: 'legendary_level', count: 1, min_level: 4 };
    }

    // Sauvegarder la frame
    await db.setThemeProfileFrame(guildId, theme.id, frameNumber, name, description, frameUrl, unlockCondition);

    await interaction.editReply({
      content: `✅ Frame de Profil ${frameNumber} mise à jour!\n\n**Nom:** ${name}\n**URL:** ${frameUrl}`
    });
  }

  /**
   * Réinitialiser les frames de collectibles du thème
   */
  async resetCollectibleFrames(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    // Supprimer les frames personnalisées du thème
    await db.query(
      `DELETE FROM theme_collectible_frames WHERE guild_id = $1 AND theme_id = $2`,
      [guildId, theme.id]
    );

    await interaction.followUp({
      content: '✅ Les frames de collectibles ont été réinitialisées. Les valeurs par défaut seront utilisées.',
      flags: 64
    });

    // Rafraîchir le menu
    return this.showCollectibleFramesMenu(interaction);
  }

  /**
   * Réinitialiser les frames de profil du thème
   */
  async resetProfileFrames(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    // Supprimer les frames personnalisées du thème
    await db.query(
      `DELETE FROM theme_profile_frames WHERE guild_id = $1 AND theme_id = $2`,
      [guildId, theme.id]
    );

    await interaction.followUp({
      content: '✅ Les frames de profil ont été réinitialisées. Les valeurs par défaut seront utilisées.',
      flags: 64
    });

    // Rafraîchir le menu
    return this.showProfileFramesMenu(interaction);
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  /**
   * Vérifie si les frames de collectibles sont configurées pour le thème
   */
  async areCollectibleFramesConfigured(guildId, themeId) {
    const result = await db.queryOne(
      `SELECT COUNT(*) as count FROM theme_collectible_frames WHERE guild_id = $1 AND theme_id = $2`,
      [guildId, themeId]
    );
    return parseInt(result.count) > 0;
  }

  /**
   * Vérifie si les frames de profil sont configurées pour le thème
   */
  async areProfileFramesConfigured(guildId, themeId) {
    const result = await db.queryOne(
      `SELECT COUNT(*) as count FROM theme_profile_frames WHERE guild_id = $1 AND theme_id = $2`,
      [guildId, themeId]
    );
    return parseInt(result.count) > 0;
  }

  /**
   * Tronque une URL pour l'affichage
   */
  truncateUrl(url) {
    if (!url) return 'Non définie';
    if (url.length <= 50) return url;
    return url.substring(0, 47) + '...';
  }

  /**
   * Valide une URL
   */
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

module.exports = new FramesConfigHandler();
