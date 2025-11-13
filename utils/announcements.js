const db = require('./database-pg');
const { EmbedBuilder } = require('discord.js');

/**
 * Système d'annonces pour les événements du bot
 */
class AnnouncementSystem {
  /**
   * Envoyer une annonce si elle est activée
   */
  async sendAnnouncement(client, guildId, type, data) {
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

      // Envoyer l'annonce
      await channel.send({ embeds: [embed] });
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

  async announceLegendaryCollectible(client, guildId, userName, collectibleName, collectibleImage) {
    return this.sendAnnouncement(client, guildId, 'legendary_collectible', {
      userName,
      collectibleName,
      collectibleImage
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

  async announceCollectionLost(client, guildId, userName, trapName) {
    return this.sendAnnouncement(client, guildId, 'collection_lost', {
      userName,
      trapName
    });
  }

  async announceTrapCurse(client, guildId, userName, trapName, trapEffect) {
    return this.sendAnnouncement(client, guildId, 'trap_curse', {
      userName,
      trapName,
      trapEffect
    });
  }

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
      collectibleName
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

  async announceTrapLoseCollectibleTriggered(client, guildId, userName, trapName, collectibleLost) {
    return this.sendAnnouncement(client, guildId, 'trap_lose_collectible', {
      userName,
      trapName,
      collectibleLost,
      collectible: collectibleLost // Alias pour compatibilité
    });
  }

  async announceTrapPublicShameTriggered(client, guildId, userName, trapName, shameMessage) {
    return this.sendAnnouncement(client, guildId, 'trap_public_shame', {
      userName,
      trapName,
      shameMessage
    });
  }

  async announceTrapMalusPointsTriggered(client, guildId, userName, trapName, malusPoints) {
    return this.sendAnnouncement(client, guildId, 'trap_malus_points', {
      userName,
      trapName,
      malusPoints,
      points: malusPoints // Alias pour compatibilité
    });
  }
}

module.exports = new AnnouncementSystem();
