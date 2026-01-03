/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MYSTERY BOX CONFIG HANDLER - Interface de Configuration Admin V2
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Gestion complète des mystery boxes par rareté:
 * - Configuration des boxes (nom, emoji, couleur via sélecteur, probabilités forcées à 100%)
 * - Gestion des chances d'upgrade par rareté (step-by-step)
 * - Sélection des collectibles et super bonus spécifiques
 * - Upload d'images via thread
 * - Configuration animation, textes personnalisés, pity system
 *
 * @author Bot Discord
 * @version 2.2.0
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType
} = require('discord.js');
const db = require('../utils/database-pg');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES ET CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const RARITY_CONFIG = {
    common: { emoji: '⚪', label: 'COMMUNE', color: '#95A5A6', order: 1 },
    rare: { emoji: '🔵', label: 'RARE', color: '#3498DB', order: 2 },
    epic: { emoji: '🟣', label: 'ÉPIQUE', color: '#9B59B6', order: 3 },
    legendary: { emoji: '🟡', label: 'LÉGENDAIRE', color: '#F1C40F', order: 4 }
};

const UPGRADE_PATH = {
    common: 'rare',
    rare: 'epic',
    epic: 'legendary',
    legendary: null
};

// Palettes de couleurs (réutilisation du système existant)
const COLOR_PALETTES = {
    basiques: [
        { name: '🔴 Rouge', value: '#E74C3C', emoji: '🔴' },
        { name: '🟠 Orange', value: '#E67E22', emoji: '🟠' },
        { name: '🟡 Jaune', value: '#F1C40F', emoji: '🟡' },
        { name: '🟢 Vert', value: '#2ECC71', emoji: '🟢' },
        { name: '🔵 Bleu', value: '#3498DB', emoji: '🔵' },
        { name: '🟣 Violet', value: '#9B59B6', emoji: '🟣' }
    ],
    pastel: [
        { name: '🌸 Rose Pastel', value: '#FFB6C1', emoji: '🌸' },
        { name: '🍑 Pêche', value: '#FFDAB9', emoji: '🍑' },
        { name: '🌿 Menthe', value: '#98FF98', emoji: '🌿' },
        { name: '💠 Cyan Pastel', value: '#B0E0E6', emoji: '💠' },
        { name: '💜 Lavande', value: '#E6E6FA', emoji: '💜' }
    ],
    vives: [
        { name: '💖 Magenta', value: '#FF00FF', emoji: '💖' },
        { name: '💚 Lime', value: '#00FF00', emoji: '💚' },
        { name: '💙 Cyan', value: '#00FFFF', emoji: '💙' },
        { name: '🧡 Orange Vif', value: '#FF4500', emoji: '🧡' },
        { name: '💛 Or', value: '#FFD700', emoji: '💛' }
    ],
    discord: [
        { name: '⬛ Discord Dark', value: '#2B2D31', emoji: '⬛' },
        { name: '🟦 Blurple', value: '#5865F2', emoji: '🟦' },
        { name: '🟩 Discord Green', value: '#57F287', emoji: '🟩' },
        { name: '🟨 Discord Yellow', value: '#FEE75C', emoji: '🟨' },
        { name: '🟥 Discord Red', value: '#ED4245', emoji: '🟥' }
    ]
};

// Cache pour les uploads d'images (par utilisateur)
const imageUploadCache = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: PANEL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Afficher le panel principal de configuration des Mystery Boxes
 */
async function showMysteryBoxConfigPanel(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;

    // Récupérer le thème actif pour filtrer les boxes
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif. Activez un thème d\'abord.',
            embeds: [],
            components: []
        });
    }

    const boxes = await db.queryAll(`
        SELECT
            mbc.*,
            t.name as theme_name
        FROM mystery_box_config mbc
        LEFT JOIN themes t ON mbc.theme_id = t.id
        WHERE mbc.guild_id = $1 AND mbc.theme_id = $2
        ORDER BY
            CASE mbc.rarity
                WHEN 'common' THEN 1
                WHEN 'rare' THEN 2
                WHEN 'epic' THEN 3
                WHEN 'legendary' THEN 4
            END,
            mbc.is_default DESC,
            mbc.name ASC
    `, [guildId, activeTheme.id]);

    const stats = {
        common: boxes.filter(b => b.rarity === 'common'),
        rare: boxes.filter(b => b.rarity === 'rare'),
        epic: boxes.filter(b => b.rarity === 'epic'),
        legendary: boxes.filter(b => b.rarity === 'legendary')
    };

    // Récupérer les chances d'upgrade
    const upgradeChances = {};
    for (const rarity of ['common', 'rare', 'epic']) {
        const defaultBox = boxes.find(b => b.rarity === rarity && b.is_default);
        if (defaultBox) {
            const targetRarity = UPGRADE_PATH[rarity];
            const columnName = `rarity_upgrade_${targetRarity}`;
            upgradeChances[rarity] = defaultBox[columnName] || 0;
        } else {
            upgradeChances[rarity] = 0;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('📦 CONFIGURATION MYSTERY BOXES')
        .setColor('#2B2D31')
        .setDescription(
            `### 🎁 Vue d'ensemble\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `\`\`\`ansi\n` +
            `${RARITY_CONFIG.common.emoji} Common:    ${stats.common.length} box(es)  |  ` +
            `${RARITY_CONFIG.rare.emoji} Rare:      ${stats.rare.length} box(es)\n` +
            `${RARITY_CONFIG.epic.emoji} Epic:      ${stats.epic.length} box(es)  |  ` +
            `${RARITY_CONFIG.legendary.emoji} Legendary: ${stats.legendary.length} box(es)\n` +
            `\`\`\`\n\n` +
            `### ⬆️ Chances d'Upgrade (Step-by-Step)\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${RARITY_CONFIG.common.emoji} Common → Rare: **${upgradeChances.common}%**\n` +
            `${RARITY_CONFIG.rare.emoji} Rare → Epic: **${upgradeChances.rare}%**\n` +
            `${RARITY_CONFIG.epic.emoji} Epic → Legendary: **${upgradeChances.epic}%**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 *Sélectionne une rareté pour gérer ses boxes*`
        )
        .setFooter({ text: '📦 Mystery Box Config • v2.2.0' })
        .setTimestamp();

    const raritySelect = new StringSelectMenuBuilder()
        .setCustomId('mb_config_rarity_select')
        .setPlaceholder('Sélectionner une rareté à configurer')
        .addOptions([
            {
                label: `${RARITY_CONFIG.common.emoji} Boxes Communes`,
                description: `${stats.common.length} box(es) configurée(s)`,
                value: 'common',
                emoji: '⚪'
            },
            {
                label: `${RARITY_CONFIG.rare.emoji} Boxes Rares`,
                description: `${stats.rare.length} box(es) configurée(s)`,
                value: 'rare',
                emoji: '🔵'
            },
            {
                label: `${RARITY_CONFIG.epic.emoji} Boxes Épiques`,
                description: `${stats.epic.length} box(es) configurée(s)`,
                value: 'epic',
                emoji: '🟣'
            },
            {
                label: `${RARITY_CONFIG.legendary.emoji} Boxes Légendaires`,
                description: `${stats.legendary.length} box(es) configurée(s)`,
                value: 'legendary',
                emoji: '🟡'
            }
        ]);

    const row1 = new ActionRowBuilder().addComponents(raritySelect);

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('mb_config_upgrade_settings')
            .setLabel('⬆️ Config Upgrades')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('mb_config_preview')
            .setLabel('👁️ Aperçu Probabilités')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('admin_settings')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: LISTE DES BOXES PAR RARETÉ
// ═══════════════════════════════════════════════════════════════════════════════

async function showBoxList(interaction, rarity) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;
    const config = RARITY_CONFIG[rarity];

    // Récupérer le thème actif pour filtrer les boxes
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif. Créez ou activez un thème d\'abord.',
            components: []
        });
    }

    const boxes = await db.queryAll(`
        SELECT
            id, name, emoji, color,
            prob_collectible, prob_super_bonus,
            is_default, is_enabled,
            total_opened,
            pity_system_enabled,
            animation_duration
        FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
        ORDER BY is_default DESC, name ASC
    `, [guildId, rarity, activeTheme.id]);

    let boxList = '';
    if (boxes.length === 0) {
        boxList = '*Aucune box configurée pour cette rareté*\n\n';
    } else {
        boxes.forEach((box) => {
            const defaultBadge = box.is_default ? ' 🌟' : '';
            const enabledBadge = box.is_enabled ? '🟢' : '🔴';
            const pityBadge = box.pity_system_enabled ? ' 🎰' : '';
            const total = box.prob_collectible + box.prob_super_bonus;

            boxList += `${enabledBadge} **${box.emoji || '📦'} ${box.name}**${defaultBadge}${pityBadge}\n`;
            boxList += `   └ 🎨 ${box.prob_collectible}% | ✨ ${box.prob_super_bonus}%`;
            if (total !== 100) boxList += ` ⚠️ (${total}%)`;
            if (box.total_opened > 0) boxList += ` | 📊 ${box.total_opened}`;
            boxList += '\n\n';
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(`${config.emoji} BOXES ${config.label}S`)
        .setColor(config.color)
        .setDescription(
            `### 📋 Liste des Mystery Boxes\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            boxList +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🌟 = Par défaut | 🎰 = Pity activé\n` +
            `🟢 = Activée | 🔴 = Désactivée\n` +
            `⚠️ = Probabilités ≠ 100%`
        )
        .setFooter({ text: `${boxes.length} box(es) • Clique pour éditer` })
        .setTimestamp();

    const components = [];

    if (boxes.length > 0) {
        const boxOptions = boxes.slice(0, 25).map(box => ({
            label: `${box.emoji || '📦'} ${box.name}`.substring(0, 100),
            description: `${box.is_enabled ? '✅' : '❌'} | 🎨${box.prob_collectible}% ✨${box.prob_super_bonus}%`,
            value: `box_${box.id}`,
            emoji: box.is_default ? '🌟' : (box.is_enabled ? '🟢' : '🔴')
        }));

        const boxSelect = new StringSelectMenuBuilder()
            .setCustomId(`mb_config_box_select:${rarity}`)
            .setPlaceholder('Sélectionner une box à éditer')
            .addOptions(boxOptions);

        components.push(new ActionRowBuilder().addComponents(boxSelect));
    }

    // Bouton Apparence (par rareté - partagé)
    const appearanceRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_appearance:${rarity}`)
            .setLabel('🎨 Apparence de la rareté')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(boxes.length === 0),
        new ButtonBuilder()
            .setCustomId(`mb_config_create_box:${rarity}`)
            .setLabel('➕ Créer une Box')
            .setStyle(ButtonStyle.Success)
    );
    components.push(appearanceRow);

    // Bouton retour
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('mb_config_panel')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );
    components.push(backRow);

    await interaction.editReply({
        embeds: [embed],
        components
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2B: ÉDITEUR D'APPARENCE PAR RARETÉ (PARTAGÉ)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Affiche l'éditeur d'apparence pour une rareté
 * Ces paramètres sont partagés par TOUTES les boxes de cette rareté
 */
async function showRarityAppearanceEditor(interaction, rarity) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;
    const config = RARITY_CONFIG[rarity];

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            components: []
        });
    }

    // Récupérer la box par défaut ou la première box pour l'apparence
    const referenceBox = await db.queryOne(`
        SELECT * FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
        ORDER BY is_default DESC, id ASC
        LIMIT 1
    `, [guildId, rarity, activeTheme.id]);

    if (!referenceBox) {
        return interaction.followUp({
            content: '❌ Aucune box trouvée pour cette rareté. Créez d\'abord une box.',
            flags: 64
        });
    }

    // Vérifier le nombre de récompenses configuré
    const rewardsCount = referenceBox.rewards_count || 1;

    const embed = new EmbedBuilder()
        .setTitle(`🎨 APPARENCE - Boxes ${config.label}S`)
        .setColor(referenceBox.color || config.color)
        .setDescription(
            `### 🖌️ Paramètres d'Apparence (Partagés)\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Ces paramètres s'appliquent à **TOUTES** les boxes ${config.label.toLowerCase()}s*\n\n` +
            `**Emoji:** ${referenceBox.emoji || '📦'}\n` +
            `**Couleur:** ${referenceBox.color || config.color}\n\n` +
            `### 🖼️ Images\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📦 **Fermée:** ${referenceBox.image_closed ? '✅ Configurée' : '❌ Par défaut'}\n` +
            `🔄 **Ouverture:** ${referenceBox.image_opening ? '✅ Configurée' : '❌ Par défaut'}\n` +
            `🎁 **Ouverte:** ${referenceBox.image_opened ? '✅ Configurée' : '❌ Par défaut'}\n\n` +
            `### 📝 Textes\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📌 **Titre:** ${referenceBox.text_title ? referenceBox.text_title.substring(0, 30) + '...' : 'Par défaut'}\n` +
            `📖 **Description:** ${referenceBox.text_description ? '✅' : '❌'}\n` +
            `⏳ **Ouverture:** ${referenceBox.text_opening ? '✅' : '❌'}\n` +
            `🎉 **Succès:** ${referenceBox.text_success ? '✅' : '❌'}\n\n` +
            `### ⚙️ Paramètres\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⏱️ **Animation:** ${referenceBox.animation_duration || 3000}ms\n` +
            `🎁 **Récompenses:** ${rewardsCount} item${rewardsCount > 1 ? 's' : ''} par ouverture\n` +
            `🎰 **Pity System:** ${referenceBox.pity_system_enabled ? `✅ (seuil: ${referenceBox.pity_counter_max || 10})` : '❌'}\n`
        )
        .setThumbnail(referenceBox.image_closed || null)
        .setFooter({ text: `Apparence partagée • ${rarity}` })
        .setTimestamp();

    // Row 1: Apparence de base
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_color:${rarity}`)
            .setLabel('🎨 Couleur')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_images:${rarity}`)
            .setLabel('🖼️ Images')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_texts:${rarity}`)
            .setLabel('📝 Textes')
            .setStyle(ButtonStyle.Primary)
    );

    // Row 2: Options avancées
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_animation:${rarity}`)
            .setLabel('⏱️ Animation')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_rewards:${rarity}`)
            .setLabel(`🎁 Récompenses: ${rewardsCount}`)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_pity:${rarity}`)
            .setLabel(referenceBox.pity_system_enabled ? '🎰 Pity: ON' : '🎰 Pity: OFF')
            .setStyle(referenceBox.pity_system_enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    // Row 3: Navigation
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity:${rarity}`)
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3]
    });
}

/**
 * Sélecteur de couleur pour une rareté (met à jour TOUTES les boxes)
 */
async function showRarityColorSelector(interaction, rarity) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const config = RARITY_CONFIG[rarity];

    const embed = new EmbedBuilder()
        .setTitle(`🎨 Couleur - Boxes ${config.label}S`)
        .setColor(config.color)
        .setDescription(
            `### 🖌️ Sélectionner une couleur\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Cette couleur sera appliquée à **TOUTES** les boxes ${config.label.toLowerCase()}s*\n\n` +
            `Sélectionne une palette puis choisis ta couleur.`
        )
        .setFooter({ text: `Apparence partagée • ${rarity}` });

    const paletteSelect = new StringSelectMenuBuilder()
        .setCustomId(`mb_config_rarity_palette:${rarity}`)
        .setPlaceholder('Choisir une palette')
        .addOptions([
            { label: '🔴🟡🟢 Basiques', value: 'basiques', description: 'Couleurs primaires' },
            { label: '🌸🍑🌿 Pastel', value: 'pastel', description: 'Couleurs douces' },
            { label: '💖💚💙 Vives', value: 'vives', description: 'Couleurs éclatantes' },
            { label: '⬛🟦 Discord', value: 'discord', description: 'Couleurs Discord' }
        ]);

    const row1 = new ActionRowBuilder().addComponents(paletteSelect);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_appearance:${rarity}`)
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

/**
 * Modal pour les textes d'une rareté (met à jour TOUTES les boxes)
 */
async function showRarityTextsModal(interaction, rarity) {
    const guildId = interaction.guildId;
    const config = RARITY_CONFIG[rarity];

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) return;

    // Récupérer les textes actuels depuis la box par défaut
    const referenceBox = await db.queryOne(`
        SELECT text_title, text_description, text_opening, text_success, text_empty
        FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
        ORDER BY is_default DESC, id ASC
        LIMIT 1
    `, [guildId, rarity, activeTheme.id]);

    const modal = new ModalBuilder()
        .setCustomId(`mb_config_modal_rarity_texts:${rarity}`)
        .setTitle(`Textes - Boxes ${config.label}s`);

    const titleInput = new TextInputBuilder()
        .setCustomId('text_title')
        .setLabel('Titre')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Mystery Box Rare')
        .setValue(referenceBox?.text_title || '')
        .setRequired(false);

    const descInput = new TextInputBuilder()
        .setCustomId('text_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Description de la box...')
        .setValue(referenceBox?.text_description || '')
        .setRequired(false);

    const openingInput = new TextInputBuilder()
        .setCustomId('text_opening')
        .setLabel('Texte d\'ouverture')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Tu ouvres une Mystery Box...')
        .setValue(referenceBox?.text_opening || '')
        .setRequired(false);

    const successInput = new TextInputBuilder()
        .setCustomId('text_success')
        .setLabel('Texte de succès')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Félicitations !')
        .setValue(referenceBox?.text_success || '')
        .setRequired(false);

    const emptyInput = new TextInputBuilder()
        .setCustomId('text_empty')
        .setLabel('Texte box vide')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: La box était vide...')
        .setValue(referenceBox?.text_empty || '')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(openingInput),
        new ActionRowBuilder().addComponents(successInput),
        new ActionRowBuilder().addComponents(emptyInput)
    );

    await interaction.showModal(modal);
}

/**
 * Modal pour l'animation d'une rareté (met à jour TOUTES les boxes)
 */
async function showRarityAnimationModal(interaction, rarity) {
    const guildId = interaction.guildId;
    const config = RARITY_CONFIG[rarity];

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) return;

    const referenceBox = await db.queryOne(`
        SELECT animation_duration
        FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
        ORDER BY is_default DESC, id ASC
        LIMIT 1
    `, [guildId, rarity, activeTheme.id]);

    const modal = new ModalBuilder()
        .setCustomId(`mb_config_modal_rarity_animation:${rarity}`)
        .setTitle(`Animation - Boxes ${config.label}s`);

    const durationInput = new TextInputBuilder()
        .setCustomId('animation_duration')
        .setLabel('Durée d\'animation (ms)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 3000')
        .setValue(String(referenceBox?.animation_duration || 3000))
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(durationInput)
    );

    await interaction.showModal(modal);
}

/**
 * Modal pour configurer le nombre de récompenses par rareté
 */
async function showRarityRewardsModal(interaction, rarity) {
    const guildId = interaction.guildId;
    const config = RARITY_CONFIG[rarity];

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.reply({
            content: '❌ Aucun thème actif. Créez ou activez un thème d\'abord.',
            flags: 64
        });
    }

    const referenceBox = await db.queryOne(`
        SELECT rewards_count
        FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
        ORDER BY is_default DESC, id ASC
        LIMIT 1
    `, [guildId, rarity, activeTheme.id]);

    const modal = new ModalBuilder()
        .setCustomId(`mb_config_modal_rarity_rewards:${rarity}`)
        .setTitle(`Récompenses - Boxes ${config.label}s`);

    const countInput = new TextInputBuilder()
        .setCustomId('rewards_count')
        .setLabel('Nombre de récompenses par ouverture (1-5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1, 2, 3...')
        .setValue(String(referenceBox?.rewards_count || 1))
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(countInput)
    );

    await interaction.showModal(modal);
}

/**
 * Upload d'images pour une rareté (thread)
 */
async function showRarityImagesUpload(interaction, rarity) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;
    const config = RARITY_CONFIG[rarity];

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif. Créez ou activez un thème d\'abord.',
            embeds: [],
            components: []
        });
    }

    const referenceBox = await db.queryOne(`
        SELECT image_closed, image_opening, image_opened, image_empty
        FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
        ORDER BY is_default DESC, id ASC
        LIMIT 1
    `, [guildId, rarity, activeTheme.id]);

    const embed = new EmbedBuilder()
        .setTitle(`🖼️ Images - Boxes ${config.label}S`)
        .setColor(config.color)
        .setDescription(
            `### 📷 Configuration des images\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Ces images seront utilisées par **TOUTES** les boxes ${config.label.toLowerCase()}s*\n\n` +
            `📦 **Fermée:** ${referenceBox?.image_closed ? '✅' : '❌'}\n` +
            `🔄 **Ouverture:** ${referenceBox?.image_opening ? '✅' : '❌'}\n` +
            `🎁 **Ouverte:** ${referenceBox?.image_opened ? '✅' : '❌'}\n` +
            `❌ **Vide:** ${referenceBox?.image_empty ? '✅' : '❌'}\n\n` +
            `*Envoie les URLs des images ci-dessous pour les configurer.*`
        )
        .setThumbnail(referenceBox?.image_closed || null)
        .setFooter({ text: `Apparence partagée • ${rarity}` });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_img_closed:${rarity}`)
            .setLabel('📦 Fermée')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_img_opening:${rarity}`)
            .setLabel('🔄 Ouverture')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_img_opened:${rarity}`)
            .setLabel('🎁 Ouverte')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity_img_empty:${rarity}`)
            .setLabel('❌ Vide')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_appearance:${rarity}`)
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

/**
 * Toggle pity system pour une rareté (met à jour TOUTES les boxes)
 */
async function toggleRarityPity(interaction, rarity) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif. Créez ou activez un thème d\'abord.',
            embeds: [],
            components: []
        });
    }

    // Récupérer l'état actuel
    const referenceBox = await db.queryOne(`
        SELECT pity_system_enabled FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
        ORDER BY is_default DESC, id ASC
        LIMIT 1
    `, [guildId, rarity, activeTheme.id]);

    const newState = !referenceBox?.pity_system_enabled;

    // Mettre à jour TOUTES les boxes de cette rareté pour ce thème
    await db.query(`
        UPDATE mystery_box_config
        SET pity_system_enabled = $1, updated_at = NOW()
        WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4
    `, [newState, guildId, rarity, activeTheme.id]);

    console.log(`📦 [MB CONFIG] Pity ${newState ? 'activé' : 'désactivé'} pour TOUTES les boxes ${rarity}`);

    return showRarityAppearanceEditor(interaction, rarity);
}

/**
 * Met à jour TOUTES les boxes d'une rareté avec une nouvelle couleur
 */
async function updateRarityColor(interaction, rarity, color) {
    const guildId = interaction.guildId;

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) return;

    await db.query(`
        UPDATE mystery_box_config
        SET color = $1, updated_at = NOW()
        WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4
    `, [color, guildId, rarity, activeTheme.id]);

    console.log(`📦 [MB CONFIG] Couleur ${color} appliquée à TOUTES les boxes ${rarity} (thème ${activeTheme.id})`);
}

/**
 * Met à jour TOUTES les boxes d'une rareté avec de nouveaux textes
 */
async function updateRarityTexts(interaction, rarity, texts) {
    const guildId = interaction.guildId;

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) return;

    await db.query(`
        UPDATE mystery_box_config
        SET
            text_title = COALESCE($1, text_title),
            text_description = COALESCE($2, text_description),
            text_opening = COALESCE($3, text_opening),
            text_success = COALESCE($4, text_success),
            updated_at = NOW()
        WHERE guild_id = $5 AND rarity = $6 AND theme_id = $7
    `, [texts.title || null, texts.description || null, texts.opening || null, texts.success || null, guildId, rarity, activeTheme.id]);

    console.log(`📦 [MB CONFIG] Textes mis à jour pour TOUTES les boxes ${rarity} (thème ${activeTheme.id})`);
}

/**
 * Met à jour TOUTES les boxes d'une rareté avec une nouvelle animation
 */
async function updateRarityAnimation(interaction, rarity, duration) {
    const guildId = interaction.guildId;

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) return;

    await db.query(`
        UPDATE mystery_box_config
        SET animation_duration = $1, updated_at = NOW()
        WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4
    `, [duration, guildId, rarity, activeTheme.id]);

    console.log(`📦 [MB CONFIG] Animation ${duration}ms appliquée à TOUTES les boxes ${rarity} (thème ${activeTheme.id})`);
}

/**
 * Met à jour TOUTES les boxes d'une rareté avec une nouvelle image
 */
async function updateRarityImage(interaction, rarity, imageType, imageUrl) {
    const guildId = interaction.guildId;
    const column = `image_${imageType}`;

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) return;

    await db.query(`
        UPDATE mystery_box_config
        SET ${column} = $1, updated_at = NOW()
        WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4
    `, [imageUrl, guildId, rarity, activeTheme.id]);

    console.log(`📦 [MB CONFIG] Image ${imageType} mise à jour pour TOUTES les boxes ${rarity} (thème ${activeTheme.id})`);
}

/**
 * Upload d'image via thread pour une rareté (comme les collectibles)
 */
async function showRarityImageUploadThread(interaction, rarity, imageType) {
    const guildId = interaction.guildId;
    const config = RARITY_CONFIG[rarity];
    const imageLabels = {
        closed: '📦 Fermée',
        opening: '🔄 Ouverture',
        opened: '🎁 Ouverte',
        empty: '❌ Vide'
    };

    try {
        // Récupérer le thème actif AVANT le thread
        const activeTheme = await db.getActiveTheme(guildId);
        if (!activeTheme) {
            return interaction.reply({
                content: '❌ Aucun thème actif. Créez ou activez un thème d\'abord.',
                flags: 64
            });
        }

        const channel = interaction.channel;

        // Créer un thread privé pour l'upload
        const threadName = `📷 MB ${config.label} ${imageLabels[imageType]} - ${interaction.user.username}`;

        const thread = await channel.threads.create({
            name: threadName.substring(0, 100),
            autoArchiveDuration: 60,
            type: 12, // PRIVATE_THREAD
            reason: `Upload image ${imageType} pour boxes ${rarity}`
        });

        // Ajouter l'utilisateur au thread
        await thread.members.add(interaction.user.id);

        // Defer l'interaction
        await interaction.deferUpdate();

        // Récupérer l'URL actuelle
        const column = `image_${imageType}`;
        const referenceBox = await db.queryOne(`
            SELECT ${column}
            FROM mystery_box_config
            WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
            ORDER BY is_default DESC, id ASC
            LIMIT 1
        `, [guildId, rarity, activeTheme.id]);

        const currentUrl = referenceBox?.[column];

        // Message dans le thread
        let instructions = `${config.emoji} **UPLOAD IMAGE ${imageLabels[imageType].toUpperCase()}**\n\n`;
        instructions += `📦 **Rareté:** ${config.label}\n`;
        instructions += `🖼️ **Type:** ${imageLabels[imageType]}\n\n`;

        if (currentUrl) {
            instructions += `📷 **Image actuelle:**\n${currentUrl}\n\n`;
        }

        instructions += `🎯 **Instructions:**\n`;
        instructions += `• Drag & drop ton image ici\n`;
        instructions += `• Ou colle un screenshot (Ctrl+V)\n`;
        instructions += `• Ou colle une **URL d'image** (https://...)\n`;
        instructions += `• Formats acceptés: PNG, JPG, GIF, WEBP\n\n`;
        instructions += `⏱️ Tu as **2 minutes**\n\n`;
        instructions += `💡 L'image sera appliquée à **toutes les boxes ${config.label}s** du thème actif.`;

        await thread.send({ content: instructions });

        // MessageCollector pour l'image (attachment OU URL)
        const filter = (m) => {
            if (m.author.id !== interaction.user.id) return false;
            if (m.attachments.size > 0) return true;
            // Accepter toute URL HTTP/HTTPS
            const urlPattern = /https?:\/\/[^\s]+/i;
            if (urlPattern.test(m.content)) return true;
            return false;
        };

        const collector = thread.createMessageCollector({
            filter,
            time: 120000,
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
                    imageUrl = match[0].replace(/[<>)}\]]+$/, '');
                } else {
                    await thread.send('❌ URL invalide. Colle une URL commençant par http:// ou https://');
                    return;
                }
            }

            // Mettre à jour TOUTES les boxes de cette rareté pour ce thème
            await db.query(`
                UPDATE mystery_box_config
                SET ${column} = $1, updated_at = NOW()
                WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4
            `, [imageUrl, guildId, rarity, activeTheme.id]);

            console.log(`📦 [MB CONFIG] Image ${imageType} uploadée via thread pour boxes ${rarity} (thème ${activeTheme.id})`);

            await thread.send({
                content: `✅ **Image ${imageLabels[imageType]} mise à jour !**\n\n` +
                    `📦 **Rareté:** ${config.label}\n` +
                    `📷 **Nouvelle URL:** ${imageUrl}\n\n` +
                    `🔒 Ce thread sera archivé dans 10 secondes...`
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
                await thread.send('⏱️ **Temps écoulé !** Aucune image uploadée. Ce thread sera archivé.');
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
        console.error('🔴 [MB CONFIG] Erreur upload thread:', error);

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

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: ÉDITEUR DE CONTENU (PAR BOX)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Éditeur de contenu pour une box spécifique
 * Contenu = probabilités, collectibles spécifiques, super bonus spécifiques
 */
async function showBoxEditor(interaction, boxId) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT * FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) {
        return interaction.followUp({
            content: '❌ Box introuvable.',
            flags: 64
        });
    }

    const config = RARITY_CONFIG[box.rarity];
    const totalProb = box.prob_collectible + box.prob_super_bonus;

    // Compter les items spécifiques
    const specificCollectibles = box.specific_collectibles && Array.isArray(box.specific_collectibles)
        ? box.specific_collectibles.length
        : (box.specific_collectibles ? JSON.parse(box.specific_collectibles).length : 0);
    const specificBonuses = box.specific_super_bonuses && Array.isArray(box.specific_super_bonuses)
        ? box.specific_super_bonuses.length
        : (box.specific_super_bonuses ? JSON.parse(box.specific_super_bonuses).length : 0);

    // Récupérer le thème actif pour vérifier le contenu disponible
    const theme = await db.getActiveTheme(guildId);

    // Vérifier si du contenu est disponible
    let collectiblesCount = specificCollectibles;
    let bonusesCount = specificBonuses;

    if (collectiblesCount === 0 && theme) {
        // Compter les collectibles du thème dans cette rareté
        const countResult = await db.queryOne(`
            SELECT COUNT(*) as cnt FROM collectibles
            WHERE guild_id = $1 AND theme_id = $2 AND rarity = $3
        `, [guildId, theme.id, box.rarity]);
        collectiblesCount = parseInt(countResult?.cnt || 0);
    }

    if (bonusesCount === 0 && theme) {
        // Compter les super bonus disponibles
        const countResult = await db.queryOne(`
            SELECT COUNT(*) as cnt FROM super_bonuses
            WHERE guild_id = $1 AND (theme_id IS NULL OR theme_id = $2) AND is_enabled = true
        `, [guildId, theme.id]);
        bonusesCount = parseInt(countResult?.cnt || 0);
    }

    // Générer les warnings
    let warnings = [];
    if (box.prob_collectible > 0 && collectiblesCount === 0) {
        warnings.push(`⚠️ **Attention:** Probabilité collectible (${box.prob_collectible}%) mais aucun collectible ${box.rarity} disponible!`);
    }
    if (box.prob_super_bonus > 0 && bonusesCount === 0) {
        warnings.push(`⚠️ **Attention:** Probabilité super bonus (${box.prob_super_bonus}%) mais aucun super bonus disponible!`);
    }

    const warningText = warnings.length > 0
        ? `\n### ⚠️ Avertissements\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${warnings.join('\n')}\n*Les probabilités seront redistribuées automatiquement à l'ouverture.*\n`
        : '';

    const embed = new EmbedBuilder()
        .setTitle(`📦 Contenu - Box #${box.id}`)
        .setColor(warnings.length > 0 ? '#FFA500' : (box.color || config.color))
        .setDescription(
            `### 🎁 Configuration du Contenu\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*L'apparence (images, textes, animation) se configure via le bouton "🎨 Apparence de la rareté"*\n\n` +
            `**Rareté:** ${config.emoji} ${config.label}\n` +
            `**Statut:** ${box.is_enabled ? '🟢 Activée' : '🔴 Désactivée'}` +
            `${box.is_default ? ' 🌟 (Par défaut)' : ''}\n\n` +
            `### 🎲 Probabilités\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🎨 **Collectible:** ${box.prob_collectible}%` +
            `${collectiblesCount > 0 ? ` (${collectiblesCount} dispo)` : ' ⚠️'}\n` +
            `✨ **Super Bonus:** ${box.prob_super_bonus}%` +
            `${bonusesCount > 0 ? ` (${bonusesCount} dispo)` : ' ⚠️'}\n` +
            `📊 **Total:** ${totalProb}% ${totalProb === 100 ? '✅' : '⚠️ (doit être 100%)'}\n\n` +
            `### 🎯 Contenu Spécifique\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🎨 **Collectibles:** ${specificCollectibles > 0 ? `${specificCollectibles} sélectionné(s)` : 'Tous du thème'}\n` +
            `✨ **Super Bonus:** ${specificBonuses > 0 ? `${specificBonuses} sélectionné(s)` : 'Tous disponibles'}\n` +
            warningText
        )
        .setFooter({ text: `ID: ${box.id} • ${box.rarity} • Contenu individuel` })
        .setTimestamp();

    // Row 1: Probabilités et contenu (INDIVIDUEL PAR BOX)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_edit_probs:${boxId}`)
            .setLabel('🎲 Probabilités')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`mb_config_select_collectibles:${boxId}`)
            .setLabel('🎨 Collectibles')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`mb_config_select_bonuses:${boxId}`)
            .setLabel('✨ Super Bonus')
            .setStyle(ButtonStyle.Primary)
    );

    // Row 2: Actions sur la box
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_toggle:${boxId}`)
            .setLabel(box.is_enabled ? '🔴 Désactiver' : '🟢 Activer')
            .setStyle(box.is_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`mb_config_set_default:${boxId}`)
            .setLabel('🌟 Par défaut')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(box.is_default),
        new ButtonBuilder()
            .setCustomId(`mb_config_duplicate:${boxId}`)
            .setLabel('📋 Dupliquer')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`mb_config_delete:${boxId}`)
            .setLabel('🗑️')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(box.is_default)
    );

    // Row 3: Navigation
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_rarity:${box.rarity}`)
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3]
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: CRÉATION DE BOX
// ═══════════════════════════════════════════════════════════════════════════════

async function createNewBox(interaction, rarity) {
    const guildId = interaction.guildId;
    const config = RARITY_CONFIG[rarity];

    // Récupérer le thème actif (OBLIGATOIRE)
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.followUp({
            content: '❌ Aucun thème actif. Créez ou activez un thème d\'abord.',
            flags: 64
        });
    }

    // Valeurs par défaut (FORCÉ à 100%)
    const defaults = {
        common: { prob_collectible: 70, prob_super_bonus: 30 },
        rare: { prob_collectible: 65, prob_super_bonus: 35 },
        epic: { prob_collectible: 60, prob_super_bonus: 40 },
        legendary: { prob_collectible: 55, prob_super_bonus: 45 }
    };

    const probs = defaults[rarity];

    const newBox = await db.queryOne(`
        INSERT INTO mystery_box_config (
            guild_id, theme_id, rarity, name, emoji, color,
            prob_collectible, prob_super_bonus,
            is_default, is_enabled,
            animation_duration
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, FALSE, TRUE, 3000
        )
        RETURNING id
    `, [
        guildId,
        activeTheme.id,
        rarity,
        `${config.emoji} Nouvelle Box ${config.label}`,
        config.emoji === '⚪' ? '📦' : config.emoji,
        config.color,
        probs.prob_collectible,
        probs.prob_super_bonus
    ]);

    console.log(`📦 [MB CONFIG] Nouvelle box créée: ${newBox.id} (${rarity}) pour thème ${activeTheme.id}`);

    await showBoxEditor(interaction, newBox.id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: MODALS D'ÉDITION
// ═══════════════════════════════════════════════════════════════════════════════

async function showBasicEditModal(interaction, boxId) {
    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT name, emoji FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    const modal = new ModalBuilder()
        .setCustomId(`mb_config_modal_basic:${boxId}`)
        .setTitle('Éditer la Box');

    const nameInput = new TextInputBuilder()
        .setCustomId('box_name')
        .setLabel('Nom de la box')
        .setStyle(TextInputStyle.Short)
        .setValue(box.name || '')
        .setRequired(true)
        .setMaxLength(100);

    const emojiInput = new TextInputBuilder()
        .setCustomId('box_emoji')
        .setLabel('Emoji')
        .setStyle(TextInputStyle.Short)
        .setValue(box.emoji || '📦')
        .setRequired(false)
        .setMaxLength(10);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(emojiInput)
    );

    await interaction.showModal(modal);
}

/**
 * Modal des probabilités - FORCÉ À 100%
 */
async function showProbabilitiesModal(interaction, boxId) {
    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT prob_collectible, prob_super_bonus FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    const modal = new ModalBuilder()
        .setCustomId(`mb_config_modal_probs:${boxId}`)
        .setTitle('Probabilités (Total = 100%)');

    const collectibleInput = new TextInputBuilder()
        .setCustomId('prob_collectible')
        .setLabel('% Collectible (Super Bonus = 100 - valeur)')
        .setStyle(TextInputStyle.Short)
        .setValue(String(box.prob_collectible || 70))
        .setPlaceholder('Entrez un nombre entre 0 et 100')
        .setRequired(true)
        .setMaxLength(3);

    modal.addComponents(
        new ActionRowBuilder().addComponents(collectibleInput)
    );

    await interaction.showModal(modal);
}

/**
 * Modal d'animation
 */
async function showAnimationModal(interaction, boxId) {
    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT animation_duration FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    const modal = new ModalBuilder()
        .setCustomId(`mb_config_modal_animation:${boxId}`)
        .setTitle('Configuration Animation');

    const durationInput = new TextInputBuilder()
        .setCustomId('animation_duration')
        .setLabel('Durée animation (ms) - ex: 3000 = 3 secondes')
        .setStyle(TextInputStyle.Short)
        .setValue(String(box.animation_duration || 3000))
        .setPlaceholder('1000 à 10000')
        .setRequired(true)
        .setMaxLength(5);

    modal.addComponents(
        new ActionRowBuilder().addComponents(durationInput)
    );

    await interaction.showModal(modal);
}

/**
 * Modal des textes personnalisés
 */
async function showTextsModal(interaction, boxId) {
    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT text_title, text_description, text_opening, text_success
        FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    const modal = new ModalBuilder()
        .setCustomId(`mb_config_modal_texts:${boxId}`)
        .setTitle('Textes personnalisés');

    const titleInput = new TextInputBuilder()
        .setCustomId('text_title')
        .setLabel('Titre (laisser vide = défaut)')
        .setStyle(TextInputStyle.Short)
        .setValue(box.text_title || '')
        .setRequired(false)
        .setMaxLength(100);

    const descInput = new TextInputBuilder()
        .setCustomId('text_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(box.text_description || '')
        .setRequired(false)
        .setMaxLength(500);

    const openingInput = new TextInputBuilder()
        .setCustomId('text_opening')
        .setLabel('Message d\'ouverture')
        .setStyle(TextInputStyle.Short)
        .setValue(box.text_opening || '')
        .setRequired(false)
        .setMaxLength(200);

    const successInput = new TextInputBuilder()
        .setCustomId('text_success')
        .setLabel('Message de succès')
        .setStyle(TextInputStyle.Short)
        .setValue(box.text_success || '')
        .setRequired(false)
        .setMaxLength(200);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(openingInput),
        new ActionRowBuilder().addComponents(successInput)
    );

    await interaction.showModal(modal);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: SÉLECTEUR DE COULEUR
// ═══════════════════════════════════════════════════════════════════════════════

async function showColorSelector(interaction, boxId) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT name, color FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    const embed = new EmbedBuilder()
        .setTitle('🎨 Sélection de Couleur')
        .setColor(box.color || '#3498DB')
        .setDescription(
            `**Box:** ${box.name}\n` +
            `**Couleur actuelle:** ${box.color || '#3498DB'}\n\n` +
            `Choisis une couleur dans les catégories ci-dessous:`
        )
        .setFooter({ text: 'Sélectionne une catégorie de couleurs' });

    // Créer les select menus par catégorie
    const basiquesSelect = new StringSelectMenuBuilder()
        .setCustomId(`mb_config_color_select:${boxId}:basiques`)
        .setPlaceholder('🎨 Couleurs basiques')
        .addOptions(COLOR_PALETTES.basiques.map(c => ({
            label: c.name,
            value: c.value,
            description: c.value,
            emoji: c.emoji
        })));

    const pastelSelect = new StringSelectMenuBuilder()
        .setCustomId(`mb_config_color_select:${boxId}:pastel`)
        .setPlaceholder('🌸 Couleurs pastel')
        .addOptions(COLOR_PALETTES.pastel.map(c => ({
            label: c.name,
            value: c.value,
            description: c.value,
            emoji: c.emoji
        })));

    const vivesSelect = new StringSelectMenuBuilder()
        .setCustomId(`mb_config_color_select:${boxId}:vives`)
        .setPlaceholder('⚡ Couleurs vives')
        .addOptions(COLOR_PALETTES.vives.map(c => ({
            label: c.name,
            value: c.value,
            description: c.value,
            emoji: c.emoji
        })));

    const discordSelect = new StringSelectMenuBuilder()
        .setCustomId(`mb_config_color_select:${boxId}:discord`)
        .setPlaceholder('🎮 Couleurs Discord')
        .addOptions(COLOR_PALETTES.discord.map(c => ({
            label: c.name,
            value: c.value,
            description: c.value,
            emoji: c.emoji
        })));

    const row1 = new ActionRowBuilder().addComponents(basiquesSelect);
    const row2 = new ActionRowBuilder().addComponents(pastelSelect);
    const row3 = new ActionRowBuilder().addComponents(vivesSelect);
    const row4 = new ActionRowBuilder().addComponents(discordSelect);

    const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_box:${boxId}`)
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3, row4, row5]
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: SÉLECTION COLLECTIBLES/SUPER BONUS SPÉCIFIQUES
// ═══════════════════════════════════════════════════════════════════════════════

async function showCollectiblesSelector(interaction, boxId) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;

    // Récupérer la box et le thème actif
    const box = await db.queryOne(`
        SELECT name, rarity, specific_collectibles FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
        return interaction.followUp({
            content: '❌ Aucun thème actif. Impossible de sélectionner des collectibles.',
            flags: 64
        });
    }

    // Récupérer les collectibles du thème avec la même rareté
    const collectibles = await db.queryAll(`
        SELECT id, name, rarity
        FROM collectibles
        WHERE guild_id = $1 AND theme_id = $2 AND rarity = $3
        ORDER BY name ASC
    `, [guildId, theme.id, box.rarity]);

    if (collectibles.length === 0) {
        return interaction.followUp({
            content: `❌ Aucun collectible de rareté ${box.rarity} dans le thème actif.`,
            flags: 64
        });
    }

    // Collectibles actuellement sélectionnés (JSONB retourne directement un array)
    let currentSelection = [];
    if (box.specific_collectibles) {
        currentSelection = Array.isArray(box.specific_collectibles)
            ? box.specific_collectibles
            : JSON.parse(box.specific_collectibles);
    }

    const embed = new EmbedBuilder()
        .setTitle('🎨 Sélection des Collectibles')
        .setColor(RARITY_CONFIG[box.rarity].color)
        .setDescription(
            `**Box:** ${box.name}\n` +
            `**Rareté:** ${RARITY_CONFIG[box.rarity].emoji} ${RARITY_CONFIG[box.rarity].label}\n` +
            `**Thème:** ${theme.name}\n\n` +
            `**Sélection actuelle:** ${currentSelection.length > 0 ? `${currentSelection.length} collectible(s)` : 'Tous (aucune restriction)'}\n\n` +
            `💡 *Laisse vide pour permettre tous les collectibles de cette rareté*`
        );

    // Créer le menu de sélection multiple
    const options = collectibles.slice(0, 25).map(c => ({
        label: c.name.substring(0, 100),
        value: String(c.id),
        default: currentSelection.includes(c.id)
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mb_config_collectibles_select:${boxId}`)
        .setPlaceholder('Sélectionner les collectibles (multi-select)')
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_clear_collectibles:${boxId}`)
            .setLabel('🗑️ Tout désélectionner')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`mb_config_box:${boxId}`)
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

async function showBonusesSelector(interaction, boxId) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT name, rarity, is_default, specific_super_bonuses FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    // Hiérarchie des raretés pour le filtrage
    const RARITY_HIERARCHY = { common: 0, rare: 1, epic: 2, legendary: 3 };
    const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

    // Déterminer les raretés éligibles selon le type de box
    const boxRarity = box.rarity;
    const isDefaultBox = box.is_default !== false;
    const minRarityLevel = RARITY_HIERARCHY[boxRarity] || 0;

    let eligibleRarities;
    let rarityConstraintText;
    if (isDefaultBox) {
        // Box par défaut: seulement même rareté
        eligibleRarities = [boxRarity];
        rarityConstraintText = `⚠️ *Box par défaut: uniquement les super bonus ${RARITY_CONFIG[boxRarity]?.label || boxRarity}*`;
    } else {
        // Box custom: même rareté ou supérieur
        eligibleRarities = RARITY_ORDER.filter(r => RARITY_HIERARCHY[r] >= minRarityLevel);
        if (eligibleRarities.length === 4) {
            rarityConstraintText = `💡 *Box custom: tous les super bonus disponibles*`;
        } else {
            rarityConstraintText = `💡 *Box custom ${RARITY_CONFIG[boxRarity]?.label}: super bonus ${eligibleRarities.map(r => RARITY_CONFIG[r]?.label || r).join(', ')}*`;
        }
    }

    // Récupérer les super bonus du serveur (filtrés par rareté)
    const bonuses = await db.queryAll(`
        SELECT id, name, icon, rarity
        FROM super_bonuses
        WHERE guild_id = $1 AND is_enabled = TRUE
          AND rarity = ANY($2::text[])
        ORDER BY
            CASE rarity
                WHEN 'legendary' THEN 1
                WHEN 'epic' THEN 2
                WHEN 'rare' THEN 3
                WHEN 'common' THEN 4
            END,
            name ASC
    `, [guildId, eligibleRarities]);

    if (bonuses.length === 0) {
        return interaction.followUp({
            content: `❌ Aucun super bonus ${isDefaultBox ? RARITY_CONFIG[boxRarity]?.label : 'éligible'} activé sur ce serveur.`,
            flags: 64
        });
    }

    // Super bonus actuellement sélectionnés (JSONB retourne directement un array)
    let currentSelection = [];
    if (box.specific_super_bonuses) {
        currentSelection = Array.isArray(box.specific_super_bonuses)
            ? box.specific_super_bonuses
            : JSON.parse(box.specific_super_bonuses);
    }

    const embed = new EmbedBuilder()
        .setTitle('✨ Sélection des Super Bonus')
        .setColor('#9B59B6')
        .setDescription(
            `**Box:** ${box.name} (${RARITY_CONFIG[boxRarity]?.label || boxRarity})\n` +
            `**Type:** ${isDefaultBox ? '🔒 Par défaut' : '🎨 Custom'}\n\n` +
            `**Sélection actuelle:** ${currentSelection.length > 0 ? `${currentSelection.length} bonus` : 'Tous éligibles'}\n\n` +
            `${rarityConstraintText}`
        );

    const options = bonuses.slice(0, 25).map(b => ({
        label: `${b.icon || '✨'} ${b.name}`.substring(0, 100),
        description: `${RARITY_CONFIG[b.rarity]?.label || b.rarity}`,
        value: String(b.id),
        default: currentSelection.includes(b.id),
        emoji: RARITY_CONFIG[b.rarity]?.emoji || '✨'
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mb_config_bonuses_select:${boxId}`)
        .setPlaceholder('Sélectionner les super bonus (multi-select)')
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mb_config_clear_bonuses:${boxId}`)
            .setLabel('🗑️ Tout désélectionner')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`mb_config_box:${boxId}`)
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: UPLOAD IMAGES VIA THREAD
// ═══════════════════════════════════════════════════════════════════════════════

async function showImagesUpload(interaction, boxId) {
    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT name, image_closed, image_opening, image_opened, image_empty
        FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    try {
        const channel = interaction.channel;

        // Vérifier si on peut créer des threads
        if (!channel || !channel.threads || channel.isThread()) {
            return interaction.reply({
                content: '❌ Impossible de créer un thread dans ce canal. Utilise un salon textuel normal.',
                flags: 64
            });
        }

        // Créer le thread
        const thread = await channel.threads.create({
            name: `📦 Config Images - ${box.name.substring(0, 30)}`,
            autoArchiveDuration: 60,
            type: ChannelType.PrivateThread,
            reason: 'Upload images Mystery Box'
        });

        await thread.members.add(interaction.user.id);

        // Sauvegarder dans le cache
        imageUploadCache.set(interaction.user.id, {
            boxId,
            threadId: thread.id,
            step: 'closed' // closed, opening, opened
        });

        // Envoyer les instructions
        await thread.send({
            content:
                `📦 **UPLOAD DES IMAGES - ${box.name}**\n\n` +
                `**Images actuelles:**\n` +
                `• 📷 Fermée: ${box.image_closed ? '✅' : '❌'}\n` +
                `• 🎬 Animation: ${box.image_opening ? '✅' : '❌'}\n` +
                `• 🎁 Ouverte: ${box.image_opened ? '✅' : '❌'}\n` +
                `• ❌ Vide: ${box.image_empty ? '✅' : '❌'}\n\n` +
                `**Étape 1/4: Image FERMÉE**\n` +
                `Drag & drop l'image de la box fermée ici\n` +
                `(ou tape \`skip\` pour passer)\n\n` +
                `⏱️ Tu as 2 minutes par image`
        });

        await interaction.reply({
            content: `📦 Thread créé ! Rejoins ${thread} pour uploader les images.`,
            flags: 64
        });

        // Collector pour les messages
        const filter = m => m.author.id === interaction.user.id;
        const collector = thread.createMessageCollector({
            filter,
            time: 360000 // 6 minutes total
        });

        collector.on('collect', async (message) => {
            const cache = imageUploadCache.get(interaction.user.id);
            if (!cache) return;

            const step = cache.step;
            const isSkip = message.content.toLowerCase() === 'skip';
            let imageUrl = null;

            // Cas 1: Attachment (fichier uploadé)
            if (!isSkip && message.attachments.size > 0) {
                const attachment = message.attachments.first();
                const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

                if (validTypes.includes(attachment.contentType)) {
                    imageUrl = attachment.url;
                } else {
                    await thread.send('⚠️ Format non supporté. Utilise PNG, JPG, GIF ou WEBP.');
                    return;
                }
            }
            // Cas 2: URL collée
            else if (!isSkip) {
                const urlPattern = /https?:\/\/[^\s]+/i;
                const match = message.content.match(urlPattern);
                if (match) {
                    imageUrl = match[0].replace(/[<>)}\]]+$/, '');
                }
            }

            // Mettre à jour la DB
            const columnMap = {
                closed: 'image_closed',
                opening: 'image_opening',
                opened: 'image_opened',
                empty: 'image_empty'
            };

            if (imageUrl) {
                await db.query(`
                    UPDATE mystery_box_config
                    SET ${columnMap[step]} = $1, updated_at = NOW()
                    WHERE id = $2 AND guild_id = $3
                `, [imageUrl, boxId, guildId]);

                await thread.send(`✅ Image ${step} sauvegardée !`);
            } else if (isSkip) {
                await thread.send(`⏭️ Image ${step} ignorée.`);
            }

            // Passer à l'étape suivante
            const steps = ['closed', 'opening', 'opened', 'empty'];
            const currentIndex = steps.indexOf(step);

            if (currentIndex < steps.length - 1) {
                const nextStep = steps[currentIndex + 1];
                cache.step = nextStep;
                imageUploadCache.set(interaction.user.id, cache);

                const stepLabels = {
                    opening: '**Étape 2/4: Image ANIMATION**\nDrag & drop l\'image/GIF d\'ouverture',
                    opened: '**Étape 3/4: Image OUVERTE**\nDrag & drop l\'image finale (contenu révélé)',
                    empty: '**Étape 4/4: Image BOX VIDE**\nDrag & drop l\'image affichée quand la box est vide'
                };

                await thread.send(`\n${stepLabels[nextStep]}\n(ou tape \`skip\` pour passer)`);
            } else {
                // Terminé
                collector.stop('completed');
                await thread.send(
                    `\n✅ **Configuration terminée !**\n\n` +
                    `Retourne dans le panneau admin pour voir les changements.\n` +
                    `Ce thread va être archivé dans 10 secondes...`
                );

                imageUploadCache.delete(interaction.user.id);

                setTimeout(async () => {
                    try {
                        await thread.setArchived(true);
                    } catch (e) {
                        console.warn('⚠️ Impossible d\'archiver le thread');
                    }
                }, 10000);
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                imageUploadCache.delete(interaction.user.id);
                thread.send('⏰ Temps écoulé ! Le thread va être archivé.').catch(() => {});
                setTimeout(() => thread.setArchived(true).catch(() => {}), 5000);
            }
        });

    } catch (error) {
        console.error('❌ Erreur création thread images:', error);
        return interaction.reply({
            content: '❌ Erreur lors de la création du thread. Vérifie les permissions.',
            flags: 64
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: TRAITEMENT DES MODALS
// ═══════════════════════════════════════════════════════════════════════════════

async function handleBasicModalSubmit(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const name = interaction.fields.getTextInputValue('box_name');
    const emoji = interaction.fields.getTextInputValue('box_emoji') || '📦';

    await db.query(`
        UPDATE mystery_box_config
        SET name = $1, emoji = $2, updated_at = NOW()
        WHERE id = $3 AND guild_id = $4
    `, [name, emoji, boxId, guildId]);

    console.log(`📦 [MB CONFIG] Box ${boxId} mise à jour: ${name}`);

    await showBoxEditor(interaction, boxId);
}

/**
 * Traiter le modal des probabilités - FORCÉ À 100%
 */
async function handleProbabilitiesModalSubmit(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    let probCollectible = parseInt(interaction.fields.getTextInputValue('prob_collectible')) || 70;

    // Forcer entre 0 et 100
    probCollectible = Math.max(0, Math.min(100, probCollectible));

    // Super Bonus = 100 - Collectible (TOUJOURS = 100%)
    const probSuperBonus = 100 - probCollectible;

    await db.query(`
        UPDATE mystery_box_config
        SET prob_collectible = $1, prob_super_bonus = $2, updated_at = NOW()
        WHERE id = $3 AND guild_id = $4
    `, [probCollectible, probSuperBonus, boxId, guildId]);

    console.log(`📦 [MB CONFIG] Box ${boxId} probabilités: ${probCollectible}% collectible, ${probSuperBonus}% super bonus (total: 100%)`);

    await showBoxEditor(interaction, boxId);
}

async function handleAnimationModalSubmit(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    let duration = parseInt(interaction.fields.getTextInputValue('animation_duration')) || 3000;

    // Limiter entre 1000 et 10000 ms
    duration = Math.max(1000, Math.min(10000, duration));

    await db.query(`
        UPDATE mystery_box_config
        SET animation_duration = $1, updated_at = NOW()
        WHERE id = $2 AND guild_id = $3
    `, [duration, boxId, guildId]);

    console.log(`📦 [MB CONFIG] Box ${boxId} animation: ${duration}ms`);

    await showBoxEditor(interaction, boxId);
}

async function handleTextsModalSubmit(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const textTitle = interaction.fields.getTextInputValue('text_title') || null;
    const textDesc = interaction.fields.getTextInputValue('text_description') || null;
    const textOpening = interaction.fields.getTextInputValue('text_opening') || null;
    const textSuccess = interaction.fields.getTextInputValue('text_success') || null;

    await db.query(`
        UPDATE mystery_box_config
        SET text_title = $1, text_description = $2, text_opening = $3, text_success = $4, updated_at = NOW()
        WHERE id = $5 AND guild_id = $6
    `, [textTitle, textDesc, textOpening, textSuccess, boxId, guildId]);

    console.log(`📦 [MB CONFIG] Box ${boxId} textes mis à jour`);

    await showBoxEditor(interaction, boxId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: ACTIONS SUR LES BOXES
// ═══════════════════════════════════════════════════════════════════════════════

async function toggleBox(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT is_enabled FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    const newStatus = !box.is_enabled;

    await db.query(`
        UPDATE mystery_box_config
        SET is_enabled = $1, updated_at = NOW()
        WHERE id = $2 AND guild_id = $3
    `, [newStatus, boxId, guildId]);

    console.log(`📦 [MB CONFIG] Box ${boxId} ${newStatus ? 'activée' : 'désactivée'}`);

    await showBoxEditor(interaction, boxId);
}

async function togglePity(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT pity_system_enabled FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    const newStatus = !box.pity_system_enabled;

    await db.query(`
        UPDATE mystery_box_config
        SET pity_system_enabled = $1, updated_at = NOW()
        WHERE id = $2 AND guild_id = $3
    `, [newStatus, boxId, guildId]);

    console.log(`📦 [MB CONFIG] Box ${boxId} pity system ${newStatus ? 'activé' : 'désactivé'}`);

    await showBoxEditor(interaction, boxId);
}

async function setDefaultBox(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT rarity, theme_id FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    // Retirer le flag des autres boxes de cette rareté pour ce thème
    await db.query(`
        UPDATE mystery_box_config
        SET is_default = FALSE
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3
    `, [guildId, box.rarity, box.theme_id]);

    // Définir comme par défaut
    await db.query(`
        UPDATE mystery_box_config
        SET is_default = TRUE, updated_at = NOW()
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    console.log(`📦 [MB CONFIG] Box ${boxId} définie par défaut pour ${box.rarity} (thème ${box.theme_id})`);

    await showBoxEditor(interaction, boxId);
}

async function duplicateBox(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;

    const original = await db.queryOne(`
        SELECT * FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!original) return;

    const newBox = await db.queryOne(`
        INSERT INTO mystery_box_config (
            guild_id, theme_id, rarity, name, emoji, color,
            prob_collectible, prob_super_bonus,
            image_closed, image_opening, image_opened,
            text_title, text_description, text_opening, text_success,
            animation_duration, pity_system_enabled, pity_counter_max,
            specific_collectibles, specific_super_bonuses,
            is_default, is_enabled
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8,
            $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, $18,
            $19, $20,
            FALSE, TRUE
        )
        RETURNING id
    `, [
        guildId, original.theme_id, original.rarity, `${original.name} (copie)`, original.emoji, original.color,
        original.prob_collectible, original.prob_super_bonus,
        original.image_closed, original.image_opening, original.image_opened,
        original.text_title, original.text_description, original.text_opening, original.text_success,
        original.animation_duration || 3000, original.pity_system_enabled, original.pity_counter_max,
        original.specific_collectibles, original.specific_super_bonuses
    ]);

    console.log(`📦 [MB CONFIG] Box ${boxId} dupliquée → ${newBox.id}`);

    await showBoxEditor(interaction, newBox.id);
}

async function deleteBox(interaction, boxId) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;

    const box = await db.queryOne(`
        SELECT rarity, is_default FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    if (!box) return;

    if (box.is_default) {
        return interaction.followUp({
            content: '❌ Impossible de supprimer la box par défaut.',
            flags: 64
        });
    }

    await db.query(`
        DELETE FROM mystery_box_config
        WHERE id = $1 AND guild_id = $2
    `, [boxId, guildId]);

    console.log(`📦 [MB CONFIG] Box ${boxId} supprimée`);

    await showBoxList(interaction, box.rarity);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: CONFIGURATION DES UPGRADES
// ═══════════════════════════════════════════════════════════════════════════════

async function showUpgradeSettings(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;

    // Récupérer le thème actif pour filtrer les boxes
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif. Activez un thème d\'abord.',
            embeds: [],
            components: []
        });
    }

    const defaultBoxes = await db.queryAll(`
        SELECT id, rarity, name,
               rarity_upgrade_rare, rarity_upgrade_epic, rarity_upgrade_legendary
        FROM mystery_box_config
        WHERE guild_id = $1 AND is_default = TRUE AND theme_id = $2
        ORDER BY
            CASE rarity
                WHEN 'common' THEN 1
                WHEN 'rare' THEN 2
                WHEN 'epic' THEN 3
            END
    `, [guildId, activeTheme.id]);

    const upgradeInfo = {
        common: defaultBoxes.find(b => b.rarity === 'common'),
        rare: defaultBoxes.find(b => b.rarity === 'rare'),
        epic: defaultBoxes.find(b => b.rarity === 'epic')
    };

    const embed = new EmbedBuilder()
        .setTitle('⬆️ CONFIGURATION DES UPGRADES')
        .setColor('#2B2D31')
        .setDescription(
            `### 🎯 Système d'Upgrade Step-by-Step\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Quand un joueur utilise une clé, le système vérifie\n` +
            `si la rareté peut être **upgradée** step-by-step.\n\n` +
            `**Exemple:** Clé COMMON\n` +
            `1. Roll: X% chance → RARE ?\n` +
            `2. Si oui, roll: Y% chance → EPIC ?\n` +
            `3. Si oui, roll: Z% chance → LEGENDARY ?\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `### 📊 Chances Actuelles\n\n` +
            `${RARITY_CONFIG.common.emoji} **Common → Rare:** ${upgradeInfo.common?.rarity_upgrade_rare || 0}%\n` +
            `${RARITY_CONFIG.rare.emoji} **Rare → Epic:** ${upgradeInfo.rare?.rarity_upgrade_epic || 0}%\n` +
            `${RARITY_CONFIG.epic.emoji} **Epic → Legendary:** ${upgradeInfo.epic?.rarity_upgrade_legendary || 0}%\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 *Ces % sont stockés dans la box par défaut de chaque rareté*`
        )
        .setFooter({ text: 'Les upgrades sont cumulatifs' })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('mb_config_edit_upgrade:common')
            .setLabel(`${RARITY_CONFIG.common.emoji} Common → Rare`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!upgradeInfo.common),
        new ButtonBuilder()
            .setCustomId('mb_config_edit_upgrade:rare')
            .setLabel(`${RARITY_CONFIG.rare.emoji} Rare → Epic`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!upgradeInfo.rare),
        new ButtonBuilder()
            .setCustomId('mb_config_edit_upgrade:epic')
            .setLabel(`${RARITY_CONFIG.epic.emoji} Epic → Legendary`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!upgradeInfo.epic)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('mb_config_panel')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

async function showUpgradeEditModal(interaction, sourceRarity) {
    const targetRarity = UPGRADE_PATH[sourceRarity];
    if (!targetRarity) return;

    const guildId = interaction.guildId;

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.reply({
            content: '❌ Aucun thème actif. Créez ou activez un thème d\'abord.',
            flags: 64
        });
    }

    const defaultBox = await db.queryOne(`
        SELECT id, rarity_upgrade_${targetRarity} as current_value
        FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id = $3 AND is_default = TRUE
    `, [guildId, sourceRarity, activeTheme.id]);

    if (!defaultBox) {
        return interaction.reply({
            content: `❌ Aucune box par défaut pour ${sourceRarity}. Créez-en une d'abord.`,
            flags: 64
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(`mb_config_modal_upgrade:${sourceRarity}`)
        .setTitle(`Upgrade ${RARITY_CONFIG[sourceRarity].label} → ${RARITY_CONFIG[targetRarity].label}`);

    const upgradeInput = new TextInputBuilder()
        .setCustomId('upgrade_chance')
        .setLabel(`% de chance d'upgrade (0-100)`)
        .setStyle(TextInputStyle.Short)
        .setValue(String(defaultBox.current_value || 0))
        .setRequired(true)
        .setMaxLength(3);

    modal.addComponents(
        new ActionRowBuilder().addComponents(upgradeInput)
    );

    await interaction.showModal(modal);
}

async function handleUpgradeModalSubmit(interaction, sourceRarity) {
    await interaction.deferUpdate();

    const targetRarity = UPGRADE_PATH[sourceRarity];
    if (!targetRarity) return;

    const guildId = interaction.guildId;

    // Récupérer le thème actif
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) return;

    let upgradeChance = parseInt(interaction.fields.getTextInputValue('upgrade_chance')) || 0;
    upgradeChance = Math.max(0, Math.min(100, upgradeChance));

    await db.query(`
        UPDATE mystery_box_config
        SET rarity_upgrade_${targetRarity} = $1, updated_at = NOW()
        WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4 AND is_default = TRUE
    `, [upgradeChance, guildId, sourceRarity, activeTheme.id]);

    console.log(`📦 [MB CONFIG] Upgrade ${sourceRarity} → ${targetRarity}: ${upgradeChance}% (thème ${activeTheme.id})`);

    await showUpgradeSettings(interaction);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: APERÇU DES PROBABILITÉS
// ═══════════════════════════════════════════════════════════════════════════════

async function showProbabilityPreview(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;

    // Récupérer le thème actif pour filtrer les boxes
    const activeTheme = await db.getActiveTheme(guildId);
    if (!activeTheme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif. Activez un thème d\'abord.',
            embeds: [],
            components: []
        });
    }

    const defaultBoxes = await db.queryAll(`
        SELECT rarity, name, prob_collectible, prob_super_bonus,
               rarity_upgrade_rare, rarity_upgrade_epic, rarity_upgrade_legendary
        FROM mystery_box_config
        WHERE guild_id = $1 AND is_default = TRUE AND theme_id = $2
        ORDER BY
            CASE rarity
                WHEN 'common' THEN 1
                WHEN 'rare' THEN 2
                WHEN 'epic' THEN 3
                WHEN 'legendary' THEN 4
            END
    `, [guildId, activeTheme.id]);

    let previewText = '';

    for (const box of defaultBoxes) {
        const config = RARITY_CONFIG[box.rarity];
        const targetRarity = UPGRADE_PATH[box.rarity];
        const upgradeColumn = targetRarity ? `rarity_upgrade_${targetRarity}` : null;
        const upgradeChance = upgradeColumn ? (box[upgradeColumn] || 0) : 0;
        const total = box.prob_collectible + box.prob_super_bonus;

        previewText += `### ${config.emoji} ${config.label}\n`;
        previewText += `**${box.name}**\n`;
        previewText += `├ 🎨 Collectible: ${box.prob_collectible}%\n`;
        previewText += `├ ✨ Super Bonus: ${box.prob_super_bonus}%\n`;
        previewText += `├ 📊 Total: ${total}% ${total === 100 ? '✅' : '⚠️'}\n`;
        if (targetRarity) {
            previewText += `└ ⬆️ Upgrade → ${RARITY_CONFIG[targetRarity].emoji}: ${upgradeChance}%\n`;
        } else {
            previewText += `└ ⬆️ *Rareté maximale*\n`;
        }
        previewText += '\n';
    }

    // Calcul probabilité légendaire depuis common
    const common = defaultBoxes.find(b => b.rarity === 'common');
    const rare = defaultBoxes.find(b => b.rarity === 'rare');
    const epic = defaultBoxes.find(b => b.rarity === 'epic');

    let legendaryFromCommon = 0;
    if (common && rare && epic) {
        const cToR = (common.rarity_upgrade_rare || 0) / 100;
        const rToE = (rare.rarity_upgrade_epic || 0) / 100;
        const eToL = (epic.rarity_upgrade_legendary || 0) / 100;
        legendaryFromCommon = cToR * rToE * eToL * 100;
    }

    const embed = new EmbedBuilder()
        .setTitle('👁️ APERÇU DES PROBABILITÉS')
        .setColor('#2B2D31')
        .setDescription(
            `### 📊 Configuration Actuelle\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            previewText +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `### 🧮 Probabilité Composée\n\n` +
            `Chance d'obtenir un **LÉGENDAIRE** depuis une clé **COMMON**:\n` +
            `\`\`\`\n` +
            `${legendaryFromCommon.toFixed(4)}%\n` +
            `(via upgrades: C→R→E→L)\n` +
            `\`\`\`\n\n` +
            `💡 *N'inclut pas l'Aimant à Légendaires*`
        )
        .setFooter({ text: 'Aperçu basé sur les boxes par défaut' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('mb_config_panel')
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: ROUTER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

async function handleInteraction(interaction) {
    const customId = interaction.customId;

    try {
        // ========== BOUTONS ==========
        if (interaction.isButton()) {
            // Panel principal
            if (customId === 'mb_config_panel') {
                return showMysteryBoxConfigPanel(interaction);
            }

            // Config upgrades
            if (customId === 'mb_config_upgrade_settings') {
                return showUpgradeSettings(interaction);
            }

            // Aperçu probabilités
            if (customId === 'mb_config_preview') {
                return showProbabilityPreview(interaction);
            }

            // Retour à une rareté
            if (customId.startsWith('mb_config_rarity:')) {
                const rarity = customId.split(':')[1];
                return showBoxList(interaction, rarity);
            }

            // Retour à une box spécifique
            if (customId.startsWith('mb_config_box:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showBoxEditor(interaction, boxId);
            }

            // Créer une box
            if (customId.startsWith('mb_config_create_box:')) {
                const rarity = customId.split(':')[1];
                return createNewBox(interaction, rarity);
            }

            // ========== APPARENCE PAR RARETÉ (PARTAGÉ) ==========

            // Afficher l'éditeur d'apparence de la rareté
            if (customId.startsWith('mb_config_appearance:')) {
                const rarity = customId.split(':')[1];
                return showRarityAppearanceEditor(interaction, rarity);
            }

            // Couleur par rareté (met à jour TOUTES les boxes de cette rareté)
            if (customId.startsWith('mb_config_rarity_color:')) {
                const rarity = customId.split(':')[1];
                return showRarityColorSelector(interaction, rarity);
            }

            // Images par rareté
            if (customId.startsWith('mb_config_rarity_images:')) {
                const rarity = customId.split(':')[1];
                return showRarityImagesUpload(interaction, rarity);
            }

            // Textes par rareté
            if (customId.startsWith('mb_config_rarity_texts:')) {
                const rarity = customId.split(':')[1];
                return showRarityTextsModal(interaction, rarity);
            }

            // Animation par rareté
            if (customId.startsWith('mb_config_rarity_animation:')) {
                const rarity = customId.split(':')[1];
                return showRarityAnimationModal(interaction, rarity);
            }

            // Toggle pity par rareté
            if (customId.startsWith('mb_config_rarity_pity:')) {
                const rarity = customId.split(':')[1];
                return toggleRarityPity(interaction, rarity);
            }

            // Nombre de récompenses par rareté
            if (customId.startsWith('mb_config_rarity_rewards:')) {
                const rarity = customId.split(':')[1];
                return showRarityRewardsModal(interaction, rarity);
            }

            // Image fermée par rareté (via thread)
            if (customId.startsWith('mb_config_rarity_img_closed:')) {
                const rarity = customId.split(':')[1];
                return showRarityImageUploadThread(interaction, rarity, 'closed');
            }

            // Image ouverture par rareté (via thread)
            if (customId.startsWith('mb_config_rarity_img_opening:')) {
                const rarity = customId.split(':')[1];
                return showRarityImageUploadThread(interaction, rarity, 'opening');
            }

            // Image ouverte par rareté (via thread)
            if (customId.startsWith('mb_config_rarity_img_opened:')) {
                const rarity = customId.split(':')[1];
                return showRarityImageUploadThread(interaction, rarity, 'opened');
            }

            // Image box vide par rareté (via thread)
            if (customId.startsWith('mb_config_rarity_img_empty:')) {
                const rarity = customId.split(':')[1];
                return showRarityImageUploadThread(interaction, rarity, 'empty');
            }

            // ========== CONTENU PAR BOX (INDIVIDUEL) ==========

            // Édition basique
            if (customId.startsWith('mb_config_edit_basic:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showBasicEditModal(interaction, boxId);
            }

            // Édition couleur (sélecteur)
            if (customId.startsWith('mb_config_edit_color:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showColorSelector(interaction, boxId);
            }

            // Édition probabilités
            if (customId.startsWith('mb_config_edit_probs:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showProbabilitiesModal(interaction, boxId);
            }

            // Sélection collectibles spécifiques
            if (customId.startsWith('mb_config_select_collectibles:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showCollectiblesSelector(interaction, boxId);
            }

            // Sélection super bonus spécifiques
            if (customId.startsWith('mb_config_select_bonuses:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showBonusesSelector(interaction, boxId);
            }

            // Édition images (via thread)
            if (customId.startsWith('mb_config_edit_images:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showImagesUpload(interaction, boxId);
            }

            // Édition animation
            if (customId.startsWith('mb_config_edit_animation:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showAnimationModal(interaction, boxId);
            }

            // Toggle pity
            if (customId.startsWith('mb_config_toggle_pity:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return togglePity(interaction, boxId);
            }

            // Édition textes
            if (customId.startsWith('mb_config_edit_texts:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return showTextsModal(interaction, boxId);
            }

            // Toggle activation
            if (customId.startsWith('mb_config_toggle:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return toggleBox(interaction, boxId);
            }

            // Définir par défaut
            if (customId.startsWith('mb_config_set_default:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return setDefaultBox(interaction, boxId);
            }

            // Dupliquer
            if (customId.startsWith('mb_config_duplicate:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return duplicateBox(interaction, boxId);
            }

            // Supprimer
            if (customId.startsWith('mb_config_delete:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return deleteBox(interaction, boxId);
            }

            // Clear collectibles
            if (customId.startsWith('mb_config_clear_collectibles:')) {
                const boxId = parseInt(customId.split(':')[1]);
                await interaction.deferUpdate();
                await db.query(`
                    UPDATE mystery_box_config
                    SET specific_collectibles = NULL, updated_at = NOW()
                    WHERE id = $1 AND guild_id = $2
                `, [boxId, interaction.guildId]);
                return showCollectiblesSelector(interaction, boxId);
            }

            // Clear bonuses
            if (customId.startsWith('mb_config_clear_bonuses:')) {
                const boxId = parseInt(customId.split(':')[1]);
                await interaction.deferUpdate();
                await db.query(`
                    UPDATE mystery_box_config
                    SET specific_super_bonuses = NULL, updated_at = NOW()
                    WHERE id = $1 AND guild_id = $2
                `, [boxId, interaction.guildId]);
                return showBonusesSelector(interaction, boxId);
            }

            // Édition upgrade
            if (customId.startsWith('mb_config_edit_upgrade:')) {
                const rarity = customId.split(':')[1];
                return showUpgradeEditModal(interaction, rarity);
            }
        }

        // ========== SELECT MENUS ==========
        if (interaction.isStringSelectMenu()) {
            // Sélection de rareté
            if (customId === 'mb_config_rarity_select') {
                const rarity = interaction.values[0];
                return showBoxList(interaction, rarity);
            }

            // Sélection de box
            if (customId.startsWith('mb_config_box_select:')) {
                const boxId = parseInt(interaction.values[0].replace('box_', ''));
                return showBoxEditor(interaction, boxId);
            }

            // Sélection de couleur
            if (customId.startsWith('mb_config_color_select:')) {
                const parts = customId.split(':');
                const boxId = parseInt(parts[1]);
                const selectedColor = interaction.values[0];

                await interaction.deferUpdate();
                await db.query(`
                    UPDATE mystery_box_config
                    SET color = $1, updated_at = NOW()
                    WHERE id = $2 AND guild_id = $3
                `, [selectedColor, boxId, interaction.guildId]);

                console.log(`📦 [MB CONFIG] Box ${boxId} couleur: ${selectedColor}`);
                return showBoxEditor(interaction, boxId);
            }

            // Sélection collectibles spécifiques
            if (customId.startsWith('mb_config_collectibles_select:')) {
                const boxId = parseInt(customId.split(':')[1]);
                const selectedIds = interaction.values.map(v => parseInt(v));

                await interaction.deferUpdate();
                await db.query(`
                    UPDATE mystery_box_config
                    SET specific_collectibles = $1, updated_at = NOW()
                    WHERE id = $2 AND guild_id = $3
                `, [selectedIds.length > 0 ? JSON.stringify(selectedIds) : null, boxId, interaction.guildId]);

                console.log(`📦 [MB CONFIG] Box ${boxId} collectibles: ${selectedIds.length} sélectionnés`);
                return showBoxEditor(interaction, boxId);
            }

            // Sélection super bonus spécifiques
            if (customId.startsWith('mb_config_bonuses_select:')) {
                const boxId = parseInt(customId.split(':')[1]);
                const selectedIds = interaction.values.map(v => parseInt(v));

                await interaction.deferUpdate();
                await db.query(`
                    UPDATE mystery_box_config
                    SET specific_super_bonuses = $1, updated_at = NOW()
                    WHERE id = $2 AND guild_id = $3
                `, [selectedIds.length > 0 ? JSON.stringify(selectedIds) : null, boxId, interaction.guildId]);

                console.log(`📦 [MB CONFIG] Box ${boxId} super bonus: ${selectedIds.length} sélectionnés`);
                return showBoxEditor(interaction, boxId);
            }

            // ========== SELECT MENUS RARETÉ (APPARENCE PARTAGÉE) ==========

            // Sélection de palette de couleur par rareté
            if (customId.startsWith('mb_config_rarity_palette:')) {
                const rarity = customId.split(':')[1];
                const palette = interaction.values[0];

                await interaction.deferUpdate();

                const colors = COLOR_PALETTES[palette] || COLOR_PALETTES.basiques;
                const colorOptions = colors.map(c => ({
                    label: c.name,
                    value: c.value,
                    emoji: c.emoji
                }));

                const colorSelect = new StringSelectMenuBuilder()
                    .setCustomId(`mb_config_rarity_color_final:${rarity}`)
                    .setPlaceholder('Choisir une couleur')
                    .addOptions(colorOptions);

                const row1 = new ActionRowBuilder().addComponents(colorSelect);
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mb_config_rarity_color:${rarity}`)
                        .setLabel('🔙 Changer de palette')
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.editReply({ components: [row1, row2] });
            }

            // Sélection finale de couleur par rareté
            if (customId.startsWith('mb_config_rarity_color_final:')) {
                const rarity = customId.split(':')[1];
                const selectedColor = interaction.values[0];

                await interaction.deferUpdate();

                // Récupérer le thème actif
                const activeTheme = await db.getActiveTheme(interaction.guildId);
                if (!activeTheme) {
                    return interaction.editReply({
                        content: '❌ Aucun thème actif.',
                        embeds: [],
                        components: []
                    });
                }

                // Mettre à jour TOUTES les boxes de cette rareté pour ce thème
                await db.query(`
                    UPDATE mystery_box_config
                    SET color = $1, updated_at = NOW()
                    WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4
                `, [selectedColor, interaction.guildId, rarity, activeTheme.id]);

                console.log(`📦 [MB CONFIG] Couleur ${selectedColor} appliquée à TOUTES les boxes ${rarity} (thème ${activeTheme.id})`);
                return showRarityAppearanceEditor(interaction, rarity);
            }
        }

        // ========== MODALS ==========
        if (interaction.isModalSubmit()) {
            // Modal édition basique
            if (customId.startsWith('mb_config_modal_basic:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return handleBasicModalSubmit(interaction, boxId);
            }

            // Modal probabilités
            if (customId.startsWith('mb_config_modal_probs:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return handleProbabilitiesModalSubmit(interaction, boxId);
            }

            // Modal animation
            if (customId.startsWith('mb_config_modal_animation:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return handleAnimationModalSubmit(interaction, boxId);
            }

            // Modal textes
            if (customId.startsWith('mb_config_modal_texts:')) {
                const boxId = parseInt(customId.split(':')[1]);
                return handleTextsModalSubmit(interaction, boxId);
            }

            // Modal upgrade
            if (customId.startsWith('mb_config_modal_upgrade:')) {
                const rarity = customId.split(':')[1];
                return handleUpgradeModalSubmit(interaction, rarity);
            }

            // ========== MODALS RARETÉ (APPARENCE PARTAGÉE) ==========

            // Modal textes par rareté
            if (customId.startsWith('mb_config_modal_rarity_texts:')) {
                const rarity = customId.split(':')[1];
                await interaction.deferReply({ flags: 64 });

                // Récupérer le thème actif
                const activeTheme = await db.getActiveTheme(interaction.guildId);
                if (!activeTheme) {
                    return interaction.editReply({ content: '❌ Aucun thème actif.' });
                }

                const texts = {
                    title: interaction.fields.getTextInputValue('text_title') || null,
                    description: interaction.fields.getTextInputValue('text_description') || null,
                    opening: interaction.fields.getTextInputValue('text_opening') || null,
                    success: interaction.fields.getTextInputValue('text_success') || null,
                    empty: interaction.fields.getTextInputValue('text_empty') || null
                };

                // Mettre à jour TOUTES les boxes de cette rareté pour ce thème
                await db.query(`
                    UPDATE mystery_box_config
                    SET
                        text_title = COALESCE($1, text_title),
                        text_description = COALESCE($2, text_description),
                        text_opening = COALESCE($3, text_opening),
                        text_success = COALESCE($4, text_success),
                        text_empty = COALESCE($5, text_empty),
                        updated_at = NOW()
                    WHERE guild_id = $6 AND rarity = $7 AND theme_id = $8
                `, [texts.title, texts.description, texts.opening, texts.success, texts.empty, interaction.guildId, rarity, activeTheme.id]);

                console.log(`📦 [MB CONFIG] Textes mis à jour pour TOUTES les boxes ${rarity} (thème ${activeTheme.id})`);
                await interaction.editReply({ content: `✅ Textes mis à jour pour toutes les boxes ${RARITY_CONFIG[rarity].label}s` });
                return showRarityAppearanceEditor(interaction, rarity);
            }

            // Modal animation par rareté
            if (customId.startsWith('mb_config_modal_rarity_animation:')) {
                const rarity = customId.split(':')[1];
                await interaction.deferReply({ flags: 64 });

                // Récupérer le thème actif
                const activeTheme = await db.getActiveTheme(interaction.guildId);
                if (!activeTheme) {
                    return interaction.editReply({ content: '❌ Aucun thème actif.' });
                }

                const duration = parseInt(interaction.fields.getTextInputValue('animation_duration')) || 3000;

                // Mettre à jour TOUTES les boxes de cette rareté pour ce thème
                await db.query(`
                    UPDATE mystery_box_config
                    SET animation_duration = $1, updated_at = NOW()
                    WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4
                `, [duration, interaction.guildId, rarity, activeTheme.id]);

                console.log(`📦 [MB CONFIG] Animation ${duration}ms pour TOUTES les boxes ${rarity} (thème ${activeTheme.id})`);
                await interaction.editReply({ content: `✅ Animation (${duration}ms) mise à jour pour toutes les boxes ${RARITY_CONFIG[rarity].label}s` });
                return showRarityAppearanceEditor(interaction, rarity);
            }

            // Modal rewards_count par rareté
            if (customId.startsWith('mb_config_modal_rarity_rewards:')) {
                const rarity = customId.split(':')[1];
                await interaction.deferReply({ flags: 64 });

                // Récupérer le thème actif
                const activeTheme = await db.getActiveTheme(interaction.guildId);
                if (!activeTheme) {
                    return interaction.editReply({ content: '❌ Aucun thème actif.' });
                }

                let count = parseInt(interaction.fields.getTextInputValue('rewards_count')) || 1;
                // Validation: entre 1 et 5
                if (count < 1) count = 1;
                if (count > 5) count = 5;

                // Mettre à jour TOUTES les boxes de cette rareté pour ce thème
                await db.query(`
                    UPDATE mystery_box_config
                    SET rewards_count = $1, updated_at = NOW()
                    WHERE guild_id = $2 AND rarity = $3 AND theme_id = $4
                `, [count, interaction.guildId, rarity, activeTheme.id]);

                console.log(`📦 [MB CONFIG] Récompenses: ${count} pour TOUTES les boxes ${rarity} (thème ${activeTheme.id})`);
                await interaction.editReply({ content: `✅ Nombre de récompenses (${count}) mis à jour pour toutes les boxes ${RARITY_CONFIG[rarity].label}s` });
                return showRarityAppearanceEditor(interaction, rarity);
            }

            // Note: Le modal image par rareté a été remplacé par showRarityImageUploadThread (upload via thread)
        }

        console.log(`⚠️ [MB CONFIG] Interaction non gérée: ${customId}`);

    } catch (error) {
        console.error('🔴 [MB CONFIG] Erreur:', error);

        const errorMessage = '❌ Une erreur est survenue. Réessaie.';
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: 64 });
        } else {
            await interaction.reply({ content: errorMessage, flags: 64 });
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    handleInteraction,
    showMysteryBoxConfigPanel,
    showBoxList,
    showBoxEditor,
    showUpgradeSettings,
    showProbabilityPreview,
    RARITY_CONFIG,
    UPGRADE_PATH
};
