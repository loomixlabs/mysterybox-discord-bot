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
 *
 * Architecture: Menu principal → 3 sous-menus → Validation → Sauvegarde
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

    embed.addFields({
      name: '💡 Informations',
      value:
        '**Probabilités des Types:** Doivent totaliser 100%\n' +
        '**Probabilités par Rareté:** Doivent totaliser 100% (0% = jamais, 100% = toujours)',
      inline: false
    });

    // Boutons
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
        .setStyle(ButtonStyle.Secondary)
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
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const probCollectible = parseInt(interaction.fields.getTextInputValue('prob_collectible'));
    const probMission = parseInt(interaction.fields.getTextInputValue('prob_mission'));
    const probTrap = parseInt(interaction.fields.getTextInputValue('prob_trap'));
    const probSuperBonus = parseInt(interaction.fields.getTextInputValue('prob_super_bonus'));

    // Validation
    if (isNaN(probCollectible) || isNaN(probMission) || isNaN(probTrap) || isNaN(probSuperBonus)) {
      return interaction.editReply({
        content: '❌ Toutes les valeurs doivent être des nombres valides.',
        flags: 64
      });
    }

    if (probCollectible < 0 || probMission < 0 || probTrap < 0 || probSuperBonus < 0) {
      return interaction.editReply({
        content: '❌ Les probabilités ne peuvent pas être négatives.',
        flags: 64
      });
    }

    const total = probCollectible + probMission + probTrap + probSuperBonus;
    if (total !== 100) {
      return interaction.editReply({
        content: `❌ La somme des probabilités doit être égale à 100% (actuellement: ${total}%)`,
        flags: 64
      });
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

    await interaction.editReply({
      content:
        `✅ **Probabilités des types mises à jour !**\n\n` +
        `🎁 Collectibles: **${probCollectible}%**\n` +
        `📋 Missions: **${probMission}%**\n` +
        `⚠️ Pièges: **${probTrap}%**\n` +
        `✨ Super Bonus: **${probSuperBonus}%**`,
      flags: 64
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
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const legendary = parseInt(interaction.fields.getTextInputValue('collectible_rarity_legendary'));
    const epic = parseInt(interaction.fields.getTextInputValue('collectible_rarity_epic'));
    const rare = parseInt(interaction.fields.getTextInputValue('collectible_rarity_rare'));
    const common = parseInt(interaction.fields.getTextInputValue('collectible_rarity_common'));

    // Validation
    if (isNaN(legendary) || isNaN(epic) || isNaN(rare) || isNaN(common)) {
      return interaction.editReply({
        content: '❌ Toutes les valeurs doivent être des nombres valides.',
        flags: 64
      });
    }

    if (legendary < 0 || epic < 0 || rare < 0 || common < 0) {
      return interaction.editReply({
        content: '❌ Tous les pourcentages doivent être supérieurs ou égaux à 0.',
        flags: 64
      });
    }

    const total = legendary + epic + rare + common;
    if (total !== 100) {
      return interaction.editReply({
        content: `❌ La somme des pourcentages doit être égale à 100% (actuellement: ${total}%)`,
        flags: 64
      });
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

    await interaction.editReply({
      content:
        `✅ **Probabilités rareté collectibles mises à jour !**\n\n` +
        `🟣 Legendary: **${legendary}%**\n` +
        `🟠 Epic: **${epic}%**\n` +
        `🔵 Rare: **${rare}%**\n` +
        `⚪ Common: **${common}%**`,
      flags: 64
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
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const legendary = parseInt(interaction.fields.getTextInputValue('super_bonus_rarity_legendary'));
    const epic = parseInt(interaction.fields.getTextInputValue('super_bonus_rarity_epic'));
    const rare = parseInt(interaction.fields.getTextInputValue('super_bonus_rarity_rare'));
    const common = parseInt(interaction.fields.getTextInputValue('super_bonus_rarity_common'));

    // Validation
    if (isNaN(legendary) || isNaN(epic) || isNaN(rare) || isNaN(common)) {
      return interaction.editReply({
        content: '❌ Toutes les valeurs doivent être des nombres valides.',
        flags: 64
      });
    }

    if (legendary < 0 || epic < 0 || rare < 0 || common < 0) {
      return interaction.editReply({
        content: '❌ Tous les pourcentages doivent être supérieurs ou égaux à 0.',
        flags: 64
      });
    }

    const total = legendary + epic + rare + common;
    if (total !== 100) {
      return interaction.editReply({
        content: `❌ La somme des pourcentages doit être égale à 100% (actuellement: ${total}%)`,
        flags: 64
      });
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

    await interaction.editReply({
      content:
        `✅ **Probabilités rareté super bonuses mises à jour !**\n\n` +
        `🟣 Legendary: **${legendary}%**\n` +
        `🟠 Epic: **${epic}%**\n` +
        `🔵 Rare: **${rare}%**\n` +
        `⚪ Common: **${common}%**`,
      flags: 64
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
  }
}

module.exports = new ProbabilityHandler();
