const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } = require('discord.js');
const db = require('../utils/database-pg');
const announcements = require('../utils/announcements');
const superBonusHandler = require('./superBonusHandler');
const themeExpirationHandler = require('./themeExpirationHandler');
const { SUPER_ADMINS } = require('../utils/permissions');

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

    // Récupérer le thème et sa config avec guild_id
    const [theme, config] = await Promise.all([
      db.queryOne('SELECT * FROM themes WHERE id = $1 AND guild_id = $2', [themeId, guildId]),
      db.getThemeConfig(guildId, themeId)
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
      .setColor('#FFD700')
      .setFooter({ text: `Thème: ${theme.name}` })
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
   * Tirer aléatoirement le contenu de la boîte
   * @param {string} guildId - ID du serveur Discord
   * @param {number} themeId - ID du thème
   * @param {object} config - Configuration du thème
   * @param {string} mode - Mode forcé (optionnel): 'mystery_box', 'mission', 'trap', 'super_bonus', 'collectible'
   * @param {number} itemId - ID de l'item spécifique (optionnel)
   * @returns {object} {type, id, item}
   */
  async rollMysteryContent(guildId, themeId, config, mode = null, itemId = null) {
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

    // Déterminer le type selon les probabilités
    if (rand <= probCollectible) {
      // COLLECTIBLE
      type = 'collectible';
      items = await db.getCollectiblesByTheme(guildId, themeId);

    } else if (rand <= probCollectible + probMission) {
      // MISSION
      type = 'mission';
      items = await db.getMissionsByTheme(guildId, themeId);

    } else {
      // PIÈGE
      type = 'trap';
      items = await db.getTrapsByTheme(guildId, themeId); // Récupère seulement les pièges actifs
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

      // Si aucun type n'a d'items, erreur
      if (availableTypes.length === 0) {
        throw new Error(`Aucun contenu disponible (collectibles, missions ou pièges actifs) pour le thème ${themeId}`);
      }

      // Sélectionner un type aléatoire parmi ceux disponibles
      const selected = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      type = selected.type;
      items = selected.items;

      console.log(`✅ Redistribution vers: ${type}`);
    }

    // Sélectionner un item aléatoire du type
    item = items[Math.floor(Math.random() * items.length)];

    return { type, id: item.id, item };
  }

  /**
   * Gérer l'ouverture de la boîte (clic sur le bouton)
   * @param {ButtonInteraction} interaction
   */
  async handleMysteryBoxOpen(interaction) {
    const [, , type, itemId] = interaction.customId.split('_');

    // Defer immédiatement pour éviter timeout
    await interaction.deferUpdate();

    // Vérifier le cooldown du joueur
    const player = await db.upsertPlayer(interaction.guildId, interaction.user.id, interaction.user.username);
    const hasCooldown = await db.hasActiveCooldown(interaction.guildId, player.id);

    if (hasCooldown) {
      // Désactiver le bouton même si cooldown
      await interaction.editReply({
        components: []
      });

      // Envoyer message de cooldown en followUp (éphémère)
      return interaction.followUp({
        content: '⏰ Tu es sous l\'effet d\'un piège ! Tu ne peux pas encore ouvrir de boîtes.',
        flags: 64
      });
    }

    // Récupérer le thème et sa config pour le message de félicitations
    const theme = await db.getActiveTheme(interaction.guildId);
    const config = await db.getThemeConfig(interaction.guildId, theme.id);

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

    // Créer des confettis décoratifs
    const confettiLine = celebrationEmojis.slice(0, 3).join(' ').repeat(2);

    // Créer l'embed de félicitations stylisé
    const winnerEmbed = new EmbedBuilder()
      .setTitle(`${celebrationEmojis[0]} FÉLICITATIONS ! ${celebrationEmojis[0]}`)
      .setDescription(`${confettiLine}\n\n${winnerMessage.replace('{player}', `<@${interaction.user.id}>`)}\n\n${confettiLine}`)
      .setColor('#FFD700') // Or brillant
      .setThumbnail(interaction.user.displayAvatarURL())
      .setImage(celebrationGif) // GIF de célébration
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

    // Révéler le contenu selon le type
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
    }

    // Mettre à jour le log
    await db.updateGiveWinner(interaction.message.id, interaction.user.id, interaction.user.username);
  }

  /**
   * Révéler un collectible
   */
  async revealCollectible(interaction, collectibleId, player) {
    const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);

    if (!collectible) {
      return interaction.followUp({
        content: '❌ Collectible introuvable.',
        flags: 64
      });
    }

    // Vérifier si le joueur l'a déjà
    const alreadyHas = await db.hasCollectible(interaction.guildId, player.id, collectibleId);

    if (alreadyHas) {
      // Doublon
      const embed = new EmbedBuilder()
        .setTitle('⚠️ Doublon !')
        .setDescription(`Tu as déjà **${collectible.name}** dans ta collection !`)
        .setColor('#FFA500')
        .setThumbnail(collectible.image_url);

      return interaction.followUp({ embeds: [embed], flags: 64 });
    }

    // Vérifier si le joueur a un multiplicateur de récompense actif
    const multiplierData = await superBonusHandler.getRewardMultiplier(interaction.user.id);
    let bonusApplied = false;

    // Ajouter le collectible
    await db.addCollectible(interaction.guildId, player.id, collectibleId);
    const progress = await db.incrementProgress(interaction.guildId, player.id, collectible.theme_id);

    // Appliquer le multiplicateur si actif (à implémenter: doubler les points)
    if (multiplierData && multiplierData.appliesTo === 'collectible' || multiplierData?.appliesTo === 'all') {
      await superBonusHandler.consumeMultiplierCharge(interaction.user.id);
      bonusApplied = true;
      // TODO: Implémenter le système de points et doubler la récompense ici
    }

    // Message de révélation
    let description = collectible.reveal_message ||
      `Félicitations ! Tu as trouvé **${collectible.name}** !`;

    if (bonusApplied) {
      description += `\n\n💵 **Bonus actif:** ${multiplierData.bonus.icon} ${multiplierData.bonus.name}\n` +
        `Récompense multipliée par ${multiplierData.multiplier}x !`;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Collectible Obtenu !')
      .setDescription(description)
      .setColor(collectible.role_color || '#00FF00')
      .setThumbnail(collectible.image_url)
      .addFields({
        name: 'Progression',
        value: `${progress.collected_count}/${collectible.required_items}`,
        inline: true
      })
      .setFooter({ text: `Rareté: ${collectible.rarity}` });

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
  }

  /**
   * Révéler une mission
   */
  async revealMission(interaction, missionId, player) {
    const mission = await db.getMissionById(interaction.guildId, missionId);

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

    // Ajouter les super-admins (accès tous serveurs)
    for (const adminId of SUPER_ADMINS) {
      try {
        await thread.members.add(adminId);
      } catch (e) {
        // Ignore si le super-admin n'est pas sur le serveur
      }
    }

    // Ajouter le propriétaire du serveur
    try {
      await thread.members.add(interaction.guild.ownerId);
    } catch (e) {
      console.warn(`⚠️ Impossible d'ajouter le propriétaire au thread`);
    }

    // Message de révélation dans le salon public
    const revealEmbed = new EmbedBuilder()
      .setTitle('📋 MISSION DÉBLOQUÉE !')
      .setDescription(`Tu as déclenché une mission secrète !\n\nUn thread privé a été créé pour toi. Consulte-le pour découvrir ta mission !`)
      .setColor('#3498db')
      .setImage('https://media.giphy.com/media/xT9IgBwI5SLzZGV2PC/giphy.gif'); // Mission secrète générique

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
      .setColor('#FFD700')
      .setFooter({ text: 'Mission Secrète' }); // FIX: Ne pas révéler le nom de la mission

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

    await thread.send({
      content: `<@${interaction.user.id}>`,
      embeds: [missionEmbed],
      components: [button]
    });

    // Créer la progression de mission
    await db.createMissionProgress(interaction.guildId, player.id, mission.id, thread.id);
  }

  /**
   * Révéler un piège
   */
  async revealTrap(interaction, trapId, player) {
    const trap = await db.queryOne('SELECT * FROM traps WHERE id = $1 AND guild_id = $2', [trapId, interaction.guildId]);

    if (!trap) {
      return interaction.followUp({
        content: '❌ Piège introuvable.',
        flags: 64
      });
    }

    // Vérifier si le joueur a un bouclier anti-piège
    const trapShield = await superBonusHandler.hasTrapShield(interaction.user.id);

    if (trapShield) {
      // Consommer le bouclier
      await superBonusHandler.consumeTrapShield(interaction.user.id, trap.name);

      // Embed de blocage du piège
      const embed = new EmbedBuilder()
        .setTitle('🛡️ PIÈGE BLOQUÉ !')
        .setDescription(
          `Tu as activé une **${trap.name}**, mais ton super bonus **${trapShield.name}** ${trapShield.icon} t'a protégé !\n\n` +
          `Le piège a été annulé. Tu es sain et sauf ! ✨`
        )
        .setColor('#3498db')
        .setFooter({ text: `Bonus utilisé: ${trapShield.name}` });

      return interaction.followUp({ embeds: [embed], flags: 64 });
    }

    // Embed de révélation
    const embed = new EmbedBuilder()
      .setTitle('💀 PIÈGE !')
      .setDescription(`**${trap.name}**\n\n${trap.description}`)
      .setColor('#FF0000')
      .setImage(trap.image_url);

    await interaction.followUp({ embeds: [embed], flags: 64 });

    // Appliquer l'effet du piège selon le type
    switch (trap.type) {
      case 'cooldown':
        await this.applyTrapCooldown(interaction, trap, player);
        break;

      case 'lose-collectible':
        await this.applyTrapLoseCollectible(interaction, trap, player);
        break;

      case 'public-shame':
        await this.applyTrapShame(interaction, trap, player);
        break;

      case 'points-malus':
        await this.applyTrapMalus(interaction, trap, player);
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
   * Révéler un super bonus
   */
  async revealSuperBonus(interaction, bonusId, player) {
    const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1 AND guild_id = $2', [bonusId, interaction.guildId]);

    if (!bonus) {
      return interaction.followUp({
        content: '❌ Super bonus introuvable.',
        flags: 64
      });
    }

    // Ajouter le bonus au joueur (via mystery_box)
    await db.addBonusToPlayer(interaction.guildId, interaction.user.id, bonusId, 'mystery_box', null);

    // Créer l'embed de révélation
    const embed = superBonusHandler.createBonusReceivedEmbed(bonus, `<@${interaction.user.id}>`);

    // Message de révélation
    await interaction.followUp({ embeds: [embed], flags: 64 });

    // Annonce si le bonus est légendaire
    if (bonus.rarity === 'legendary') {
      const announceChannel = interaction.guild.channels.cache.get(process.env.ANNOUNCE_CHANNEL_ID);

      if (announceChannel) {
        const announceEmbed = new EmbedBuilder()
          .setTitle('🌟 SUPER BONUS LÉGENDAIRE !')
          .setDescription(
            `**${interaction.user.username}** vient de recevoir le super bonus légendaire **${bonus.name}** ${bonus.icon} !\n\n` +
            `${bonus.description}`
          )
          .setColor(bonus.color || '#FFD700')
          .setThumbnail(interaction.user.displayAvatarURL())
          .setImage(bonus.image_url)
          .setTimestamp();

        await announceChannel.send({ embeds: [announceEmbed] });
      }
    }

    console.log(`✅ Super bonus révélé: ${bonus.name} (ID: ${bonusId}) pour ${interaction.user.username}`);
  }

  /**
   * Gérer la collection complète
   */
  async handleCollectionComplete(interaction, player, collectible) {
    const theme = await db.queryOne('SELECT * FROM themes WHERE id = $1 AND guild_id = $2', [collectible.theme_id, interaction.guildId]);

    // Marquer comme complété
    await db.completeCollection(interaction.guildId, player.id, collectible.theme_id);

    // Attribuer le rôle final
    const finalRole = interaction.guild.roles.cache.find(r => r.name === theme.final_role_name);

    if (finalRole) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(finalRole);
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
        .setTimestamp();

      await interaction.user.send({
        embeds: [dmEmbed],
        content: `🎉 Bravo ! Tu as reçu le rôle **${theme.final_role_name}** !`
      });
    } catch (e) {
      // Ignore si MPs fermés
    }
  }
}

module.exports = new MysteryBoxHandler();
