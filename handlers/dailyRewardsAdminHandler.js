/**
 * 📅 DAILY REWARDS ADMIN HANDLER v1.0.0
 * Gestion admin des récompenses quotidiennes par thème
 *
 * CustomIds gérés:
 * - daily_admin_menu              → Menu principal
 * - daily_admin_calendar          → Voir calendrier
 * - daily_admin_calendar:{page}   → Pagination calendrier
 * - daily_admin_edit_day          → Sélection jour à modifier
 * - daily_admin_edit_day_select   → Select du jour
 * - daily_admin_edit_type_select  → Select du type de récompense
 * - daily_admin_presets           → Voir les présets
 * - daily_admin_apply_preset:{preset} → Appliquer un préset
 * - daily_admin_confirm_preset    → Confirmer application préset
 * - daily_admin_batch_edit        → Édition par lot
 * - daily_admin_batch_select      → Sélection jours pour lot
 * - daily_admin_catchup_config    → Config rattrapage
 * - daily_admin_back              → Retour au menu
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../utils/database-pg');

// Emojis pour les types de récompenses
const REWARD_TYPE_CONFIG = {
    mystery_box: {
        emoji: '🔑',
        label: 'Clé Mystery Box',
        hasRarity: true,
        hasAmount: true,
        hasItemId: false
    },
    currency: {
        emoji: '💰',
        label: 'Loomix',
        hasRarity: false,
        hasAmount: true,
        hasItemId: false
    },
    collectible: {
        emoji: '🎯',
        label: 'Collectible Précis',
        hasRarity: false,
        hasAmount: false,
        hasItemId: true
    },
    super_bonus: {
        emoji: '⚡',
        label: 'Super Bonus Précis',
        hasRarity: false,
        hasAmount: false,
        hasItemId: true
    },
    super_bonus_random: {
        emoji: '🌀',
        label: 'Super Bonus Aléatoire',
        hasRarity: false,
        hasAmount: false,
        hasItemId: false
    }
};

// Emojis simples pour les select menus Discord (un seul emoji autorisé)
const RARITY_CONFIG = {
    common: { emoji: '🔑', label: 'Commune', color: 0x808080 },
    rare: { emoji: '💎', label: 'Rare', color: 0x3498db },
    epic: { emoji: '✨', label: 'Épique', color: 0x9b59b6 },
    legendary: { emoji: '👑', label: 'Légendaire', color: 0xf39c12 }
};

// Emojis combinés pour l'affichage dans les embeds et textes
const RARITY_DISPLAY_EMOJI = {
    common: '🔑',
    rare: '🔑💎',
    epic: '🔑✨',
    legendary: '🗝️👑'
};

const PRESET_CONFIG = {
    classic: {
        name: '🎯 Classique',
        description: 'Progression équilibrée, récompenses croissantes',
        details: [
            '• Jours pairs: Loomix progressifs',
            '• Jours impairs: Clé Commune',
            '• Milestones: Clé Rare → Épique → Légendaire'
        ]
    },
    generous: {
        name: '🎁 Généreux',
        description: 'Plus de récompenses, parfait pour fidéliser',
        details: [
            '• Jours pairs: Loomix x2',
            '• Jours impairs: Clé Commune x2',
            '• Milestones: Clé Épique + quantité bonus'
        ]
    },
    hardcore: {
        name: '💀 Hardcore',
        description: 'Récompenses rares uniquement aux milestones',
        details: [
            '• Jours normaux: Loomix faibles',
            '• Milestones: Clé Rare uniquement',
            '• Jour final: Clé Épique'
        ]
    }
};

/**
 * 🎯 Router principal des interactions admin daily rewards
 */
async function handleDailyRewardsAdmin(interaction) {
    const { customId } = interaction;

    try {
        // Menu principal (depuis admin panel ou retour)
        if (customId === 'admin_daily_rewards' || customId === 'daily_admin_menu' || customId === 'daily_admin_back') {
            await interaction.deferUpdate();
            return showMainMenu(interaction);
        }

        // Calendrier
        if (customId === 'daily_admin_calendar' || customId.startsWith('daily_admin_calendar:')) {
            await interaction.deferUpdate();
            const page = customId.includes(':') ? parseInt(customId.split(':')[1]) : 1;
            return showCalendar(interaction, page);
        }

        // Modifier jour - Sélection
        if (customId === 'daily_admin_edit_day') {
            await interaction.deferUpdate();
            return showEditDaySelect(interaction);
        }

        // Modifier jour - Pagination
        if (customId.startsWith('daily_admin_edit_day_page:')) {
            await interaction.deferUpdate();
            const page = parseInt(customId.split(':')[1]);
            return showEditDaySelect(interaction, page);
        }

        // Modifier jour - Select du jour
        if (customId === 'daily_admin_edit_day_select') {
            await interaction.deferUpdate();
            const dayNumber = parseInt(interaction.values[0]);
            return showEditDayTypeSelect(interaction, dayNumber);
        }

        // Modifier jour - Select du type → Sous-menus selon le type
        if (customId.startsWith('daily_admin_edit_type_select:')) {
            const dayNumber = parseInt(customId.split(':')[1]);
            const rewardType = interaction.values[0];

            // Types nécessitant un sous-menu de sélection → deferUpdate puis select
            if (rewardType === 'mystery_box') {
                await interaction.deferUpdate();
                return showRaritySelect(interaction, dayNumber, rewardType);
            }
            if (rewardType === 'collectible') {
                await interaction.deferUpdate();
                return showCollectibleSelect(interaction, dayNumber);
            }
            if (rewardType === 'super_bonus') {
                await interaction.deferUpdate();
                return showSuperBonusSelect(interaction, dayNumber);
            }

            // Types sans sous-menu → Modal direct (PAS de deferUpdate avant showModal)
            return showEditDayModalDirect(interaction, dayNumber, rewardType);
        }

        // Modifier jour - Select rareté (mystery_box)
        if (customId.startsWith('daily_admin_edit_rarity_select:')) {
            const [, dayNumber, rewardType] = customId.split(':');
            const rarity = interaction.values[0];
            // showModal ne doit PAS avoir de deferUpdate avant
            return showEditDayModalWithRarity(interaction, parseInt(dayNumber), rewardType, rarity);
        }

        // Modifier jour - Select collectible
        if (customId.startsWith('daily_admin_edit_collectible_select:')) {
            const dayNumber = parseInt(customId.split(':')[1]);
            const collectibleId = parseInt(interaction.values[0]);
            return showEditDayModalWithItem(interaction, dayNumber, 'collectible', collectibleId);
        }

        // Modifier jour - Select super bonus
        if (customId.startsWith('daily_admin_edit_superbonus_select:')) {
            const dayNumber = parseInt(customId.split(':')[1]);
            const bonusId = parseInt(interaction.values[0]);
            return showEditDayModalWithItem(interaction, dayNumber, 'super_bonus', bonusId);
        }

        // Modifier jour - Retour à la sélection du type
        if (customId.startsWith('daily_admin_edit_type_back:')) {
            await interaction.deferUpdate();
            const dayNumber = parseInt(customId.split(':')[1]);
            return showEditDayTypeSelect(interaction, dayNumber);
        }

        // Modifier jour - Pagination collectibles
        if (customId.startsWith('daily_admin_edit_collectible_page:')) {
            await interaction.deferUpdate();
            const [, dayNumber, page] = customId.split(':');
            return showCollectibleSelect(interaction, parseInt(dayNumber), parseInt(page));
        }

        // Modifier jour - Pagination super bonus
        if (customId.startsWith('daily_admin_edit_superbonus_page:')) {
            await interaction.deferUpdate();
            const [, dayNumber, page] = customId.split(':');
            return showSuperBonusSelect(interaction, parseInt(dayNumber), parseInt(page));
        }

        // Modal de modification de jour
        if (customId.startsWith('daily_admin_edit_modal:')) {
            return handleEditDayModal(interaction);
        }

        // Présets
        if (customId === 'daily_admin_presets') {
            await interaction.deferUpdate();
            return showPresets(interaction);
        }

        // Appliquer préset
        if (customId.startsWith('daily_admin_apply_preset:')) {
            await interaction.deferUpdate();
            const presetKey = customId.split(':')[1];
            return showPresetConfirmation(interaction, presetKey);
        }

        // Confirmer préset
        if (customId.startsWith('daily_admin_confirm_preset:')) {
            await interaction.deferUpdate();
            const presetKey = customId.split(':')[1];
            return applyPreset(interaction, presetKey);
        }

        // Édition par lot
        if (customId === 'daily_admin_batch_edit') {
            await interaction.deferUpdate();
            return showBatchEdit(interaction);
        }

        // Sélection batch → Modal (PAS de deferUpdate avant showModal)
        if (customId === 'daily_admin_batch_select') {
            const selection = interaction.values[0];
            return showBatchEditModal(interaction, selection);
        }

        // Modal batch
        if (customId.startsWith('daily_admin_batch_modal:')) {
            return handleBatchEditModal(interaction);
        }

        // Config rattrapage
        if (customId === 'daily_admin_catchup_config') {
            await interaction.deferUpdate();
            return showCatchupConfig(interaction);
        }

        // Toggle activer/désactiver rattrapage
        if (customId === 'daily_admin_catchup_toggle') {
            await interaction.deferUpdate();
            return toggleCatchupEnabled(interaction);
        }

        // Modal config rattrapage
        if (customId === 'daily_admin_catchup_modal') {
            return handleCatchupConfigModal(interaction);
        }

        // Bouton pour ouvrir le modal catchup
        if (customId === 'daily_admin_catchup_edit') {
            return showCatchupModal(interaction);
        }

    } catch (error) {
        console.error('❌ Erreur dailyRewardsAdminHandler:', error);
        const errorMsg = { content: '❌ Une erreur est survenue.', ephemeral: true };
        if (interaction.deferred) {
            return interaction.editReply(errorMsg);
        } else {
            return interaction.reply(errorMsg);
        }
    }
}

/**
 * 📋 Menu principal Daily Rewards Admin
 */
async function showMainMenu(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif. Active un thème d\'abord.',
            embeds: [],
            components: []
        });
    }

    // Compter les jours configurés
    const calendar = await db.getDailyRewardsCalendar(guildId, theme.id);
    const configuredDays = calendar.length;
    const totalDays = theme.duration_days || 30;

    const embed = new EmbedBuilder()
        .setTitle('📅 RÉCOMPENSES QUOTIDIENNES')
        .setColor(0x5865F2)
        .setDescription(`**Thème:** ${theme.name}\n**Durée:** ${totalDays} jours\n**Configurés:** ${configuredDays}/${totalDays} jours ${configuredDays >= totalDays ? '✅' : '⚠️'}`)
        .setTimestamp();

    // Calculer les milestones pour info
    const milestones = calculateMilestones(totalDays);
    embed.addFields({
        name: '⭐ Milestones détectés',
        value: milestones.map(d => `J${d}`).join(', ') || 'Aucun',
        inline: false
    });

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_admin_calendar')
                .setLabel('Voir Calendrier')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('daily_admin_edit_day')
                .setLabel('Modifier Jour')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Primary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_admin_presets')
                .setLabel('Appliquer Préset')
                .setEmoji('🎨')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('daily_admin_batch_edit')
                .setLabel('Édition par Lot')
                .setEmoji('📦')
                .setStyle(ButtonStyle.Secondary)
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_admin_catchup_config')
                .setLabel('Config Rattrapage')
                .setEmoji('💰')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('admin_settings')
                .setLabel('Retour Paramétrages')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Danger)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3]
    });
}

/**
 * 📋 Afficher le calendrier avec pagination
 */
async function showCalendar(interaction, page = 1) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    const totalDays = theme.duration_days || 30;
    const daysPerPage = 10; // 10 jours par page (augmenté depuis 7)
    const totalPages = Math.ceil(totalDays / daysPerPage);
    page = Math.max(1, Math.min(page, totalPages));

    const calendar = await db.getDailyRewardsCalendar(guildId, theme.id);
    const milestones = calculateMilestones(totalDays);

    const startDay = (page - 1) * daysPerPage + 1;
    const endDay = Math.min(page * daysPerPage, totalDays);

    let calendarText = '';
    for (let day = startDay; day <= endDay; day++) {
        const config = calendar.find(c => c.day_number === day);
        const isMilestone = milestones.includes(day);
        const isFinal = day === totalDays;

        let line = `**J${day}**`;

        if (config) {
            const typeConfig = REWARD_TYPE_CONFIG[config.reward_type] || { emoji: '🎁', label: config.reward_type };
            const amountInfo = config.reward_amount > 1 ? ` x${config.reward_amount}` : '';
            // display_name contient déjà l'emoji et la rareté, pas besoin de les ajouter
            if (config.display_name) {
                line += ` ${config.display_name}${amountInfo}`;
            } else {
                // Fallback si pas de display_name
                // Pour mystery_box, utiliser les emojis combinés
                if (config.reward_type === 'mystery_box' && config.reward_rarity) {
                    const displayEmoji = RARITY_DISPLAY_EMOJI[config.reward_rarity] || '🔑';
                    const rarityLabel = RARITY_CONFIG[config.reward_rarity]?.label || config.reward_rarity;
                    line += ` ${displayEmoji} Clé ${rarityLabel}${amountInfo}`;
                } else {
                    const rarityInfo = config.reward_rarity ? ` (${RARITY_CONFIG[config.reward_rarity]?.label || config.reward_rarity})` : '';
                    line += ` ${typeConfig.emoji} ${typeConfig.label}${rarityInfo}${amountInfo}`;
                }
            }
        } else {
            line += ` ⬜ *Non configuré*`;
        }

        if (isFinal) {
            line += ' 🏆 **FINAL**';
        } else if (isMilestone) {
            line += ' ⭐';
        }

        calendarText += line + '\n';
    }

    const embed = new EmbedBuilder()
        .setTitle(`📅 CALENDRIER - ${theme.name}`)
        .setDescription(`Page ${page}/${totalPages} (Jours ${startDay}-${endDay})`)
        .setColor(0x5865F2)
        .addFields({
            name: 'Récompenses',
            value: calendarText || '*Aucune configuration*',
            inline: false
        })
        .setTimestamp();

    const navRow = new ActionRowBuilder();

    if (page > 1) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_calendar:${page - 1}`)
                .setLabel('◀️ Préc')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId('daily_admin_back')
            .setLabel('Menu')
            .setEmoji('🏠')
            .setStyle(ButtonStyle.Primary)
    );

    if (page < totalPages) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_calendar:${page + 1}`)
                .setLabel('Suiv ▶️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return interaction.editReply({
        embeds: [embed],
        components: [navRow]
    });
}

/**
 * ✏️ Sélection du jour à modifier
 */
async function showEditDaySelect(interaction, page = 1) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    const totalDays = theme.duration_days || 30;
    const calendar = await db.getDailyRewardsCalendar(guildId, theme.id);
    const milestones = calculateMilestones(totalDays);

    // Pagination: 25 jours max par page (limite Discord select)
    const daysPerPage = 25;
    const totalPages = Math.ceil(totalDays / daysPerPage);
    page = Math.max(1, Math.min(page, totalPages));

    const startDay = (page - 1) * daysPerPage + 1;
    const endDay = Math.min(page * daysPerPage, totalDays);

    // Créer les options du select pour cette page
    const options = [];
    for (let day = startDay; day <= endDay; day++) {
        const config = calendar.find(c => c.day_number === day);
        const isMilestone = milestones.includes(day);
        const isFinal = day === totalDays;
        const typeConfig = config ? (REWARD_TYPE_CONFIG[config.reward_type] || { emoji: '🎁' }) : { emoji: '⬜' };

        // Générer une description lisible
        let description = 'Non configuré';
        if (config) {
            if (config.display_name) {
                description = config.display_name;
            } else if (config.reward_type === 'currency') {
                description = `${config.reward_amount} Loomix`;
            } else if (config.reward_type === 'mystery_box') {
                const rarityLabel = RARITY_CONFIG[config.reward_rarity]?.label || config.reward_rarity;
                description = `Clé ${rarityLabel}${config.reward_amount > 1 ? ` x${config.reward_amount}` : ''}`;
            } else {
                description = REWARD_TYPE_CONFIG[config.reward_type]?.label || config.reward_type;
            }
        }

        options.push({
            label: `Jour ${day}${isFinal ? ' 🏆' : isMilestone ? ' ⭐' : ''}`,
            value: String(day),
            description: description.substring(0, 100), // Discord limite à 100 chars
            emoji: typeConfig.emoji
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('✏️ MODIFIER UN JOUR')
        .setDescription(`Sélectionne le jour à modifier.\n**Page ${page}/${totalPages}** (Jours ${startDay}-${endDay})`)
        .setColor(0x5865F2);

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('daily_admin_edit_day_select')
                .setPlaceholder('📆 Sélectionner le jour...')
                .addOptions(options)
        );

    const navRow = new ActionRowBuilder();

    // Boutons de pagination si nécessaire
    if (page > 1) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_edit_day_page:${page - 1}`)
                .setLabel('◀️ Préc')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId('daily_admin_back')
            .setLabel('Menu')
            .setEmoji('🏠')
            .setStyle(ButtonStyle.Primary)
    );

    if (page < totalPages) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_edit_day_page:${page + 1}`)
                .setLabel('Suiv ▶️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return interaction.editReply({
        embeds: [embed],
        components: [selectRow, navRow]
    });
}

/**
 * ✏️ Sélection du type de récompense pour un jour
 */
async function showEditDayTypeSelect(interaction, dayNumber) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const milestones = calculateMilestones(theme.duration_days || 30);
    const isMilestone = milestones.includes(dayNumber);

    const embed = new EmbedBuilder()
        .setTitle(`✏️ MODIFIER JOUR ${dayNumber}${isMilestone ? ' ⭐' : ''}`)
        .setDescription('Choisis le type de récompense.')
        .setColor(isMilestone ? 0xFFD700 : 0x5865F2);

    const options = Object.entries(REWARD_TYPE_CONFIG).map(([key, config]) => ({
        label: config.label,
        value: key,
        emoji: config.emoji
    }));

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`daily_admin_edit_type_select:${dayNumber}`)
                .setPlaceholder('🎁 Type de récompense...')
                .addOptions(options)
        );

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_admin_edit_day')
                .setLabel('Retour')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('daily_admin_back')
                .setLabel('Annuler')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [selectRow, navRow]
    });
}

/**
 * 🎨 Sélection de la rareté (mystery_box uniquement)
 */
async function showRaritySelect(interaction, dayNumber, rewardType) {
    const typeConfig = REWARD_TYPE_CONFIG[rewardType];

    const embed = new EmbedBuilder()
        .setTitle(`✏️ JOUR ${dayNumber} - ${typeConfig.label}`)
        .setDescription('Choisis la rareté.')
        .setColor(0x5865F2);

    // Raretés valides pour mystery boxes (pas mythic)
    const validRarities = ['common', 'rare', 'epic', 'legendary'];
    const options = validRarities.map(key => ({
        label: RARITY_CONFIG[key].label,
        value: key,
        emoji: RARITY_CONFIG[key].emoji
    }));

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`daily_admin_edit_rarity_select:${dayNumber}:${rewardType}`)
                .setPlaceholder('💎 Choisir la rareté...')
                .addOptions(options)
        );

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_edit_type_back:${dayNumber}`)
                .setLabel('Retour')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('daily_admin_back')
                .setLabel('Annuler')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [selectRow, navRow]
    });
}

/**
 * 🎯 Sélection d'un collectible du thème
 */
async function showCollectibleSelect(interaction, dayNumber, page = 1) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    // Récupérer les collectibles du thème (pas de colonne emoji dans cette table)
    const collectibles = await db.queryAll(`
        SELECT id, name, rarity
        FROM collectibles
        WHERE guild_id = $1 AND theme_id = $2
        ORDER BY
            CASE rarity
                WHEN 'legendary' THEN 1
                WHEN 'epic' THEN 2
                WHEN 'rare' THEN 3
                WHEN 'common' THEN 4
                ELSE 5
            END,
            name
    `, [guildId, theme.id]);

    if (collectibles.length === 0) {
        return interaction.editReply({
            content: '❌ Aucun collectible dans ce thème.',
            embeds: [],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`daily_admin_edit_type_back:${dayNumber}`)
                        .setLabel('Retour')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    // Pagination (25 max par select)
    const itemsPerPage = 25;
    const totalPages = Math.ceil(collectibles.length / itemsPerPage);
    page = Math.max(1, Math.min(page, totalPages));
    const startIdx = (page - 1) * itemsPerPage;
    const pageCollectibles = collectibles.slice(startIdx, startIdx + itemsPerPage);

    const embed = new EmbedBuilder()
        .setTitle(`✏️ JOUR ${dayNumber} - Collectible`)
        .setDescription(`Choisis le collectible à attribuer.\n**Page ${page}/${totalPages}** (${collectibles.length} collectibles)`)
        .setColor(0x5865F2);

    const options = pageCollectibles.map(c => ({
        label: c.name.substring(0, 100),
        value: String(c.id),
        description: `${RARITY_CONFIG[c.rarity]?.label || c.rarity}`,
        emoji: RARITY_CONFIG[c.rarity]?.emoji || '🎯'
    }));

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`daily_admin_edit_collectible_select:${dayNumber}`)
                .setPlaceholder('🎯 Choisir le collectible...')
                .addOptions(options)
        );

    const navRow = new ActionRowBuilder();

    if (page > 1) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_edit_collectible_page:${dayNumber}:${page - 1}`)
                .setLabel('◀️ Préc')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`daily_admin_edit_type_back:${dayNumber}`)
            .setLabel('Retour')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Primary)
    );

    if (page < totalPages) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_edit_collectible_page:${dayNumber}:${page + 1}`)
                .setLabel('Suiv ▶️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    // Bouton Annuler toujours en dernier
    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId('daily_admin_back')
            .setLabel('Annuler')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [selectRow, navRow]
    });
}

/**
 * ⚡ Sélection d'un super bonus actif
 */
async function showSuperBonusSelect(interaction, dayNumber, page = 1) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    // Récupérer les super bonus activés (globaux ou du thème)
    // Les super bonuses ont généralement theme_id = NULL (globaux au serveur)
    const bonuses = await db.queryAll(`
        SELECT id, name, effect_type, icon, description
        FROM super_bonuses
        WHERE guild_id = $1 AND is_enabled = true
        AND (theme_id IS NULL OR theme_id = $2)
        ORDER BY name
    `, [guildId, theme.id]);

    if (bonuses.length === 0) {
        return interaction.editReply({
            content: '❌ Aucun super bonus actif dans ce thème.',
            embeds: [],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`daily_admin_edit_type_back:${dayNumber}`)
                        .setLabel('Retour')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    // Pagination (25 max par select)
    const itemsPerPage = 25;
    const totalPages = Math.ceil(bonuses.length / itemsPerPage);
    page = Math.max(1, Math.min(page, totalPages));
    const startIdx = (page - 1) * itemsPerPage;
    const pageBonuses = bonuses.slice(startIdx, startIdx + itemsPerPage);

    const embed = new EmbedBuilder()
        .setTitle(`✏️ JOUR ${dayNumber} - Super Bonus`)
        .setDescription(`Choisis le super bonus à attribuer.\n**Page ${page}/${totalPages}** (${bonuses.length} bonus)`)
        .setColor(0x5865F2);

    const options = pageBonuses.map(b => ({
        label: b.name.substring(0, 100),
        value: String(b.id),
        description: (b.description || b.effect_type).substring(0, 100),
        emoji: b.icon || '⚡'
    }));

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`daily_admin_edit_superbonus_select:${dayNumber}`)
                .setPlaceholder('⚡ Choisir le super bonus...')
                .addOptions(options)
        );

    const navRow = new ActionRowBuilder();

    if (page > 1) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_edit_superbonus_page:${dayNumber}:${page - 1}`)
                .setLabel('◀️ Préc')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`daily_admin_edit_type_back:${dayNumber}`)
            .setLabel('Retour')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Primary)
    );

    if (page < totalPages) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_edit_superbonus_page:${dayNumber}:${page + 1}`)
                .setLabel('Suiv ▶️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    // Bouton Annuler toujours en dernier
    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId('daily_admin_back')
            .setLabel('Annuler')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [selectRow, navRow]
    });
}

/**
 * ✏️ Modal direct pour types sans sous-menu (currency, super_bonus_random)
 */
async function showEditDayModalDirect(interaction, dayNumber, rewardType) {
    const typeConfig = REWARD_TYPE_CONFIG[rewardType];

    const modal = new ModalBuilder()
        .setCustomId(`daily_admin_edit_modal:${dayNumber}:${rewardType}`)
        .setTitle(`Jour ${dayNumber} - ${typeConfig.label}`);

    // Nom personnalisé
    const nameInput = new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Nom affiché (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Ex: Bonus du jour ${dayNumber}`)
        .setRequired(false)
        .setMaxLength(50);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

    // Quantité (currency ou super_bonus_random)
    if (rewardType === 'currency') {
        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Montant de Loomix')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 100')
            .setRequired(true)
            .setMaxLength(10);
        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    } else if (rewardType === 'super_bonus_random') {
        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Quantité de super bonus')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 1')
            .setValue('1')
            .setRequired(true)
            .setMaxLength(5);
        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    }

    // Emoji personnalisé
    const emojiInput = new TextInputBuilder()
        .setCustomId('display_emoji')
        .setLabel('Emoji (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(typeConfig.emoji)
        .setRequired(false)
        .setMaxLength(10);
    modal.addComponents(new ActionRowBuilder().addComponents(emojiInput));

    // Milestone
    const milestoneInput = new TextInputBuilder()
        .setCustomId('is_milestone')
        .setLabel('Milestone? (oui/non)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('non')
        .setValue('non')
        .setRequired(false)
        .setMaxLength(5);
    modal.addComponents(new ActionRowBuilder().addComponents(milestoneInput));

    return interaction.showModal(modal);
}

/**
 * ✏️ Modal après sélection de rareté (mystery_box uniquement)
 */
async function showEditDayModalWithRarity(interaction, dayNumber, rewardType, rarity) {
    const typeConfig = REWARD_TYPE_CONFIG[rewardType];
    const rarityConfig = RARITY_CONFIG[rarity];

    const modal = new ModalBuilder()
        .setCustomId(`daily_admin_edit_modal:${dayNumber}:${rewardType}:${rarity}`)
        .setTitle(`J${dayNumber} - ${rarityConfig.label}`);

    // Nom personnalisé
    const nameInput = new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Nom affiché (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Ex: Récompense du jour ${dayNumber}`)
        .setRequired(false)
        .setMaxLength(50);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

    // Quantité (pour mystery_box)
    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Quantité')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1')
        .setValue('1')
        .setRequired(true)
        .setMaxLength(5);
    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

    // Emoji personnalisé
    const emojiInput = new TextInputBuilder()
        .setCustomId('display_emoji')
        .setLabel('Emoji (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(rarityConfig.emoji || typeConfig.emoji)
        .setRequired(false)
        .setMaxLength(10);
    modal.addComponents(new ActionRowBuilder().addComponents(emojiInput));

    // Milestone
    const milestoneInput = new TextInputBuilder()
        .setCustomId('is_milestone')
        .setLabel('Milestone? (oui/non)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('non')
        .setValue('non')
        .setRequired(false)
        .setMaxLength(5);
    modal.addComponents(new ActionRowBuilder().addComponents(milestoneInput));

    return interaction.showModal(modal);
}

/**
 * ✏️ Modal après sélection d'item (collectible, super_bonus)
 */
async function showEditDayModalWithItem(interaction, dayNumber, rewardType, itemId) {
    const typeConfig = REWARD_TYPE_CONFIG[rewardType];

    const modal = new ModalBuilder()
        .setCustomId(`daily_admin_edit_modal:${dayNumber}:${rewardType}:${itemId}`)
        .setTitle(`Jour ${dayNumber} - ${typeConfig.label}`);

    // Nom personnalisé
    const nameInput = new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Nom affiché (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Ex: Récompense spéciale`)
        .setRequired(false)
        .setMaxLength(50);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

    // Quantité
    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Quantité')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1')
        .setValue('1')
        .setRequired(true)
        .setMaxLength(5);
    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

    // Emoji personnalisé
    const emojiInput = new TextInputBuilder()
        .setCustomId('display_emoji')
        .setLabel('Emoji (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(typeConfig.emoji)
        .setRequired(false)
        .setMaxLength(10);
    modal.addComponents(new ActionRowBuilder().addComponents(emojiInput));

    // Milestone
    const milestoneInput = new TextInputBuilder()
        .setCustomId('is_milestone')
        .setLabel('Milestone? (oui/non)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('non')
        .setValue('non')
        .setRequired(false)
        .setMaxLength(5);
    modal.addComponents(new ActionRowBuilder().addComponents(milestoneInput));

    return interaction.showModal(modal);
}

/**
 * ✏️ Modal pour éditer un jour (LEGACY - à supprimer après migration)
 */
async function showEditDayModal(interaction, dayNumber, rewardType) {
    const typeConfig = REWARD_TYPE_CONFIG[rewardType];

    const modal = new ModalBuilder()
        .setCustomId(`daily_admin_edit_modal:${dayNumber}:${rewardType}`)
        .setTitle(`Jour ${dayNumber} - ${typeConfig.label}`);

    // Nom affiché
    const displayNameInput = new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Nom affiché (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Ex: ${typeConfig.emoji} ${typeConfig.label}`)
        .setRequired(false)
        .setMaxLength(50);

    modal.addComponents(new ActionRowBuilder().addComponents(displayNameInput));

    // Rareté (si applicable)
    if (typeConfig.hasRarity) {
        const rarityInput = new TextInputBuilder()
            .setCustomId('rarity')
            .setLabel('Rareté (common/rare/epic/legendary)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('common, rare, epic ou legendary')
            .setRequired(true)
            .setMaxLength(15);
        modal.addComponents(new ActionRowBuilder().addComponents(rarityInput));
    }

    // Quantité (si applicable)
    if (typeConfig.hasAmount) {
        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel(rewardType === 'currency' ? 'Montant de Loomix' : 'Quantité')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(rewardType === 'currency' ? 'Ex: 100' : 'Ex: 1')
            .setRequired(true)
            .setMaxLength(10);
        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    }

    // Item ID (si applicable)
    if (typeConfig.hasItemId) {
        const itemIdInput = new TextInputBuilder()
            .setCustomId('item_id')
            .setLabel('ID de l\'item')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('ID numérique du collectible ou super bonus')
            .setRequired(true)
            .setMaxLength(10);
        modal.addComponents(new ActionRowBuilder().addComponents(itemIdInput));
    }

    // Milestone
    const milestoneInput = new TextInputBuilder()
        .setCustomId('is_milestone')
        .setLabel('Milestone ? (oui/non)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('oui ou non')
        .setRequired(false)
        .setMaxLength(5);
    modal.addComponents(new ActionRowBuilder().addComponents(milestoneInput));

    return interaction.showModal(modal);
}

/**
 * ✏️ Traitement du modal d'édition (nouvelle version avec pré-sélection)
 */
async function handleEditDayModal(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const parts = interaction.customId.split(':');
    const dayNumber = parseInt(parts[1]);
    const rewardType = parts[2];
    const preselected = parts[3] || null; // rarity pour mystery_box, itemId pour collectible/super_bonus

    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({ content: '❌ Aucun thème actif.' });
    }

    const typeConfig = REWARD_TYPE_CONFIG[rewardType];

    // Récupérer les valeurs du modal
    let amount = null;
    let displayEmoji = null;
    let displayName = null;
    let isMilestone = false;

    // Récupérer display_name si présent
    try {
        displayName = interaction.fields.getTextInputValue('display_name') || null;
    } catch (e) {
        displayName = null;
    }

    // Récupérer amount si présent
    try {
        amount = parseInt(interaction.fields.getTextInputValue('amount'));
        if (isNaN(amount)) amount = 1;
    } catch (e) {
        amount = 1;
    }

    // Récupérer emoji personnalisé
    try {
        displayEmoji = interaction.fields.getTextInputValue('display_emoji') || null;
    } catch (e) {
        displayEmoji = null;
    }

    // Récupérer is_milestone
    try {
        const milestoneValue = interaction.fields.getTextInputValue('is_milestone')?.toLowerCase();
        isMilestone = milestoneValue === 'oui' || milestoneValue === 'yes' || milestoneValue === 'true' || milestoneValue === '1';
    } catch (e) {
        isMilestone = false;
    }

    // Déterminer rarity et itemId selon le type
    let rarity = null;
    let itemId = null;

    if (rewardType === 'mystery_box') {
        rarity = preselected; // La rareté était pré-sélectionnée
    } else if (rewardType === 'collectible' || rewardType === 'super_bonus') {
        itemId = preselected ? parseInt(preselected) : null;
    }

    // Récupérer infos de l'item si applicable pour le display
    let itemName = null;
    let itemEmoji = null;
    if (itemId) {
        if (rewardType === 'collectible') {
            const collectible = await db.queryOne(`SELECT name, rarity FROM collectibles WHERE id = $1`, [itemId]);
            if (collectible) {
                itemName = collectible.name;
                itemEmoji = RARITY_CONFIG[collectible.rarity]?.emoji;
                rarity = collectible.rarity;
            }
        } else if (rewardType === 'super_bonus') {
            const bonus = await db.queryOne(`SELECT name, icon FROM super_bonuses WHERE id = $1`, [itemId]);
            if (bonus) {
                itemName = bonus.name;
                itemEmoji = bonus.icon;
            }
        }
    }

    // Déterminer l'emoji final
    // Pour mystery_box, utiliser les emojis combinés (RARITY_DISPLAY_EMOJI)
    let rarityEmoji = null;
    if (rarity) {
        rarityEmoji = rewardType === 'mystery_box'
            ? RARITY_DISPLAY_EMOJI[rarity]
            : RARITY_CONFIG[rarity]?.emoji;
    }
    const finalEmoji = displayEmoji || itemEmoji || rarityEmoji || typeConfig.emoji;

    try {
        // Upsert dans daily_rewards_config
        await db.query(`
            INSERT INTO daily_rewards_config (
                guild_id, theme_id, day_number, reward_type, reward_rarity,
                reward_amount, reward_item_id, display_name, display_emoji, is_milestone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (guild_id, theme_id, day_number)
            DO UPDATE SET
                reward_type = EXCLUDED.reward_type,
                reward_rarity = EXCLUDED.reward_rarity,
                reward_amount = EXCLUDED.reward_amount,
                reward_item_id = EXCLUDED.reward_item_id,
                display_name = EXCLUDED.display_name,
                display_emoji = EXCLUDED.display_emoji,
                is_milestone = EXCLUDED.is_milestone,
                updated_at = NOW()
        `, [
            guildId,
            theme.id,
            dayNumber,
            rewardType,
            rarity,
            amount,
            itemId,
            displayName,
            finalEmoji,
            isMilestone
        ]);

        // Construire la description de la récompense
        let rewardDesc = `${finalEmoji} `;
        if (displayName) {
            rewardDesc += displayName;
        } else if (itemName) {
            rewardDesc += itemName;
        } else if (rewardType === 'currency') {
            rewardDesc += `${amount} Loomix`;
        } else if (rewardType === 'mystery_box') {
            rewardDesc += `Clé ${rarity ? RARITY_CONFIG[rarity]?.label : ''}`;
            if (amount > 1) rewardDesc += ` x${amount}`;
        } else if (rewardType === 'super_bonus_random') {
            rewardDesc += `Super Bonus Aléatoire`;
            if (amount > 1) rewardDesc += ` x${amount}`;
        } else {
            rewardDesc += typeConfig.label;
        }

        if (isMilestone) {
            rewardDesc += ' ⭐ **Milestone**';
        }

        // Embed de confirmation
        const successEmbed = new EmbedBuilder()
            .setTitle(`✅ Jour ${dayNumber} configuré !`)
            .setDescription(rewardDesc)
            .setColor(0x57F287)
            .setTimestamp();

        // Boutons pour continuer ou revenir
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('daily_admin_edit_day')
                    .setLabel('Configurer un autre jour')
                    .setEmoji('📅')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('daily_admin_back')
                    .setLabel('Retour au menu')
                    .setEmoji('🏠')
                    .setStyle(ButtonStyle.Secondary)
            );

        return interaction.editReply({ content: null, embeds: [successEmbed], components: [actionRow] });
    } catch (error) {
        console.error('❌ Erreur sauvegarde jour:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la sauvegarde.' });
    }
}

/**
 * 🎨 Afficher les présets
 */
async function showPresets(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    const totalDays = theme.duration_days || 30;
    const milestones = calculateMilestones(totalDays);

    const embed = new EmbedBuilder()
        .setTitle('🎨 APPLIQUER UN PRÉSET')
        .setDescription(`**Thème:** ${theme.name} (${totalDays} jours)\n**Milestones:** ${milestones.map(d => `J${d}`).join(', ')}`)
        .setColor(0x5865F2);

    // Ajouter les descriptions des présets
    for (const [key, preset] of Object.entries(PRESET_CONFIG)) {
        embed.addFields({
            name: preset.name,
            value: `${preset.description}\n${preset.details.join('\n')}`,
            inline: false
        });
    }

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_admin_apply_preset:classic')
                .setLabel('Classique')
                .setEmoji('🎯')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('daily_admin_apply_preset:generous')
                .setLabel('Généreux')
                .setEmoji('🎁')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('daily_admin_apply_preset:hardcore')
                .setLabel('Hardcore')
                .setEmoji('💀')
                .setStyle(ButtonStyle.Danger)
        );

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_admin_back')
                .setLabel('Retour')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [row, navRow]
    });
}

/**
 * 🎨 Confirmation avant application du préset
 */
async function showPresetConfirmation(interaction, presetKey) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const preset = PRESET_CONFIG[presetKey];

    if (!preset || !theme) {
        return interaction.editReply({
            content: '❌ Préset ou thème introuvable.',
            embeds: [],
            components: []
        });
    }

    const totalDays = theme.duration_days || 30;
    const milestones = calculateMilestones(totalDays);

    // Générer un aperçu
    const preview = generatePresetPreview(presetKey, totalDays, milestones);

    const embed = new EmbedBuilder()
        .setTitle(`⚠️ CONFIRMATION - ${preset.name}`)
        .setDescription(`Tu vas appliquer le préset **${preset.name}** sur **${totalDays} jours**.\n\n**⚠️ Cela écrasera toute la configuration actuelle!**`)
        .setColor(0xFFA500)
        .addFields({
            name: '📋 Aperçu des récompenses',
            value: preview.slice(0, 1024),
            inline: false
        });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_admin_confirm_preset:${presetKey}`)
                .setLabel('Confirmer')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('daily_admin_presets')
                .setLabel('Annuler')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

/**
 * 🎨 Appliquer le préset
 */
async function applyPreset(interaction, presetKey) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    const totalDays = theme.duration_days || 30;
    const milestones = calculateMilestones(totalDays);
    const rewards = generatePreset(presetKey, totalDays, milestones);

    try {
        // Supprimer l'ancienne config
        await db.query(`
            DELETE FROM daily_rewards_config
            WHERE guild_id = $1 AND theme_id = $2
        `, [guildId, theme.id]);

        // Insérer la nouvelle config
        for (const reward of rewards) {
            await db.query(`
                INSERT INTO daily_rewards_config (
                    guild_id, theme_id, day_number, reward_type, reward_rarity,
                    reward_amount, display_name, display_emoji, is_milestone
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                guildId,
                theme.id,
                reward.day_number,
                reward.reward_type,
                reward.reward_rarity,
                reward.reward_amount,
                reward.display_name,
                reward.display_emoji,
                reward.is_milestone
            ]);
        }

        const preset = PRESET_CONFIG[presetKey];
        return interaction.editReply({
            content: `✅ Préset **${preset.name}** appliqué avec succès!\n📅 ${totalDays} jours configurés.`,
            embeds: [],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('daily_admin_calendar')
                        .setLabel('Voir Calendrier')
                        .setEmoji('📋')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('daily_admin_back')
                        .setLabel('Menu')
                        .setEmoji('🏠')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    } catch (error) {
        console.error('❌ Erreur application préset:', error);
        return interaction.editReply({
            content: '❌ Erreur lors de l\'application du préset.',
            embeds: [],
            components: []
        });
    }
}

/**
 * 📦 Afficher l'édition par lot
 */
async function showBatchEdit(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    const totalDays = theme.duration_days || 30;

    const embed = new EmbedBuilder()
        .setTitle('📦 ÉDITION PAR LOT')
        .setDescription('Modifie plusieurs jours en une seule fois.')
        .setColor(0x5865F2)
        .addFields({
            name: '📌 Instructions',
            value: 'Sélectionne les jours à modifier, puis configure la récompense à appliquer.',
            inline: false
        });

    // Générer les options de sélection
    const options = [
        { label: 'Jours pairs (2, 4, 6...)', value: 'even', emoji: '2️⃣' },
        { label: 'Jours impairs (1, 3, 5...)', value: 'odd', emoji: '1️⃣' }
    ];

    // Ajouter les semaines
    const weeks = Math.ceil(totalDays / 7);
    for (let w = 1; w <= Math.min(weeks, 6); w++) {
        const start = (w - 1) * 7 + 1;
        const end = Math.min(w * 7, totalDays);
        options.push({
            label: `Semaine ${w} (J${start}-J${end})`,
            value: `week_${w}`,
            emoji: '📅'
        });
    }

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('daily_admin_batch_select')
                .setPlaceholder('🎯 Sélectionner les jours...')
                .addOptions(options)
        );

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_admin_back')
                .setLabel('Retour')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [selectRow, navRow]
    });
}

/**
 * 📦 Modal pour édition par lot
 */
async function showBatchEditModal(interaction, selection) {
    const modal = new ModalBuilder()
        .setCustomId(`daily_admin_batch_modal:${selection}`)
        .setTitle('Édition par lot');

    const typeInput = new TextInputBuilder()
        .setCustomId('reward_type')
        .setLabel('Type de récompense')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('mystery_box, currency, super_bonus_random')
        .setRequired(true)
        .setMaxLength(20);

    const rarityInput = new TextInputBuilder()
        .setCustomId('rarity')
        .setLabel('Rareté (pour mystery_box)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('common, rare, epic, legendary')
        .setRequired(false)
        .setMaxLength(15);

    const baseAmountInput = new TextInputBuilder()
        .setCustomId('base_amount')
        .setLabel('Montant de base')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 50')
        .setRequired(true)
        .setMaxLength(10);

    const incrementInput = new TextInputBuilder()
        .setCustomId('increment')
        .setLabel('Incrément par jour (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 10 (pour +10/jour)')
        .setRequired(false)
        .setMaxLength(10);

    modal.addComponents(
        new ActionRowBuilder().addComponents(typeInput),
        new ActionRowBuilder().addComponents(rarityInput),
        new ActionRowBuilder().addComponents(baseAmountInput),
        new ActionRowBuilder().addComponents(incrementInput)
    );

    return interaction.showModal(modal);
}

/**
 * 📦 Traitement du modal batch
 */
async function handleBatchEditModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const selection = interaction.customId.split(':')[1];
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({ content: '❌ Aucun thème actif.' });
    }

    const totalDays = theme.duration_days || 30;

    // Récupérer les valeurs
    const rewardType = interaction.fields.getTextInputValue('reward_type').toLowerCase();
    const rarity = interaction.fields.getTextInputValue('rarity')?.toLowerCase() || null;
    const baseAmount = parseInt(interaction.fields.getTextInputValue('base_amount')) || 1;
    const increment = parseInt(interaction.fields.getTextInputValue('increment')) || 0;

    // Validation
    if (!REWARD_TYPE_CONFIG[rewardType]) {
        return interaction.editReply({ content: '❌ Type de récompense invalide.' });
    }

    // Déterminer les jours à modifier
    let daysToModify = [];
    if (selection === 'even') {
        for (let d = 2; d <= totalDays; d += 2) daysToModify.push(d);
    } else if (selection === 'odd') {
        for (let d = 1; d <= totalDays; d += 2) daysToModify.push(d);
    } else if (selection.startsWith('week_')) {
        const weekNum = parseInt(selection.split('_')[1]);
        const start = (weekNum - 1) * 7 + 1;
        const end = Math.min(weekNum * 7, totalDays);
        for (let d = start; d <= end; d++) daysToModify.push(d);
    }

    try {
        const typeConfig = REWARD_TYPE_CONFIG[rewardType];
        let position = 0;

        for (const day of daysToModify) {
            const amount = baseAmount + (position * increment);
            position++;

            await db.query(`
                INSERT INTO daily_rewards_config (
                    guild_id, theme_id, day_number, reward_type, reward_rarity,
                    reward_amount, display_name, display_emoji, is_milestone
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
                ON CONFLICT (guild_id, theme_id, day_number)
                DO UPDATE SET
                    reward_type = EXCLUDED.reward_type,
                    reward_rarity = EXCLUDED.reward_rarity,
                    reward_amount = EXCLUDED.reward_amount,
                    display_name = EXCLUDED.display_name,
                    display_emoji = EXCLUDED.display_emoji,
                    updated_at = NOW()
            `, [
                guildId,
                theme.id,
                day,
                rewardType,
                rarity,
                amount,
                rewardType === 'currency' ? `💰 ${amount} Loomix` : `${typeConfig.emoji} ${typeConfig.label}`,
                typeConfig.emoji
            ]);
        }

        return interaction.editReply({
            content: `✅ **${daysToModify.length} jours** modifiés!\n${typeConfig.emoji} ${typeConfig.label}${rarity ? ` (${rarity})` : ''}\n💰 Base: ${baseAmount}${increment ? ` (+${increment}/jour)` : ''}`
        });
    } catch (error) {
        console.error('❌ Erreur batch edit:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la modification.' });
    }
}

/**
 * 💰 Afficher la config rattrapage
 */
async function showCatchupConfig(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    // Récupérer la config rattrapage depuis daily_catchup_config
    const catchupConfig = await db.queryOne(`
        SELECT enabled, base_price, price_increment, price_multiplier, pricing_mode, max_catchup_days
        FROM daily_catchup_config
        WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, theme.id]);

    // Valeurs par défaut si aucune config
    const enabled = catchupConfig?.enabled !== false;
    const basePrice = catchupConfig?.base_price || 250;
    const priceIncrement = catchupConfig?.price_increment || 100;
    const maxDays = catchupConfig?.max_catchup_days || 0;

    const embed = new EmbedBuilder()
        .setTitle('💰 CONFIG RATTRAPAGE')
        .setColor(enabled ? 0x57F287 : 0xED4245)
        .setDescription(enabled
            ? '✅ **Rattrapage ACTIVÉ** - Les joueurs peuvent acheter des récompenses manquées'
            : '❌ **Rattrapage DÉSACTIVÉ** - Les joueurs ne peuvent pas rattraper les jours manqués')
        .addFields(
            {
                name: '💰 Prix de base',
                value: `${basePrice} Loomix`,
                inline: true
            },
            {
                name: '📈 Incrément/jour',
                value: `+${priceIncrement} Loomix`,
                inline: true
            },
            {
                name: '🔢 Max jours',
                value: maxDays === 0 ? 'Illimité' : `${maxDays} jours`,
                inline: true
            }
        )
        .setFooter({ text: 'Prix = base + (incrément × nombre de jours déjà achetés)' });

    // Bouton toggle avec état visuel
    const toggleButton = new ButtonBuilder()
        .setCustomId('daily_admin_catchup_toggle')
        .setLabel(enabled ? 'Désactiver' : 'Activer')
        .setEmoji(enabled ? '❌' : '✅')
        .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success);

    const row = new ActionRowBuilder()
        .addComponents(
            toggleButton,
            new ButtonBuilder()
                .setCustomId('daily_admin_catchup_edit')
                .setLabel('Modifier Prix')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('daily_admin_back')
                .setLabel('Retour')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

/**
 * 💰 Toggle activer/désactiver rattrapage
 */
async function toggleCatchupEnabled(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    // Récupérer l'état actuel
    const catchupConfig = await db.queryOne(`
        SELECT enabled FROM daily_catchup_config
        WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, theme.id]);

    const currentEnabled = catchupConfig?.enabled !== false;
    const newEnabled = !currentEnabled;

    // Mettre à jour (UPSERT)
    await db.query(`
        INSERT INTO daily_catchup_config (guild_id, theme_id, enabled, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (guild_id, theme_id) DO UPDATE SET
            enabled = $3,
            updated_at = NOW()
    `, [guildId, theme.id, newEnabled]);

    // Refresh l'affichage immédiatement
    return showCatchupConfig(interaction);
}

/**
 * 💰 Modal config rattrapage (prix uniquement, toggle séparé)
 */
async function showCatchupModal(interaction) {
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    // Pré-remplir avec les valeurs actuelles
    const catchupConfig = await db.queryOne(`
        SELECT base_price, price_increment, max_catchup_days
        FROM daily_catchup_config
        WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, theme?.id]);

    const currentBasePrice = String(catchupConfig?.base_price || 250);
    const currentIncrement = String(catchupConfig?.price_increment || 100);
    const currentMaxDays = String(catchupConfig?.max_catchup_days || 0);

    const modal = new ModalBuilder()
        .setCustomId('daily_admin_catchup_modal')
        .setTitle('Config Prix Rattrapage');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('base_price')
                .setLabel('Prix de base (Loomix)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 250')
                .setValue(currentBasePrice)
                .setRequired(true)
                .setMaxLength(10)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('price_increment')
                .setLabel('Incrément par jour acheté (Loomix)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 100 (0 = prix fixe)')
                .setValue(currentIncrement)
                .setRequired(true)
                .setMaxLength(10)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('max_days')
                .setLabel('Max jours rattrapables (0 = illimité)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 7 ou 0')
                .setValue(currentMaxDays)
                .setRequired(true)
                .setMaxLength(5)
        )
    );

    return interaction.showModal(modal);
}

/**
 * 💰 Traitement modal config rattrapage (met à jour les prix, refresh l'embed)
 */
async function handleCatchupConfigModal(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
        return interaction.editReply({
            content: '❌ Aucun thème actif.',
            embeds: [],
            components: []
        });
    }

    const basePrice = parseInt(interaction.fields.getTextInputValue('base_price'));
    const priceIncrement = parseInt(interaction.fields.getTextInputValue('price_increment'));
    const maxDays = parseInt(interaction.fields.getTextInputValue('max_days'));

    if (isNaN(basePrice) || basePrice < 0) {
        return interaction.editReply({
            content: '❌ Prix de base invalide (doit être un nombre positif).',
            embeds: [],
            components: []
        });
    }
    if (isNaN(priceIncrement) || priceIncrement < 0) {
        return interaction.editReply({
            content: '❌ Incrément invalide (minimum 0).',
            embeds: [],
            components: []
        });
    }
    if (isNaN(maxDays) || maxDays < 0) {
        return interaction.editReply({
            content: '❌ Max jours invalide (minimum 0).',
            embeds: [],
            components: []
        });
    }

    try {
        // UPSERT dans daily_catchup_config (ne change PAS enabled, juste les prix)
        await db.query(`
            INSERT INTO daily_catchup_config (guild_id, theme_id, base_price, price_increment, max_catchup_days, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (guild_id, theme_id) DO UPDATE SET
                base_price = $3,
                price_increment = $4,
                max_catchup_days = $5,
                updated_at = NOW()
        `, [guildId, theme.id, basePrice, priceIncrement, maxDays]);

        // Refresh l'embed de la config rattrapage
        return showCatchupConfig(interaction);
    } catch (error) {
        console.error('❌ Erreur sauvegarde config rattrapage:', error);
        return interaction.editReply({
            content: '❌ Erreur lors de la sauvegarde.',
            embeds: [],
            components: []
        });
    }
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Calculer les milestones pour un thème
 */
function calculateMilestones(durationDays) {
    const milestones = [];
    for (let d = 7; d <= durationDays; d += 7) {
        milestones.push(d);
    }
    // Le dernier jour est toujours un milestone
    if (!milestones.includes(durationDays)) {
        milestones.push(durationDays);
    }
    return milestones;
}

/**
 * Générer un préset complet
 */
function generatePreset(presetKey, totalDays, milestones) {
    const rewards = [];
    const totalPhases = milestones.length;

    for (let day = 1; day <= totalDays; day++) {
        const phase = Math.ceil(day / 7);
        const isMilestone = milestones.includes(day);
        const isFinalDay = day === totalDays;
        const isEvenDay = day % 2 === 0;

        let reward;

        switch (presetKey) {
            case 'classic':
                reward = generateClassicReward(day, phase, totalPhases, isMilestone, isFinalDay, isEvenDay);
                break;
            case 'generous':
                reward = generateGenerousReward(day, phase, totalPhases, isMilestone, isFinalDay, isEvenDay);
                break;
            case 'hardcore':
                reward = generateHardcoreReward(day, phase, totalPhases, isMilestone, isFinalDay, isEvenDay);
                break;
            default:
                reward = generateClassicReward(day, phase, totalPhases, isMilestone, isFinalDay, isEvenDay);
        }

        rewards.push({
            day_number: day,
            ...reward,
            is_milestone: isMilestone
        });
    }

    return rewards;
}

function generateClassicReward(day, phase, totalPhases, isMilestone, isFinalDay, isEvenDay) {
    if (isFinalDay) {
        return {
            reward_type: 'mystery_box',
            reward_rarity: 'legendary',
            reward_amount: 1,
            display_name: null, // Généré dynamiquement à l'affichage
            display_emoji: '👑'
        };
    }

    if (isMilestone) {
        const progress = phase / totalPhases;
        let rarity = 'rare';
        if (progress > 0.75) rarity = 'legendary';
        else if (progress > 0.4) rarity = 'epic';

        return {
            reward_type: 'mystery_box',
            reward_rarity: rarity,
            reward_amount: 1,
            display_name: null, // Généré dynamiquement à l'affichage
            display_emoji: RARITY_DISPLAY_EMOJI[rarity]
        };
    }

    if (isEvenDay) {
        const baseAmount = 50;
        const phaseBonus = (phase - 1) * 20;
        const dayBonus = Math.floor((day % 7) * 5);
        const amount = baseAmount + phaseBonus + dayBonus;

        return {
            reward_type: 'currency',
            reward_rarity: null,
            reward_amount: amount,
            display_name: null, // Généré dynamiquement à l'affichage
            display_emoji: '💰'
        };
    }

    return {
        reward_type: 'mystery_box',
        reward_rarity: 'common',
        reward_amount: 1,
        display_name: null, // Généré dynamiquement à l'affichage
        display_emoji: '📦'
    };
}

function generateGenerousReward(day, phase, totalPhases, isMilestone, isFinalDay, isEvenDay) {
    if (isFinalDay) {
        return {
            reward_type: 'mystery_box',
            reward_rarity: 'legendary',
            reward_amount: 2,
            display_name: null, // Généré dynamiquement à l'affichage
            display_emoji: '👑'
        };
    }

    if (isMilestone) {
        return {
            reward_type: 'mystery_box',
            reward_rarity: 'epic',
            reward_amount: 2,
            display_name: null, // Généré dynamiquement à l'affichage
            display_emoji: '✨'
        };
    }

    if (isEvenDay) {
        const amount = 100 + (phase - 1) * 50;
        return {
            reward_type: 'currency',
            reward_rarity: null,
            reward_amount: amount,
            display_name: null, // Généré dynamiquement à l'affichage
            display_emoji: '💰'
        };
    }

    return {
        reward_type: 'mystery_box',
        reward_rarity: 'common',
        reward_amount: 2,
        display_name: null, // Généré dynamiquement à l'affichage
        display_emoji: '📦'
    };
}

function generateHardcoreReward(day, phase, totalPhases, isMilestone, isFinalDay, isEvenDay) {
    if (isFinalDay) {
        return {
            reward_type: 'mystery_box',
            reward_rarity: 'epic',
            reward_amount: 1,
            display_name: null, // Généré dynamiquement à l'affichage
            display_emoji: '✨'
        };
    }

    if (isMilestone) {
        return {
            reward_type: 'mystery_box',
            reward_rarity: 'rare',
            reward_amount: 1,
            display_name: null, // Généré dynamiquement à l'affichage
            display_emoji: '💎'
        };
    }

    const amount = 30 + (day * 2);
    return {
        reward_type: 'currency',
        reward_rarity: null,
        reward_amount: amount,
        display_name: null, // Généré dynamiquement à l'affichage
        display_emoji: '💰'
    };
}

/**
 * Générer un aperçu du préset
 */
function generatePresetPreview(presetKey, totalDays, milestones) {
    const rewards = generatePreset(presetKey, totalDays, milestones);
    const preview = [];

    // Montrer les 5 premiers jours
    for (let i = 0; i < Math.min(5, rewards.length); i++) {
        const r = rewards[i];
        preview.push(`J${r.day_number}: ${r.display_emoji} ${r.display_name?.split(' ').slice(1).join(' ') || r.reward_type}${r.is_milestone ? ' ⭐' : ''}`);
    }

    preview.push('...');

    // Montrer les milestones
    for (const milestone of milestones.slice(0, 3)) {
        const r = rewards.find(r => r.day_number === milestone);
        if (r && !preview.some(p => p.startsWith(`J${milestone}:`))) {
            preview.push(`J${r.day_number}: ${r.display_emoji} ${r.display_name?.split(' ').slice(1).join(' ') || r.reward_type} ⭐`);
        }
    }

    // Montrer le dernier jour
    const lastReward = rewards[rewards.length - 1];
    preview.push(`J${lastReward.day_number}: ${lastReward.display_emoji} ${lastReward.display_name?.split(' ').slice(1).join(' ') || lastReward.reward_type} 🏆`);

    return preview.join('\n');
}

module.exports = {
    handleDailyRewardsAdmin,
    calculateMilestones,
    generatePreset
};
