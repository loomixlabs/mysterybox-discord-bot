const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../utils/database-pg');
const auditLogger = require('../utils/auditLogger');

/**
 * PROBABILITY HANDLER
 *
 * Gère TOUTES les configurations de probabilités:
 * 1. Probabilités des Types (collectible/mission/trap/super_bonus)
 * 2. Probabilités par Rareté - Collectibles (legendary/epic/rare/common)
 * 3. Probabilités par Rareté - Super Bonuses (legendary/epic/rare/common)
 * 4. Probabilités par Sévérité - Pièges (Minor/Low/Medium/High/Extreme)
 *
 * Architecture: Menu principal → 4 sous-menus → Validation → Sauvegarde
 */

class ProbabilityHandler {

  // ========================================================================
  // MENU PRINCIPAL
  // ========================================================================

  /**
   * Afficher le menu principal de configuration des probabilités
   */
  async showMainMenu(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif. Configure un thème d\'abord.',
        components: [],
        embeds: []
      });
    }

    // Récupérer la config actuelle
    const config = await db.getThemeConfig(guildId, theme.id);

    const embed = new EmbedBuilder()
      .setTitle('🎲 Configuration des Probabilités')
      .setDescription(
        'Configure les probabilités pour le système de mystery boxes.\n\n' +
        '**Deux systèmes de probabilités:**\n' +
        '📊 **Probabilités des Types** - Quel type de contenu apparaît\n' +
        '⭐ **Probabilités par Rareté** - Quelle rareté dans chaque type\n'
      )
      .setColor(0x3498db);

    // État actuel - Probabilités des Types
    embed.addFields({
      name: '📊 PROBABILITÉS DES TYPES',
      value:
        `🎁 Collectibles: **${config.probability_collectible}%**\n` +
        `📋 Missions: **${config.probability_mission}%**\n` +
        `⚠️ Pièges: **${config.probability_trap}%**\n` +
        `✨ Super Bonus: **${config.probability_super_bonus || 0}%**\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `Total: **${config.probability_collectible + config.probability_mission + config.probability_trap + (config.probability_super_bonus || 0)}%**`,
      inline: true
    });

    // État actuel - Probabilités Rareté Collectibles
    embed.addFields({
      name: '⭐ RARETÉ COLLECTIBLES',
      value:
        `🟣 Legendary: **${config.collectible_rarity_legendary}%**\n` +
        `🟠 Epic: **${config.collectible_rarity_epic}%**\n` +
        `🔵 Rare: **${config.collectible_rarity_rare}%**\n` +
        `⚪ Common: **${config.collectible_rarity_common}%**`,
      inline: true
    });

    // État actuel - Probabilités Rareté Super Bonuses
    embed.addFields({
      name: '⭐ RARETÉ SUPER BONUSES',
      value:
        `🟣 Legendary: **${config.super_bonus_rarity_legendary}%**\n` +
        `🟠 Epic: **${config.super_bonus_rarity_epic}%**\n` +
        `🔵 Rare: **${config.super_bonus_rarity_rare}%**\n` +
        `⚪ Common: **${config.super_bonus_rarity_common}%**`,
      inline: true
    });

    // État actuel - Probabilités Sévérité Pièges
    embed.addFields({
      name: '⚠️ SÉVÉRITÉ PIÈGES',
      value:
        `⭐ Minor (S1): **${config.trap_severity_1 || 45}%**\n` +
        `⭐⭐ Low (S2): **${config.trap_severity_2 || 30}%**\n` +
        `⭐⭐⭐ Medium (S3): **${config.trap_severity_3 || 15}%**\n` +
        `⭐⭐⭐⭐ High (S4): **${config.trap_severity_4 || 8}%**\n` +
        `⭐⭐⭐⭐⭐ Extreme (S5): **${config.trap_severity_5 || 2}%**`,
      inline: true
    });

    embed.addFields({
      name: '💡 Informations',
      value:
        '**Probabilités des Types:** Doivent totaliser 100%\n' +
        '**Probabilités par Rareté:** Doivent totaliser 100%\n' +
        '**Sévérité Pièges:** Doivent totaliser 100% (probabilité de chaque niveau)',
      inline: false
    });

    // Boutons - Ligne 1 (Types + Raretés)
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('probability_config_types')
        .setLabel('📊 Config Types')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('probability_config_collectible_rarity')
        .setLabel('⭐ Rareté Collectibles')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('probability_config_bonus_rarity')
        .setLabel('⭐ Rareté Super Bonus')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('probability_config_trap_severity')
        .setLabel('⚠️ Sévérité Pièges')
        .setStyle(ButtonStyle.Danger)
    );

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_panel_home')
        .setLabel('← Retour Admin Panel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row, backRow]
    });
  }

  // ========================================================================
  // PROBABILITÉS DES TYPES
  // ========================================================================

  /**
   * Afficher le modal de configuration des probabilités des types
   */
  async showTypeProbabilitiesModal(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const config = await db.getThemeConfig(guildId, theme.id);

    const modal = new ModalBuilder()
      .setCustomId('probability_modal_types')
      .setTitle('📊 Probabilités des Types');

    const collectibleInput = new TextInputBuilder()
      .setCustomId('prob_collectible')
      .setLabel('🎁 Collectibles (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.probability_collectible))
      .setRequired(true)
      .setPlaceholder('0-100');

    const missionInput = new TextInputBuilder()
      .setCustomId('prob_mission')
      .setLabel('📋 Missions (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.probability_mission))
      .setRequired(true)
      .setPlaceholder('0-100');

    const trapInput = new TextInputBuilder()
      .setCustomId('prob_trap')
      .setLabel('⚠️ Pièges (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.probability_trap))
      .setRequired(true)
      .setPlaceholder('0-100');

    const superBonusInput = new TextInputBuilder()
      .setCustomId('prob_super_bonus')
      .setLabel('✨ Super Bonus (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.probability_super_bonus || 0))
      .setRequired(true)
      .setPlaceholder('0-100');

    modal.addComponents(
      new ActionRowBuilder().addComponents(collectibleInput),
      new ActionRowBuilder().addComponents(missionInput),
      new ActionRowBuilder().addComponents(trapInput),
      new ActionRowBuilder().addComponents(superBonusInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Traiter la soumission du modal de probabilités des types
   */
  async handleTypeProbabilitiesSubmit(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const probCollectible = parseInt(interaction.fields.getTextInputValue('prob_collectible'));
    const probMission = parseInt(interaction.fields.getTextInputValue('prob_mission'));
    const probTrap = parseInt(interaction.fields.getTextInputValue('prob_trap'));
    const probSuperBonus = parseInt(interaction.fields.getTextInputValue('prob_super_bonus'));

    // Validation - en cas d'erreur, afficher dans l'embed
    if (isNaN(probCollectible) || isNaN(probMission) || isNaN(probTrap) || isNaN(probSuperBonus)) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription('Toutes les valeurs doivent être des nombres valides.')
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_types')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    if (probCollectible < 0 || probMission < 0 || probTrap < 0 || probSuperBonus < 0) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription('Les probabilités ne peuvent pas être négatives.')
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_types')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    const total = probCollectible + probMission + probTrap + probSuperBonus;
    if (total !== 100) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription(`La somme des probabilités doit être égale à 100%.\n\nActuellement: **${total}%**`)
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_types')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    // Sauvegarde
    await db.query(`
      UPDATE theme_config
      SET
        probability_collectible = $1,
        probability_mission = $2,
        probability_trap = $3,
        probability_super_bonus = $4
      WHERE theme_id = $5
    `, [probCollectible, probMission, probTrap, probSuperBonus, theme.id]);

    // Audit log
    await auditLogger.logProbabilitiesUpdated(
      guildId,
      interaction.user.id,
      interaction.user.username,
      theme.id,
      theme.name,
      {
        collectible: probCollectible,
        mission: probMission,
        trap: probTrap,
        super_bonus: probSuperBonus
      }
    );

    // Embed de confirmation dans le panel principal
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ PROBABILITÉS DES TYPES MISES À JOUR')
      .setDescription(
        `Les probabilités de contenu des Mystery Boxes ont été modifiées.\n\n` +
        `🎁 **Collectibles:** ${probCollectible}%\n` +
        `📋 **Missions:** ${probMission}%\n` +
        `⚠️ **Pièges:** ${probTrap}%\n` +
        `✨ **Super Bonus:** ${probSuperBonus}%`
      )
      .setColor('#2ecc71')
      .setFooter({ text: `Thème: ${theme.name}` })
      .setTimestamp();

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_probabilities')
        .setLabel('🔙 Retour aux probabilités')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '',
      embeds: [successEmbed],
      components: [backRow]
    });
  }

  // ========================================================================
  // PROBABILITÉS RARETÉ COLLECTIBLES
  // ========================================================================

  /**
   * Afficher le modal de configuration des probabilités rareté collectibles
   */
  async showCollectibleRarityModal(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const config = await db.getThemeConfig(guildId, theme.id);

    const modal = new ModalBuilder()
      .setCustomId('probability_modal_collectible_rarity')
      .setTitle('⭐ Rareté Collectibles');

    const legendaryInput = new TextInputBuilder()
      .setCustomId('collectible_rarity_legendary')
      .setLabel('🟣 Legendary (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.collectible_rarity_legendary))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 10)');

    const epicInput = new TextInputBuilder()
      .setCustomId('collectible_rarity_epic')
      .setLabel('🟠 Epic (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.collectible_rarity_epic))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 20)');

    const rareInput = new TextInputBuilder()
      .setCustomId('collectible_rarity_rare')
      .setLabel('🔵 Rare (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.collectible_rarity_rare))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 30)');

    const commonInput = new TextInputBuilder()
      .setCustomId('collectible_rarity_common')
      .setLabel('⚪ Common (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.collectible_rarity_common))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 40)');

    modal.addComponents(
      new ActionRowBuilder().addComponents(legendaryInput),
      new ActionRowBuilder().addComponents(epicInput),
      new ActionRowBuilder().addComponents(rareInput),
      new ActionRowBuilder().addComponents(commonInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Traiter la soumission du modal de rareté collectibles
   */
  async handleCollectibleRaritySubmit(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const legendary = parseInt(interaction.fields.getTextInputValue('collectible_rarity_legendary'));
    const epic = parseInt(interaction.fields.getTextInputValue('collectible_rarity_epic'));
    const rare = parseInt(interaction.fields.getTextInputValue('collectible_rarity_rare'));
    const common = parseInt(interaction.fields.getTextInputValue('collectible_rarity_common'));

    // Validation - en cas d'erreur, afficher dans l'embed
    if (isNaN(legendary) || isNaN(epic) || isNaN(rare) || isNaN(common)) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription('Toutes les valeurs doivent être des nombres valides.')
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_collectible_rarity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    if (legendary < 0 || epic < 0 || rare < 0 || common < 0) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription('Tous les pourcentages doivent être supérieurs ou égaux à 0.')
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_collectible_rarity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    const total = legendary + epic + rare + common;
    if (total !== 100) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription(`La somme des pourcentages doit être égale à 100%.\n\nActuellement: **${total}%**`)
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_collectible_rarity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    // Sauvegarde
    await db.query(`
      UPDATE theme_config
      SET
        collectible_rarity_legendary = $1,
        collectible_rarity_epic = $2,
        collectible_rarity_rare = $3,
        collectible_rarity_common = $4
      WHERE theme_id = $5
    `, [legendary, epic, rare, common, theme.id]);

    // Embed de confirmation dans le panel principal
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ PROBABILITÉS RARETÉ COLLECTIBLES MISES À JOUR')
      .setDescription(
        `Les probabilités de rareté des collectibles ont été modifiées.\n\n` +
        `🟣 **Legendary:** ${legendary}%\n` +
        `🟠 **Epic:** ${epic}%\n` +
        `🔵 **Rare:** ${rare}%\n` +
        `⚪ **Common:** ${common}%`
      )
      .setColor('#2ecc71')
      .setFooter({ text: `Thème: ${theme.name}` })
      .setTimestamp();

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_probabilities')
        .setLabel('🔙 Retour aux probabilités')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '',
      embeds: [successEmbed],
      components: [backRow]
    });
  }

  // ========================================================================
  // PROBABILITÉS RARETÉ SUPER BONUSES
  // ========================================================================

  /**
   * Afficher le modal de configuration des probabilités rareté super bonuses
   */
  async showBonusRarityModal(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const config = await db.getThemeConfig(guildId, theme.id);

    const modal = new ModalBuilder()
      .setCustomId('probability_modal_bonus_rarity')
      .setTitle('⭐ Rareté Super Bonuses');

    const legendaryInput = new TextInputBuilder()
      .setCustomId('super_bonus_rarity_legendary')
      .setLabel('🟣 Legendary (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.super_bonus_rarity_legendary))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 10)');

    const epicInput = new TextInputBuilder()
      .setCustomId('super_bonus_rarity_epic')
      .setLabel('🟠 Epic (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.super_bonus_rarity_epic))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 20)');

    const rareInput = new TextInputBuilder()
      .setCustomId('super_bonus_rarity_rare')
      .setLabel('🔵 Rare (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.super_bonus_rarity_rare))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 30)');

    const commonInput = new TextInputBuilder()
      .setCustomId('super_bonus_rarity_common')
      .setLabel('⚪ Common (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.super_bonus_rarity_common))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 40)');

    modal.addComponents(
      new ActionRowBuilder().addComponents(legendaryInput),
      new ActionRowBuilder().addComponents(epicInput),
      new ActionRowBuilder().addComponents(rareInput),
      new ActionRowBuilder().addComponents(commonInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Traiter la soumission du modal de rareté super bonuses
   */
  async handleBonusRaritySubmit(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const legendary = parseInt(interaction.fields.getTextInputValue('super_bonus_rarity_legendary'));
    const epic = parseInt(interaction.fields.getTextInputValue('super_bonus_rarity_epic'));
    const rare = parseInt(interaction.fields.getTextInputValue('super_bonus_rarity_rare'));
    const common = parseInt(interaction.fields.getTextInputValue('super_bonus_rarity_common'));

    // Validation - en cas d'erreur, afficher dans l'embed
    if (isNaN(legendary) || isNaN(epic) || isNaN(rare) || isNaN(common)) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription('Toutes les valeurs doivent être des nombres valides.')
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_bonus_rarity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    if (legendary < 0 || epic < 0 || rare < 0 || common < 0) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription('Tous les pourcentages doivent être supérieurs ou égaux à 0.')
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_bonus_rarity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    const total = legendary + epic + rare + common;
    if (total !== 100) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription(`La somme des pourcentages doit être égale à 100%.\n\nActuellement: **${total}%**`)
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_bonus_rarity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    // Sauvegarde
    await db.query(`
      UPDATE theme_config
      SET
        super_bonus_rarity_legendary = $1,
        super_bonus_rarity_epic = $2,
        super_bonus_rarity_rare = $3,
        super_bonus_rarity_common = $4
      WHERE theme_id = $5
    `, [legendary, epic, rare, common, theme.id]);

    // Embed de confirmation dans le panel principal
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ PROBABILITÉS RARETÉ SUPER BONUSES MISES À JOUR')
      .setDescription(
        `Les probabilités de rareté des super bonuses ont été modifiées.\n\n` +
        `🟣 **Legendary:** ${legendary}%\n` +
        `🟠 **Epic:** ${epic}%\n` +
        `🔵 **Rare:** ${rare}%\n` +
        `⚪ **Common:** ${common}%`
      )
      .setColor('#2ecc71')
      .setFooter({ text: `Thème: ${theme.name}` })
      .setTimestamp();

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_probabilities')
        .setLabel('🔙 Retour aux probabilités')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '',
      embeds: [successEmbed],
      components: [backRow]
    });
  }

  // ========================================================================
  // PROBABILITÉS SÉVÉRITÉ PIÈGES
  // ========================================================================

  /**
   * Afficher le modal de configuration des probabilités de sévérité des pièges
   */
  async showTrapSeverityModal(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const config = await db.getThemeConfig(guildId, theme.id);

    const modal = new ModalBuilder()
      .setCustomId('probability_modal_trap_severity')
      .setTitle('⚠️ Sévérité Pièges');

    const severity1Input = new TextInputBuilder()
      .setCustomId('trap_severity_1')
      .setLabel('⭐ Minor (S1) - Effets mineurs (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.trap_severity_1 || 45))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 45)');

    const severity2Input = new TextInputBuilder()
      .setCustomId('trap_severity_2')
      .setLabel('⭐⭐ Low (S2) - Inconvénients (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.trap_severity_2 || 30))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 30)');

    const severity3Input = new TextInputBuilder()
      .setCustomId('trap_severity_3')
      .setLabel('⭐⭐⭐ Medium (S3) - Perte modérée (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.trap_severity_3 || 15))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 15)');

    const severity4Input = new TextInputBuilder()
      .setCustomId('trap_severity_4')
      .setLabel('⭐⭐⭐⭐ High (S4) - Pertes multiples (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.trap_severity_4 || 8))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 8)');

    const severity5Input = new TextInputBuilder()
      .setCustomId('trap_severity_5')
      .setLabel('⭐⭐⭐⭐⭐ Extreme (S5) - Catastrophe (%)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(config.trap_severity_5 || 2))
      .setRequired(true)
      .setPlaceholder('0-100 (ex: 2)');

    modal.addComponents(
      new ActionRowBuilder().addComponents(severity1Input),
      new ActionRowBuilder().addComponents(severity2Input),
      new ActionRowBuilder().addComponents(severity3Input),
      new ActionRowBuilder().addComponents(severity4Input),
      new ActionRowBuilder().addComponents(severity5Input)
    );

    await interaction.showModal(modal);
  }

  /**
   * Traiter la soumission du modal de sévérité pièges
   */
  async handleTrapSeveritySubmit(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const severity1 = parseInt(interaction.fields.getTextInputValue('trap_severity_1'));
    const severity2 = parseInt(interaction.fields.getTextInputValue('trap_severity_2'));
    const severity3 = parseInt(interaction.fields.getTextInputValue('trap_severity_3'));
    const severity4 = parseInt(interaction.fields.getTextInputValue('trap_severity_4'));
    const severity5 = parseInt(interaction.fields.getTextInputValue('trap_severity_5'));

    // Validation - en cas d'erreur, afficher dans l'embed
    if (isNaN(severity1) || isNaN(severity2) || isNaN(severity3) || isNaN(severity4) || isNaN(severity5)) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription('Toutes les valeurs doivent être des nombres valides.')
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_trap_severity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    if (severity1 < 0 || severity2 < 0 || severity3 < 0 || severity4 < 0 || severity5 < 0) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription('Tous les pourcentages doivent être supérieurs ou égaux à 0.')
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_trap_severity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    const total = severity1 + severity2 + severity3 + severity4 + severity5;
    if (total !== 100) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de validation')
        .setDescription(`La somme des pourcentages doit être égale à 100%.\n\nActuellement: **${total}%**`)
        .setColor('#e74c3c');

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('probability_config_trap_severity')
          .setLabel('🔄 Réessayer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_probabilities')
          .setLabel('🔙 Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: '', embeds: [errorEmbed], components: [backRow] });
    }

    // Sauvegarde
    await db.query(`
      UPDATE theme_config
      SET
        trap_severity_1 = $1,
        trap_severity_2 = $2,
        trap_severity_3 = $3,
        trap_severity_4 = $4,
        trap_severity_5 = $5
      WHERE theme_id = $6
    `, [severity1, severity2, severity3, severity4, severity5, theme.id]);

    // Audit log
    try {
      await auditLogger.logProbabilitiesUpdated(
        guildId,
        interaction.user.id,
        interaction.user.username,
        theme.id,
        theme.name,
        {
          trap_severity_1: severity1,
          trap_severity_2: severity2,
          trap_severity_3: severity3,
          trap_severity_4: severity4,
          trap_severity_5: severity5
        }
      );
    } catch (err) {
      console.error('⚠️ Erreur audit log (non-bloquante):', err.message);
    }

    // Embed de confirmation dans le panel principal
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ PROBABILITÉS SÉVÉRITÉ MISES À JOUR')
      .setDescription(
        `Les probabilités de sélection des pièges par sévérité ont été modifiées.\n\n` +
        `⭐ **Minor (S1):** ${severity1}%\n` +
        `⭐⭐ **Low (S2):** ${severity2}%\n` +
        `⭐⭐⭐ **Medium (S3):** ${severity3}%\n` +
        `⭐⭐⭐⭐ **High (S4):** ${severity4}%\n` +
        `⭐⭐⭐⭐⭐ **Extreme (S5):** ${severity5}%`
      )
      .setColor('#2ecc71')
      .setFooter({ text: `Thème: ${theme.name}` })
      .setTimestamp();

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_probabilities')
        .setLabel('🔙 Retour aux probabilités')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '',
      embeds: [successEmbed],
      components: [backRow]
    });
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  /**
   * Calculer le pourcentage
   */
  calculatePercent(value, total) {
    if (total === 0) return '0.00';
    return ((value / total) * 100).toFixed(2);
  }

  /**
   * Router pour gérer les interactions
   */
  async handleInteraction(interaction) {
    const customId = interaction.customId;

    // Bouton depuis admin panel + menu principal
    if (customId === 'admin_probabilities' || customId === 'probability_main_menu') {
      return this.showMainMenu(interaction);
    }

    if (customId === 'probability_config_types') {
      return this.showTypeProbabilitiesModal(interaction);
    }

    if (customId === 'probability_config_collectible_rarity') {
      return this.showCollectibleRarityModal(interaction);
    }

    if (customId === 'probability_config_bonus_rarity') {
      return this.showBonusRarityModal(interaction);
    }

    if (customId === 'probability_config_trap_severity') {
      return this.showTrapSeverityModal(interaction);
    }

    // Modals
    if (customId === 'probability_modal_types') {
      return this.handleTypeProbabilitiesSubmit(interaction);
    }

    if (customId === 'probability_modal_collectible_rarity') {
      return this.handleCollectibleRaritySubmit(interaction);
    }

    if (customId === 'probability_modal_bonus_rarity') {
      return this.handleBonusRaritySubmit(interaction);
    }

    if (customId === 'probability_modal_trap_severity') {
      return this.handleTrapSeveritySubmit(interaction);
    }
  }
}

module.exports = new ProbabilityHandler();
