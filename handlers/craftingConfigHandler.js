/**
 * 🔨 CRAFTING CONFIG HANDLER
 * Panel d'administration pour configurer le système de crafting
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const { getLoomixFooterOnly } = require('../utils/footerHelper');

// ============================================================================
// CONSTANTES
// ============================================================================

const RARITY_INFO = {
    common: { emoji: '📦', label: 'Commune' },
    rare: { emoji: '💎', label: 'Rare' },
    epic: { emoji: '✨', label: 'Épique' },
    legendary: { emoji: '👑', label: 'Légendaire' }
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

async function getCraftingConfig(guildId) {
    let config = await db.queryOne(
        'SELECT * FROM crafting_config WHERE guild_id = $1',
        [guildId]
    );

    if (!config) {
        config = await db.queryOne(`
            INSERT INTO crafting_config (guild_id)
            VALUES ($1)
            RETURNING *
        `, [guildId]);
    }

    return config;
}

// ============================================================================
// PANEL PRINCIPAL
// ============================================================================

async function showCraftingConfigPanel(interaction) {
    const guildId = interaction.guildId;
    const config = await getCraftingConfig(guildId);

    const embed = new EmbedBuilder()
        .setTitle('⚙️ CONFIGURATION CRAFTING')
        .setDescription(`Configurez le système de craft de clés pour ce serveur.`)
        .setColor('#FF6B35')
        .addFields(
            {
                name: '🔑 Coûts en clés (upgrade)',
                value: [
                    `${RARITY_INFO.common.emoji}→${RARITY_INFO.rare.emoji}: **${config.keys_common_to_rare}** clés`,
                    `${RARITY_INFO.rare.emoji}→${RARITY_INFO.epic.emoji}: **${config.keys_rare_to_epic}** clés`,
                    `${RARITY_INFO.epic.emoji}→${RARITY_INFO.legendary.emoji}: **${config.keys_epic_to_legendary}** clés`,
                    `${RARITY_INFO.legendary.emoji} (recyclage): **${config.keys_legendary_cost}** clés`
                ].join('\n'),
                inline: true
            },
            {
                name: `🪙 Coûts en Loomix`,
                value: [
                    `${RARITY_INFO.common.emoji}→${RARITY_INFO.rare.emoji}: ${config.loomix_common_to_rare || '❌ Désactivé'}`,
                    `${RARITY_INFO.rare.emoji}→${RARITY_INFO.epic.emoji}: ${config.loomix_rare_to_epic || '❌ Désactivé'}`,
                    `${RARITY_INFO.epic.emoji}→${RARITY_INFO.legendary.emoji}: ${config.loomix_epic_to_legendary || '❌ Désactivé'}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🎲 Chance critique',
                value: `**${config.critical_chance}%**`,
                inline: true
            },
            {
                name: '📊 État',
                value: config.enabled ? '✅ Activé' : '❌ Désactivé',
                inline: true
            },
            {
                name: '🖼️ Images configurées',
                value: [
                    `🔨 Craft: ${config.image_craft_animation ? '✅' : '❌'}`,
                    `🎯 Critique: ${config.image_craft_critical ? '✅' : '❌'}`,
                    `🔑 Clés: ${config.image_key_common || config.image_key_rare || config.image_key_epic || config.image_key_legendary ? '✅' : '❌'}`
                ].join(' | '),
                inline: false
            }
        )
        .setFooter(getLoomixFooterOnly())
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_config_keys')
            .setLabel('🔑 Coûts Clés')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('craft_config_loomix')
            .setLabel('🪙 Coûts Loomix')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('craft_config_critical')
            .setLabel('🎲 Critique')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_config_images')
            .setLabel('🖼️ Images')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`craft_config_toggle`)
            .setLabel(config.enabled ? '❌ Désactiver' : '✅ Activer')
            .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_settings')
            .setLabel('↩️ Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3]
    });
}

// ============================================================================
// MODAL: Configuration des coûts en clés
// ============================================================================

async function showKeysCostModal(interaction) {
    const guildId = interaction.guildId;
    const config = await getCraftingConfig(guildId);

    const modal = new ModalBuilder()
        .setCustomId('craft_config_keys_modal')
        .setTitle('Configuration Coûts Clés');

    const commonToRare = new TextInputBuilder()
        .setCustomId('keys_common_to_rare')
        .setLabel(`Commune → Rare (clés)`)
        .setStyle(TextInputStyle.Short)
        .setValue(String(config.keys_common_to_rare))
        .setPlaceholder('3')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2);

    const rareToEpic = new TextInputBuilder()
        .setCustomId('keys_rare_to_epic')
        .setLabel(`Rare → Épique (clés)`)
        .setStyle(TextInputStyle.Short)
        .setValue(String(config.keys_rare_to_epic))
        .setPlaceholder('3')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2);

    const epicToLegendary = new TextInputBuilder()
        .setCustomId('keys_epic_to_legendary')
        .setLabel(`Épique → Légendaire (clés)`)
        .setStyle(TextInputStyle.Short)
        .setValue(String(config.keys_epic_to_legendary))
        .setPlaceholder('3')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2);

    const legendaryCost = new TextInputBuilder()
        .setCustomId('keys_legendary_cost')
        .setLabel(`Coût Légendaire (pour recyclage)`)
        .setStyle(TextInputStyle.Short)
        .setValue(String(config.keys_legendary_cost))
        .setPlaceholder('3')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2);

    modal.addComponents(
        new ActionRowBuilder().addComponents(commonToRare),
        new ActionRowBuilder().addComponents(rareToEpic),
        new ActionRowBuilder().addComponents(epicToLegendary),
        new ActionRowBuilder().addComponents(legendaryCost)
    );

    return interaction.showModal(modal);
}

async function handleKeysCostModalSubmit(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const keysCommonToRare = parseInt(interaction.fields.getTextInputValue('keys_common_to_rare'));
    const keysRareToEpic = parseInt(interaction.fields.getTextInputValue('keys_rare_to_epic'));
    const keysEpicToLegendary = parseInt(interaction.fields.getTextInputValue('keys_epic_to_legendary'));
    const keysLegendaryCost = parseInt(interaction.fields.getTextInputValue('keys_legendary_cost'));

    // Validation
    if (isNaN(keysCommonToRare) || isNaN(keysRareToEpic) || isNaN(keysEpicToLegendary) || isNaN(keysLegendaryCost)) {
        return interaction.editReply({
            content: '❌ Tous les coûts doivent être des nombres entiers.',
            embeds: [],
            components: []
        });
    }

    if (keysCommonToRare < 2 || keysRareToEpic < 2 || keysEpicToLegendary < 2 || keysLegendaryCost < 2) {
        return interaction.editReply({
            content: '❌ Les coûts doivent être d\'au moins 2 clés (pour permettre le recyclage à coût - 1).',
            embeds: [],
            components: []
        });
    }

    await db.query(`
        UPDATE crafting_config
        SET keys_common_to_rare = $1,
            keys_rare_to_epic = $2,
            keys_epic_to_legendary = $3,
            keys_legendary_cost = $4
        WHERE guild_id = $5
    `, [keysCommonToRare, keysRareToEpic, keysEpicToLegendary, keysLegendaryCost, guildId]);

    return showCraftingConfigPanel(interaction);
}

// ============================================================================
// MODAL: Configuration des coûts en Loomix
// ============================================================================

async function showLoomixCostModal(interaction) {
    const guildId = interaction.guildId;
    const config = await getCraftingConfig(guildId);

    const modal = new ModalBuilder()
        .setCustomId('craft_config_loomix_modal')
        .setTitle('Configuration Coûts Loomix');

    const commonToRare = new TextInputBuilder()
        .setCustomId('loomix_common_to_rare')
        .setLabel('📦→💎 Commune→Rare (vide=off)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.loomix_common_to_rare ? String(config.loomix_common_to_rare) : '')
        .setPlaceholder('100 Loomix pour 1 clé Rare')
        .setRequired(false)
        .setMaxLength(6);

    const rareToEpic = new TextInputBuilder()
        .setCustomId('loomix_rare_to_epic')
        .setLabel('💎→✨ Rare→Épique (vide=off)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.loomix_rare_to_epic ? String(config.loomix_rare_to_epic) : '')
        .setPlaceholder('300 Loomix pour 1 clé Épique')
        .setRequired(false)
        .setMaxLength(6);

    const epicToLegendary = new TextInputBuilder()
        .setCustomId('loomix_epic_to_legendary')
        .setLabel('✨→👑 Épique→Légendaire (vide=off)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.loomix_epic_to_legendary ? String(config.loomix_epic_to_legendary) : '')
        .setPlaceholder('1000 Loomix pour 1 clé Légendaire')
        .setRequired(false)
        .setMaxLength(6);

    modal.addComponents(
        new ActionRowBuilder().addComponents(commonToRare),
        new ActionRowBuilder().addComponents(rareToEpic),
        new ActionRowBuilder().addComponents(epicToLegendary)
    );

    return interaction.showModal(modal);
}

async function handleLoomixCostModalSubmit(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const loomixCommonToRare = interaction.fields.getTextInputValue('loomix_common_to_rare');
    const loomixRareToEpic = interaction.fields.getTextInputValue('loomix_rare_to_epic');
    const loomixEpicToLegendary = interaction.fields.getTextInputValue('loomix_epic_to_legendary');

    // Parser avec null si vide
    const parseLoomix = (val) => {
        if (!val || val.trim() === '') return null;
        const num = parseInt(val);
        return isNaN(num) || num <= 0 ? null : num;
    };

    await db.query(`
        UPDATE crafting_config
        SET loomix_common_to_rare = $1,
            loomix_rare_to_epic = $2,
            loomix_epic_to_legendary = $3
        WHERE guild_id = $4
    `, [parseLoomix(loomixCommonToRare), parseLoomix(loomixRareToEpic), parseLoomix(loomixEpicToLegendary), guildId]);

    return showCraftingConfigPanel(interaction);
}

// ============================================================================
// MODAL: Configuration de la chance critique
// ============================================================================

async function showCriticalModal(interaction) {
    const guildId = interaction.guildId;
    const config = await getCraftingConfig(guildId);

    const modal = new ModalBuilder()
        .setCustomId('craft_config_critical_modal')
        .setTitle('Chance Critique');

    const criticalChance = new TextInputBuilder()
        .setCustomId('critical_chance')
        .setLabel(`Chance critique (%, 0-100)`)
        .setStyle(TextInputStyle.Short)
        .setValue(String(config.critical_chance))
        .setPlaceholder('5')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3);

    modal.addComponents(
        new ActionRowBuilder().addComponents(criticalChance)
    );

    return interaction.showModal(modal);
}

async function handleCriticalModalSubmit(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const criticalChance = parseInt(interaction.fields.getTextInputValue('critical_chance'));

    if (isNaN(criticalChance) || criticalChance < 0 || criticalChance > 100) {
        return interaction.editReply({
            content: '❌ La chance critique doit être un nombre entre 0 et 100.',
            embeds: [],
            components: []
        });
    }

    await db.query(`
        UPDATE crafting_config
        SET critical_chance = $1
        WHERE guild_id = $2
    `, [criticalChance, guildId]);

    return showCraftingConfigPanel(interaction);
}

// ============================================================================
// CONFIGURATION DES IMAGES
// ============================================================================

async function showImagesConfig(interaction) {
    const guildId = interaction.guildId;
    const config = await getCraftingConfig(guildId);

    const embed = new EmbedBuilder()
        .setTitle('🖼️ CONFIGURATION IMAGES CRAFTING')
        .setDescription(
            `Configurez les images d'animation du crafting.\n\n` +
            `**Flow d'animation:**\n` +
            `1️⃣ GIF Craft (7 sec) → 2️⃣ Image Critique (2 sec si crit) → 3️⃣ Image Clé`
        )
        .setColor('#9B59B6')
        .addFields(
            {
                name: '🎬 Animation de Craft',
                value: [
                    `🔨 GIF Craft: ${config.image_craft_animation ? '✅ Personnalisé' : '❌ Par défaut'}`,
                    `🎯 Image Critique: ${config.image_craft_critical ? '✅ Personnalisé' : '❌ Par défaut'}`
                ].join('\n'),
                inline: false
            },
            {
                name: '🔑 Images des clés (résultat)',
                value: [
                    `${RARITY_INFO.common.emoji} Commune: ${config.image_key_common ? '✅' : '❌'}`,
                    `${RARITY_INFO.rare.emoji} Rare: ${config.image_key_rare ? '✅' : '❌'}`,
                    `${RARITY_INFO.epic.emoji} Épique: ${config.image_key_epic ? '✅' : '❌'}`,
                    `${RARITY_INFO.legendary.emoji} Légendaire: ${config.image_key_legendary ? '✅' : '❌'}`
                ].join('\n'),
                inline: false
            }
        )
        .setFooter(getLoomixFooterOnly());

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('craft_config_image_select')
        .setPlaceholder('Sélectionnez une image à modifier...')
        .addOptions([
            { label: 'GIF Animation Craft (7s)', value: 'image_craft_animation', emoji: '🔨' },
            { label: 'Image Critique', value: 'image_craft_critical', emoji: '🎯' },
            { label: 'Clé Commune', value: 'image_key_common', emoji: '📦' },
            { label: 'Clé Rare', value: 'image_key_rare', emoji: '💎' },
            { label: 'Clé Épique', value: 'image_key_epic', emoji: '✨' },
            { label: 'Clé Légendaire', value: 'image_key_legendary', emoji: '👑' }
        ]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_config_panel')
            .setLabel('↩️ Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

async function showImageModal(interaction, imageField) {
    const guildId = interaction.guildId;
    const config = await getCraftingConfig(guildId);

    const labels = {
        image_craft_animation: 'GIF Animation Craft',
        image_craft_critical: 'Image Critique',
        image_key_common: 'Clé Commune',
        image_key_rare: 'Clé Rare',
        image_key_epic: 'Clé Épique',
        image_key_legendary: 'Clé Légendaire'
    };

    const modal = new ModalBuilder()
        .setCustomId(`craft_config_image_modal_${imageField}`)
        .setTitle(`Image: ${labels[imageField]}`);

    const imageUrl = new TextInputBuilder()
        .setCustomId('image_url')
        .setLabel(`URL de l'image (vide = par défaut)`)
        .setStyle(TextInputStyle.Short)
        .setValue(config[imageField] || '')
        .setPlaceholder('https://example.com/image.gif')
        .setRequired(false)
        .setMaxLength(500);

    modal.addComponents(
        new ActionRowBuilder().addComponents(imageUrl)
    );

    return interaction.showModal(modal);
}

async function handleImageModalSubmit(interaction, imageField) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const imageUrl = interaction.fields.getTextInputValue('image_url').trim();

    await db.query(`
        UPDATE crafting_config
        SET ${imageField} = $1
        WHERE guild_id = $2
    `, [imageUrl || null, guildId]);

    return showImagesConfig(interaction);
}

// ============================================================================
// TOGGLE ACTIVATION
// ============================================================================

async function toggleCrafting(interaction) {
    const guildId = interaction.guildId;
    const config = await getCraftingConfig(guildId);

    await db.query(`
        UPDATE crafting_config
        SET enabled = $1
        WHERE guild_id = $2
    `, [!config.enabled, guildId]);

    return showCraftingConfigPanel(interaction);
}

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================

async function handleCraftingConfigInteraction(interaction) {
    const { customId } = interaction;

    try {
        // Modals ne nécessitent pas de defer
        if (customId === 'craft_config_keys') {
            return showKeysCostModal(interaction);
        }

        if (customId === 'craft_config_loomix') {
            return showLoomixCostModal(interaction);
        }

        if (customId === 'craft_config_critical') {
            return showCriticalModal(interaction);
        }

        // Boutons nécessitent defer
        await interaction.deferUpdate();

        if (customId === 'craft_config_panel') {
            return showCraftingConfigPanel(interaction);
        }

        if (customId === 'craft_config_images') {
            return showImagesConfig(interaction);
        }

        if (customId === 'craft_config_toggle') {
            return toggleCrafting(interaction);
        }

        // Select menu pour les images
        if (customId === 'craft_config_image_select') {
            const imageField = interaction.values[0];
            // Ré-afficher le modal sans defer (car showModal répond)
            // On a déjà déféré, donc on doit utiliser une autre approche
            return showImageModal(interaction, imageField);
        }

    } catch (error) {
        console.error('🔴 [CRAFTING CONFIG] Erreur:', error);

        if (error.code === 10062) {
            console.error('⏱️ Interaction expirée');
            return;
        }

        const errorMsg = { content: '❌ Une erreur est survenue.', embeds: [], components: [] };
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(errorMsg);
        } else {
            await interaction.reply({ ...errorMsg, flags: 64 });
        }
    }
}

/**
 * Handler pour les modals de config crafting
 */
async function handleCraftingConfigModal(interaction) {
    const customId = interaction.customId;

    try {
        if (customId === 'craft_config_keys_modal') {
            return handleKeysCostModalSubmit(interaction);
        }

        if (customId === 'craft_config_loomix_modal') {
            return handleLoomixCostModalSubmit(interaction);
        }

        if (customId === 'craft_config_critical_modal') {
            return handleCriticalModalSubmit(interaction);
        }

        if (customId.startsWith('craft_config_image_modal_')) {
            const imageField = customId.replace('craft_config_image_modal_', '');
            return handleImageModalSubmit(interaction, imageField);
        }

    } catch (error) {
        console.error('🔴 [CRAFTING CONFIG MODAL] Erreur:', error);

        await interaction.deferUpdate();
        await interaction.editReply({
            content: '❌ Une erreur est survenue.',
            embeds: [],
            components: []
        });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    handleCraftingConfigInteraction,
    handleCraftingConfigModal,
    showCraftingConfigPanel,
    getCraftingConfig
};
