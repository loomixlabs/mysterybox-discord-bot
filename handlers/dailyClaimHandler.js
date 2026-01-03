/**
 * 🎁 DAILY CLAIM HANDLER v2.3.0
 * Gestion des récompenses quotidiennes par thème + Système Loomix
 *
 * CustomIds gérés:
 * - profile_daily_rewards       → Vue récompenses quotidiennes
 * - daily_claim                 → Réclamer la récompense du jour
 * - daily_calendar              → Voir le calendrier complet
 * - daily_rewards_list          → Voir liste des 30 récompenses
 * - daily_catchup               → Vue rattrapage jours manqués
 * - daily_catchup_buy:{day}     → Acheter un jour manqué
 * - daily_back_to_profile       → Retour au profil
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const { createProgressBar, formatRelativeTime, getRarityEmoji, getRarityColor } = require('../utils/profileHelpers');
const { getLoomixFooter } = require('../utils/footerHelper');
const badgeHandler = require('./badgeHandler');

// Emojis pour les types de récompenses (clés pour mystery box) - affichage texte
const REWARD_EMOJIS = {
    mystery_box: {
        common: '🔑',
        rare: '🔑💎',
        epic: '🔑✨',
        legendary: '🗝️👑'
    },
    currency: '💎',
    points: '💰',
    collectible_specific: '🎯',
    collectible_random: '🎲',
    super_bonus_specific: '⚡',
    super_bonus_random: '🌀',
    collectible: '🎯',
    super_bonus: '⚡',
    random_collectible: '🎲',
    choice: '🎁'
};

// Emojis simples pour les boutons Discord (un seul emoji autorisé)
const BUTTON_EMOJIS = {
    mystery_box: {
        common: '🔑',
        rare: '💎',
        epic: '✨',
        legendary: '👑'
    }
};

// Statuts des jours
const DAY_STATUS = {
    claimed: '✅',      // Réclamé
    available: '🎁',    // Disponible aujourd'hui
    missed: '🔒',       // Manqué (peut être rattrapé)
    catchedUp: '🔄',    // Rattrapé (acheté)
    upcoming: '⬜',     // À venir
    milestone: '⭐'     // Milestone (jour spécial)
};

// Couleurs par état
const COLORS = {
    available: 0x57F287,    // Vert - peut claim
    claimed: 0xFEE75C,      // Jaune - déjà claim
    milestone: 0xFFD700,    // Or - milestone
    streakLost: 0xED4245,   // Rouge - streak perdu
    normal: 0x5865F2        // Bleu Discord
};

// Noms lisibles par type de récompense (fallback si pas de display_name)
const REWARD_TYPE_NAMES = {
    mystery_box: 'Clé',
    currency: 'Loomix',
    points: 'Points',
    collectible: 'Collectible',
    super_bonus: 'Super Bonus',
    super_bonus_random: 'Super Bonus Aléatoire',
    random_collectible: 'Collectible Aléatoire'
};

// Noms des raretés
const RARITY_NAMES = {
    common: 'Commune',
    rare: 'Rare',
    epic: 'Épique',
    legendary: 'Légendaire',
    mythic: 'Mythique'
};

/**
 * 🎨 Formater l'affichage d'une récompense (respecte display_name et display_emoji)
 * @param {object} reward - Config de la récompense depuis daily_rewards_config
 * @param {object} options - Options supplémentaires {itemName, currencyName}
 * @returns {object} {emoji, name, full} - emoji seul, nom seul, format complet "emoji nom"
 */
function formatRewardDisplay(reward, options = {}) {
    if (!reward) return { emoji: '🎁', name: 'Récompense', full: '🎁 Récompense' };

    const { itemName, currencyName } = options;

    // 1. Déterminer l'emoji (priorité: display_emoji > getRewardEmoji)
    let emoji;
    if (reward.display_emoji) {
        emoji = reward.display_emoji;
    } else {
        emoji = getRewardEmoji(reward.reward_type, reward.reward_rarity);
    }

    // 2. Déterminer le nom (priorité: display_name > nom calculé)
    let name;
    if (reward.display_name) {
        name = reward.display_name;
    } else {
        // Générer un nom lisible selon le type
        switch (reward.reward_type) {
            case 'mystery_box':
                const rarityName = RARITY_NAMES[reward.reward_rarity] || reward.reward_rarity;
                name = `Clé ${rarityName}`;
                if (reward.reward_amount && reward.reward_amount > 1) {
                    name += ` x${reward.reward_amount}`;
                }
                break;
            case 'currency':
            case 'points':
                const cName = currencyName || 'Loomix';
                name = `${reward.reward_amount || 50} ${cName}`;
                break;
            case 'collectible':
                name = itemName || 'Collectible Précis';
                break;
            case 'super_bonus':
                name = itemName || 'Super Bonus Précis';
                break;
            case 'super_bonus_random':
                name = 'Super Bonus Aléatoire';
                if (reward.reward_amount && reward.reward_amount > 1) {
                    name += ` x${reward.reward_amount}`;
                }
                break;
            default:
                name = REWARD_TYPE_NAMES[reward.reward_type] || reward.reward_type;
        }
    }

    return {
        emoji,
        name,
        full: `${emoji} ${name}`
    };
}

/**
 * 🎁 Traiter une récompense pour un joueur (fonction centralisée)
 * Gère tous les types: mystery_box, currency, super_bonus, collectible, etc.
 *
 * @param {string} guildId - ID du serveur
 * @param {object} player - Objet joueur avec id et discord_id
 * @param {object} reward - Configuration de la récompense
 * @param {string} source - Source de la récompense ('daily_claim', 'catchup')
 * @param {object} details - Détails supplémentaires {dayNumber, themeId}
 * @returns {object} {success, message, type, data}
 */
async function processRewardForPlayer(guildId, player, reward, source, details = {}) {
    const { dayNumber, themeId } = details;
    const sourceRef = `day_${dayNumber}`;

    try {
        switch (reward.reward_type) {
            case 'mystery_box': {
                await db.addMysteryBoxCredits(
                    guildId,
                    player.id,
                    reward.reward_rarity,
                    reward.reward_amount || 1,
                    source,
                    sourceRef
                );
                const emoji = REWARD_EMOJIS.mystery_box[reward.reward_rarity] || '🔑';
                return {
                    success: true,
                    type: 'mystery_box',
                    rarity: reward.reward_rarity,
                    message: `${emoji} **${reward.reward_amount || 1}x ${reward.display_name || 'Clé ' + RARITY_NAMES[reward.reward_rarity]}**`,
                    data: { rarity: reward.reward_rarity, amount: reward.reward_amount || 1 }
                };
            }

            case 'currency':
            case 'points': {
                const amount = reward.reward_amount || 50;
                const currencyConfig = await db.getGuildCurrencyConfig(guildId);

                await db.addCurrency(
                    guildId,
                    player.id,
                    amount,
                    source,
                    sourceRef,
                    `Récompense jour ${dayNumber}`
                );

                // 🏆 BADGE TRACKING - Loomix earned
                try {
                    await badgeHandler.onLoomixOperation(guildId, player.id, 'earned', amount, null);
                } catch (err) {
                    console.error('🔴 [BADGES] Erreur tracking loomix earned:', err);
                }

                return {
                    success: true,
                    type: 'currency',
                    message: `${currencyConfig.display_emoji} **+${amount} ${currencyConfig.display_name}**`,
                    data: { amount, currencyName: currencyConfig.display_name }
                };
            }

            case 'super_bonus': {
                // Super bonus spécifique par ID
                const bonusId = reward.reward_item_id;
                if (!bonusId) {
                    return { success: false, message: '❌ ID du super bonus non configuré' };
                }

                const bonus = await db.getSuperBonusById(guildId, bonusId);
                if (!bonus) {
                    return { success: false, message: '❌ Super bonus introuvable' };
                }

                await db.addBonusToPlayer(guildId, player.discord_id, bonusId, source, null);

                return {
                    success: true,
                    type: 'super_bonus',
                    message: `⚡ **${bonus.name}** obtenu!`,
                    data: { bonus, bonusId }
                };
            }

            case 'super_bonus_random': {
                // Super bonus aléatoire du thème
                const availableBonuses = await db.queryAll(`
                    SELECT id, name, icon, rarity, effect_type
                    FROM super_bonuses
                    WHERE guild_id = $1
                    AND is_enabled = TRUE
                    AND (theme_id IS NULL OR theme_id = $2)
                    ORDER BY RANDOM()
                    LIMIT 1
                `, [guildId, themeId]);

                if (!availableBonuses || availableBonuses.length === 0) {
                    // Fallback: donner des Loomix si pas de bonus disponible
                    const fallbackAmount = 100;
                    const currencyConfig = await db.getGuildCurrencyConfig(guildId);
                    await db.addCurrency(guildId, player.id, fallbackAmount, source, sourceRef, `Bonus de remplacement J${dayNumber}`);

                    // 🏆 BADGE TRACKING - Loomix earned (fallback)
                    try {
                        await badgeHandler.onLoomixOperation(guildId, player.id, 'earned', fallbackAmount, null);
                    } catch (err) {
                        console.error('🔴 [BADGES] Erreur tracking loomix earned fallback:', err);
                    }

                    return {
                        success: true,
                        type: 'currency',
                        message: `${currencyConfig.display_emoji} **+${fallbackAmount} ${currencyConfig.display_name}** (aucun bonus disponible)`,
                        data: { amount: fallbackAmount, fallback: true }
                    };
                }

                const randomBonus = availableBonuses[0];
                await db.addBonusToPlayer(guildId, player.discord_id, randomBonus.id, source, null);

                return {
                    success: true,
                    type: 'super_bonus',
                    message: `🌀 **${randomBonus.name}** obtenu! (aléatoire)`,
                    data: { bonus: randomBonus, bonusId: randomBonus.id, isRandom: true }
                };
            }

            case 'collectible': {
                // Collectible spécifique par ID
                const collectibleId = reward.reward_item_id;
                if (!collectibleId) {
                    return { success: false, message: '❌ ID du collectible non configuré' };
                }

                const collectible = await db.queryOne(`
                    SELECT id, name, rarity, emoji FROM collectibles
                    WHERE guild_id = $1 AND id = $2
                `, [guildId, collectibleId]);

                if (!collectible) {
                    return { success: false, message: '❌ Collectible introuvable' };
                }

                await db.addCollectible(guildId, player.id, collectibleId, source);

                // Incrémenter la progression du joueur
                if (themeId) {
                    await db.incrementProgress(guildId, player.id, themeId);
                }

                const rarityEmoji = getRarityEmoji(collectible.rarity);
                return {
                    success: true,
                    type: 'collectible',
                    message: `🎯 **${collectible.emoji || ''} ${collectible.name}** ${rarityEmoji} obtenu!`,
                    data: { collectible, collectibleId }
                };
            }

            case 'random_collectible': {
                // Collectible aléatoire du thème (filtré par rareté si spécifié)
                let query = `
                    SELECT id, name, rarity, emoji FROM collectibles
                    WHERE guild_id = $1 AND theme_id = $2
                `;
                const params = [guildId, themeId];

                if (reward.reward_rarity) {
                    query += ` AND rarity = $3`;
                    params.push(reward.reward_rarity);
                }

                query += ` ORDER BY RANDOM() LIMIT 1`;

                const randomCollectible = await db.queryOne(query, params);

                if (!randomCollectible) {
                    // Fallback: donner des Loomix
                    const fallbackAmount = 75;
                    const currencyConfig = await db.getGuildCurrencyConfig(guildId);
                    await db.addCurrency(guildId, player.id, fallbackAmount, source, sourceRef, `Collectible de remplacement J${dayNumber}`);

                    // 🏆 BADGE TRACKING - Loomix earned (collectible fallback)
                    try {
                        await badgeHandler.onLoomixOperation(guildId, player.id, 'earned', fallbackAmount, null);
                    } catch (err) {
                        console.error('🔴 [BADGES] Erreur tracking loomix earned collectible fallback:', err);
                    }

                    return {
                        success: true,
                        type: 'currency',
                        message: `${currencyConfig.display_emoji} **+${fallbackAmount} ${currencyConfig.display_name}** (aucun collectible disponible)`,
                        data: { amount: fallbackAmount, fallback: true }
                    };
                }

                await db.addCollectible(guildId, player.id, randomCollectible.id, source);

                // Incrémenter la progression du joueur
                if (themeId) {
                    await db.incrementProgress(guildId, player.id, themeId);
                }

                const rarityEmoji = getRarityEmoji(randomCollectible.rarity);
                return {
                    success: true,
                    type: 'collectible',
                    message: `🎲 **${randomCollectible.emoji || ''} ${randomCollectible.name}** ${rarityEmoji} obtenu! (aléatoire)`,
                    data: { collectible: randomCollectible, collectibleId: randomCollectible.id, isRandom: true }
                };
            }

            default:
                console.warn(`⚠️ Type de récompense non géré: ${reward.reward_type}`);
                return {
                    success: false,
                    message: `❌ Type de récompense non supporté: ${reward.reward_type}`
                };
        }
    } catch (error) {
        console.error(`❌ Erreur processRewardForPlayer:`, error);
        return {
            success: false,
            message: `❌ Erreur lors de l'attribution de la récompense`
        };
    }
}

/**
 * 🎯 Router principal des interactions daily claim
 */
async function handleDailyClaimInteraction(interaction) {
    const { customId } = interaction;

    try {
        // Ne PAS déférer ici si on route vers profile_daily_rewards
        // car le handler appelant a peut-être déjà déféré

        if (customId === 'daily_claim') {
            await interaction.deferUpdate();
            return handleClaim(interaction);
        }

        if (customId === 'daily_calendar') {
            await interaction.deferUpdate();
            return handleShowCalendar(interaction);
        }

        if (customId === 'daily_rewards_list' || customId.startsWith('daily_rewards_list:')) {
            await interaction.deferUpdate();
            return handleShowRewardsList(interaction);
        }

        if (customId === 'daily_catchup') {
            await interaction.deferUpdate();
            return handleShowCatchup(interaction);
        }

        if (customId === 'daily_catchup_select') {
            await interaction.deferUpdate();
            return handleCatchupSelect(interaction);
        }

        if (customId.startsWith('daily_catchup_buy:')) {
            await interaction.deferUpdate();
            return handleCatchupBuy(interaction);
        }

        if (customId.startsWith('daily_catchup_confirm:')) {
            await interaction.deferUpdate();
            return handleCatchupConfirm(interaction);
        }

        if (customId === 'daily_catchup_cancel') {
            await interaction.deferUpdate();
            return handleShowCatchup(interaction);
        }

        if (customId === 'daily_back_to_profile') {
            // Retourner au profil - déléguer au profileHandler
            return false; // Indique que ce n'est pas géré ici
        }

        return false;

    } catch (error) {
        console.error('🔴 Erreur dailyClaimHandler:', error);

        if (error.code === 10062) {
            console.error('⏱️ Interaction expirée');
            return;
        }

        const errorMsg = {
            content: '❌ Une erreur est survenue avec les récompenses quotidiennes.',
            components: []
        };

        if (interaction.deferred) {
            await interaction.editReply(errorMsg).catch(() => {});
        }
    }
}

/**
 * 📅 Afficher la vue des récompenses quotidiennes (refonte v2.3.0)
 */
async function showDailyRewards(interaction, player, theme, progress) {
    const guildId = interaction.guildId;

    // 1. Récupérer les infos de claim par thème
    const claimInfo = await db.getDailyClaimInfoByTheme(guildId, player.id, theme.id);

    // 2. Récupérer le calendrier
    const calendar = await db.getDailyRewardsCalendar(guildId, theme.id);

    // 3. Récupérer les clés mystery box (globales, pas liées au thème)
    const mbCredits = await db.getMysteryBoxCredits(guildId, player.id);

    // 4. Récupérer le solde Loomix
    const currency = await db.getPlayerCurrency(guildId, player.id);
    const currencyConfig = await db.getGuildCurrencyConfig(guildId);

    // 5. Récupérer les jours manqués
    const missedDays = await db.getMissedDays(guildId, player.id, theme.id);

    // 6. Calculer le temps restant avant prochain claim
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const canClaim = claimInfo.lastClaim !== today;

    let timeUntilNext = '';
    if (!canClaim) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntil = tomorrow - now;
        const hours = Math.floor(msUntil / (1000 * 60 * 60));
        const minutes = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60));
        timeUntilNext = `${hours}h ${minutes}m`;
    }

    // 7. Déterminer le jour actuel et la récompense du jour
    const currentDay = claimInfo.currentDay; // Nombre de claims effectués (0 si aucun)
    const nextDay = claimInfo.nextClaimDay;  // Prochain jour à réclamer (1-indexed)
    const themeDuration = theme.duration_days || 30;
    const themeDaysRemaining = claimInfo.themeDaysRemaining;
    const themeDaysPassed = claimInfo.themeDaysPassed;

    // Trouver la récompense du jour
    const todayReward = calendar.find(d => d.day_number === nextDay);

    // 8. Vérifier si streak perdu
    const streakLost = claimInfo.lastClaim &&
        claimInfo.lastClaim !== today &&
        new Date(claimInfo.lastClaim).toDateString() !== new Date(now - 86400000).toDateString();

    // 9. Construire l'embed
    const embedColor = streakLost ? COLORS.streakLost :
        (canClaim ? COLORS.available : COLORS.claimed);

    const embed = new EmbedBuilder()
        .setTitle(`🎁 Récompenses Quotidiennes`)
        .setColor(embedColor)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }));

    // Thème actif + jours restants
    const themeTimeInfo = themeDaysRemaining > 0
        ? `⏳ **${themeDaysRemaining}** jours restants`
        : `⚠️ Thème terminé`;
    embed.setDescription(`**🎯 Thème:** ${theme.name}\n**📅 Durée:** ${themeDuration} jours | ${themeTimeInfo}`);

    // Solde Loomix (nouveau)
    embed.addFields({
        name: `${currencyConfig.display_emoji} ${currencyConfig.display_name}`,
        value: `**${currency.balance.toLocaleString()}** ${currencyConfig.display_emoji}`,
        inline: true
    });

    // Jours manqués (nouveau)
    const missedInfo = missedDays.length > 0
        ? `🔒 **${missedDays.length}** jour(s) manqué(s)`
        : `✅ Aucun jour manqué`;
    embed.addFields({
        name: '📋 Jours Manqués',
        value: missedInfo,
        inline: true
    });

    // Progression des claims (0 si aucun claim effectué)
    const progressBar = createProgressBar(currentDay, themeDuration);
    const percentage = Math.round((currentDay / themeDuration) * 100);
    embed.addFields({
        name: '📊 Progression des Claims',
        value: `${progressBar} **${currentDay}/${themeDuration}** jours réclamés (${percentage}%)`,
        inline: false
    });

    // Streak
    const streakValue = streakLost
        ? `😢 **Streak perdu!** Ton streak repart à 1.\n` +
          `├─ Ancien streak: ${claimInfo.currentStreak || 0} jours\n` +
          `├─ Meilleur: ⭐ ${claimInfo.bestStreak || 0} jours\n` +
          `└─ Total claims: 📦 ${claimInfo.totalClaims || 0}`
        : `├─ Actuel: 🔥 ${claimInfo.currentStreak || 0} jours\n` +
          `├─ Meilleur: ⭐ ${claimInfo.bestStreak || 0} jours\n` +
          `└─ Total claims: 📦 ${claimInfo.totalClaims || 0}`;

    embed.addFields({
        name: '🔥 Streak',
        value: streakValue,
        inline: false
    });

    // Prochain claim
    if (canClaim && todayReward) {
        const rewardDisplay = formatRewardDisplay(todayReward, { currencyName: currencyConfig.display_name });
        const isMilestone = todayReward.is_milestone;

        embed.addFields({
            name: isMilestone ? '⭐ MILESTONE DISPONIBLE!' : '🎁 Récompense du Jour',
            value: `**Jour ${nextDay}:** ${rewardDisplay.full}` +
                (isMilestone ? '\n🏆 *Bonus milestone!*' : ''),
            inline: true
        });
    } else if (!canClaim) {
        embed.addFields({
            name: '⏰ Prochain claim',
            value: `Dans **${timeUntilNext}**`,
            inline: true
        });
    }

    // Clés Mystery Box (compact) - Commune | Rare | Épique | Légendaire
    const creditsValue = `🔑 ${mbCredits?.common || 0} | 🔑💎 ${mbCredits?.rare || 0} | 🔑✨ ${mbCredits?.epic || 0} | 🗝️👑 ${mbCredits?.legendary || 0}`;
    const totalMbCredits = (mbCredits?.common || 0) + (mbCredits?.rare || 0) + (mbCredits?.epic || 0) + (mbCredits?.legendary || 0);
    embed.addFields({
        name: '🔑 Mes Clés',
        value: creditsValue,
        inline: false
    });

    // Prochains milestones (compact)
    const upcomingMilestones = calendar
        .filter(d => d.is_milestone && d.day_number > currentDay)
        .slice(0, 3);

    if (upcomingMilestones.length > 0) {
        const milestonesValue = upcomingMilestones
            .map(m => {
                const daysUntil = m.day_number - currentDay;
                const mDisplay = formatRewardDisplay(m, { currencyName: currencyConfig.display_name });
                return `${mDisplay.emoji} J${m.day_number} (${daysUntil}j)`;
            })
            .join(' | ');

        embed.addFields({
            name: '📆 Prochains Milestones',
            value: milestonesValue,
            inline: false
        });
    }

    embed.setFooter(await getLoomixFooter(guildId));
    embed.setTimestamp();

    // 10. Construire les boutons (2 rangées)
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_claim')
                .setLabel(canClaim ? 'Réclamer' : 'Déjà réclamé')
                .setEmoji('🎁')
                .setStyle(canClaim ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!canClaim),
            new ButtonBuilder()
                .setCustomId('daily_rewards_list')
                .setLabel('Récompenses')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('daily_calendar')
                .setLabel('Calendrier')
                .setEmoji('📅')
                .setStyle(ButtonStyle.Primary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_catchup')
                .setLabel(`Rattraper (${missedDays.length})`)
                .setEmoji('🔓')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(missedDays.length === 0),
            new ButtonBuilder()
                .setCustomId('profile_overview')
                .setLabel('Retour')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
        );

    return {
        embeds: [embed],
        components: [row1, row2]
    };
}

/**
 * 🎁 Gérer le claim de récompense
 */
async function handleClaim(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // 1. Récupérer le joueur et le thème
    const player = await db.getPlayerByDiscordId(guildId, userId);
    const theme = await db.getActiveTheme(guildId);
    const currencyConfig = await db.getGuildCurrencyConfig(guildId);

    if (!player || !theme) {
        return interaction.editReply({
            content: '❌ Profil ou thème introuvable.',
            embeds: [],
            components: []
        });
    }

    // 2. Vérifier si déjà claim aujourd'hui
    const claimInfo = await db.getDailyClaimInfoByTheme(guildId, player.id, theme.id);
    const today = new Date().toISOString().split('T')[0];

    if (claimInfo.lastClaim === today) {
        return interaction.editReply({
            content: '⏰ Tu as déjà réclamé ta récompense aujourd\'hui!',
            embeds: [],
            components: []
        });
    }

    // 3. Récupérer la récompense du jour
    const nextDay = claimInfo.nextClaimDay;
    const reward = await db.getDailyRewardForDay(guildId, theme.id, nextDay);

    if (!reward) {
        return interaction.editReply({
            content: `❌ Aucune récompense configurée pour le jour ${nextDay}.`,
            embeds: [],
            components: []
        });
    }

    // 4. Vérifier si streak perdu
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const streakLost = claimInfo.lastClaim &&
        claimInfo.lastClaim !== yesterday &&
        claimInfo.lastClaim !== today;

    // 5. Calculer le nouveau streak
    let newStreak = 1;
    if (!streakLost && claimInfo.currentStreak) {
        newStreak = claimInfo.currentStreak + 1;
    }

    // 6. Enregistrer le claim (propriétés: type, rarity, amount, detail)
    const claimResult = await db.recordDailyClaimByTheme(guildId, player.id, theme.id, {
        dayNumber: nextDay,
        newStreak: newStreak,
        type: reward.reward_type,
        rarity: reward.reward_rarity || null,
        amount: reward.reward_amount || null,
        detail: reward.display_name || null
    });

    // 6.1 Mettre à jour les badges Engagement basés sur le streak GLOBAL (persiste entre thèmes)
    try {
        const globalStreak = claimResult?.globalStreak || newStreak;
        await badgeHandler.onLoginStreak(guildId, player.id, globalStreak, interaction.client);
        console.log(`📅 [BADGE] Streak global ${globalStreak}J pour ${player.username}`);
    } catch (badgeError) {
        console.error('⚠️ Erreur mise à jour badges streak:', badgeError);
    }

    // 6.2 Tracker l'activité joueur pour badges de séniorité
    try {
        await badgeHandler.onPlayerActivity(guildId, player.id, interaction.client);
    } catch (activityError) {
        console.error('⚠️ Erreur tracking activité joueur:', activityError);
    }

    // 7. Donner la récompense via la fonction centralisée
    const rewardResult = await processRewardForPlayer(guildId, player, reward, 'daily_claim', {
        dayNumber: nextDay,
        themeId: theme.id
    });

    const rewardMessage = rewardResult.message;
    const mbRarityReceived = rewardResult.type === 'mystery_box' ? rewardResult.rarity : null;

    // 8. Construire l'embed de succès
    const isMilestone = reward.is_milestone;
    const embedColor = isMilestone ? COLORS.milestone : COLORS.available;

    const successEmbed = new EmbedBuilder()
        .setTitle(isMilestone ? '🎊 MILESTONE ATTEINT!' : '🎉 Récompense Réclamée!')
        .setColor(embedColor)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }));

    if (isMilestone) {
        successEmbed.setDescription(`⭐ **JOUR ${nextDay} - MILESTONE ${reward.reward_rarity?.toUpperCase() || ''}**`);
    }

    successEmbed.addFields({
        name: '🎁 Tu as reçu',
        value: rewardMessage,
        inline: false
    });

    if (streakLost) {
        successEmbed.addFields({
            name: '😢 Streak perdu',
            value: `Ton streak repart à **1** jour.\nAncien streak: ${claimInfo.currentStreak || 0} jours`,
            inline: false
        });
    } else {
        successEmbed.addFields({
            name: '🔥 Streak',
            value: `**${newStreak}** jours consécutifs!`,
            inline: true
        });
    }

    // Prochain jour
    const nextReward = await db.getDailyRewardForDay(guildId, theme.id, nextDay + 1);
    if (nextReward) {
        const nextRewardDisplay = formatRewardDisplay(nextReward, { currencyName: currencyConfig.display_name });
        successEmbed.addFields({
            name: '💡 Demain (Jour ' + (nextDay + 1) + ')',
            value: nextRewardDisplay.full,
            inline: true
        });
    }

    successEmbed.setFooter(await getLoomixFooter(guildId));
    successEmbed.setTimestamp();

    // 9. Boutons d'action
    const components = [];

    // Si mystery box reçue, proposer d'ouvrir
    if (mbRarityReceived) {
        const rewardDisplay = formatRewardDisplay(reward, { currencyName: currencyConfig.display_name });
        const openRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mb_open:${mbRarityReceived}`)
                    .setLabel(`Ouvrir: ${rewardDisplay.name}`)
                    .setEmoji(rewardDisplay.emoji)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('profile_daily_rewards')
                    .setLabel('Voir Daily')
                    .setEmoji('📅')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('profile_overview')
                    .setLabel('Profil')
                    .setEmoji('🏠')
                    .setStyle(ButtonStyle.Secondary)
            );
        components.push(openRow);
    } else {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_daily_rewards')
                    .setLabel('Voir Daily')
                    .setEmoji('📅')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('profile_overview')
                    .setLabel('Profil')
                    .setEmoji('🏠')
                    .setStyle(ButtonStyle.Secondary)
            );
        components.push(actionRow);
    }

    return interaction.editReply({
        embeds: [successEmbed],
        components
    });
}

/**
 * 📋 Afficher le calendrier complet
 */
async function handleShowCalendar(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const player = await db.getPlayerByDiscordId(guildId, userId);
    const theme = await db.getActiveTheme(guildId);

    if (!player || !theme) {
        return interaction.editReply({
            content: '❌ Profil ou thème introuvable.',
            embeds: [],
            components: []
        });
    }

    const claimInfo = await db.getDailyClaimInfoByTheme(guildId, player.id, theme.id);

    // Récupérer les jours RÉELLEMENT réclamés, manqués et rattrapés
    const claimedDays = await db.getClaimedDays(guildId, player.id, theme.id);
    const missedDays = await db.getMissedDays(guildId, player.id, theme.id);
    const caughtUpDays = await db.getCaughtUpDays(guildId, player.id, theme.id);

    const claimedDaysSet = new Set(claimedDays);
    const missedDaysSet = new Set(missedDays);
    const caughtUpDaysSet = new Set(caughtUpDays);

    const nextClaimDay = claimInfo.nextClaimDay; // Prochain jour à réclamer
    const themeDuration = theme.duration_days || 30;
    const themeDaysPassed = claimInfo.themeDaysPassed || 0; // Jours écoulés depuis activation

    // Générer le calendrier visuel par semaines
    // Format compact: numéro + emoji (ex: 1✅ 2✅ 3🔒 4🎁 5⬜)
    let calendarText = '';
    const weeksCount = Math.ceil(themeDuration / 7);

    for (let week = 0; week < weeksCount; week++) {
        const weekStart = week * 7 + 1;
        const weekEnd = Math.min((week + 1) * 7, themeDuration);
        let weekLine = '';

        for (let day = weekStart; day <= weekEnd; day++) {
            const isClaimed = claimedDaysSet.has(day);
            const isCaughtUp = caughtUpDaysSet.has(day);
            const isMissed = missedDaysSet.has(day);
            const isToday = day === nextClaimDay && claimInfo.canClaim;
            const isFuture = day > themeDaysPassed && !isClaimed && !isCaughtUp;

            let emoji;
            if (isClaimed) {
                emoji = '✅'; // Jour réclamé normalement
            } else if (isCaughtUp) {
                emoji = '🔄'; // Jour rattrapé avec Loomix
            } else if (isMissed) {
                emoji = '🔒'; // Jour manqué (peut être rattrapé)
            } else if (isToday) {
                emoji = '🎁'; // Disponible aujourd'hui
            } else if (isFuture) {
                emoji = '⬜'; // Jour à venir
            } else {
                emoji = '⬜'; // Par défaut
            }

            // Format: numéro + emoji (compact et aligné)
            weekLine += `${day}${emoji} `;
        }

        calendarText += `**Semaine ${week + 1}**\n${weekLine.trim()}\n\n`;
    }

    // Légende complète
    const legend = '✅ Réclamé | 🔄 Rattrapé | 🔒 Manqué | 🎁 Disponible | ⬜ À venir';

    const embed = new EmbedBuilder()
        .setTitle(`📅 Calendrier - ${theme.name}`)
        .setColor(COLORS.normal)
        .setDescription(calendarText)
        .addFields({
            name: '📋 Légende',
            value: legend,
            inline: false
        })
        .addFields({
            name: '✅ Réclamés',
            value: `**${claimedDays.length}** jour(s)`,
            inline: true
        })
        .addFields({
            name: '🔒 Manqués',
            value: `**${missedDays.length}** jour(s)`,
            inline: true
        })
        .addFields({
            name: '🔥 Streak',
            value: `**${claimInfo.currentStreak || 0}** jours`,
            inline: true
        });

    embed.setFooter(await getLoomixFooter(guildId));
    embed.setTimestamp();

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('profile_daily_rewards')
                .setLabel('Retour')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_overview')
                .setLabel('Profil')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [actionRow]
    });
}

/**
 * 🎁 Obtenir l'emoji pour un type de récompense
 */
function getRewardEmoji(rewardType, rarity = null) {
    if (rewardType === 'mystery_box') {
        // Pour mystery_box, utiliser l'emoji de la rareté ou 🔑 par défaut
        return REWARD_EMOJIS.mystery_box[rarity] || '🔑';
    }
    return REWARD_EMOJIS[rewardType] || '🎁';
}

/**
 * 📋 Afficher la liste complète des récompenses (streak list)
 */
async function handleShowRewardsList(interaction, page = 1) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Extraire la page du customId si présent (daily_rewards_list:2)
    if (interaction.customId && interaction.customId.includes(':')) {
        const parts = interaction.customId.split(':');
        page = parseInt(parts[1]) || 1;
    }

    const player = await db.getPlayerByDiscordId(guildId, userId);
    const theme = await db.getActiveTheme(guildId);

    if (!player || !theme) {
        return interaction.editReply({
            content: '❌ Profil ou thème introuvable.',
            embeds: [],
            components: []
        });
    }

    const calendar = await db.getDailyRewardsCalendar(guildId, theme.id);
    const currencyConfig = await db.getGuildCurrencyConfig(guildId);

    // Récupérer les jours réclamés ET rattrapés
    const claimedDays = await db.getClaimedDays(guildId, player.id, theme.id);
    const caughtUpDays = await db.getCaughtUpDays(guildId, player.id, theme.id);

    // Total des récompenses obtenues (claims + catchups)
    const totalRewardsObtained = claimedDays.length + caughtUpDays.length;
    const nextRewardNumber = totalRewardsObtained + 1;
    const themeDuration = theme.duration_days || 30;

    // Pagination
    const rewardsPerPage = 10;
    const totalPages = Math.ceil(themeDuration / rewardsPerPage);
    page = Math.max(1, Math.min(page, totalPages)); // Clamp page

    const startDay = (page - 1) * rewardsPerPage + 1;
    const endDay = Math.min(page * rewardsPerPage, themeDuration);

    // Construire la liste des récompenses pour cette page
    let rewardsList = '';

    for (let day = startDay; day <= endDay; day++) {
        const dayConfig = calendar.find(d => d.day_number === day);
        const isClaimed = day <= totalRewardsObtained;
        const isNext = day === nextRewardNumber;
        const isMilestone = dayConfig?.is_milestone;

        // Déterminer le statut
        let statusEmoji;
        if (isClaimed) {
            statusEmoji = DAY_STATUS.claimed;
        } else if (isNext) {
            statusEmoji = DAY_STATUS.available;
        } else {
            statusEmoji = DAY_STATUS.upcoming;
        }

        // Formater l'affichage de la récompense
        const rewardDisplay = formatRewardDisplay(dayConfig, { currencyName: currencyConfig.display_name });

        // Formater la ligne
        const milestoneMarker = isMilestone ? ' ⭐' : '';
        const dayPadded = day.toString().padStart(2, '0');
        rewardsList += `${statusEmoji} **${dayPadded}:** ${rewardDisplay.full}${milestoneMarker}\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`📋 Récompenses - ${theme.name}`)
        .setColor(COLORS.normal)
        .setDescription(rewardsList)
        .addFields({
            name: '📋 Légende',
            value: `${DAY_STATUS.claimed} Obtenue | ${DAY_STATUS.available} Prochaine | ${DAY_STATUS.upcoming} À venir | ⭐ Milestone`,
            inline: false
        })
        .addFields({
            name: '📊 Progression',
            value: `**${totalRewardsObtained}/${themeDuration}** récompenses\n✅ ${claimedDays.length} réclamée(s) | 🔄 ${caughtUpDays.length} rattrapée(s)`,
            inline: true
        })
        .addFields({
            name: '📄 Page',
            value: `**${page}/${totalPages}**`,
            inline: true
        });

    embed.setFooter(await getLoomixFooter(guildId));
    embed.setTimestamp();

    // Boutons de navigation
    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_rewards_list:${page - 1}`)
                .setLabel('◀')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId('profile_daily_rewards')
                .setLabel('Retour')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`daily_rewards_list:${page + 1}`)
                .setLabel('▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages)
        );

    // Boutons d'actions
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('daily_calendar')
                .setLabel('Calendrier')
                .setEmoji('📅')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('daily_catchup')
                .setLabel('Rattrapage')
                .setEmoji('🔓')
                .setStyle(ButtonStyle.Secondary)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [navRow, actionRow]
    });
}

/**
 * 🔓 Afficher la vue de rattrapage des jours manqués
 */
async function handleShowCatchup(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const player = await db.getPlayerByDiscordId(guildId, userId);
    const theme = await db.getActiveTheme(guildId);

    if (!player || !theme) {
        return interaction.editReply({
            content: '❌ Profil ou thème introuvable.',
            embeds: [],
            components: []
        });
    }

    // Récupérer les données
    const missedDays = await db.getMissedDays(guildId, player.id, theme.id);
    const claimedDays = await db.getClaimedDays(guildId, player.id, theme.id);
    const caughtUpDays = await db.getCaughtUpDays(guildId, player.id, theme.id);
    const currency = await db.getPlayerCurrency(guildId, player.id);
    const currencyConfig = await db.getGuildCurrencyConfig(guildId);

    // Vérifier si l'utilisateur peut encore claim aujourd'hui (gratuit)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const claimInfo = await db.getDailyClaimInfoByTheme(guildId, player.id, theme.id);
    const canClaimToday = !claimInfo.lastClaim || claimInfo.lastClaim !== today;

    // Calculer les jours passés depuis activation
    const themeActivatedAt = new Date(theme.activated_at);
    const themeDaysPassed = Math.floor((now - themeActivatedAt) / (1000 * 60 * 60 * 24)) + 1;

    if (missedDays.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle(`✅ Aucun Jour à Rattraper`)
            .setColor(COLORS.available)
            .setDescription(`Félicitations ! Tu n'as manqué aucun jour sur le thème **${theme.name}**.`)
            .addFields({
                name: `${currencyConfig.display_emoji} Solde ${currencyConfig.display_name}`,
                value: `**${currency.balance.toLocaleString()}** ${currencyConfig.display_emoji}`,
                inline: true
            })
            .addFields({
                name: '📊 Progression',
                value: `✅ **${claimedDays.length}** réclamé(s) | 🔄 **${caughtUpDays.length}** rattrapé(s)`,
                inline: true
            });

        embed.setFooter(await getLoomixFooter(guildId));

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_daily_rewards')
                    .setLabel('Retour')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
            );

        return interaction.editReply({
            embeds: [embed],
            components: [actionRow]
        });
    }

    // Calculer les prix pour chaque jour manqué (avec offset des achats précédents)
    const priceInfo = await db.calculateCatchupPrice(guildId, theme.id, missedDays.length, player.id);

    // Nombre de récompenses déjà obtenues (claimed + caught up)
    const rewardsObtained = claimedDays.length + caughtUpDays.length;

    // Récupérer les prochaines récompenses disponibles
    const upcomingRewards = [];
    for (let i = 0; i < Math.min(missedDays.length, 10); i++) {
        const rewardNumber = rewardsObtained + i + 1;
        const reward = await db.getDailyRewardForDay(guildId, theme.id, rewardNumber);
        if (reward) {
            const rewardDisplay = formatRewardDisplay(reward, { currencyName: currencyConfig.display_name });
            upcomingRewards.push(`**${rewardNumber}.** ${rewardDisplay.full}`);
        }
    }
    const upcomingRewardsText = upcomingRewards.length > 0
        ? upcomingRewards.join('\n')
        : '*Aucune récompense configurée*';
    const upcomingSuffix = missedDays.length > 10 ? `\n*...et ${missedDays.length - 10} autres*` : '';

    // Texte de tarification avec info sur achats précédents
    let tarificationText = priceInfo.pricingMode === 'increment'
        ? `Base: **${priceInfo.basePrice}** ${currencyConfig.display_emoji} (+${priceInfo.priceIncrement}/jour)`
        : `Base: **${priceInfo.basePrice}** ${currencyConfig.display_emoji} (×${priceInfo.priceMultiplier}/jour)`;

    if (priceInfo.previousPurchases > 0) {
        tarificationText += `\n⚠️ *${priceInfo.previousPurchases} rattrapage(s) précédent(s) pris en compte*`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🔓 Rattraper des Jours Manqués`)
        .setColor(COLORS.normal)
        .setDescription(`**${theme.name}** - Jour ${themeDaysPassed}/${theme.duration_days || 30}`)
        .addFields({
            name: `${currencyConfig.display_emoji} Ton Solde`,
            value: `**${currency.balance.toLocaleString()}** ${currencyConfig.display_emoji}`,
            inline: true
        })
        .addFields({
            name: '📊 Récompenses',
            value: `✅ **${rewardsObtained}** obtenue(s) | 🔒 **${missedDays.length}** à rattraper`,
            inline: true
        })
        .addFields({
            name: '🎁 Prochaines Récompenses',
            value: upcomingRewardsText + upcomingSuffix,
            inline: false
        })
        .addFields({
            name: '📈 Tarification',
            value: tarificationText,
            inline: false
        });

    // Avertir si l'utilisateur peut d'abord claim gratuitement
    if (canClaimToday) {
        embed.addFields({
            name: '⚠️ Conseil',
            value: `Tu peux d'abord **réclamer aujourd'hui gratuitement** avant de payer pour rattraper des jours !\nRéclamer te donnera la **prochaine récompense séquentielle** sans frais.`,
            inline: false
        });
    }

    embed.setFooter(await getLoomixFooter(guildId));
    embed.setTimestamp();

    // Créer le sélecteur pour choisir le nombre de jours
    const maxOptions = Math.min(missedDays.length, 25); // Discord limite à 25 options
    const selectOptions = [];

    let cumulativePrice = 0;
    for (let i = 0; i < maxOptions; i++) {
        cumulativePrice += priceInfo.priceBreakdown[i];
        const canAfford = currency.balance >= cumulativePrice;
        const count = i + 1;

        // Montrer les récompenses qu'on va obtenir (numéros séquentiels)
        const rewardStart = rewardsObtained + 1;
        const rewardEnd = rewardsObtained + count;
        const rewardsRange = count === 1
            ? `Récompense ${rewardStart}`
            : `Récompenses ${rewardStart}-${rewardEnd}`;

        selectOptions.push({
            label: `${count} jour${count > 1 ? 's' : ''} → ${cumulativePrice.toLocaleString()} ${currencyConfig.display_name}`,
            description: canAfford ? rewardsRange : `❌ Solde insuffisant`,
            value: `${count}`,
            emoji: canAfford ? '🔓' : '🔒',
            default: false
        });
    }

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('daily_catchup_select')
                .setPlaceholder('Choisir le nombre de jours à rattraper...')
                .addOptions(selectOptions)
        );

    // Boutons de navigation
    const navButtons = [
        new ButtonBuilder()
            .setCustomId('profile_daily_rewards')
            .setLabel('Retour')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
    ];

    // Ajouter le bouton "Réclamer" si l'utilisateur peut claim gratuitement
    if (canClaimToday) {
        navButtons.push(
            new ButtonBuilder()
                .setCustomId('daily_claim')
                .setLabel('Réclamer (gratuit)')
                .setEmoji('🎁')
                .setStyle(ButtonStyle.Success)
        );
    }

    const navRow = new ActionRowBuilder().addComponents(navButtons);

    return interaction.editReply({
        embeds: [embed],
        components: [selectRow, navRow]
    });
}

/**
 * 💰 Acheter un jour manqué
 */
async function handleCatchupBuy(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Extraire le numéro du jour
    const dayNumber = parseInt(interaction.customId.split(':')[1]);

    const player = await db.getPlayerByDiscordId(guildId, userId);
    const theme = await db.getActiveTheme(guildId);

    if (!player || !theme) {
        return interaction.editReply({
            content: '❌ Profil ou thème introuvable.',
            embeds: [],
            components: []
        });
    }

    const currencyConfig = await db.getGuildCurrencyConfig(guildId);
    const calendar = await db.getDailyRewardsCalendar(guildId, theme.id);
    const dayConfig = calendar.find(d => d.day_number === dayNumber);

    // Tenter l'achat
    const result = await db.purchaseCatchupDay(guildId, player.id, theme.id, dayNumber);

    if (!result.success) {
        let errorMessage = '❌ Impossible d\'acheter ce jour.';

        if (result.error === 'DAY_NOT_MISSED') {
            errorMessage = '❌ Ce jour n\'est pas manqué ou a déjà été rattrapé.';
        } else if (result.error === 'INSUFFICIENT_BALANCE') {
            errorMessage = `❌ Solde insuffisant ! Tu as **${result.currentBalance}** ${currencyConfig.display_emoji} mais il te faut **${result.required}** ${currencyConfig.display_emoji}.`;
        } else if (result.error === 'CATCHUP_DISABLED') {
            errorMessage = '❌ Le rattrapage est désactivé pour ce thème.';
        }

        return interaction.editReply({
            content: errorMessage,
            embeds: [],
            components: []
        });
    }

    // Succès ! Donner la récompense via la fonction centralisée
    const rewardResult = await processRewardForPlayer(guildId, player, dayConfig, 'catchup', {
        dayNumber,
        themeId: theme.id
    });

    const rewardMessage = rewardResult.message;
    const mbRarityReceived = rewardResult.type === 'mystery_box' ? rewardResult.rarity : null;

    const embed = new EmbedBuilder()
        .setTitle(`🎉 Jour ${dayNumber} Rattrapé !`)
        .setColor(COLORS.available)
        .setDescription(`Tu as acheté le rattrapage du **Jour ${dayNumber}** pour **${result.pricePaid}** ${currencyConfig.display_emoji}`)
        .addFields({
            name: '🎁 Récompense obtenue',
            value: rewardMessage,
            inline: true
        })
        .addFields({
            name: `${currencyConfig.display_emoji} Nouveau solde`,
            value: `**${result.newBalance.toLocaleString()}** ${currencyConfig.display_emoji}`,
            inline: true
        });

    embed.setFooter(await getLoomixFooter(guildId));
    embed.setTimestamp();

    // Boutons de navigation (sans option d'ouverture directe - via "Mes MysteryBox")
    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('profile_daily_rewards')
                .setLabel('Daily')
                .setEmoji('📅')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('daily_catchup')
                .setLabel('Rattrapage')
                .setEmoji('🔓')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_overview')
                .setLabel('Profil')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [navRow]
    });
}

/**
 * 🛒 Gérer la sélection du nombre de jours à rattraper - AFFICHE CONFIRMATION
 */
async function handleCatchupSelect(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Récupérer le nombre de jours choisis
    const daysCount = parseInt(interaction.values[0]);

    const player = await db.getPlayerByDiscordId(guildId, userId);
    const theme = await db.getActiveTheme(guildId);

    if (!player || !theme) {
        return interaction.editReply({
            content: '❌ Profil ou thème introuvable.',
            embeds: [],
            components: []
        });
    }

    const currencyConfig = await db.getGuildCurrencyConfig(guildId);
    const currency = await db.getPlayerCurrency(guildId, player.id);
    const missedDays = await db.getMissedDays(guildId, player.id, theme.id);

    // Calculer le prix sans acheter
    const priceInfo = await db.calculateCatchupPrice(guildId, theme.id, daysCount, player.id);

    if (!priceInfo.enabled) {
        return interaction.editReply({
            content: '❌ Le rattrapage est désactivé pour ce thème.',
            embeds: [],
            components: []
        });
    }

    // Vérifier le solde
    const hasEnough = currency.balance >= priceInfo.totalPrice;
    const newBalance = currency.balance - priceInfo.totalPrice;

    // Récupérer le nombre de récompenses déjà obtenues (pour numérotation séquentielle)
    const claimedDays = await db.getClaimedDays(guildId, player.id, theme.id);
    const caughtUpDays = await db.getCaughtUpDays(guildId, player.id, theme.id);
    const rewardsObtained = claimedDays.length + caughtUpDays.length;

    // Récupérer les récompenses à obtenir (numérotation séquentielle)
    const rewardsPreview = [];

    for (let i = 0; i < daysCount; i++) {
        const rewardNumber = rewardsObtained + i + 1;
        const reward = await db.getDailyRewardForDay(guildId, theme.id, rewardNumber);
        if (reward) {
            let rewardText = '';
            if (reward.display_name) {
                rewardText = `${reward.display_emoji || '🎁'} ${reward.display_name}`;
            } else if (reward.reward_type === 'currency') {
                rewardText = `💰 ${reward.reward_amount} ${currencyConfig.display_name || 'Loomix'}`;
            } else if (reward.reward_type === 'mystery_box') {
                const rarityLabels = { common: 'Commune', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire' };
                const rarityEmojis = { common: '🔑', rare: '🔑💎', epic: '🔑✨', legendary: '🗝️👑' };
                rewardText = `${rarityEmojis[reward.reward_rarity] || '🔑'} Clé ${rarityLabels[reward.reward_rarity] || reward.reward_rarity}`;
                if (reward.reward_amount > 1) rewardText += ` x${reward.reward_amount}`;
            } else if (reward.reward_type === 'super_bonus_random') {
                rewardText = '🌀 Super Bonus Aléatoire';
            } else {
                rewardText = `🎁 ${reward.reward_type}`;
            }
            rewardsPreview.push(`**${rewardNumber}.** ${rewardText}`);
        } else {
            rewardsPreview.push(`**${rewardNumber}.** ⬜ Non configuré`);
        }
    }

    // Construire l'embed de confirmation
    const embed = new EmbedBuilder()
        .setTitle('🛒 Confirmation de Rattrapage')
        .setColor(hasEnough ? 0xF1C40F : 0xED4245)
        .setDescription(hasEnough
            ? `Tu vas rattraper **${daysCount}** jour${daysCount > 1 ? 's' : ''} manqué${daysCount > 1 ? 's' : ''}.`
            : `⚠️ **Solde insuffisant** pour rattraper ${daysCount} jour${daysCount > 1 ? 's' : ''}.`)
        .addFields(
            {
                name: '💰 Coût total',
                value: `**${priceInfo.totalPrice.toLocaleString()}** ${currencyConfig.display_emoji}`,
                inline: true
            },
            {
                name: '💳 Ton solde actuel',
                value: `**${currency.balance.toLocaleString()}** ${currencyConfig.display_emoji}`,
                inline: true
            },
            {
                name: hasEnough ? '✅ Solde après achat' : '❌ Il te manque',
                value: hasEnough
                    ? `**${newBalance.toLocaleString()}** ${currencyConfig.display_emoji}`
                    : `**${Math.abs(newBalance).toLocaleString()}** ${currencyConfig.display_emoji}`,
                inline: true
            }
        );

    // Détail des prix par jour si plusieurs jours
    if (daysCount > 1 && priceInfo.priceBreakdown && priceInfo.priceBreakdown.length > 0) {
        const priceDetails = priceInfo.priceBreakdown.map((price, i) =>
            `Jour ${i + 1}: **${price.toLocaleString()}** ${currencyConfig.display_emoji}`
        ).join('\n');
        embed.addFields({
            name: '📊 Détail des prix',
            value: priceDetails,
            inline: false
        });
    }

    // Aperçu des récompenses
    if (rewardsPreview.length > 0) {
        embed.addFields({
            name: '🎁 Récompenses à obtenir',
            value: rewardsPreview.join('\n'),
            inline: false
        });
    }

    embed.setFooter(await getLoomixFooter(guildId));
    embed.setTimestamp();

    // Boutons de validation
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`daily_catchup_confirm:${daysCount}`)
                .setLabel(`Valider (${priceInfo.totalPrice.toLocaleString()} ${currencyConfig.currency_name || 'Loomix'})`)
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!hasEnough),
            new ButtonBuilder()
                .setCustomId('daily_catchup_cancel')
                .setLabel('Annuler')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [actionRow]
    });
}

/**
 * ✅ Confirmer et exécuter l'achat de rattrapage
 */
async function handleCatchupConfirm(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Extraire le nombre de jours du customId
    const daysCount = parseInt(interaction.customId.split(':')[1]);

    const player = await db.getPlayerByDiscordId(guildId, userId);
    const theme = await db.getActiveTheme(guildId);

    if (!player || !theme) {
        return interaction.editReply({
            content: '❌ Profil ou thème introuvable.',
            embeds: [],
            components: []
        });
    }

    const currencyConfig = await db.getGuildCurrencyConfig(guildId);

    // Tenter l'achat multiple
    const result = await db.purchaseMultipleCatchupDays(guildId, player.id, theme.id, daysCount);

    if (!result.success) {
        let errorMessage = '❌ Impossible de rattraper ces jours.';

        if (result.error === 'NO_MISSED_DAYS') {
            errorMessage = '✅ Aucun jour à rattraper !';
        } else if (result.error === 'INSUFFICIENT_BALANCE') {
            errorMessage = `❌ Solde insuffisant !\nTu as **${result.currentBalance.toLocaleString()}** ${currencyConfig.display_emoji}\nIl te faut **${result.required.toLocaleString()}** ${currencyConfig.display_emoji}`;
        } else if (result.error === 'CATCHUP_DISABLED') {
            errorMessage = '❌ Le rattrapage est désactivé pour ce thème.';
        }

        return interaction.editReply({
            content: errorMessage,
            embeds: [],
            components: []
        });
    }

    // Succès ! Traiter toutes les récompenses via la fonction centralisée
    const rewardsResults = [];

    for (const r of result.rewards) {
        if (r.reward) {
            const rewardResult = await processRewardForPlayer(guildId, player, r.reward, 'catchup', {
                dayNumber: r.themeDayNumber,
                themeId: theme.id
            });
            rewardsResults.push({
                ...rewardResult,
                themeDayNumber: r.themeDayNumber,
                rewardNumber: r.rewardNumber
            });
        }
    }

    // Construire le résumé des récompenses
    const rewardsSummary = rewardsResults.map(r => {
        return `**J${r.themeDayNumber}** → ${r.message}`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`🎉 ${result.daysCount} Jour${result.daysCount > 1 ? 's' : ''} Rattrapé${result.daysCount > 1 ? 's' : ''} !`)
        .setColor(COLORS.available)
        .setDescription(`Tu as acheté le rattrapage de **${result.daysCount}** jour${result.daysCount > 1 ? 's' : ''} pour **${result.totalPaid.toLocaleString()}** ${currencyConfig.display_emoji}`)
        .addFields(
            {
                name: '💳 Solde avant',
                value: `**${(result.newBalance + result.totalPaid).toLocaleString()}** ${currencyConfig.display_emoji}`,
                inline: true
            },
            {
                name: '💰 Dépensé',
                value: `**-${result.totalPaid.toLocaleString()}** ${currencyConfig.display_emoji}`,
                inline: true
            },
            {
                name: '✅ Solde après',
                value: `**${result.newBalance.toLocaleString()}** ${currencyConfig.display_emoji}`,
                inline: true
            }
        )
        .addFields({
            name: '🎁 Récompenses obtenues',
            value: rewardsSummary || 'Aucune récompense',
            inline: false
        });

    embed.setFooter(await getLoomixFooter(guildId));
    embed.setTimestamp();

    // Boutons de navigation
    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('profile_daily_rewards')
                .setLabel('Daily')
                .setEmoji('📅')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('daily_catchup')
                .setLabel('Rattrapage')
                .setEmoji('🔓')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_overview')
                .setLabel('Profil')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );

    return interaction.editReply({
        embeds: [embed],
        components: [navRow]
    });
}

module.exports = {
    handleDailyClaimInteraction,
    showDailyRewards,
    handleClaim,
    handleShowCalendar,
    handleShowRewardsList,
    handleShowCatchup,
    handleCatchupBuy,
    handleCatchupSelect,
    handleCatchupConfirm,
    getRewardEmoji
};
