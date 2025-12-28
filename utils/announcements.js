const db = require('./database-pg');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

/**
 * Système d'annonces pour les événements du bot
 */
class AnnouncementSystem {
  /**
   * Envoyer une annonce si elle est activée
   * @param {object} options - Options supplémentaires (imageBuffer, imageName)
   */
  async sendAnnouncement(client, guildId, type, data, options = {}) {
    try {
      // Récupérer le canal d'annonces
      const announcementChannel = await db.getAnnouncementChannel(guildId);
      if (!announcementChannel) {
        return; // Pas de canal configuré
      }

      // Récupérer les paramètres
      const settings = await db.getAnnouncementSettings(guildId);
      if (!settings) {
        return;
      }

      // Vérifier si ce type d'annonce est activé
      if (!settings[type]) {
        return; // Cette annonce est désactivée
      }

      // Récupérer le canal Discord
      const channel = await client.channels.fetch(announcementChannel.channel_id).catch(() => null);
      if (!channel) {
        console.warn(`⚠️ Canal d'annonces introuvable: ${announcementChannel.channel_id}`);
        return;
      }

      // Créer l'embed selon le type
      const embed = await this.createAnnouncementEmbed(guildId, type, data);
      if (!embed) {
        return;
      }

      // Préparer les fichiers attachés (image générée avec frame/étoiles)
      const files = [];
      if (options.imageBuffer) {
        const imageName = options.imageName || 'collectible.png';
        const attachment = new AttachmentBuilder(options.imageBuffer, { name: imageName });
        files.push(attachment);
        // Utiliser l'image attachée dans l'embed
        embed.setImage(`attachment://${imageName}`);
      }

      // Envoyer l'annonce
      await channel.send({ embeds: [embed], files });
      console.log(`📢 Annonce envoyée: ${type} (Serveur: ${guildId})`);

    } catch (error) {
      console.error(`❌ Erreur lors de l'envoi de l'annonce (${type}):`, error);
    }
  }

  /**
   * Créer l'embed selon le type d'annonce
   */
  async createAnnouncementEmbed(guildId, type, data) {
    try {
      // Récupérer le template depuis la base de données
      const template = await db.getAnnouncementTemplate(type, guildId);

      if (!template) {
        console.warn(`⚠️ Template d'annonce introuvable: ${type} (Serveur: ${guildId})`);
        return null;
      }

      // Remplacer les variables dans le titre et la description
      let title = template.title;
      let description = template.description;

      // Remplacer toutes les variables dans le texte
      Object.keys(data).forEach(key => {
        const variable = `{${key}}`;
        const value = data[key] || '';
        title = title.replace(new RegExp(variable, 'g'), value);
        description = description.replace(new RegExp(variable, 'g'), value);
      });

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(template.color)
        .setTimestamp()
        .setFooter({ text: template.footer_text || 'Système d\'annonces' });

      // Ajouter l'image principale si définie
      if (template.image_url) {
        embed.setImage(template.image_url);
      }

      // Ajouter le thumbnail si défini
      if (template.thumbnail_url) {
        embed.setThumbnail(template.thumbnail_url);
      }

      // Pour les collectibles légendaires, utiliser l'image du collectible si pas de thumbnail dans le template
      if (type === 'legendary_collectible' && !template.thumbnail_url && data.collectibleImage) {
        embed.setThumbnail(data.collectibleImage);
      }

      return embed;

    } catch (error) {
      console.error(`❌ Erreur lors de la création de l'embed pour ${type}:`, error);
      return null;
    }
  }

  /**
   * Méthodes pratiques pour chaque type d'annonce
   */

  /**
   * Annoncer un collectible légendaire obtenu
   * @param {Buffer} imageBuffer - Image générée avec frame/étoiles/mint (optionnel)
   */
  async announceLegendaryCollectible(client, guildId, userName, collectibleName, collectibleImage, imageBuffer = null) {
    return this.sendAnnouncement(client, guildId, 'legendary_collectible', {
      userName,
      collectibleName,
      collectibleImage
    }, {
      imageBuffer,
      imageName: 'legendary_collectible.png'
    });
  }

  async announceCollectionCompleted(client, guildId, userName, themeName, roleName) {
    return this.sendAnnouncement(client, guildId, 'collection_completed', {
      userName,
      themeName,
      roleName
    });
  }

  async announceCollectionTraded(client, guildId, user1Name, user2Name, missionName) {
    return this.sendAnnouncement(client, guildId, 'collection_traded', {
      user1Name,
      user2Name,
      missionName
    });
  }

  async announceCollectionLost(client, guildId, userName, trapName, collectibleName = '') {
    return this.sendAnnouncement(client, guildId, 'collection_lost', {
      userName,
      trapName,
      collectibleName,
      collectibleLost: collectibleName, // Alias pour rétro-compatibilité
      collectible: collectibleName // Alias supplémentaire
    });
  }

  // Méthode obsolète - remplacée par announceTrapEmptyBox et announceTrapLoseAllCollectibles
  // async announceTrapCurse - SUPPRIMÉ

  async announceTrapEmptyBox(client, guildId, userName, trapName) {
    return this.sendAnnouncement(client, guildId, 'trap_empty_box', {
      userName,
      trapName
    });
  }

  async announceTrapLoseCollectibleTriggered(client, guildId, userName, trapName, collectibleName) {
    return this.sendAnnouncement(client, guildId, 'trap_lose_collectible', {
      userName,
      trapName,
      collectibleName,
      collectibleLost: collectibleName, // Alias pour rétro-compatibilité
      collectible: collectibleName // Alias supplémentaire
    });
  }

  async announceTrapLoseAllCollectiblesTriggered(client, guildId, userName, trapName, count) {
    return this.sendAnnouncement(client, guildId, 'trap_lose_all_collectibles', {
      userName,
      trapName,
      count
    });
  }

  async announceMissionWordGuessed(client, guildId, userName, word, missionName) {
    return this.sendAnnouncement(client, guildId, 'mission_word_guessed', {
      userName,
      word,
      missionName
    });
  }

  /**
   * NOUVEAUX TYPES D'ANNONCES - Thèmes
   */

  async announceThemeExpired(client, guildId, themeName, durationDays, expirationDate) {
    return this.sendAnnouncement(client, guildId, 'theme_expired', {
      themeName,
      durationDays,
      expirationDate: `<t:${Math.floor(expirationDate.getTime() / 1000)}:F>`
    });
  }

  async announceThemeExpiringSoon(client, guildId, themeName, daysRemaining, expirationDate) {
    return this.sendAnnouncement(client, guildId, 'theme_expiring_soon', {
      themeName,
      daysRemaining,
      expirationDate: `<t:${Math.floor(expirationDate.getTime() / 1000)}:F>`
    });
  }

  /**
   * NOUVEAUX TYPES D'ANNONCES - Missions
   */

  async announceMissionStarted(client, guildId, userName, missionName, timeLimit) {
    return this.sendAnnouncement(client, guildId, 'mission_started', {
      userName,
      missionName,
      timeLimit
    });
  }

  async announceMissionCompleted(client, guildId, userName, missionName, rewardName) {
    return this.sendAnnouncement(client, guildId, 'mission_completed', {
      userName,
      missionName,
      rewardName
    });
  }

  async announceMissionFailed(client, guildId, userName, missionName, failReason) {
    return this.sendAnnouncement(client, guildId, 'mission_failed', {
      userName,
      missionName,
      failReason
    });
  }

  async announceMissionApproved(client, guildId, userName, missionName, adminName, rewardName) {
    return this.sendAnnouncement(client, guildId, 'mission_approved', {
      userName,
      missionName,
      adminName,
      rewardName
    });
  }

  async announceMissionRejected(client, guildId, userName, missionName, adminName) {
    return this.sendAnnouncement(client, guildId, 'mission_rejected', {
      userName,
      missionName,
      adminName
    });
  }

  /**
   * NOUVEAUX TYPES D'ANNONCES - Pièges Spécifiques
   */

  async announceTrapCooldownTriggered(client, guildId, userName, trapName, cooldownMinutes) {
    return this.sendAnnouncement(client, guildId, 'trap_cooldown', {
      userName,
      trapName,
      cooldownMinutes,
      duration: cooldownMinutes // Alias pour compatibilité
    });
  }

  // NOTE: announceTrapLoseCollectibleTriggered déplacé plus haut dans le fichier (ligne 156)

  async announceTrapPublicShameTriggered(client, guildId, userName, trapName, shameMessage) {
    return this.sendAnnouncement(client, guildId, 'trap_public_shame', {
      userName,
      trapName,
      shameMessage
    });
  }

  // Méthode obsolète - supprimée car type trap_malus_points n'existe plus
  // async announceTrapMalusPointsTriggered - SUPPRIMÉ

  /**
   * NOUVEAUX TYPES D'ANNONCES - Évolution des Collectibles
   */

  /**
   * Annoncer un level up de collectible (fusion doublon)
   * @param {Buffer} imageBuffer - Image générée avec frame/étoiles/mint (optionnel)
   */
  async announceCollectibleLevelUp(client, guildId, userName, collectibleName, oldLevel, newLevel, currentXP, requiredXP, imageBuffer = null) {
    return this.sendAnnouncement(client, guildId, 'collectible_level_up', {
      userName,
      collectibleName,
      oldLevel,
      newLevel,
      currentXP,
      requiredXP
    }, {
      imageBuffer,
      imageName: 'level_up.png'
    });
  }

  /**
   * Annoncer qu'un collectible a atteint le niveau maximum
   * @param {Buffer} imageBuffer - Image générée avec frame/étoiles/mint (optionnel)
   */
  async announceCollectibleMaxLevel(client, guildId, userName, collectibleName, maxLevel, mintNumber, imageBuffer = null) {
    return this.sendAnnouncement(client, guildId, 'collectible_max_level', {
      userName,
      collectibleName,
      maxLevel,
      mintNumber
    }, {
      imageBuffer,
      imageName: 'max_level.png'
    });
  }

  /**
   * Annoncer qu'un collectible perdu a été restauré avec sa progression
   * @param {Buffer} imageBuffer - Image générée avec frame/étoiles/mint (optionnel)
   */
  async announceCollectibleRestored(client, guildId, userName, collectibleName, level, xp, mintNumber, imageBuffer = null) {
    return this.sendAnnouncement(client, guildId, 'collectible_restored', {
      userName,
      collectibleName,
      level,
      xp,
      mintNumber
    }, {
      imageBuffer,
      imageName: 'restored.png'
    });
  }

  /**
   * Annoncer un super bonus légendaire obtenu
   */
  async announceSuperBonus(client, guildId, userName, bonusName, bonusIcon, bonusImage) {
    return this.sendAnnouncement(client, guildId, 'legendary_super_bonus', {
      userName,
      bonusName,
      bonusIcon,
      bonusImage
    });
  }

  /**
   * Annoncer un super bonus avec un GIF local attaché
   */
  async announceSuperBonusWithAttachment(client, guildId, userName, bonusName, bonusIcon, gifPath) {
    try {
      // Récupérer le canal d'annonces
      const announcementChannel = await db.getAnnouncementChannel(guildId);
      if (!announcementChannel) {
        return;
      }

      // Récupérer les paramètres
      const settings = await db.getAnnouncementSettings(guildId);
      if (!settings || !settings.legendary_super_bonus) {
        return;
      }

      // Récupérer le canal Discord
      const channel = await client.channels.fetch(announcementChannel.channel_id).catch(() => null);
      if (!channel) {
        console.warn(`⚠️ Canal d'annonces introuvable: ${announcementChannel.channel_id}`);
        return;
      }

      // Créer l'attachment pour le GIF
      const attachment = new AttachmentBuilder(gifPath, { name: 'joker-wow.gif' });

      // Créer l'embed épique pour le joker
      const embed = new EmbedBuilder()
        .setTitle('🃏✨ MYSTERYBOX JOKER OBTENU ! ✨🃏')
        .setDescription(
          `╔═══════════════════════════════════════════════╗\n` +
          `║     🎰 **BONUS ULTRA-LÉGENDAIRE** 🎰      ║\n` +
          `╚═══════════════════════════════════════════════╝\n\n` +
          `🌟 **${userName}** vient d'obtenir le **MysteryBox Joker** !\n\n` +
          `Le bonus le plus puissant du jeu est maintenant sien ! 🃏\n\n` +
          `*Il pourra choisir N'IMPORTE QUEL collectible manquant !*`
        )
        .setColor('#FFD700')
        .setImage('attachment://joker-wow.gif')
        .setFooter({ text: '🃏 MysteryBox Joker • Bonus Légendaire' })
        .setTimestamp();

      await channel.send({ embeds: [embed], files: [attachment] });
      console.log(`📢 Annonce Joker OBTENTION envoyée avec GIF (Serveur: ${guildId})`);

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'annonce Joker:', error);
    }
  }

  /**
   * Annoncer l'UTILISATION du Joker avec le collectible choisi
   */
  async announceJokerUsed(client, guildId, userName, collectibleName, collectibleRarity, gifPath) {
    try {
      // Récupérer le canal d'annonces
      const announcementChannel = await db.getAnnouncementChannel(guildId);
      if (!announcementChannel) {
        return;
      }

      // Récupérer les paramètres - vérifier le toggle super_bonus_joker_used
      const settings = await db.getAnnouncementSettings(guildId);
      if (!settings || !settings.super_bonus_joker_used) {
        return;
      }

      // Récupérer le canal Discord
      const channel = await client.channels.fetch(announcementChannel.channel_id).catch(() => null);
      if (!channel) {
        console.warn(`⚠️ Canal d'annonces introuvable: ${announcementChannel.channel_id}`);
        return;
      }

      // Créer l'attachment pour le GIF
      const attachment = new AttachmentBuilder(gifPath, { name: 'joker-wow.gif' });

      // Mapping rareté vers label français
      const rarityLabels = {
        legendary: 'LÉGENDAIRE',
        epic: 'ÉPIQUE',
        rare: 'RARE',
        common: 'COMMUN'
      };
      const rarityLabel = rarityLabels[collectibleRarity] || collectibleRarity.toUpperCase();

      // Mapping rareté vers emoji
      const rarityEmojis = {
        legendary: '👑',
        epic: '💜',
        rare: '💙',
        common: '⚪'
      };
      const rarityEmoji = rarityEmojis[collectibleRarity] || '✨';

      // Créer l'embed pour l'UTILISATION du joker
      const embed = new EmbedBuilder()
        .setTitle('🃏✨ MYSTERYBOX JOKER UTILISÉ ✨🃏')
        .setDescription(
          `╔═══════════════════════════════════════════════╗\n` +
          `║     🎰 **BONUS LÉGENDAIRE ACTIVÉ** 🎰      ║\n` +
          `╚═══════════════════════════════════════════════╝\n\n` +
          `🃏 **${userName}** a utilisé son **MysteryBox Joker** !\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🎁 **Collectible choisi:**\n\n` +
          `╭─────────────────────────────────────────╮\n` +
          `│  ${rarityEmoji} **${collectibleName}**\n` +
          `│  \n` +
          `│  📊 Rareté: **${rarityLabel}**\n` +
          `╰─────────────────────────────────────────╯\n\n` +
          `*Le pouvoir du Joker a été consommé !* ✨`
        )
        .setColor('#FFD700')
        .setImage('attachment://joker-wow.gif')
        .setFooter({ text: '🃏 MysteryBox Joker • Le pouvoir a été consommé' })
        .setTimestamp();

      await channel.send({ embeds: [embed], files: [attachment] });
      console.log(`📢 Annonce Joker UTILISATION envoyée: ${collectibleName} (${collectibleRarity}) pour ${userName}`);

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'annonce Joker utilisé:', error);
    }
  }
}

module.exports = new AnnouncementSystem();
