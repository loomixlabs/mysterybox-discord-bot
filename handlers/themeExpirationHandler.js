const cron = require('node-cron');
const db = require('../utils/database-pg');
const { EmbedBuilder } = require('discord.js');

/**
 * Handler pour gérer l'expiration automatique des thèmes
 */
class ThemeExpirationHandler {
  constructor() {
    this.cronTask = null;
  }

  /**
   * Initialiser le système d'expiration
   */
  async init(client) {
    console.log('🔄 Initialisation du système d\'expiration des thèmes...');

    // Vérifier immédiatement les expirations au démarrage
    await this.checkAllExpirations(client);

    // Planifier une vérification quotidienne à 3h du matin
    this.cronTask = cron.schedule('0 3 * * *', async () => {
      console.log('⏰ Vérification quotidienne des expirations de thèmes...');
      await this.checkAllExpirations(client);
    });

    console.log('✅ Système d\'expiration initialisé (vérification quotidienne à 3h)');
  }

  /**
   * Vérifier les expirations pour tous les serveurs
   */
  async checkAllExpirations(client) {
    try {
      // Récupérer tous les thèmes actifs avec durée limitée
      const activeThemes = await db.query(
        `SELECT t.*, gc.guild_id
         FROM themes t
         JOIN guild_config gc ON t.guild_id = gc.guild_id
         WHERE t.is_active = TRUE
           AND t.duration_days > 0
           AND t.activated_at IS NOT NULL`
      );

      console.log(`🔍 Vérification de ${activeThemes.length} thème(s) actif(s) avec durée limitée...`);

      for (const theme of activeThemes) {
        await this.checkThemeExpiration(client, theme);
      }

      console.log('✅ Vérification des expirations terminée');
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des expirations:', error);
    }
  }

  /**
   * Vérifier l'expiration d'un thème spécifique
   */
  async checkThemeExpiration(client, theme) {
    try {
      const expirationInfo = this.calculateExpiration(theme);

      if (expirationInfo.isExpired) {
        console.log(`⏰ Thème "${theme.name}" (${theme.theme_id}) expiré dans le serveur ${theme.guild_id}`);

        // Désactiver le thème
        await db.query(
          `UPDATE themes
           SET is_active = FALSE,
               updated_at = NOW()
           WHERE guild_id = $1 AND id = $2`,
          [theme.guild_id, theme.id]
        );

        // Notifier les admins
        await this.notifyExpiration(client, theme, expirationInfo);

        console.log(`✅ Thème "${theme.name}" désactivé automatiquement`);
      } else if (expirationInfo.daysRemaining <= 7 && expirationInfo.daysRemaining > 0) {
        // Notifier si moins de 7 jours restants
        console.log(`⚠️ Thème "${theme.name}" expire dans ${expirationInfo.daysRemaining} jour(s)`);
        await this.notifyUpcomingExpiration(client, theme, expirationInfo);
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification du thème ${theme.id}:`, error);
    }
  }

  /**
   * Calculer les informations d'expiration d'un thème
   */
  calculateExpiration(theme) {
    // Thème illimité
    if (theme.duration_days === 0) {
      return {
        isExpired: false,
        isUnlimited: true,
        daysRemaining: Infinity,
        hoursRemaining: Infinity,
        percentageRemaining: 100,
        expirationDate: null
      };
    }

    // Pas encore activé
    if (!theme.activated_at) {
      return {
        isExpired: false,
        isUnlimited: false,
        notActivated: true,
        daysRemaining: theme.duration_days,
        hoursRemaining: theme.duration_days * 24,
        percentageRemaining: 100,
        expirationDate: null
      };
    }

    const now = new Date();
    const activatedAt = new Date(theme.activated_at);
    const expirationDate = new Date(activatedAt.getTime() + (theme.duration_days * 24 * 60 * 60 * 1000));

    const timeElapsed = now - activatedAt;
    const timeRemaining = expirationDate - now;
    const totalDuration = theme.duration_days * 24 * 60 * 60 * 1000;

    const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000));
    const percentageRemaining = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));

    return {
      isExpired: timeRemaining <= 0,
      isUnlimited: false,
      notActivated: false,
      daysRemaining: Math.max(0, daysRemaining),
      hoursRemaining: Math.max(0, hoursRemaining),
      percentageRemaining: Math.round(percentageRemaining * 10) / 10,
      expirationDate: expirationDate,
      activatedAt: activatedAt,
      timeElapsed: timeElapsed
    };
  }

  /**
   * Créer un embed graphique pour afficher la durée restante
   */
  createExpirationEmbed(theme, expirationInfo) {
    const embed = new EmbedBuilder()
      .setTitle(`⏱️ DURÉE DU THÈME: ${theme.name}`)
      .setColor(this.getColorByPercentage(expirationInfo.percentageRemaining));

    // Thème illimité
    if (expirationInfo.isUnlimited) {
      embed.setDescription(
        `♾️ **Durée: ILLIMITÉE**\n\n` +
        `Ce thème n'a pas de date d'expiration.\n` +
        `Il restera actif jusqu'à désactivation manuelle.`
      );
      embed.setColor('#FFD700'); // Or
      return embed;
    }

    // Thème pas encore activé
    if (expirationInfo.notActivated) {
      embed.setDescription(
        `⏸️ **Statut: NON ACTIVÉ**\n\n` +
        `📅 **Durée configurée:** ${theme.duration_days} jour(s)\n\n` +
        `💡 Le décompte commencera dès l'activation du thème.`
      );
      embed.setColor('#95A5A6'); // Gris
      return embed;
    }

    // Thème actif avec durée
    const progressBar = this.createProgressBar(expirationInfo.percentageRemaining);
    const statusEmoji = expirationInfo.isExpired ? '🔴' :
                       expirationInfo.daysRemaining <= 3 ? '🟠' :
                       expirationInfo.daysRemaining <= 7 ? '🟡' : '🟢';

    let statusText = '';
    if (expirationInfo.isExpired) {
      statusText = '❌ **EXPIRÉ**';
    } else if (expirationInfo.daysRemaining === 0) {
      statusText = `⏰ **Expire aujourd'hui** (${expirationInfo.hoursRemaining}h restantes)`;
    } else if (expirationInfo.daysRemaining === 1) {
      statusText = `⚠️ **Expire demain** (${expirationInfo.hoursRemaining}h restantes)`;
    } else if (expirationInfo.daysRemaining <= 7) {
      statusText = `⚠️ **${expirationInfo.daysRemaining} jours restants**`;
    } else {
      statusText = `✅ **${expirationInfo.daysRemaining} jours restants**`;
    }

    embed.setDescription(
      `${statusEmoji} ${statusText}\n\n` +
      `${progressBar}\n` +
      `**${expirationInfo.percentageRemaining}%** de la durée restante\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📅 **Activé le:** <t:${Math.floor(expirationInfo.activatedAt.getTime() / 1000)}:D>\n` +
      `⏱️ **Durée totale:** ${theme.duration_days} jour(s)\n` +
      `📆 **Expire le:** <t:${Math.floor(expirationInfo.expirationDate.getTime() / 1000)}:D>\n` +
      `⏰ **Date d'expiration:** <t:${Math.floor(expirationInfo.expirationDate.getTime() / 1000)}:F>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 **Temps restant détaillé:**\n` +
      `• ${expirationInfo.daysRemaining} jour(s)\n` +
      `• ${expirationInfo.hoursRemaining} heure(s)\n\n` +
      (expirationInfo.daysRemaining <= 3 ?
        `⚠️ **Le thème sera désactivé automatiquement à l'expiration.**` :
        `✅ Le thème est actif et fonctionnel.`)
    );

    // Ajouter un footer avec des conseils
    if (expirationInfo.daysRemaining <= 7 && !expirationInfo.isExpired) {
      embed.setFooter({
        text: '💡 Astuce: Tu peux créer un nouveau thème avant l\'expiration pour assurer la continuité !'
      });
    }

    return embed;
  }

  /**
   * Créer une barre de progression visuelle
   */
  createProgressBar(percentage) {
    const totalBars = 20;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    // Choisir les emojis selon le pourcentage
    let fillEmoji, emptyEmoji;
    if (percentage >= 70) {
      fillEmoji = '🟩'; // Vert
      emptyEmoji = '⬜';
    } else if (percentage >= 30) {
      fillEmoji = '🟨'; // Jaune
      emptyEmoji = '⬜';
    } else {
      fillEmoji = '🟥'; // Rouge
      emptyEmoji = '⬜';
    }

    return fillEmoji.repeat(filledBars) + emptyEmoji.repeat(emptyBars);
  }

  /**
   * Obtenir une couleur selon le pourcentage restant
   */
  getColorByPercentage(percentage) {
    if (percentage >= 70) return '#2ecc71'; // Vert
    if (percentage >= 50) return '#f39c12'; // Orange
    if (percentage >= 30) return '#e67e22'; // Orange foncé
    if (percentage > 0) return '#e74c3c';   // Rouge
    return '#95a5a6'; // Gris (expiré)
  }

  /**
   * Notifier l'expiration d'un thème
   */
  async notifyExpiration(client, theme, expirationInfo) {
    try {
      const guild = await client.guilds.fetch(theme.guild_id);
      if (!guild) return;

      // Récupérer le canal d'annonces
      const guildConfig = await db.getGuildConfig(theme.guild_id);
      if (!guildConfig || !guildConfig.announcement_channel_id) {
        console.log(`⚠️ Pas de canal d'annonces configuré pour ${guild.name}`);
        return;
      }

      const channel = await guild.channels.fetch(guildConfig.announcement_channel_id);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('⏰ THÈME EXPIRÉ')
        .setColor('#e74c3c')
        .setDescription(
          `Le thème **${theme.name}** est arrivé à expiration !\n\n` +
          `🆔 **ID du thème:** \`${theme.theme_id}\`\n` +
          `📅 **Activé le:** <t:${Math.floor(new Date(theme.activated_at).getTime() / 1000)}:D>\n` +
          `⏱️ **Durée:** ${theme.duration_days} jour(s)\n` +
          `📆 **Expiré le:** <t:${Math.floor(expirationInfo.expirationDate.getTime() / 1000)}:D>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ **Le thème a été désactivé automatiquement.**\n\n` +
          `💡 **Que faire maintenant ?**\n` +
          `• Crée un nouveau thème via le panel admin\n` +
          `• Ou prolonge ce thème en modifiant sa durée\n` +
          `• Les collectibles et missions de ce thème sont conservés`
        )
        .setTimestamp()
        .setFooter({ text: 'Système d\'expiration automatique' });

      await channel.send({ embeds: [embed] });
      console.log(`📢 Notification d'expiration envoyée dans ${guild.name}`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de la notification d\'expiration:', error);
    }
  }

  /**
   * Notifier d'une expiration prochaine (moins de 7 jours)
   */
  async notifyUpcomingExpiration(client, theme, expirationInfo) {
    try {
      const guild = await client.guilds.fetch(theme.guild_id);
      if (!guild) return;

      const guildConfig = await db.getGuildConfig(theme.guild_id);
      if (!guildConfig || !guildConfig.announcement_channel_id) return;

      const channel = await guild.channels.fetch(guildConfig.announcement_channel_id);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('⚠️ EXPIRATION PROCHAINE')
        .setColor('#f39c12')
        .setDescription(
          `Le thème **${theme.name}** expire bientôt !\n\n` +
          `⏰ **${expirationInfo.daysRemaining} jour(s) restant(s)**\n` +
          `📆 **Date d'expiration:** <t:${Math.floor(expirationInfo.expirationDate.getTime() / 1000)}:F>\n\n` +
          `${this.createProgressBar(expirationInfo.percentageRemaining)}\n` +
          `**${expirationInfo.percentageRemaining}%** de la durée restante\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 **Que faire ?**\n` +
          `• Prépare un nouveau thème pour prendre le relais\n` +
          `• Ou prolonge ce thème via le panel admin\n` +
          `• Le thème sera désactivé automatiquement à l'expiration`
        )
        .setTimestamp()
        .setFooter({ text: 'Rappel automatique' });

      await channel.send({ embeds: [embed] });
      console.log(`📢 Notification d'expiration prochaine envoyée dans ${guild.name}`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de la notification d\'expiration prochaine:', error);
    }
  }

  /**
   * Vérifier si un thème est expiré avant de lancer une boîte
   */
  async checkBeforeLaunch(guildId, themeId) {
    try {
      const themes = await db.query(
        `SELECT * FROM themes WHERE guild_id = $1 AND id = $2`,
        [guildId, themeId]
      );

      if (themes.length === 0) {
        return { valid: false, reason: 'Thème introuvable' };
      }

      const theme = themes[0];
      const expirationInfo = this.calculateExpiration(theme);

      if (expirationInfo.isExpired) {
        // Désactiver automatiquement si pas encore fait
        await db.query(
          `UPDATE themes SET is_active = FALSE WHERE guild_id = $1 AND id = $2`,
          [guildId, themeId]
        );

        return {
          valid: false,
          reason: 'Thème expiré',
          expirationInfo
        };
      }

      return {
        valid: true,
        expirationInfo
      };
    } catch (error) {
      console.error('❌ Erreur lors de la vérification d\'expiration:', error);
      return { valid: false, reason: 'Erreur de vérification' };
    }
  }

  /**
   * Mettre à jour la date d'activation d'un thème
   */
  async updateActivationDate(guildId, themeId) {
    try {
      await db.query(
        `UPDATE themes
         SET activated_at = NOW(),
             updated_at = NOW()
         WHERE guild_id = $1
           AND id = $2
           AND activated_at IS NULL`,
        [guildId, themeId]
      );

      console.log(`✅ Date d'activation mise à jour pour le thème ${themeId}`);
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la date d\'activation:', error);
    }
  }

  /**
   * Arrêter le système d'expiration
   */
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log('⏹️ Système d\'expiration arrêté');
    }
  }
}

module.exports = new ThemeExpirationHandler();
