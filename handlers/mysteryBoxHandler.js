const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } = require('discord.js');
const db = require('../utils/database-pg');
const announcements = require('../utils/announcements');
const superBonusHandler = require('./superBonusHandler');
const themeExpirationHandler = require('./themeExpirationHandler');
const badgeHandler = require('./badgeHandler');
const progressionRoleHandler = require('./progressionRoleHandler');
const { SUPER_ADMINS } = require('../utils/permissions');
const { getLoomixFooter, getLoomixFooterWithCustomText } = require('../utils/footerHelper');

/**
 * Handler pour le système de boîte mystère
 */
class MysteryBoxHandler {

  /**
   * Créer et poster une boîte mystère
   * @param {Channel} channel - Salon où poster
   * @param {number} themeId - ID du thème
   * @param {string} mode - Mode de lancement (optionnel): 'mystery_box', 'mission', 'trap', 'super_bonus', 'collectible'
   * @param {number} itemId - ID de l'item spécifique (optionnel)
   * @param {string} guildId - ID du serveur Discord (requis pour multi-serveur)
   * @returns {Message} Message de la boîte mystère
   */
  async createMysteryBox(channel, themeId, mode = null, itemId = null, guildId = null) {
    // Récupérer le guildId si non fourni
    guildId = guildId || channel.guild.id;

    // Récupérer le thème, sa config et le branding avec guild_id
    const [theme, config, branding] = await Promise.all([
      db.queryOne('SELECT * FROM themes WHERE id = $1 AND guild_id = $2', [themeId, guildId]),
      db.getThemeConfig(guildId, themeId),
      db.getGuildBranding(guildId)
    ]);

    if (!theme || !config) {
      throw new Error('Thème ou configuration introuvable');
    }

    // ✨ Vérifier l'expiration du thème avant de créer la boîte
    const expirationCheck = await themeExpirationHandler.checkBeforeLaunch(guildId, themeId);
    if (!expirationCheck.valid) {
      throw new Error(`Impossible de créer la boîte mystère: ${expirationCheck.reason}`);
    }

    // Tirer aléatoirement le contenu selon les probabilités (ou forcer un item spécifique)
    const content = await this.rollMysteryContent(guildId, themeId, config, mode, itemId);

    // Créer l'embed de boîte mystère (uniforme pour tous)
    const embed = new EmbedBuilder()
      .setTitle(config.mystery_box_title || '🎁 BOÎTE MYSTÉRIEUSE')
      .setDescription(
        config.mystery_box_description ||
        'Une boîte mystérieuse apparaît !\n\n' +
        '**Que contient-elle ?**\n' +
        '• Un collectible ? 🎭\n' +
        '• Une mission ? 📋\n' +
        '• Un piège ? ⚠️\n\n' +
        'Premier arrivé, premier servi !'
      )
      .setColor(branding.secondary_color)
      .setFooter(await getLoomixFooter(guildId))
      .setTimestamp();

    // Ajouter l'image si configurée
    if (config.mystery_box_image) {
      embed.setImage(config.mystery_box_image);
    }

    // Créer le bouton
    const button = new ButtonBuilder()
      .setCustomId(`mystery_open_${content.type}_${content.id}`)
      .setLabel('🎯 Ouvrir la boîte')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    // Poster le message (SILENCIEUX - pas de notifications push)
    const message = await channel.send({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.SuppressNotifications
    });

    // Logger le give
    await db.logGive(guildId, content.type, content.id, message.id, channel.id);

    console.log(`✅ Boîte mystère créée: ${content.type} (ID: ${content.id})`);

    return message;
  }

  /**
   * Sélectionner un super bonus aléatoire avec pondération par rareté
   * @param {string} guildId - ID du serveur Discord
   * @param {object} config - Configuration du thème (pour probabilités rareté - FUTUR)
   * @returns {object|null} Super bonus sélectionné ou null si aucun disponible
   */
  async selectSuperBonus(guildId, config = null) {
    console.log(`🎁 [SUPER BONUS] Sélection d'un super bonus pour guild ${guildId}...`);

    // Récupérer tous les super bonuses disponibles ET ACTIVÉS
    const bonuses = await db.queryAll(`
      SELECT id, bonus_id, name, rarity, icon, description,
             duration_type, duration_value, effect_type
      FROM super_bonuses
      WHERE guild_id = $1 AND is_enabled = TRUE
      ORDER BY rarity DESC, name
    `, [guildId]);

    if (!bonuses || bonuses.length === 0) {
      console.error('❌ Aucun super bonus disponible pour guild', guildId);
      return null;
    }

    console.log(`📊 ${bonuses.length} super bonuses trouvés`);

    // Pourcentages par rareté depuis la config DB
    const percentages = {
      legendary: config?.super_bonus_rarity_legendary || 5,
      epic: config?.super_bonus_rarity_epic || 10,
      rare: config?.super_bonus_rarity_rare || 20,
      common: config?.super_bonus_rarity_common || 40
    };

    console.log(`🎲 Pourcentages rareté super bonuses:`, percentages);

    // Grouper les bonuses par rareté
    const byRarity = {
      legendary: bonuses.filter(b => b.rarity === 'legendary'),
      epic: bonuses.filter(b => b.rarity === 'epic'),
      rare: bonuses.filter(b => b.rarity === 'rare'),
      common: bonuses.filter(b => b.rarity === 'common')
    };

    console.log(`📊 Distribution: ${byRarity.legendary.length} legendary, ${byRarity.epic.length} epic, ${byRarity.rare.length} rare, ${byRarity.common.length} common`);

    // Sélection de la rareté basée sur les pourcentages
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedRarity = 'common';

    if (rand < (cumulative += percentages.legendary) && byRarity.legendary.length > 0) {
      selectedRarity = 'legendary';
    } else if (rand < (cumulative += percentages.epic) && byRarity.epic.length > 0) {
      selectedRarity = 'epic';
    } else if (rand < (cumulative += percentages.rare) && byRarity.rare.length > 0) {
      selectedRarity = 'rare';
    } else if (byRarity.common.length > 0) {
      selectedRarity = 'common';
    } else {
      // Fallback: si la rareté sélectionnée n'a pas d'items, prendre n'importe quel bonus
      const allAvailable = [...byRarity.legendary, ...byRarity.epic, ...byRarity.rare, ...byRarity.common];
      if (allAvailable.length > 0) {
        const fallbackBonus = allAvailable[Math.floor(Math.random() * allAvailable.length)];
        console.log(`✅ Fallback - Super bonus sélectionné: ${fallbackBonus.icon} ${fallbackBonus.name} (${fallbackBonus.rarity})`);
        return fallbackBonus;
      }
    }

    // Sélection uniforme parmi les bonuses de la rareté choisie
    const bonusesOfRarity = byRarity[selectedRarity];
    const selected = bonusesOfRarity[Math.floor(Math.random() * bonusesOfRarity.length)];

    console.log(`✅ Rareté sélectionnée: ${selectedRarity} (roll: ${rand.toFixed(2)})`);
    console.log(`   Super bonus: ${selected.icon} ${selected.name}`);
    console.log(`   Duration: ${selected.duration_type} = ${selected.duration_value}`);
    console.log(`   Effect: ${selected.effect_type}`);

    return selected;
  }

  /**
   * Sélectionner un collectible de manière pondérée selon la rareté
   * @param {array} collectibles - Liste des collectibles disponibles
   * @param {object} config - Configuration du thème (contient les pourcentages par rareté)
   * @param {object} customPercentages - Pourcentages personnalisés (optionnel, pour boost Aimant à Légendaires)
   * @returns {object} Collectible sélectionné
   */
  selectCollectibleWeighted(collectibles, config, customPercentages = null) {
    // Utiliser les percentages personnalisés (boostés) ou la config par défaut
    const percentages = customPercentages || {
      legendary: config.collectible_rarity_legendary || 5,
      epic: config.collectible_rarity_epic || 10,
      rare: config.collectible_rarity_rare || 20,
      common: config.collectible_rarity_common || 40
    };

    console.log(`🎲 Pourcentages rareté collectibles:`, percentages);

    // Grouper les collectibles par rareté
    const byRarity = {
      legendary: collectibles.filter(c => c.rarity === 'legendary'),
      epic: collectibles.filter(c => c.rarity === 'epic'),
      rare: collectibles.filter(c => c.rarity === 'rare'),
      common: collectibles.filter(c => c.rarity === 'common')
    };

    console.log(`📊 Distribution: ${byRarity.legendary.length} legendary, ${byRarity.epic.length} epic, ${byRarity.rare.length} rare, ${byRarity.common.length} common`);

    // Sélection de la rareté basée sur les pourcentages
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedRarity = 'common';

    if (rand < (cumulative += percentages.legendary) && byRarity.legendary.length > 0) {
      selectedRarity = 'legendary';
    } else if (rand < (cumulative += percentages.epic) && byRarity.epic.length > 0) {
      selectedRarity = 'epic';
    } else if (rand < (cumulative += percentages.rare) && byRarity.rare.length > 0) {
      selectedRarity = 'rare';
    } else if (byRarity.common.length > 0) {
      selectedRarity = 'common';
    } else {
      // Fallback: si la rareté sélectionnée n'a pas d'items, prendre n'importe quel item
      const allAvailable = [...byRarity.legendary, ...byRarity.epic, ...byRarity.rare, ...byRarity.common];
      if (allAvailable.length > 0) {
        return allAvailable[Math.floor(Math.random() * allAvailable.length)];
      }
    }

    // Sélection uniforme parmi les items de la rareté choisie
    const itemsOfRarity = byRarity[selectedRarity];
    const selected = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];

    console.log(`✅ Rareté sélectionnée: ${selectedRarity} (roll: ${rand.toFixed(2)})`);
    console.log(`   Collectible: ${selected.name}`);

    return selected;
  }

  /**
   * Tirer aléatoirement le contenu de la boîte
   * @param {string} guildId - ID du serveur Discord
   * @param {number} themeId - ID du thème
   * @param {object} config - Configuration du thème
   * @param {string} mode - Mode forcé (optionnel): 'mystery_box', 'mission', 'trap', 'super_bonus', 'collectible'
   * @param {number} itemId - ID de l'item spécifique (optionnel)
   * @param {string} userId - ID Discord du joueur (pour appliquer les bonus)
   * @returns {object} {type, id, item}
   */
  async rollMysteryContent(guildId, themeId, config, mode = null, itemId = null, userId = null) {
    let type, items, item;

    console.log(`🔍 [MYSTERY BOX] rollMysteryContent appelé avec mode="${mode}", itemId="${itemId}"`);

    // Si un mode spécifique est demandé et qu'un itemId est fourni, forcer cet item
    if (mode && itemId) {
      // Convertir le mode en type
      const modeToType = {
        'mystery_box': null, // Mystery box classique utilise les probabilités
        'mission': 'mission',
        'trap': 'trap',
        'super_bonus': 'super_bonus',
        'collectible': 'collectible'
      };

      type = modeToType[mode];
      console.log(`🔍 [MYSTERY BOX] Mode trouvé dans modeToType: type="${type}"`);

      if (!type) {
        // Si mode est 'mystery_box', utiliser le système de probabilités normal ci-dessous
        mode = null;
        itemId = null;
      } else {
        // Récupérer l'item spécifique avec guild_id
        if (type === 'collectible') {
          item = await db.queryOne('SELECT * FROM collectibles WHERE id = $1 AND guild_id = $2', [itemId, guildId]);
        } else if (type === 'mission') {
          item = await db.queryOne('SELECT * FROM missions WHERE id = $1 AND guild_id = $2', [itemId, guildId]);
        } else if (type === 'trap') {
          item = await db.queryOne('SELECT * FROM traps WHERE id = $1 AND guild_id = $2', [itemId, guildId]);
        } else if (type === 'super_bonus') {
          item = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1 AND guild_id = $2', [itemId, guildId]);
        }

        if (!item) {
          throw new Error(`Item ${type} avec l'ID ${itemId} introuvable`);
        }

        return { type, id: item.id, item };
      }
    }

    // Système de probabilités classique (utilisé si mode = null ou mode = 'mystery_box')
    const rand = Math.floor(Math.random() * 100) + 1; // 1-100

    const probCollectible = config.probability_collectible;
    const probMission = config.probability_mission;
    const probTrap = config.probability_trap;
    const probSuperBonus = config.probability_super_bonus || 0; // NOUVEAU - Fallback à 0 si pas défini

    console.log(`🎲 Roll: ${rand} | Collectible: 1-${probCollectible} | Mission: ${probCollectible + 1}-${probCollectible + probMission} | Trap: ${probCollectible + probMission + 1}-${probCollectible + probMission + probTrap} | Super Bonus: ${probCollectible + probMission + probTrap + 1}-100`);

    // Déterminer le type selon les probabilités (4 types maintenant)
    if (rand <= probCollectible) {
      // COLLECTIBLE
      type = 'collectible';
      items = await db.getCollectiblesByTheme(guildId, themeId);

    } else if (rand <= probCollectible + probMission) {
      // MISSION
      type = 'mission';
      items = await db.getMissionsByTheme(guildId, themeId);

    } else if (rand <= probCollectible + probMission + probTrap) {
      // PIÈGE
      type = 'trap';
      items = await db.getTrapsByTheme(guildId, themeId); // Récupère seulement les pièges actifs

    } else {
      // SUPER BONUS (nouveau - reste des 100%)
      type = 'super_bonus';

      // Appeler selectSuperBonus() qui fait la sélection pondérée par rareté
      const selectedBonus = await this.selectSuperBonus(guildId, config);

      if (!selectedBonus) {
        console.error('❌ Aucun super bonus disponible, redistribution...');
        // Redistribuer vers un autre type
        items = null;
      } else {
        // Retourner directement le bonus (pas besoin de random selection après)
        console.log(`✅ Super bonus tiré: ${selectedBonus.name} (${selectedBonus.rarity})`);
        return { type: 'super_bonus', id: selectedBonus.id, item: selectedBonus };
      }
    }

    // Si le type sélectionné n'a pas d'items disponibles, redistribuer
    if (!items || items.length === 0) {
      console.warn(`⚠️ Aucun ${type} disponible, redistribution automatique...`);

      // Créer une liste des types disponibles avec items
      const availableTypes = [];

      const collectibles = await db.getCollectiblesByTheme(guildId, themeId);
      if (collectibles && collectibles.length > 0) {
        availableTypes.push({ type: 'collectible', items: collectibles });
      }

      const missions = await db.getMissionsByTheme(guildId, themeId);
      if (missions && missions.length > 0) {
        availableTypes.push({ type: 'mission', items: missions });
      }

      const traps = await db.getTrapsByTheme(guildId, themeId);
      if (traps && traps.length > 0) {
        availableTypes.push({ type: 'trap', items: traps });
      }

      // Pour super_bonus, vérifier qu'au moins 1 est activé
      const hasSuperBonuses = await db.queryOne('SELECT COUNT(*) as count FROM super_bonuses WHERE guild_id = $1 AND is_enabled = TRUE', [guildId]);
      if (hasSuperBonuses && parseInt(hasSuperBonuses.count) > 0) {
        // On met un placeholder, selectSuperBonus() sera appelé si ce type est choisi
        availableTypes.push({ type: 'super_bonus', items: [{ id: 'placeholder' }] });
      }

      // Si aucun type n'a d'items, erreur
      if (availableTypes.length === 0) {
        throw new Error(`Aucun contenu disponible (collectibles, missions, pièges ou super bonuses) pour le thème ${themeId}`);
      }

      // Sélectionner un type aléatoire parmi ceux disponibles
      const selected = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      type = selected.type;
      items = selected.items;

      console.log(`✅ Redistribution vers: ${type}`);

      // Si redistribution vers super_bonus, appeler selectSuperBonus() directement
      if (type === 'super_bonus') {
        const selectedBonus = await this.selectSuperBonus(guildId, config);
        if (selectedBonus) {
          console.log(`✅ Super bonus redistribué: ${selectedBonus.name}`);
          return { type: 'super_bonus', id: selectedBonus.id, item: selectedBonus };
        } else {
          throw new Error('Redistribution vers super_bonus échouée: aucun bonus disponible');
        }
      }
    }

    // Sélectionner un item du type
    if (type === 'collectible') {
      // 🧲 Appliquer Aimant à Légendaires si le joueur l'a actif
      let customPercentages = null;
      let rarityBoostInfo = null;

      if (userId) {
        const boostResult = await superBonusHandler.applyCollectibleRarityBoost(
          guildId,
          userId,
          {
            legendary: config.collectible_rarity_legendary || 5,
            epic: config.collectible_rarity_epic || 10,
            rare: config.collectible_rarity_rare || 20,
            common: config.collectible_rarity_common || 40
          }
        );

        if (boostResult.hasBoost) {
          customPercentages = boostResult.percentages;
          rarityBoostInfo = boostResult.boost;
          console.log(`🧲 [AIMANT] Boost appliqué pour ${userId}: ${rarityBoostInfo.target} ${rarityBoostInfo.original}% → ${rarityBoostInfo.normalized}%`);
        }
      }

      // Sélection pondérée par rareté pour les collectibles
      item = this.selectCollectibleWeighted(items, config, customPercentages);
      console.log(`🎯 Collectible sélectionné (pondéré): ${item.name} (${item.rarity})`);
    } else {
      // Sélection uniforme pour missions et pièges (pas de rareté)
      item = items[Math.floor(Math.random() * items.length)];
    }

    return { type, id: item.id, item };
  }

  /**
   * Gérer l'ouverture de la boîte (clic sur le bouton)
   * @param {ButtonInteraction} interaction
   */
  async handleMysteryBoxOpen(interaction) {
    // Format: mystery_open_TYPE_ID
    // où TYPE peut contenir des underscores (ex: super_bonus)
    const customIdParts = interaction.customId.split('_');
    // Le dernier élément est toujours l'ID
    const itemId = customIdParts[customIdParts.length - 1];
    // Tout entre "open" et l'ID est le type
    const type = customIdParts.slice(2, -1).join('_');

    console.log(`🔍 [MYSTERY BOX] Ouverture demandée - customId: ${interaction.customId}`);
    console.log(`🔍 [MYSTERY BOX] Type: ${type}, ItemId: ${itemId}`);

    // Defer immédiatement pour éviter timeout
    await interaction.deferUpdate();

    // VÉRIFIER SI LA BOÎTE A DÉJÀ ÉTÉ OUVERTE (protection contre les clics multiples)
    const giveLog = await db.query(
      `SELECT * FROM give_logs WHERE message_id = $1`,
      [interaction.message.id]
    );

    if (giveLog.length > 0 && giveLog[0].winner_id) {
      // La boîte a déjà été ouverte par quelqu'un d'autre
      return interaction.followUp({
        content: `⚠️ Trop tard ! Cette boîte a déjà été ouverte par <@${giveLog[0].winner_id}>`,
        flags: 64
      });
    }

    // Vérifier le cooldown du joueur
    const player = await db.upsertPlayer(interaction.guildId, interaction.user.id, interaction.user.username);
    const hasCooldown = await db.hasActiveCooldown(interaction.guildId, player.id);

    if (hasCooldown) {
      // NE PAS éditer le message original (sinon le bouton disparaît pour tout le monde)
      // Juste envoyer un message d'erreur éphémère
      return interaction.followUp({
        content: '⏰ Tu es sous l\'effet d\'un piège ! Tu ne peux pas encore ouvrir de boîtes.',
        flags: 64
      });
    }

    // MARQUER IMMÉDIATEMENT LA BOÎTE COMME GAGNÉE (avant le traitement long)
    await db.updateGiveWinner(interaction.message.id, interaction.user.id, interaction.user.username);

    // Récupérer le thème et sa config pour le message de félicitations
    const theme = await db.getActiveTheme(interaction.guildId);
    const config = await db.getThemeConfig(interaction.guildId, theme.id);

    // Rollér le contenu pour cette boîte
    const content = await this.rollMysteryContent(interaction.guildId, theme.id, config, type, itemId, interaction.user.id);

    // 👁️ VISION DIVINE - Vérifier si le joueur a le bonus actif
    const visionDivineResult = await superBonusHandler.checkAndRevealVisionDivine(
      interaction.user.id,
      interaction.guildId,
      content,
      interaction.message.id
    );

    if (visionDivineResult) {
      console.log(`👁️ [VISION DIVINE] Révélation envoyée au joueur ${interaction.user.tag}`);
      // Révélation avec choix accept/decline - NE PAS continuer le flow normal
      return interaction.followUp({
        ...visionDivineResult,
        flags: 64 // Ephemeral
      });
    }

    // Pas de Vision Divine, continuer le flow normal avec le contenu rollé

    // Message personnalisé ou par défaut
    const winnerMessage = config?.mystery_box_winner_message ||
      '🎉 **{player}** a ouvert la boîte mystère !';

    // GIF de célébration (personnalisable)
    const celebrationGif = config?.mystery_box_celebration_gif ||
      'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif';

    // Emojis pour les réactions (personnalisables)
    const celebrationEmojis = config?.mystery_box_celebration_emojis
      ? config.mystery_box_celebration_emojis.split(',').map(e => e.trim())
      : ['🎉', '🎊', '✨', '🌟'];

    // Récupérer le branding
    const branding = await db.getGuildBranding(interaction.guildId);

    // Créer des confettis décoratifs
    const confettiLine = celebrationEmojis.slice(0, 3).join(' ').repeat(2);

    // Créer l'embed de félicitations stylisé
    const winnerEmbed = new EmbedBuilder()
      .setTitle(`${celebrationEmojis[0]} FÉLICITATIONS ! ${celebrationEmojis[0]}`)
      .setDescription(`${confettiLine}\n\n${winnerMessage.replace('{player}', `<@${interaction.user.id}>`)}\n\n${confettiLine}`)
      .setColor(branding.secondary_color)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setImage(celebrationGif) // GIF de célébration
      .setFooter(await getLoomixFooter(interaction.guildId))
      .setTimestamp();

    // Transformer le message de la box pour afficher le gagnant
    const updatedMessage = await interaction.editReply({
      embeds: [winnerEmbed],
      components: []
    });

    // Ajouter des réactions automatiques au message pour l'effet festif
    try {
      for (const emoji of celebrationEmojis) {
        await updatedMessage.react(emoji).catch(() => {}); // Ignore les erreurs d'emojis invalides
      }
    } catch (error) {
      console.warn('⚠️ Impossible d\'ajouter des réactions:', error.message);
    }

    // Auto-suppression du message de félicitation après 10 secondes (si activé)
    if (config.auto_delete_celebration_message) {
      console.log('🗑️ [MYSTERY BOX] Suppression auto activée - Message sera supprimé dans 10 secondes');
      setTimeout(async () => {
        try {
          await updatedMessage.delete();
          console.log('✅ [MYSTERY BOX] Message de félicitation supprimé');
        } catch (error) {
          console.warn('⚠️ [MYSTERY BOX] Impossible de supprimer le message:', error.message);
        }
      }, 10000); // 10 secondes
    }

    // Révéler le contenu selon le type (utilise le content déjà rollé)
    console.log(`🔍 [MYSTERY BOX] Switch statement - content.type="${content.type}", content.id="${content.id}"`);

    switch (content.type) {
      case 'collectible':
        console.log('🎁 [MYSTERY BOX] Case collectible atteint');
        await this.revealCollectible(interaction, parseInt(content.id), player);
        break;

      case 'mission':
        console.log('📋 [MYSTERY BOX] Case mission atteint');
        await this.revealMission(interaction, parseInt(content.id), player);
        break;

      case 'trap':
        console.log('⚠️ [MYSTERY BOX] Case trap atteint');
        await this.revealTrap(interaction, parseInt(content.id), player);
        break;

      case 'super_bonus':
        console.log('✨ [MYSTERY BOX] Case super_bonus atteint - Appel revealSuperBonus()');
        await this.revealSuperBonus(interaction, parseInt(content.id), player);
        console.log('✨ [MYSTERY BOX] revealSuperBonus() terminé');
        break;

      default:
        console.error(`❌ [MYSTERY BOX] Type inconnu: "${content.type}"`);
    }

    // 🏆 BADGE TRACKING - Mystery Box Opened
    try {
      await badgeHandler.onMysteryBoxOpened(interaction.guildId, player.id, interaction.client);
      console.log(`🏆 [BADGES] Mystery Box badge tracking appelé pour player ${player.id}`);
    } catch (error) {
      console.error('🔴 [BADGES] Erreur tracking mystery box:', error);
    }

    // Le gagnant a déjà été enregistré au début de la fonction (ligne 244)
    // pour éviter les clics multiples
  }

  /**
   * Révéler un collectible
   */
  async revealCollectible(interaction, collectibleId, player) {
    const [collectible, branding] = await Promise.all([
      db.getCollectibleById(interaction.guildId, collectibleId),
      db.getGuildBranding(interaction.guildId)
    ]);

    if (!collectible) {
      return interaction.followUp({
        content: '❌ Collectible introuvable.',
        flags: 64
      });
    }

    // 💰 JACKPOT X2 - Vérifier si le joueur a le bonus actif AVANT le check doublon
    const jackpotBonus = await superBonusHandler.hasMultiplierBonus(
      interaction.guildId,
      interaction.user.id,
      'collectible'
    );

    let bonusCollectible = null;

    if (jackpotBonus) {
      console.log(`💰 [JACKPOT X2] Bonus actif pour ${interaction.user.tag} - Charge restante: ${jackpotBonus.remaining_charges}`);

      // Récupérer TOUS les collectibles du thème actif avec required_items
      const allCollectibles = await db.query(
        `SELECT c.*, t.required_items
         FROM collectibles c
         JOIN themes t ON c.theme_id = t.id
         WHERE c.guild_id = $1 AND c.theme_id = $2`,
        [interaction.guildId, collectible.theme_id]
      );

      // Filtrer pour obtenir un collectible DIFFÉRENT du principal (doublons acceptés)
      const availableCollectibles = allCollectibles.filter(c => c.id !== collectibleId);

      if (availableCollectibles.length > 0) {
        // Tirer un collectible au hasard (uniforme, pas de rareté pondérée)
        bonusCollectible = availableCollectibles[Math.floor(Math.random() * availableCollectibles.length)];

        console.log(`💰 [JACKPOT X2] Collectible bonus tiré: ${bonusCollectible.name} (${bonusCollectible.rarity})`);
      } else {
        console.log(`💰 [JACKPOT X2] Impossible de tirer un collectible différent (un seul collectible existe dans le thème)`);
      }
    }

    // Vérifier si le bonus est un doublon
    let bonusIsDuplicate = false;
    if (bonusCollectible) {
      bonusIsDuplicate = await db.hasCollectible(interaction.guildId, player.id, bonusCollectible.id);
      if (bonusIsDuplicate) {
        console.log(`⚠️ [JACKPOT X2] Bonus collectible est un doublon: ${bonusCollectible.name}`);
      }
    }

    // Vérifier si le joueur a déjà le collectible PRINCIPAL
    const alreadyHas = await db.hasCollectible(interaction.guildId, player.id, collectibleId);

    // Variables pour progression
    let progress = null;

    if (alreadyHas) {
      console.log(`⚠️ [DOUBLON] Le joueur a déjà ${collectible.name}, mais Jackpot x2 ${bonusCollectible ? 'actif' : 'inactif'}`);

      // Si Jackpot x2 actif, ajouter quand même le collectible bonus et consommer la charge
      if (bonusCollectible) {
        await db.addCollectible(interaction.guildId, player.id, bonusCollectible.id, 'mystery_box');
        progress = await db.incrementProgress(interaction.guildId, player.id, bonusCollectible.theme_id);

        // Consommer une charge du bonus
        await superBonusHandler.consumeBonusCharge(
          interaction.guildId,
          interaction.user.id,
          jackpotBonus.id
        );

        console.log(`💰 [JACKPOT X2] Charge consommée - Restant: ${jackpotBonus.remaining_charges - 1}`);
        console.log(`💰 [JACKPOT X2] Progression bonus: ${progress.collected_count}/${bonusCollectible.required_items}`);
      }

      // Message doublon avec mention du bonus si applicable
      const rarityEmojis = {
        legendary: '🌟',
        epic: '💎',
        rare: '💙',
        common: '⚪'
      };

      const rarityColors = {
        legendary: '#FFD700',
        epic: '#9B59B6',
        rare: '#3498DB',
        common: '#95A5A6'
      };

      let description = `Tu as déjà **${collectible.name}** dans ta collection !`;

      if (bonusCollectible) {
        description += `\n\n💰 **Mais grâce au Jackpot x2, tu as reçu un collectible bonus !**`;
      }

      const embed = new EmbedBuilder()
        .setTitle(bonusCollectible ? '🎉 Félicitations !' : '⚠️ Doublon !')
        .setDescription(description)
        .setColor(bonusCollectible ? rarityColors[bonusCollectible.rarity] : branding.secondary_color)
        .setThumbnail(collectible.image_url)
        .setFooter(await getLoomixFooter(interaction.guildId));

      if (bonusCollectible) {
        embed.addFields({
          name: `💰 ${rarityEmojis[bonusCollectible.rarity]} ${bonusCollectible.name} *(BONUS${bonusIsDuplicate ? ' - ⚠️ DOUBLON' : ''})*`,
          value: `┗━ Rareté: **${bonusCollectible.rarity.toUpperCase()}**\n┗━ Progression: **${progress?.collected_count || '?'}/${bonusCollectible.required_items}**\n┗━ Charges restantes: **${jackpotBonus.remaining_charges - 1}**`,
          inline: false
        });
        embed.setImage(bonusCollectible.image_url);
      }

      return interaction.followUp({ embeds: [embed], flags: 64 });
    }

    // Pas de doublon: ajouter le collectible principal
    await db.addCollectible(interaction.guildId, player.id, collectibleId, 'mystery_box');
    progress = await db.incrementProgress(interaction.guildId, player.id, collectible.theme_id);

    // Si Jackpot x2 actif, ajouter aussi le collectible bonus
    if (bonusCollectible) {
      await db.addCollectible(interaction.guildId, player.id, bonusCollectible.id, 'mystery_box');

      // Consommer une charge du bonus
      await superBonusHandler.consumeBonusCharge(
        interaction.guildId,
        interaction.user.id,
        jackpotBonus.id
      );

      console.log(`💰 [JACKPOT X2] Charge consommée - Restant: ${jackpotBonus.remaining_charges - 1}`);
    }

    // Message de révélation
    let description = collectible.reveal_message ||
      `Félicitations ! Tu as trouvé **${collectible.name}** !`;

    if (bonusCollectible) {
      description += `\n\n💰 **JACKPOT X2 ACTIVÉ !**\n` +
        `Tu as également reçu **${bonusCollectible.name}** (${bonusCollectible.rarity}) en bonus !`;

      if (bonusIsDuplicate) {
        description += ` ⚠️ **DOUBLON**`;
      }
    }

    // Créer un embed moderne
    const rarityEmojis = {
      legendary: '🌟',
      epic: '💎',
      rare: '💙',
      common: '⚪'
    };

    const rarityColors = {
      legendary: '#FFD700', // Or
      epic: '#9B59B6',      // Violet
      rare: '#3498DB',      // Bleu
      common: '#95A5A6'     // Gris
    };

    const embed = new EmbedBuilder()
      .setTitle(`${bonusCollectible ? '💰 JACKPOT X2 ACTIVÉ !' : '🎉 Collectible Obtenu !'}`)
      .setDescription(description)
      .setColor(collectible.role_color || rarityColors[collectible.rarity] || branding.secondary_color)
      .setThumbnail(collectible.image_url);

    // Collectible principal
    embed.addFields({
      name: `${rarityEmojis[collectible.rarity]} ${collectible.name}`,
      value: `┗━ Rareté: **${collectible.rarity.toUpperCase()}**\n┗━ Progression: **${progress.collected_count}/${collectible.required_items}**`,
      inline: false
    });

    // Collectible bonus si Jackpot x2 activé
    if (bonusCollectible) {
      embed.addFields({
        name: `💰 ${rarityEmojis[bonusCollectible.rarity]} ${bonusCollectible.name} *(BONUS${bonusIsDuplicate ? ' - ⚠️ DOUBLON' : ''})*`,
        value: `┗━ Rareté: **${bonusCollectible.rarity.toUpperCase()}**\n┗━ Charges restantes: **${jackpotBonus.remaining_charges - 1}**`,
        inline: false
      });

      // Image du collectible bonus
      embed.setImage(bonusCollectible.image_url);
    }

    embed.setFooter(getLoomixFooterWithCustomText(`${bonusCollectible ? '2 collectibles obtenus !' : `Rareté: ${collectible.rarity}`}`))
      .setTimestamp();

    await interaction.followUp({ embeds: [embed], flags: 64 });

    // Annonce si collectible légendaire
    if (collectible.rarity === 'legendary') {
      await announcements.announceLegendaryCollectible(
        interaction.client,
        interaction.guildId,
        interaction.user.username,
        collectible.name,
        collectible.image_url
      );
    }

    // Vérifier si collection complète
    if (progress.collected_count >= collectible.required_items && !progress.is_completed) {
      await this.handleCollectionComplete(interaction, player, collectible);
    }

    // 🏆 BADGE TRACKING - Collectible Found
    try {
      await badgeHandler.onCollectibleFound(interaction.guildId, player.id, collectible.rarity, interaction.client);
      console.log(`🏆 [BADGES] Collectible badge tracking appelé pour player ${player.id}`);
    } catch (error) {
      console.error('🔴 [BADGES] Erreur tracking collectible:', error);
    }

    // 🏅 PROGRESSION ROLES - Vérifier et attribuer rôles intermédiaires
    try {
      const newProgressionRole = await progressionRoleHandler.checkAndAssignProgressionRoles(
        interaction.guild,
        interaction.user.id,
        interaction.guildId,
        collectible.theme_id,
        progress.collected_count
      );
      if (newProgressionRole) {
        console.log(`🏅 [PROGRESSION] Nouveau rôle attribué: ${newProgressionRole.name}`);
        // Envoyer une notification au joueur
        await interaction.followUp({
          content: `🎉 **Félicitations !** Tu as atteint **${newProgressionRole.percentage}%** de la collection et obtenu le rôle **${newProgressionRole.name}** !`,
          flags: 64
        });
      }
    } catch (error) {
      console.error('🔴 [PROGRESSION] Erreur check progression roles:', error);
    }
  }

  /**
   * Révéler une mission
   */
  async revealMission(interaction, missionId, player) {
    const [mission, branding] = await Promise.all([
      db.getMissionById(interaction.guildId, missionId),
      db.getGuildBranding(interaction.guildId)
    ]);

    if (!mission) {
      return interaction.followUp({
        content: '❌ Mission introuvable.',
        flags: 64
      });
    }

    // Créer un thread privé pour la mission
    const thread = await interaction.channel.threads.create({
      name: `Mission Secrète - ${interaction.user.username}`,
      autoArchiveDuration: 1440,
      type: ChannelType.PrivateThread,
      reason: `Mission secrète pour ${interaction.user.username}`
    });

    // Ajouter le joueur
    await thread.members.add(interaction.user.id);

    // Récupérer les préférences de notification
    const notifySettings = await db.getMissionNotificationSettings(interaction.guildId);

    // Ajouter les super-admins (si activé)
    if (notifySettings.superAdminsThread) {
      for (const adminId of SUPER_ADMINS) {
        try {
          await thread.members.add(adminId);
        } catch (e) {
          // Ignore si le super-admin n'est pas sur le serveur
        }
      }
    }

    // Ajouter le propriétaire du serveur (si activé)
    if (notifySettings.ownerThread) {
      try {
        await thread.members.add(interaction.guild.ownerId);
      } catch (e) {
        console.warn(`⚠️ Impossible d'ajouter le propriétaire au thread`);
      }
    }

    // Message de révélation dans le salon public
    const revealEmbed = new EmbedBuilder()
      .setTitle('📋 MISSION DÉBLOQUÉE !')
      .setDescription(`Tu as déclenché une mission secrète !\n\nUn thread privé a été créé pour toi. Consulte-le pour découvrir ta mission !`)
      .setColor(branding.secondary_color)
      .setImage('https://media.giphy.com/media/xT9IgBwI5SLzZGV2PC/giphy.gif')
      .setFooter(await getLoomixFooter(interaction.guildId));

    await interaction.followUp({ embeds: [revealEmbed], flags: 64 });

    // Message mystérieux dans le thread
    // Convertir le timeout en unité appropriée
    const timeoutSeconds = mission.timeout || 300;
    const timeoutDisplay = timeoutSeconds >= 60 && timeoutSeconds % 60 === 0
      ? `${timeoutSeconds / 60} minute${timeoutSeconds / 60 > 1 ? 's' : ''}`
      : `${timeoutSeconds} seconde${timeoutSeconds > 1 ? 's' : ''}`;

    // Message générique qui ne révèle PAS le type de mission
    const msgConfig = {
      title: '🎯 MISSION SECRÈTE !',
      description: `Une mission mystérieuse t'attend, **${interaction.user.username}** !\n\n📝 Complète-la pour gagner un collectible aléatoire !\n\n⏰ Tu auras **${timeoutDisplay}** pour l'accomplir.`,
      buttonLabel: '🎯 Lancer la mission',
      buttonEmoji: '📋'
    };

    const missionEmbed = new EmbedBuilder()
      .setTitle(msgConfig.title)
      .setDescription(msgConfig.description)
      .setColor(branding.secondary_color)
      .setFooter(await getLoomixFooter(interaction.guildId));

    if (mission.image_url) {
      missionEmbed.setThumbnail(mission.image_url);
    }

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_start_${mission.id}_${interaction.user.id}`)
        .setLabel(msgConfig.buttonLabel)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(msgConfig.buttonEmoji)
    );

    // Créer la progression de mission AVANT d'envoyer le message
    // Cela garantit que même si thread.send() échoue, on a le mission_progress en base
    await db.createMissionProgress(interaction.guildId, player.id, mission.id, thread.id);

    await thread.send({
      content: `<@${interaction.user.id}>`,
      embeds: [missionEmbed],
      components: [button]
    });
  }

  /**
   * Révéler un piège
   */
  async revealTrap(interaction, trapId, player) {
    const [trap, branding] = await Promise.all([
      db.queryOne('SELECT * FROM traps WHERE id = $1 AND guild_id = $2', [trapId, interaction.guildId]),
      db.getGuildBranding(interaction.guildId)
    ]);

    if (!trap) {
      return interaction.followUp({
        content: '❌ Piège introuvable.',
        flags: 64
      });
    }

    // Vérifier si le joueur a un bouclier anti-piège
    const trapShield = await superBonusHandler.hasTrapShield(interaction.guildId, interaction.user.id);

    if (trapShield) {
      // Consommer le bouclier et récupérer les stats
      const shieldStats = await superBonusHandler.consumeTrapShield(interaction.guildId, interaction.user.id, trap.name);

      // Récupérer le compteur de pièges bloqués
      const playerStats = await db.queryOne(`
        SELECT traps_blocked FROM players
        WHERE id = $1
      `, [player.id]);

      const totalBlocked = playerStats ? playerStats.traps_blocked : 0;

      // Tracking badge pour piège bloqué
      try {
        await badgeHandler.onTrapBlocked(interaction.guildId, player.id, interaction.client);
      } catch (error) {
        console.error('🔴 Erreur tracking badge onTrapBlocked:', error);
      }

      // Embed de blocage du piège - VERSION ÉPIQUE
      const embed = new EmbedBuilder()
        .setTitle('🛡️ ════════════════════════════════════ 🛡️')
        .setDescription(
          `\n**💥 PIÈGE BLOQUÉ ! 💥**\n\n` +
          `🔥 **Vous avez déclenché**: ${trap.name}\n` +
          `🛡️ **Votre Bouclier Anti-Piège a absorbé le coup !**\n\n` +
          `╔═══════════════════════════════════╗\n` +
          `║  ❌ **Effet annulé**: ${trap.description.split('\n')[0]}\n` +
          `║  ✅ **Vos collectibles sont en sécurité !**\n` +
          `╚═══════════════════════════════════╝\n\n` +
          `🛡️ **Charges restantes**: ${shieldStats.remainingCharges}/${shieldStats.totalCharges}\n` +
          `📊 **Pièges évités au total**: ${totalBlocked}\n\n` +
          `🛡️ ════════════════════════════════════ 🛡️`
        )
        .setColor('#FFD700')
        .setFooter(getLoomixFooterWithCustomText(`Protection activée: ${trapShield.name}`));

      // Animation Discord: Ajouter réaction 🛡️ puis ✅
      const message = await interaction.followUp({ embeds: [embed], flags: 64 });

      try {
        await message.react('🛡️');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Attendre 1.5s
        await message.react('✅');
      } catch (error) {
        console.error('⚠️  Erreur ajout réactions:', error);
        // Continuer même si réactions échouent
      }

      return message;
    }

    // Embed de révélation
    const embed = new EmbedBuilder()
      .setTitle('💀 PIÈGE !')
      .setDescription(`**${trap.name}**\n\n${trap.description}`)
      .setColor(branding.secondary_color)
      .setImage(trap.image_url)
      .setFooter(await getLoomixFooter(interaction.guildId));

    await interaction.followUp({ embeds: [embed], flags: 64 });

    // Appliquer l'effet du piège selon le type
    switch (trap.type) {
      case 'cooldown':
        await this.applyTrapCooldown(interaction, trap, player);
        break;

      case 'lose-collectible':
        await this.applyTrapLoseCollectible(interaction, trap, player);
        break;

      case 'lose-all-collectibles':
        await this.applyTrapLoseAllCollectibles(interaction, trap, player);
        break;

      case 'public-shame':
        await this.applyTrapShame(interaction, trap, player);
        break;

      case 'empty-box':
        await this.applyTrapEmptyBox(interaction, trap, player);
        break;
    }

    // Logger le piège
    await db.query(
      'INSERT INTO trap_triggered (guild_id, player_id, trap_id) VALUES ($1, $2, $3)',
      [interaction.guildId, player.id, trapId]
    );

    // 🏆 BADGE TRACKING - Trap Survived
    try {
      await badgeHandler.onTrapSurvived(interaction.guildId, player.id, interaction.client);
      console.log(`🏆 [BADGES] Trap Survival badge tracking appelé pour player ${player.id}`);
    } catch (error) {
      console.error('🔴 [BADGES] Erreur tracking trap survival:', error);
    }
  }

  /**
   * Révéler un super bonus
   */
  async revealSuperBonus(interaction, bonusId, player) {
    const auditLogger = require('../utils/auditLogger');

    // Récupérer le bonus et le branding
    const [bonus, branding] = await Promise.all([
      db.queryOne(`
        SELECT * FROM super_bonuses
        WHERE id = $1 AND guild_id = $2
      `, [bonusId, interaction.guildId]),
      db.getGuildBranding(interaction.guildId)
    ]);

    if (!bonus) {
      return interaction.followUp({
        content: '❌ Super bonus introuvable.',
        flags: 64
      });
    }

    // Vérifier si le joueur a déjà ce bonus actif
    const existingBonus = await db.queryOne(`
      SELECT * FROM player_active_bonuses
      WHERE user_id = $1
      AND guild_id = $2
      AND bonus_id = $3
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    `, [interaction.user.id, interaction.guildId, bonusId]);

    if (existingBonus) {
      // SYSTÈME DE CUMUL - Tous les bonus sont cumulables
      console.log(`📦 [SUPER BONUS] Cumul détecté - Bonus existant trouvé (ID: ${existingBonus.id})`);
      console.log(`📦 [SUPER BONUS] Type de durée: ${bonus.duration_type}`);

      if (bonus.duration_type === 'charges') {
        // CHARGES: Additionner les charges
        const currentCharges = existingBonus.remaining_charges || 0;
        const newCharges = currentCharges + bonus.duration_value;

        await db.query(`
          UPDATE player_active_bonuses
          SET remaining_charges = $1
          WHERE id = $2
        `, [newCharges, existingBonus.id]);

        console.log(`✅ [SUPER BONUS] Charges cumulées: ${currentCharges} + ${bonus.duration_value} = ${newCharges}`);

        // Message de cumul
        const embed = new EmbedBuilder()
          .setTitle(`✨ ${bonus.icon} Bonus cumulé !`)
          .setDescription(`**${bonus.name}** a été cumulé !\n\n🔢 Charges totales: **${newCharges}**`)
          .setColor(bonus.color || branding.secondary_color)
          .setFooter(await getLoomixFooter(interaction.guildId));

        await interaction.followUp({ embeds: [embed], flags: 64 });

        // TODO: Ajouter audit logging pour cumul de bonus (action: super_bonus_cumulated)
        // await auditLogger.logBonusUsed(...) ou créer nouvelle méthode

        return;

      } else if (bonus.duration_type === 'temporary') {
        // TEMPORARY: Étendre la durée
        const currentExpires = new Date(existingBonus.expires_at);
        const newExpires = new Date(currentExpires.getTime() + (bonus.duration_value * 1000));

        await db.query(`
          UPDATE player_active_bonuses
          SET expires_at = $1
          WHERE id = $2
        `, [newExpires, existingBonus.id]);

        console.log(`✅ [SUPER BONUS] Durée étendue: ${currentExpires.toISOString()} → ${newExpires.toISOString()}`);

        // Calculer temps restant
        const secondsRemaining = Math.floor((newExpires - new Date()) / 1000);
        const hoursRemaining = Math.floor(secondsRemaining / 3600);
        const minutesRemaining = Math.floor((secondsRemaining % 3600) / 60);

        const embed = new EmbedBuilder()
          .setTitle(`✨ ${bonus.icon} Bonus cumulé !`)
          .setDescription(`**${bonus.name}** a été prolongé !\n\n⏱️ Temps restant: **${hoursRemaining}h ${minutesRemaining}min**`)
          .setColor(bonus.color || branding.secondary_color)
          .setFooter(await getLoomixFooter(interaction.guildId));

        await interaction.followUp({ embeds: [embed], flags: 64 });

        // TODO: Ajouter audit logging pour cumul de bonus (action: super_bonus_cumulated)
        // await auditLogger.logBonusUsed(...) ou créer nouvelle méthode

        return;

      } else if (bonus.duration_type === 'permanent') {
        // PERMANENT: Pas de cumul possible (déjà actif en permanence)
        console.log(`ℹ️  [SUPER BONUS] Bonus permanent déjà actif - Pas de cumul`);

        const embed = new EmbedBuilder()
          .setTitle('✨ Bonus déjà actif')
          .setDescription(`Tu possèdes déjà **${bonus.icon} ${bonus.name}** (permanent).`)
          .setColor(bonus.color || branding.secondary_color)
          .setFooter(await getLoomixFooter(interaction.guildId));

        return interaction.followUp({ embeds: [embed], flags: 64 });
      }
    }

    // Déterminer si activation automatique ou manuelle
    const isAutomatic = bonus.activation_mode === 'automatic';

    console.log(`🔍 [SUPER BONUS] Bonus: ${bonus.name}`);
    console.log(`🔍 [SUPER BONUS] activation_mode: ${bonus.activation_mode} (isAutomatic=${isAutomatic})`);
    console.log(`🔍 [SUPER BONUS] duration_type: ${bonus.duration_type}, duration_value: ${bonus.duration_value}`);

    let activated_at = null;
    let expires_at = null;
    let remaining_charges = null;

    if (isAutomatic) {
      // ACTIVATION AUTOMATIQUE - Passive effects
      activated_at = new Date(); // NOW()
      console.log(`✅ [SUPER BONUS] AUTOMATIQUE - activated_at défini: ${activated_at}`);

      // Calculer expires_at selon duration_type
      if (bonus.duration_type === 'temporary') {
        // Temporaire: ajouter les secondes
        expires_at = new Date(activated_at.getTime() + (bonus.duration_value * 1000));
        console.log(`✅ [SUPER BONUS] expires_at calculé: ${expires_at}`);
      } else if (bonus.duration_type === 'charges') {
        // Charges: pas d'expiration temporelle
        remaining_charges = bonus.duration_value;
        console.log(`✅ [SUPER BONUS] remaining_charges: ${remaining_charges}`);
      }
      // permanent: pas d'expiration
    } else {
      console.log(`📱 [SUPER BONUS] MANUEL - activated_at reste NULL`);
    }
    // else: MANUEL - activated_at et expires_at restent NULL jusqu'à activation via /profile

    // Insérer le bonus dans player_active_bonuses
    await db.query(`
      INSERT INTO player_active_bonuses (
        user_id, guild_id, bonus_id, activated_at, expires_at,
        remaining_charges, is_active, obtained_from
      ) VALUES ($1, $2, $3, $4, $5, $6, true, 'mystery_box')
    `, [
      interaction.user.id,
      interaction.guildId,
      bonusId,
      activated_at,
      expires_at,
      remaining_charges
    ]);

    console.log(`🎁 Super bonus attribué: ${bonus.name} (${bonus.activation_mode}) à ${interaction.user.username}`);

    // Logger l'événement
    await auditLogger.logBonusGranted(
      interaction.guildId,
      interaction.user.id,
      bonus.name,
      {
        obtained_from: 'mystery_box',
        bonus_id: bonus.bonus_id,
        rarity: bonus.rarity,
        duration_type: bonus.duration_type,
        duration_value: bonus.duration_value,
        activation_mode: bonus.activation_mode
      }
    );

    // Créer l'embed de révélation
    let description = `${bonus.description}\n\n`;

    if (isAutomatic) {
      // Bonus automatique activé immédiatement
      description += `✨ **Bonus activé automatiquement !**\n\n`;

      if (bonus.duration_type === 'temporary') {
        const hours = Math.floor(bonus.duration_value / 3600);
        const days = Math.floor(hours / 24);

        if (days > 0) {
          description += `⏱️ Durée: **${days} jour${days > 1 ? 's' : ''}**\n`;
        } else if (hours > 0) {
          description += `⏱️ Durée: **${hours}h**\n`;
        } else {
          const minutes = Math.floor(bonus.duration_value / 60);
          description += `⏱️ Durée: **${minutes}min**\n`;
        }
      } else if (bonus.duration_type === 'charges') {
        description += `🔢 Charges: **${bonus.duration_value}**\n`;
      } else if (bonus.duration_type === 'permanent') {
        description += `♾️ Durée: **Jusqu'à utilisation**\n`;
      }
    } else {
      // Bonus manuel - à activer via /profile
      description += `📱 **Activation manuelle**\n\n`;
      description += `Ce bonus a été ajouté à ton inventaire !\n\n`;
      description += `Tu peux l'activer quand tu le souhaites via la commande \`/profile\`, section **🎁 Mes Super Bonus**.\n\n`;

      if (bonus.duration_type === 'charges') {
        description += `🔢 Nombre d'utilisations: **${bonus.duration_value}**\n`;
      } else if (bonus.duration_type === 'temporary') {
        const hours = Math.floor(bonus.duration_value / 3600);
        const days = Math.floor(hours / 24);

        if (days > 0) {
          description += `⏱️ Durée après activation: **${days} jour${days > 1 ? 's' : ''}**\n`;
        } else if (hours > 0) {
          description += `⏱️ Durée après activation: **${hours}h**\n`;
        }
      } else if (bonus.duration_type === 'permanent') {
        description += `♾️ Durée: **Jusqu'à utilisation**\n`;
      }
    }

    // Rareté emoji
    const rarityEmoji = {
      legendary: '🌟',
      epic: '💜',
      rare: '💙',
      common: '⚪'
    }[bonus.rarity] || '⚪';

    const embed = new EmbedBuilder()
      .setTitle(`${bonus.icon} Super Bonus Obtenu !`)
      .setDescription(description)
      .setColor(bonus.color || branding.secondary_color)
      .setThumbnail(bonus.image_url)
      .addFields({
        name: 'Rareté',
        value: `${rarityEmoji} ${bonus.rarity.toUpperCase()}`,
        inline: true
      })
      .setFooter(await getLoomixFooter(interaction.guildId));

    if (bonus.image_url) {
      embed.setImage(bonus.image_url);
    }

    await interaction.followUp({ embeds: [embed], flags: 64 });

    // Annonce si bonus légendaire (optionnel)
    if (bonus.rarity === 'legendary') {
      await announcements.announceSuperBonus(
        interaction.client,
        interaction.guildId,
        interaction.user.username,
        bonus.name,
        bonus.icon,
        bonus.image_url
      );
    }

    // Si activation automatique, appliquer l'effet immédiatement si nécessaire
    if (isAutomatic) {
      // Les effets passifs (Chance du Diable, Aimant, Détecteur) sont appliqués automatiquement
      // via les méthodes existantes dans superBonusHandler (applyProbabilityBonuses, etc.)
      console.log(`✅ Bonus automatique ${bonus.name} prêt à l'emploi`);
    }
  }

  /**
   * Appliquer un piège de type cooldown
   */
  async applyTrapCooldown(interaction, trap, player) {
    await db.addCooldown(interaction.guildId, player.id, trap.id, trap.cooldown_duration);

    await interaction.followUp({
      content: `⏰ Tu ne pourras plus ouvrir de boîtes pendant **${trap.cooldown_duration} minutes** !`,
      flags: 64
    });

    // Annonce de la malédiction
    await announcements.announceTrapCurse(
      interaction.client,
      interaction.guildId,
      interaction.user.username,
      trap.name,
      `Cooldown de ${trap.cooldown_duration} minutes`
    );
  }

  /**
   * Appliquer un piège de perte de collectible
   */
  async applyTrapLoseCollectible(interaction, trap, player) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const playerCollectibles = await db.getPlayerCollectibles(interaction.guildId, player.id, theme.id);

    if (playerCollectibles.length === 0) {
      return interaction.followUp({
        content: '😅 Tu n\'as aucun collectible à perdre... Tu as de la chance !',
        flags: 64
      });
    }

    // Retirer un collectible aléatoire
    const randomCol = playerCollectibles[Math.floor(Math.random() * playerCollectibles.length)];

    // Supprimer le collectible de la base de données
    const removed = await db.removePlayerCollectible(interaction.guildId, player.id, randomCol.id);

    if (removed) {
      await interaction.followUp({
        content: `😱 Tu as perdu **${randomCol.name}** de ta collection !`,
        flags: 64
      });
    } else {
      await interaction.followUp({
        content: `⚠️ Erreur lors de la suppression du collectible.`,
        flags: 64
      });
      return;
    }

    // Annonce de la perte de collection
    await announcements.announceTrapLoseCollectibleTriggered(
      interaction.client,
      interaction.guildId,
      interaction.user.username,
      trap.name,
      randomCol.name
    );
  }

  /**
   * Appliquer un piège de perte de TOUS les collectibles
   */
  async applyTrapLoseAllCollectibles(interaction, trap, player) {
    const theme = await db.getActiveTheme(interaction.guildId);
    const playerCollectibles = await db.getPlayerCollectibles(interaction.guildId, player.id, theme.id);

    if (playerCollectibles.length === 0) {
      return interaction.followUp({
        content: '😅 Tu n\'as aucun collectible à perdre... Tu as évité le pire !',
        flags: 64
      });
    }

    const count = playerCollectibles.length;
    const collectibleNames = playerCollectibles.map(c => c.name).join(', ');

    // Retirer TOUS les collectibles un par un
    for (const collectible of playerCollectibles) {
      await db.removePlayerCollectible(interaction.guildId, player.id, collectible.id);
    }

    // Message de confirmation
    await interaction.followUp({
      content: `💥 **CATASTROPHE TOTALE !** Tu as perdu **TOUS tes collectibles** !\n\n💔 **${count} objet${count > 1 ? 's' : ''} perdu${count > 1 ? 's' : ''}**: ${collectibleNames}`,
      flags: 64
    });

    // Annonce publique de la catastrophe
    await announcements.announceTrapLoseAllCollectiblesTriggered(
      interaction.client,
      interaction.guildId,
      interaction.user.username,
      trap.name,
      count
    );
  }

  /**
   * Appliquer un piège de shame public
   */
  async applyTrapShame(interaction, trap, player) {
    const shameChannel = interaction.guild.channels.cache.get(trap.shame_channel_id || process.env.ANNOUNCE_CHANNEL_ID);

    if (shameChannel) {
      const shameMsg = trap.shame_message.replace('{player}', `<@${interaction.user.id}>`);
      await shameChannel.send(shameMsg);
    }

    // Annonce de la malédiction
    await announcements.announceTrapCurse(
      interaction.client,
      interaction.user.username,
      trap.name,
      trap.shame_message
    );
  }

  /**
   * Appliquer un piège de malus de points
   */
  async applyTrapMalus(interaction, trap, player) {
    const theme = await db.getActiveTheme(interaction.guildId);
    await db.addMalusPoints(interaction.guildId, player.id, theme.id, trap.malus_points);

    await interaction.followUp({
      content: `🔮 Tu gagnes **${trap.malus_points} points de malédiction** !`,
      flags: 64
    });

    // Annonce de la malédiction
    await announcements.announceTrapCurse(
      interaction.client,
      interaction.user.username,
      trap.name,
      `${trap.malus_points} points de malédiction`
    );
  }

  /**
   * Appliquer un piège de type boîte vide (ne fait rien)
   */
  async applyTrapEmptyBox(interaction, trap, player) {
    await interaction.followUp({
      content: `📦 La boîte est... vide ? Complètement vide ! Tu n'as rien gagné, mais tu n'as rien perdu non plus. 🤷`,
      flags: 64
    });

    // Annonce optionnelle (pour le fun)
    await announcements.announceTrapEmptyBox(
      interaction.client,
      interaction.guildId,
      interaction.user.username,
      trap.name
    );
  }

  /**
   * Gérer la collection complète
   */
  async handleCollectionComplete(interaction, player, collectible) {
    const [theme, branding] = await Promise.all([
      db.queryOne('SELECT * FROM themes WHERE id = $1 AND guild_id = $2', [collectible.theme_id, interaction.guildId]),
      db.getGuildBranding(interaction.guildId)
    ]);

    // Marquer comme complété
    await db.completeCollection(interaction.guildId, player.id, collectible.theme_id);

    // Attribuer le rôle final (par ID Discord, pas par nom)
    if (theme.final_role_discord_id) {
      try {
        // IMPORTANT: Utiliser fetch() au lieu de cache.get() pour garantir la récupération du rôle
        // car le cache peut ne pas contenir le rôle si le bot vient de redémarrer
        const finalRole = await interaction.guild.roles.fetch(theme.final_role_discord_id);

        if (finalRole) {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          await member.roles.add(finalRole);
          console.log(`✅ Rôle "${finalRole.name}" (ID: ${finalRole.id}) attribué à ${interaction.user.tag}`);
        } else {
          console.error(`❌ Rôle avec ID ${theme.final_role_discord_id} introuvable dans le serveur ${interaction.guildId}`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'attribution du rôle (ID: ${theme.final_role_discord_id}):`, error);
      }
    } else {
      console.log('⚠️  Aucun rôle configuré pour ce thème');
    }

    // Annonce publique via le système d'annonces
    await announcements.announceCollectionCompleted(
      interaction.client,
      interaction.user.username,
      theme.name,
      theme.final_role_name
    );

    // MP au joueur
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('👑 COLLECTION COMPLÈTE !')
        .setDescription(
          `**Félicitations !** Tu as complété la collection **${theme.name}** !\n\n` +
          `Tu as collecté les ${theme.required_items} items ! 🎉`
        )
        .setColor(theme.final_role_color)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter(await getLoomixFooter(interaction.guildId))
        .setTimestamp();

      await interaction.user.send({
        embeds: [dmEmbed],
        content: `🎉 Bravo ! Tu as reçu le rôle **${theme.final_role_name}** !`
      });
    } catch (e) {
      // Ignore si MPs fermés
    }
  }

  /**
   * 👁️ VISION DIVINE - Accepter le contenu révélé
   */
  async handleVisionDivineAccept(interaction) {
    await interaction.deferUpdate();

    try {
      // Parse customId: vision_divine_accept:MESSAGE_ID:TYPE:ID
      const [, messageId, type, itemId] = interaction.customId.split(':');

      console.log(`👁️ [VISION DIVINE ACCEPT] User ${interaction.user.tag} accepte le contenu: ${messageId} → ${type} #${itemId}`);

      // Vérifier que c'est bien le gagnant de cette boîte
      const giveLog = await db.query(
        `SELECT * FROM give_logs WHERE message_id = $1`,
        [messageId]
      );

      if (giveLog.length === 0 || giveLog[0].winner_id !== interaction.user.id) {
        return interaction.editReply({
          content: '❌ Erreur: Cette boîte ne vous appartient pas ou a déjà été traitée.',
          embeds: [],
          components: [],
          flags: 64
        });
      }

      // Nettoyer le tracking Vision Divine pour cette boîte
      superBonusHandler.clearVisionDivineTracking(messageId, interaction.user.id);

      // Récupérer player
      const player = await db.upsertPlayer(interaction.guildId, interaction.user.id, interaction.user.username);

      // Récupérer config et branding
      const theme = await db.getActiveTheme(interaction.guildId);
      const config = await db.getThemeConfig(interaction.guildId, theme.id);
      const branding = await db.getGuildBranding(interaction.guildId);

      // Créer message de félicitations
      const winnerMessage = config?.mystery_box_winner_message ||
        '🎉 **{player}** a ouvert la boîte mystère !';
      const celebrationGif = config?.mystery_box_celebration_gif ||
        'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif';
      const celebrationEmojis = config?.mystery_box_celebration_emojis
        ? config.mystery_box_celebration_emojis.split(',').map(e => e.trim())
        : ['🎉', '🎊', '✨', '🌟'];
      const confettiLine = celebrationEmojis.slice(0, 3).join(' ').repeat(2);

      const winnerEmbed = new EmbedBuilder()
        .setTitle(`${celebrationEmojis[0]} FÉLICITATIONS ! ${celebrationEmojis[0]}`)
        .setDescription(`${confettiLine}\n\n${winnerMessage.replace('{player}', `<@${interaction.user.id}>`)}\n\n${confettiLine}`)
        .setColor(branding.secondary_color)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setImage(celebrationGif)
        .setFooter(await getLoomixFooter(interaction.guildId))
        .setTimestamp();

      // Éditer le message de révélation
      await interaction.editReply({
        embeds: [winnerEmbed],
        components: []
      });

      // Mettre à jour le message ORIGINAL de la mystery box dans le canal
      try {
        const originalMessage = await interaction.channel.messages.fetch(messageId);

        // Créer l'embed "Boîte ouverte"
        const openedEmbed = new EmbedBuilder()
          .setTitle('📦 Boîte Mystère Ouverte !')
          .setDescription(`Cette boîte a été ouverte par <@${interaction.user.id}> ! 🎉`)
          .setColor(branding.primary_color)
          .setFooter(await getLoomixFooter(interaction.guildId))
          .setTimestamp();

        // Éditer le message original pour retirer le bouton
        const updatedOriginalMessage = await originalMessage.edit({
          embeds: [openedEmbed],
          components: []
        });

        console.log(`🔄 [VISION DIVINE] Message original ${messageId} mis à jour (bouton retiré)`);

        // Auto-suppression du message après 10 secondes (si activé)
        if (config.auto_delete_celebration_message) {
          console.log('🗑️ [VISION DIVINE] Suppression auto activée - Message sera supprimé dans 10 secondes');
          setTimeout(async () => {
            try {
              await updatedOriginalMessage.delete();
              console.log('✅ [VISION DIVINE] Message original supprimé');
            } catch (error) {
              console.warn('⚠️ [VISION DIVINE] Impossible de supprimer le message:', error.message);
            }
          }, 10000); // 10 secondes
        }
      } catch (error) {
        console.error(`⚠️ [VISION DIVINE] Impossible de mettre à jour le message original ${messageId}:`, error.message);
      }

      // Révéler le contenu selon le type
      console.log(`🔍 [VISION DIVINE] Révélation contenu: type="${type}", itemId="${itemId}"`);

      switch (type) {
        case 'collectible':
          await this.revealCollectible(interaction, parseInt(itemId), player);
          break;

        case 'mission':
          await this.revealMission(interaction, parseInt(itemId), player);
          break;

        case 'trap':
          await this.revealTrap(interaction, parseInt(itemId), player);
          break;

        case 'super_bonus':
          await this.revealSuperBonus(interaction, parseInt(itemId), player);
          break;

        default:
          console.error(`❌ [VISION DIVINE] Type inconnu: "${type}"`);
      }

      console.log(`✅ [VISION DIVINE ACCEPT] Complété pour ${interaction.user.tag}`);

    } catch (error) {
      console.error('❌ Erreur handleVisionDivineAccept:', error);
      return interaction.editReply({
        content: `❌ Erreur lors de l'ouverture: ${error.message}`,
        embeds: [],
        components: [],
        flags: 64
      });
    }
  }

  /**
   * 👁️ VISION DIVINE - Décliner le contenu révélé
   */
  async handleVisionDivineDecline(interaction) {
    await interaction.deferUpdate();

    try {
      // Parse customId: vision_divine_decline:MESSAGE_ID
      const [, messageId] = interaction.customId.split(':');

      console.log(`👁️ [VISION DIVINE DECLINE] User ${interaction.user.tag} décline le contenu du message ${messageId}`);

      // Récupérer le give_log
      const giveLog = await db.query(
        `SELECT * FROM give_logs WHERE message_id = $1`,
        [messageId]
      );

      console.log(`🔍 [VISION DIVINE DECLINE] Give log trouvé:`, giveLog.length > 0 ? {
        id: giveLog[0].id,
        winner_id: giveLog[0].winner_id,
        winner_username: giveLog[0].winner_username
      } : 'AUCUN');

      if (giveLog.length === 0) {
        console.error(`❌ [VISION DIVINE DECLINE] Aucun give_log trouvé pour message ${messageId}`);
        return interaction.editReply({
          content: '❌ Erreur: Cette boîte n\'existe pas dans les logs.',
          embeds: [],
          components: [],
          flags: 64
        });
      }

      // Libérer la boîte (remettre winner_id à NULL)
      // On ne vérifie PAS le winner_id car Vision Divine permet de voir avant de décider
      await db.query(
        `UPDATE give_logs SET winner_id = NULL, winner_username = NULL WHERE message_id = $1`,
        [messageId]
      );

      console.log(`✅ [VISION DIVINE DECLINE] Boîte ${messageId} libérée et disponible pour d'autres joueurs`);

      // Message de confirmation
      await interaction.editReply({
        content: '✅ Tu as choisi de passer cette boîte. Elle est à nouveau disponible pour les autres joueurs !\n\n💡 *Note: 1 charge de Vision Divine a été consommée.*',
        embeds: [],
        components: [],
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur handleVisionDivineDecline:', error);
      return interaction.editReply({
        content: `❌ Erreur: ${error.message}`,
        embeds: [],
        components: [],
        flags: 64
      });
    }
  }
}

module.exports = new MysteryBoxHandler();
