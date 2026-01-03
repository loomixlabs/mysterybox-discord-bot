/**
 * 🔨 CRAFTING HANDLER
 * Système de craft de clés Mystery Box
 *
 * Fonctionnalités:
 * - UPGRADE: X clés rareté N → 1 clé rareté N+1
 * - CRITIQUE: Chance d'obtenir 1 clé bonus
 * - RECYCLE: 1 clé rareté N → (coût_N - 1) clés rareté N-1
 * - LOOMIX: Paiement alternatif en Loomix
 * - ANIMATIONS: 4 phases (identiques pour toutes raretés)
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const { getLoomixFooterOnly, LOOMIX_BRANDING } = require('../utils/footerHelper');
const badgeHandler = require('./badgeHandler');

// ============================================================================
// CONSTANTES
// ============================================================================

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
const RARITY_INFO = {
    common: { emoji: '📦', label: 'Commune', color: '#95A5A6', next: 'rare', prev: null },
    rare: { emoji: '💎', label: 'Rare', color: '#3498DB', next: 'epic', prev: 'common' },
    epic: { emoji: '✨', label: 'Épique', color: '#9B59B6', next: 'legendary', prev: 'rare' },
    legendary: { emoji: '👑', label: 'Légendaire', color: '#FFD700', next: null, prev: 'epic' }
};

// Durée d'affichage de l'image critique (en ms)
const CRITICAL_DISPLAY_DURATION = 2000; // 2 secondes pour l'image critique
// Note: Animation craft = 7 secondes (2s + 3s + 2s dans executeCraft)

// Images par défaut (hébergées sur VPS)
const DEFAULT_IMAGES = {
    craft_animation: 'http://72.60.185.62:8080/assets/crafting/craft_animation.gif',
    craft_critical: 'http://72.60.185.62:8080/assets/crafting/craftcritique.png',
    key_common: 'http://72.60.185.62:8080/assets/keys/key_common.png',
    key_rare: 'http://72.60.185.62:8080/assets/keys/key_rare.png',
    key_epic: 'http://72.60.185.62:8080/assets/keys/key_epic.png',
    key_legendary: 'http://72.60.185.62:8080/assets/keys/key_legendary.png'
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Récupérer ou créer la configuration crafting pour un serveur
 */
async function getCraftingConfig(guildId) {
    let config = await db.queryOne(
        'SELECT * FROM crafting_config WHERE guild_id = $1',
        [guildId]
    );

    if (!config) {
        // Créer la config par défaut
        config = await db.queryOne(`
            INSERT INTO crafting_config (guild_id)
            VALUES ($1)
            RETURNING *
        `, [guildId]);
    }

    return config;
}

/**
 * Récupérer ou créer les stats de crafting pour un joueur
 */
async function getCraftingStats(guildId, playerId) {
    let stats = await db.queryOne(
        'SELECT * FROM crafting_stats WHERE guild_id = $1 AND player_id = $2',
        [guildId, playerId]
    );

    if (!stats) {
        stats = await db.queryOne(`
            INSERT INTO crafting_stats (guild_id, player_id)
            VALUES ($1, $2)
            RETURNING *
        `, [guildId, playerId]);
    }

    return stats;
}

/**
 * Obtenir le coût en clés pour un upgrade
 */
function getKeyCost(config, fromRarity) {
    const costMap = {
        common: config.keys_common_to_rare,
        rare: config.keys_rare_to_epic,
        epic: config.keys_epic_to_legendary,
        legendary: config.keys_legendary_cost
    };
    return costMap[fromRarity] || 3;
}

/**
 * Obtenir le coût en Loomix pour un upgrade
 */
function getLoomixCost(config, fromRarity) {
    const costMap = {
        common: config.loomix_common_to_rare,
        rare: config.loomix_rare_to_epic,
        epic: config.loomix_epic_to_legendary
    };
    return costMap[fromRarity] || null;
}

/**
 * Obtenir l'image d'animation de craft
 */
function getCraftAnimationImage(config) {
    return config.image_craft_animation || DEFAULT_IMAGES.craft_animation;
}

/**
 * Obtenir l'image de craft critique
 */
function getCraftCriticalImage(config) {
    return config.image_craft_critical || DEFAULT_IMAGES.craft_critical;
}

/**
 * Obtenir l'image d'une clé
 */
function getKeyImage(config, rarity) {
    const imageMap = {
        common: config.image_key_common || DEFAULT_IMAGES.key_common,
        rare: config.image_key_rare || DEFAULT_IMAGES.key_rare,
        epic: config.image_key_epic || DEFAULT_IMAGES.key_epic,
        legendary: config.image_key_legendary || DEFAULT_IMAGES.key_legendary
    };
    return imageMap[rarity];
}

// ============================================================================
// PANEL PRINCIPAL
// ============================================================================

/**
 * Afficher le panel de crafting principal
 */
async function showCraftingPanel(interaction, player = null) {
    const guildId = interaction.guildId;

    if (!player) {
        player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
    }

    if (!player) {
        return interaction.editReply({
            content: '❌ Profil introuvable. Utilise `/profile` pour créer ton profil.',
            embeds: [],
            components: []
        });
    }

    const config = await getCraftingConfig(guildId);

    if (!config.enabled) {
        return interaction.editReply({
            content: '❌ Le système de crafting n\'est pas activé sur ce serveur.',
            embeds: [],
            components: []
        });
    }

    const keys = await db.getMysteryBoxCredits(guildId, player.id);
    const stats = await getCraftingStats(guildId, player.id);
    const loomix = await db.getPlayerCurrency(guildId, player.id, 'loomix');

    // Construire l'embed
    const embed = new EmbedBuilder()
        .setTitle('🔨 ATELIER DE CRAFT')
        .setDescription(
            `Transforme tes clés en clés de rareté supérieure !\n` +
            `Chance de critique: **${config.critical_chance}%** 🎲`
        )
        .setColor('#FF6B35')
        .addFields(
            {
                name: '🔑 Tes Clés',
                value: [
                    `${RARITY_INFO.common.emoji} Commune: **${keys.common || 0}**`,
                    `${RARITY_INFO.rare.emoji} Rare: **${keys.rare || 0}**`,
                    `${RARITY_INFO.epic.emoji} Épique: **${keys.epic || 0}**`,
                    `${RARITY_INFO.legendary.emoji} Légendaire: **${keys.legendary || 0}**`
                ].join('\n'),
                inline: true
            },
            {
                name: `${LOOMIX_BRANDING.emoji} Loomix`,
                value: `**${(loomix?.balance || 0).toLocaleString()}**`,
                inline: true
            },
            {
                name: '📊 Tes Stats',
                value: [
                    `Crafts: **${stats.total_upgrades}**`,
                    `Critiques: **${stats.total_criticals}**`,
                    `Recyclés: **${stats.total_recycles}**`
                ].join('\n'),
                inline: true
            },
            {
                name: '⬆️ UPGRADE (Craft)',
                value: [
                    `${RARITY_INFO.common.emoji}→${RARITY_INFO.rare.emoji} = **${config.keys_common_to_rare}** clés communes` + (config.loomix_common_to_rare ? ` ou **${config.loomix_common_to_rare}** ${LOOMIX_BRANDING.emoji}` : ''),
                    `${RARITY_INFO.rare.emoji}→${RARITY_INFO.epic.emoji} = **${config.keys_rare_to_epic}** clés rares` + (config.loomix_rare_to_epic ? ` ou **${config.loomix_rare_to_epic}** ${LOOMIX_BRANDING.emoji}` : ''),
                    `${RARITY_INFO.epic.emoji}→${RARITY_INFO.legendary.emoji} = **${config.keys_epic_to_legendary}** clés épiques` + (config.loomix_epic_to_legendary ? ` ou **${config.loomix_epic_to_legendary}** ${LOOMIX_BRANDING.emoji}` : '')
                ].join('\n'),
                inline: false
            },
            {
                name: '⬇️ RECYCLE (Downgrade)',
                value: [
                    `${RARITY_INFO.legendary.emoji}→${RARITY_INFO.epic.emoji} = 1 légendaire → **${config.keys_legendary_cost - 1}** clés épiques`,
                    `${RARITY_INFO.epic.emoji}→${RARITY_INFO.rare.emoji} = 1 épique → **${config.keys_epic_to_legendary - 1}** clés rares`,
                    `${RARITY_INFO.rare.emoji}→${RARITY_INFO.common.emoji} = 1 rare → **${config.keys_rare_to_epic - 1}** clés communes`
                ].join('\n'),
                inline: false
            }
        )
        .setFooter(getLoomixFooterOnly())
        .setTimestamp();

    // Boutons d'action
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_upgrade')
            .setLabel('⬆️ Upgrade')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('craft_recycle')
            .setLabel('⬇️ Recycle')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('craft_stats')
            .setLabel('📊 Stats détaillées')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('profile_overview')
            .setLabel('↩️ Retour au profil')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

// ============================================================================
// UPGRADE (Craft vers rareté supérieure)
// ============================================================================

/**
 * Afficher le menu de sélection pour upgrade
 */
async function showUpgradeMenu(interaction, player = null) {
    const guildId = interaction.guildId;

    if (!player) {
        player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
    }

    const config = await getCraftingConfig(guildId);
    const keys = await db.getMysteryBoxCredits(guildId, player.id);
    const loomix = await db.getPlayerCurrency(guildId, player.id, 'loomix');

    // Options de craft disponibles
    const options = [];
    const upgrades = [
        { from: 'common', to: 'rare', keyCost: config.keys_common_to_rare, loomixCost: config.loomix_common_to_rare },
        { from: 'rare', to: 'epic', keyCost: config.keys_rare_to_epic, loomixCost: config.loomix_rare_to_epic },
        { from: 'epic', to: 'legendary', keyCost: config.keys_epic_to_legendary, loomixCost: config.loomix_epic_to_legendary }
    ];

    for (const upgrade of upgrades) {
        const hasKeys = (keys[upgrade.from] || 0) >= upgrade.keyCost;
        const hasLoomix = upgrade.loomixCost && (loomix?.balance || 0) >= upgrade.loomixCost;
        const canCraft = hasKeys || hasLoomix;

        const description = `${upgrade.keyCost} clés ${RARITY_INFO[upgrade.from].label}` +
            (upgrade.loomixCost ? ` ou ${upgrade.loomixCost} ${LOOMIX_BRANDING.emoji}` : '');

        options.push({
            label: `${RARITY_INFO[upgrade.from].emoji}→${RARITY_INFO[upgrade.to].emoji} ${RARITY_INFO[upgrade.from].label} → ${RARITY_INFO[upgrade.to].label}`,
            description: description,
            value: `${upgrade.from}_to_${upgrade.to}`,
            emoji: canCraft ? '✅' : '❌'
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('⬆️ UPGRADE - Sélectionne ton craft')
        .setDescription(
            `🔑 **Tes clés actuelles:**\n` +
            `${RARITY_INFO.common.emoji} ${keys.common || 0} | ` +
            `${RARITY_INFO.rare.emoji} ${keys.rare || 0} | ` +
            `${RARITY_INFO.epic.emoji} ${keys.epic || 0} | ` +
            `${RARITY_INFO.legendary.emoji} ${keys.legendary || 0}\n\n` +
            `${LOOMIX_BRANDING.emoji} **Loomix:** ${(loomix?.balance || 0).toLocaleString()}\n\n` +
            `Choisis la transformation à effectuer:`
        )
        .setColor('#3498DB')
        .setFooter(getLoomixFooterOnly());

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('craft_upgrade_select')
        .setPlaceholder('Sélectionne un craft...')
        .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_panel')
            .setLabel('↩️ Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

/**
 * Afficher la preview du craft sélectionné
 */
async function showCraftPreview(interaction, fromRarity, toRarity) {
    const guildId = interaction.guildId;
    const player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
    const config = await getCraftingConfig(guildId);
    const keys = await db.getMysteryBoxCredits(guildId, player.id);
    const loomix = await db.getPlayerCurrency(guildId, player.id, 'loomix');

    const keyCost = getKeyCost(config, fromRarity);
    const loomixCost = getLoomixCost(config, fromRarity);
    const loomixBalance = loomix?.balance || 0;
    const hasKeys = (keys[fromRarity] || 0) >= keyCost;
    const hasLoomix = loomixCost && loomixBalance >= loomixCost;

    // Calcul du nombre max de crafts possibles
    const maxCraftsWithKeys = Math.floor((keys[fromRarity] || 0) / keyCost);
    const maxCraftsWithLoomix = loomixCost ? Math.floor(loomixBalance / loomixCost) : 0;

    const embed = new EmbedBuilder()
        .setTitle(`🔮 PREVIEW: ${RARITY_INFO[fromRarity].emoji} → ${RARITY_INFO[toRarity].emoji}`)
        .setDescription(
            `**${RARITY_INFO[fromRarity].label}** → **${RARITY_INFO[toRarity].label}**\n\n` +
            `🎲 Chance critique: **${config.critical_chance}%**\n` +
            `*(+1 clé ${RARITY_INFO[toRarity].label} bonus)*`
        )
        .setColor(RARITY_INFO[toRarity].color)
        .addFields(
            {
                name: '💰 Coût',
                value: [
                    `🔑 **${keyCost}** clés ${RARITY_INFO[fromRarity].label} ${hasKeys ? '✅' : '❌'}`,
                    loomixCost ? `${LOOMIX_BRANDING.emoji} **${loomixCost}** Loomix ${hasLoomix ? '✅' : '❌'}` : ''
                ].filter(Boolean).join('\n'),
                inline: true
            },
            {
                name: '📦 Tes ressources',
                value: [
                    `🔑 ${keys[fromRarity] || 0} clés ${RARITY_INFO[fromRarity].label}`,
                    `${LOOMIX_BRANDING.emoji} ${loomixBalance.toLocaleString()} Loomix`
                ].join('\n'),
                inline: true
            },
            {
                name: '🔢 Crafts possibles',
                value: [
                    `Avec clés: **${maxCraftsWithKeys}x**`,
                    loomixCost ? `Avec Loomix: **${maxCraftsWithLoomix}x**` : ''
                ].filter(Boolean).join('\n'),
                inline: true
            }
        )
        .setFooter(getLoomixFooterOnly())
        .setImage(getKeyImage(config, toRarity));

    // Boutons de craft
    const components = [];

    // Row 1: Craft avec clés (1x, 5x, 10x)
    if (hasKeys) {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`craft_exec_keys_${fromRarity}_${toRarity}_1`)
                .setLabel('🔑 1x')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!hasKeys),
            new ButtonBuilder()
                .setCustomId(`craft_exec_keys_${fromRarity}_${toRarity}_5`)
                .setLabel('🔑 5x')
                .setStyle(ButtonStyle.Success)
                .setDisabled(maxCraftsWithKeys < 5),
            new ButtonBuilder()
                .setCustomId(`craft_exec_keys_${fromRarity}_${toRarity}_10`)
                .setLabel('🔑 10x')
                .setStyle(ButtonStyle.Success)
                .setDisabled(maxCraftsWithKeys < 10)
        );
        components.push(row1);
    }

    // Row 2: Craft avec Loomix (si disponible)
    if (loomixCost) {
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`craft_exec_loomix_${fromRarity}_${toRarity}_1`)
                .setLabel(`${LOOMIX_BRANDING.emoji} 1x`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!hasLoomix),
            new ButtonBuilder()
                .setCustomId(`craft_exec_loomix_${fromRarity}_${toRarity}_5`)
                .setLabel(`${LOOMIX_BRANDING.emoji} 5x`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(maxCraftsWithLoomix < 5),
            new ButtonBuilder()
                .setCustomId(`craft_exec_loomix_${fromRarity}_${toRarity}_10`)
                .setLabel(`${LOOMIX_BRANDING.emoji} 10x`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(maxCraftsWithLoomix < 10)
        );
        components.push(row2);
    }

    // Row retour
    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_upgrade')
            .setLabel('↩️ Retour')
            .setStyle(ButtonStyle.Secondary)
    );
    components.push(rowBack);

    return interaction.editReply({
        embeds: [embed],
        components
    });
}

/**
 * Exécuter le craft (avec animation)
 */
async function executeCraft(interaction, paymentType, fromRarity, toRarity, quantity) {
    const guildId = interaction.guildId;
    const player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
    const config = await getCraftingConfig(guildId);

    // Vérifier les ressources
    const keyCost = getKeyCost(config, fromRarity);
    const loomixCost = getLoomixCost(config, fromRarity);
    const totalKeyCost = keyCost * quantity;
    const totalLoomixCost = loomixCost ? loomixCost * quantity : 0;

    const keys = await db.getMysteryBoxCredits(guildId, player.id);
    const loomixData = await db.getPlayerCurrency(guildId, player.id, 'loomix');
    const loomixBalance = loomixData?.balance || 0;

    // Vérification finale
    if (paymentType === 'keys' && (keys[fromRarity] || 0) < totalKeyCost) {
        return interaction.editReply({
            content: `❌ Tu n'as pas assez de clés ${RARITY_INFO[fromRarity].label} ! (${keys[fromRarity] || 0}/${totalKeyCost})`,
            embeds: [],
            components: []
        });
    }

    if (paymentType === 'loomix' && loomixBalance < totalLoomixCost) {
        return interaction.editReply({
            content: `❌ Tu n'as pas assez de Loomix ! (${loomixBalance}/${totalLoomixCost})`,
            embeds: [],
            components: []
        });
    }

    // === ANIMATION: GIF de craft unique pendant 7 secondes ===
    // NOTE: Discord re-render l'embed à chaque editReply, donc on fait UNE SEULE phase
    // pour que le GIF joue sans interruption pendant toute la durée
    const craftAnimationUrl = getCraftAnimationImage(config);

    const craftingEmbed = new EmbedBuilder()
        .setTitle('🔨 CRAFT EN COURS...')
        .setDescription(
            `⚙️ Transformation de **${totalKeyCost}** clés ${RARITY_INFO[fromRarity].emoji} ${RARITY_INFO[fromRarity].label}\n` +
            `➡️ en clé${quantity > 1 ? 's' : ''} ${RARITY_INFO[toRarity].emoji} ${RARITY_INFO[toRarity].label}...\n\n` +
            `*Veuillez patienter...*`
        )
        .setColor('#FFA500')
        .setImage(craftAnimationUrl);

    await interaction.editReply({ embeds: [craftingEmbed], components: [] });

    // Attendre 7 secondes (durée complète du GIF sans interruption)
    await sleep(7000);

    // === Calcul des critiques ===
    let criticalCount = 0;
    for (let i = 0; i < quantity; i++) {
        if (Math.random() * 100 < config.critical_chance) {
            criticalCount++;
        }
    }

    const totalKeysObtained = quantity + criticalCount;
    const isCritical = criticalCount > 0;

    // === PHASE CRITIQUE (si critique) - 2 secondes ===
    if (isCritical) {
        const criticalEmbed = new EmbedBuilder()
            .setTitle('🎯 CRITIQUE !')
            .setDescription(
                `**COUP CRITIQUE !** 🎲✨\n\n` +
                `Tu as déclenché **${criticalCount}** effet${criticalCount > 1 ? 's' : ''} critique${criticalCount > 1 ? 's' : ''} !\n` +
                `**+${criticalCount}** clé${criticalCount > 1 ? 's' : ''} ${RARITY_INFO[toRarity].emoji} bonus !`
            )
            .setColor('#FFD700')
            .setImage(getCraftCriticalImage(config));

        await interaction.editReply({ embeds: [criticalEmbed], components: [] });
        await sleep(CRITICAL_DISPLAY_DURATION);
    }

    // === Effectuer les transactions ===
    if (paymentType === 'keys') {
        // Déduire les clés consommées via UPDATE direct (pas de valeur négative)
        await db.query(`
            UPDATE player_mystery_box_credits
            SET credits = credits - $1, updated_at = NOW()
            WHERE guild_id = $2 AND player_id = $3 AND rarity = $4
        `, [totalKeyCost, guildId, player.id, fromRarity]);
        console.log(`🔑 [CRAFT] Déduction de ${totalKeyCost} clé(s) ${fromRarity} au joueur ${player.id}`);
    } else {
        // Déduire les Loomix via le système de devises
        await db.spendCurrency(guildId, player.id, totalLoomixCost, 'crafting', 'craft_upgrade', `Craft ${fromRarity}→${toRarity}`);

        // 🏆 BADGE TRACKING - Loomix spent
        try {
            await badgeHandler.onLoomixOperation(guildId, player.id, 'spent', totalLoomixCost, null);
        } catch (err) {
            console.error('🔴 [BADGES] Erreur tracking loomix spent crafting:', err);
        }
    }

    // Ajouter les clés craftées
    await db.addMysteryBoxCredits(guildId, player.id, toRarity, totalKeysObtained, 'crafting', `Craft ${fromRarity}→${toRarity} x${quantity}${criticalCount > 0 ? ` (+${criticalCount} crit)` : ''}`);

    // === Mettre à jour les stats ===
    const statColumn = `upgrades_${fromRarity}_to_${toRarity}`;
    const critColumn = `criticals_${fromRarity}_to_${toRarity}`;

    await db.query(`
        UPDATE crafting_stats
        SET total_upgrades = total_upgrades + $1,
            ${statColumn} = ${statColumn} + $1,
            total_criticals = total_criticals + $2,
            ${critColumn} = ${critColumn} + $2
            ${paymentType === 'loomix' ? ', total_loomix_spent = total_loomix_spent + $4' : ''}
        WHERE guild_id = $3 AND player_id = ${paymentType === 'loomix' ? '$5' : '$4'}
    `, paymentType === 'loomix'
        ? [quantity, criticalCount, guildId, totalLoomixCost, player.id]
        : [quantity, criticalCount, guildId, player.id]
    );

    // === Hook Badges ===
    const stats = await getCraftingStats(guildId, player.id);
    await badgeHandler.onCrafting(guildId, player.id, stats);

    // === PHASE FINALE: Résultat ===
    const resultEmbed = new EmbedBuilder()
        .setTitle(isCritical ? '🎉 CRAFT CRITIQUE !' : '✅ CRAFT RÉUSSI !')
        .setDescription(
            isCritical
                ? `**CRITIQUE !** 🎲 Tu as obtenu des clés bonus !\n\n` +
                  `${RARITY_INFO[toRarity].emoji} **+${totalKeysObtained}** clés ${RARITY_INFO[toRarity].label}\n` +
                  `*(${quantity} normal + ${criticalCount} critique${criticalCount > 1 ? 's' : ''})*`
                : `${RARITY_INFO[toRarity].emoji} **+${totalKeysObtained}** clé${totalKeysObtained > 1 ? 's' : ''} ${RARITY_INFO[toRarity].label}`
        )
        .setColor(isCritical ? '#FFD700' : RARITY_INFO[toRarity].color)
        .addFields(
            {
                name: '💰 Coût',
                value: paymentType === 'keys'
                    ? `${RARITY_INFO[fromRarity].emoji} -${totalKeyCost} clés ${RARITY_INFO[fromRarity].label}`
                    : `${LOOMIX_BRANDING.emoji} -${totalLoomixCost} Loomix`,
                inline: true
            },
            {
                name: '📦 Obtenu',
                value: `${RARITY_INFO[toRarity].emoji} +${totalKeysObtained} clé${totalKeysObtained > 1 ? 's' : ''} ${RARITY_INFO[toRarity].label}`,
                inline: true
            }
        )
        .setImage(getKeyImage(config, toRarity))
        .setFooter(getLoomixFooterOnly())
        .setTimestamp();

    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_panel')
            .setLabel('🔨 Retour au Craft')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('profile_overview')
            .setLabel('↩️ Profil')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [resultEmbed],
        components: [rowBack]
    });
}

// ============================================================================
// RECYCLE (Downgrade vers rareté inférieure)
// ============================================================================

/**
 * Afficher le menu de recyclage
 */
async function showRecycleMenu(interaction, player = null) {
    const guildId = interaction.guildId;

    if (!player) {
        player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
    }

    const config = await getCraftingConfig(guildId);
    const keys = await db.getMysteryBoxCredits(guildId, player.id);

    // Options de recycle disponibles
    const options = [];
    const recycles = [
        { from: 'legendary', to: 'epic', returnKeys: config.keys_legendary_cost - 1 },
        { from: 'epic', to: 'rare', returnKeys: config.keys_epic_to_legendary - 1 },
        { from: 'rare', to: 'common', returnKeys: config.keys_rare_to_epic - 1 }
    ];

    for (const recycle of recycles) {
        const hasKey = (keys[recycle.from] || 0) >= 1;

        options.push({
            label: `${RARITY_INFO[recycle.from].emoji}→${RARITY_INFO[recycle.to].emoji} ${RARITY_INFO[recycle.from].label} → ${RARITY_INFO[recycle.to].label}`,
            description: `1 clé → ${recycle.returnKeys} clés ${RARITY_INFO[recycle.to].label}`,
            value: `${recycle.from}_to_${recycle.to}`,
            emoji: hasKey ? '✅' : '❌'
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('⬇️ RECYCLE - Convertir vers rareté inférieure')
        .setDescription(
            `🔑 **Tes clés actuelles:**\n` +
            `${RARITY_INFO.common.emoji} ${keys.common || 0} | ` +
            `${RARITY_INFO.rare.emoji} ${keys.rare || 0} | ` +
            `${RARITY_INFO.epic.emoji} ${keys.epic || 0} | ` +
            `${RARITY_INFO.legendary.emoji} ${keys.legendary || 0}\n\n` +
            `⚠️ Le recyclage te donne **1 clé de moins** que le coût d'upgrade correspondant.`
        )
        .setColor('#E67E22')
        .setFooter(getLoomixFooterOnly());

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('craft_recycle_select')
        .setPlaceholder('Sélectionne un recyclage...')
        .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_panel')
            .setLabel('↩️ Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

/**
 * Afficher la preview du recyclage sélectionné
 */
async function showRecyclePreview(interaction, fromRarity, toRarity) {
    const guildId = interaction.guildId;
    const player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
    const config = await getCraftingConfig(guildId);
    const keys = await db.getMysteryBoxCredits(guildId, player.id);

    // Calculer le nombre de clés retournées
    const returnKeysMap = {
        legendary: config.keys_legendary_cost - 1,
        epic: config.keys_epic_to_legendary - 1,
        rare: config.keys_rare_to_epic - 1
    };
    const returnKeys = returnKeysMap[fromRarity];
    const hasKey = (keys[fromRarity] || 0) >= 1;
    const maxRecycles = keys[fromRarity] || 0;

    const embed = new EmbedBuilder()
        .setTitle(`♻️ RECYCLE: ${RARITY_INFO[fromRarity].emoji} → ${RARITY_INFO[toRarity].emoji}`)
        .setDescription(
            `**${RARITY_INFO[fromRarity].label}** → **${RARITY_INFO[toRarity].label}**\n\n` +
            `1 clé ${RARITY_INFO[fromRarity].label} = **${returnKeys}** clés ${RARITY_INFO[toRarity].label}`
        )
        .setColor(RARITY_INFO[toRarity].color)
        .addFields(
            {
                name: '📦 Tes clés',
                value: `${RARITY_INFO[fromRarity].emoji} ${keys[fromRarity] || 0} clés ${RARITY_INFO[fromRarity].label}`,
                inline: true
            },
            {
                name: '🔢 Recyclages possibles',
                value: `**${maxRecycles}x**`,
                inline: true
            }
        )
        .setFooter(getLoomixFooterOnly())
        .setImage(getKeyImage(config, toRarity));

    // Boutons de recycle
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`recycle_exec_${fromRarity}_${toRarity}_1`)
            .setLabel('♻️ 1x')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!hasKey),
        new ButtonBuilder()
            .setCustomId(`recycle_exec_${fromRarity}_${toRarity}_5`)
            .setLabel('♻️ 5x')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(maxRecycles < 5),
        new ButtonBuilder()
            .setCustomId(`recycle_exec_${fromRarity}_${toRarity}_10`)
            .setLabel('♻️ 10x')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(maxRecycles < 10)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_recycle')
            .setLabel('↩️ Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
    });
}

/**
 * Exécuter le recyclage
 */
async function executeRecycle(interaction, fromRarity, toRarity, quantity) {
    const guildId = interaction.guildId;
    const player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
    const config = await getCraftingConfig(guildId);
    const keys = await db.getMysteryBoxCredits(guildId, player.id);

    // Calculer le nombre de clés retournées
    const returnKeysMap = {
        legendary: config.keys_legendary_cost - 1,
        epic: config.keys_epic_to_legendary - 1,
        rare: config.keys_rare_to_epic - 1
    };
    const returnKeysPerRecycle = returnKeysMap[fromRarity];
    const totalReturnKeys = returnKeysPerRecycle * quantity;

    // Vérifier les ressources
    if ((keys[fromRarity] || 0) < quantity) {
        return interaction.editReply({
            content: `❌ Tu n'as pas assez de clés ${RARITY_INFO[fromRarity].label} ! (${keys[fromRarity] || 0}/${quantity})`,
            embeds: [],
            components: []
        });
    }

    // === Animation simple (pas de phases multiples pour le recycle) ===
    const processingEmbed = new EmbedBuilder()
        .setTitle('♻️ RECYCLAGE EN COURS...')
        .setDescription(`Conversion de ${quantity} clé${quantity > 1 ? 's' : ''} ${RARITY_INFO[fromRarity].label}...`)
        .setColor('#E67E22');

    await interaction.editReply({ embeds: [processingEmbed], components: [] });
    await sleep(1500);

    // === Effectuer les transactions ===
    // Déduire les clés recyclées via UPDATE direct (pas de fonction avec valeur négative)
    await db.query(`
        UPDATE player_mystery_box_credits
        SET credits = credits - $1, updated_at = NOW()
        WHERE guild_id = $2 AND player_id = $3 AND rarity = $4
    `, [quantity, guildId, player.id, fromRarity]);
    console.log(`♻️ [RECYCLE] Déduction de ${quantity} clé(s) ${fromRarity} au joueur ${player.id}`);

    // Ajouter les clés obtenues
    await db.addMysteryBoxCredits(guildId, player.id, toRarity, totalReturnKeys, 'recycling', `Recycle ${fromRarity}→${toRarity} x${quantity}`);

    // === Mettre à jour les stats ===
    const statColumn = `recycles_${fromRarity}_to_${toRarity}`;

    await db.query(`
        UPDATE crafting_stats
        SET total_recycles = total_recycles + $1,
            ${statColumn} = ${statColumn} + $1
        WHERE guild_id = $2 AND player_id = $3
    `, [quantity, guildId, player.id]);

    // === Hook Badges ===
    const stats = await getCraftingStats(guildId, player.id);
    await badgeHandler.onCrafting(guildId, player.id, stats);

    // === Résultat ===
    const resultEmbed = new EmbedBuilder()
        .setTitle('♻️ RECYCLAGE TERMINÉ !')
        .setDescription(
            `${RARITY_INFO[toRarity].emoji} **+${totalReturnKeys}** clés ${RARITY_INFO[toRarity].label}`
        )
        .setColor(RARITY_INFO[toRarity].color)
        .addFields(
            {
                name: '📦 Recyclé',
                value: `${RARITY_INFO[fromRarity].emoji} -${quantity} clé${quantity > 1 ? 's' : ''} ${RARITY_INFO[fromRarity].label}`,
                inline: true
            },
            {
                name: '✨ Obtenu',
                value: `${RARITY_INFO[toRarity].emoji} +${totalReturnKeys} clés ${RARITY_INFO[toRarity].label}`,
                inline: true
            }
        )
        .setImage(getKeyImage(config, toRarity))
        .setFooter(getLoomixFooterOnly())
        .setTimestamp();

    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_panel')
            .setLabel('🔨 Retour au Craft')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('profile_overview')
            .setLabel('↩️ Profil')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [resultEmbed],
        components: [rowBack]
    });
}

// ============================================================================
// STATS DÉTAILLÉES
// ============================================================================

async function showDetailedStats(interaction, player = null) {
    const guildId = interaction.guildId;

    if (!player) {
        player = await db.getPlayerByDiscordId(guildId, interaction.user.id);
    }

    const stats = await getCraftingStats(guildId, player.id);
    const config = await getCraftingConfig(guildId);

    const embed = new EmbedBuilder()
        .setTitle('📊 STATISTIQUES DE CRAFTING')
        .setColor('#9B59B6')
        .addFields(
            {
                name: '⬆️ Upgrades',
                value: [
                    `Total: **${stats.total_upgrades}**`,
                    `${RARITY_INFO.common.emoji}→${RARITY_INFO.rare.emoji}: ${stats.upgrades_common_to_rare}`,
                    `${RARITY_INFO.rare.emoji}→${RARITY_INFO.epic.emoji}: ${stats.upgrades_rare_to_epic}`,
                    `${RARITY_INFO.epic.emoji}→${RARITY_INFO.legendary.emoji}: ${stats.upgrades_epic_to_legendary}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🎲 Critiques',
                value: [
                    `Total: **${stats.total_criticals}**`,
                    `${RARITY_INFO.common.emoji}→${RARITY_INFO.rare.emoji}: ${stats.criticals_common_to_rare}`,
                    `${RARITY_INFO.rare.emoji}→${RARITY_INFO.epic.emoji}: ${stats.criticals_rare_to_epic}`,
                    `${RARITY_INFO.epic.emoji}→${RARITY_INFO.legendary.emoji}: ${stats.criticals_epic_to_legendary}`
                ].join('\n'),
                inline: true
            },
            {
                name: '♻️ Recyclages',
                value: [
                    `Total: **${stats.total_recycles}**`,
                    `${RARITY_INFO.legendary.emoji}→${RARITY_INFO.epic.emoji}: ${stats.recycles_legendary_to_epic}`,
                    `${RARITY_INFO.epic.emoji}→${RARITY_INFO.rare.emoji}: ${stats.recycles_epic_to_rare}`,
                    `${RARITY_INFO.rare.emoji}→${RARITY_INFO.common.emoji}: ${stats.recycles_rare_to_common}`
                ].join('\n'),
                inline: true
            },
            {
                name: `${LOOMIX_BRANDING.emoji} Loomix dépensés`,
                value: `**${stats.total_loomix_spent.toLocaleString()}**`,
                inline: false
            },
            {
                name: '📈 Taux de critique',
                value: stats.total_upgrades > 0
                    ? `**${((stats.total_criticals / stats.total_upgrades) * 100).toFixed(1)}%** (config: ${config.critical_chance}%)`
                    : 'N/A',
                inline: false
            }
        )
        .setFooter(getLoomixFooterOnly())
        .setTimestamp();

    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('craft_panel')
            .setLabel('↩️ Retour')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
        embeds: [embed],
        components: [rowBack]
    });
}

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================

/**
 * Router principal pour les interactions crafting
 */
async function handleCraftingInteraction(interaction) {
    const { customId } = interaction;

    try {
        // Certaines actions nécessitent un defer immédiat
        if (!customId.includes('_select')) {
            await interaction.deferUpdate();
        }

        // Panel principal
        if (customId === 'craft_panel' || customId === 'profile_crafting') {
            return showCraftingPanel(interaction);
        }

        // Menu upgrade
        if (customId === 'craft_upgrade') {
            return showUpgradeMenu(interaction);
        }

        // Sélection d'upgrade
        if (customId === 'craft_upgrade_select') {
            await interaction.deferUpdate();
            const [fromRarity, , toRarity] = interaction.values[0].split('_');
            return showCraftPreview(interaction, fromRarity, toRarity);
        }

        // Exécution de craft (keys ou loomix)
        if (customId.startsWith('craft_exec_')) {
            // craft_exec_keys_common_rare_5 ou craft_exec_loomix_common_rare_5
            const parts = customId.split('_');
            const paymentType = parts[2]; // keys ou loomix
            const fromRarity = parts[3];
            const toRarity = parts[4];
            const quantity = parseInt(parts[5]);
            return executeCraft(interaction, paymentType, fromRarity, toRarity, quantity);
        }

        // Menu recycle
        if (customId === 'craft_recycle') {
            return showRecycleMenu(interaction);
        }

        // Sélection de recycle
        if (customId === 'craft_recycle_select') {
            await interaction.deferUpdate();
            const [fromRarity, , toRarity] = interaction.values[0].split('_');
            return showRecyclePreview(interaction, fromRarity, toRarity);
        }

        // Exécution de recycle
        if (customId.startsWith('recycle_exec_')) {
            // recycle_exec_legendary_epic_5
            const parts = customId.split('_');
            const fromRarity = parts[2];
            const toRarity = parts[3];
            const quantity = parseInt(parts[4]);
            return executeRecycle(interaction, fromRarity, toRarity, quantity);
        }

        // Stats détaillées
        if (customId === 'craft_stats') {
            return showDetailedStats(interaction);
        }

    } catch (error) {
        console.error('🔴 [CRAFTING] Erreur:', error);

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

// ============================================================================
// UTILITAIRES
// ============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    handleCraftingInteraction,
    showCraftingPanel,
    getCraftingConfig,
    getCraftingStats
};
