/**
 * Handler de gestion des subscriptions et périodes d'essai
 *
 * Vérifie automatiquement les essais expirés et désactive les serveurs
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GuildConfig = require('../utils/guildConfig');
const { LOOMIX_BRANDING, getLoomixFooterOnly } = require('../utils/footerHelper');

/**
 * Vérifie et désactive les essais expirés
 * @param {Client} client - Le client Discord
 */
async function checkExpiredTrials(client) {
  try {
    const expiredTrials = await GuildConfig.getExpiredTrials();

    if (!expiredTrials || expiredTrials.length === 0) {
      return;
    }

    console.log(`⏰ ${expiredTrials.length} essai(s) expiré(s) détecté(s)`);

    for (const guildConfig of expiredTrials) {
      try {
        // Désactiver le serveur
        await GuildConfig.deactivate(guildConfig.guild_id, 'Période d\'essai expirée automatiquement');

        console.log(`🔴 Serveur ${guildConfig.guild_name} (${guildConfig.guild_id}) désactivé - essai expiré`);

        // Optionnel: notifier le propriétaire du serveur
        const guild = client.guilds.cache.get(guildConfig.guild_id);
        if (guild && guildConfig.owner_id) {
          try {
            const owner = await client.users.fetch(guildConfig.owner_id);
            await owner.send({
              content: `⚠️ **Notification importante**\n\n` +
                `La période d'essai du bot sur le serveur **${guild.name}** est terminée.\n\n` +
                `Le bot est maintenant désactivé. Pour continuer à utiliser toutes les fonctionnalités, ` +
                `contactez les administrateurs du bot pour passer en version premium.\n\n` +
                `Merci de votre intérêt pour notre service ! 💎`
            }).catch(() => {
              // DM fermés, ignorer silencieusement
            });
          } catch (err) {
            // Impossible de contacter le propriétaire
          }
        }
      } catch (error) {
        console.error(`🔴 Erreur lors de la désactivation du serveur ${guildConfig.guild_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('🔴 Erreur lors de la vérification des essais expirés:', error);
  }
}

/**
 * Envoie des notifications pour les essais qui expirent bientôt
 * @param {Client} client - Le client Discord
 * @param {number} daysThreshold - Nombre de jours avant expiration (défaut: 3)
 */
async function notifyExpiringTrials(client, daysThreshold = 3) {
  try {
    const expiringTrials = await GuildConfig.getExpiringTrials(daysThreshold);

    if (!expiringTrials || expiringTrials.length === 0) {
      return;
    }

    console.log(`📢 ${expiringTrials.length} essai(s) expire(nt) dans ${daysThreshold} jours`);

    for (const guildConfig of expiringTrials) {
      try {
        const guild = client.guilds.cache.get(guildConfig.guild_id);

        if (guild && guildConfig.owner_id) {
          const expiresAt = new Date(guildConfig.trial_expires_at);
          const daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));

          try {
            const owner = await client.users.fetch(guildConfig.owner_id);
            await owner.send({
              content: `⏰ **Rappel: Essai bientôt terminé**\n\n` +
                `Votre période d'essai sur le serveur **${guild.name}** expire dans **${daysLeft} jour(s)**.\n\n` +
                `📅 Date d'expiration: <t:${Math.floor(expiresAt.getTime() / 1000)}:F>\n\n` +
                `Pour continuer à utiliser toutes les fonctionnalités après cette date, ` +
                `contactez les administrateurs du bot pour passer en version premium. 💎`
            }).catch(() => {
              // DM fermés, ignorer silencieusement
            });
          } catch (err) {
            // Impossible de contacter le propriétaire
          }
        }
      } catch (error) {
        console.error(`⚠️ Erreur lors de la notification pour ${guildConfig.guild_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('🔴 Erreur lors de l\'envoi des notifications d\'expiration:', error);
  }
}

/**
 * Créer le bouton de support Loomix Labs
 * @returns {ActionRowBuilder} Row avec le bouton Loomix
 */
function createLoomixSupportButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🌟 Rejoindre Loomix Labs')
      .setStyle(ButtonStyle.Link)
      .setURL(LOOMIX_BRANDING.discordInvite)
  );
}

/**
 * Créer l'embed de désactivation/expiration
 * @param {string} reason - 'disabled' | 'trial_expired'
 * @param {Object} config - Config du serveur (optionnel)
 * @returns {EmbedBuilder}
 */
function createSubscriptionEmbed(reason, config = null) {
  const embed = new EmbedBuilder()
    .setFooter(getLoomixFooterOnly())
    .setTimestamp();

  if (reason === 'disabled') {
    embed
      .setTitle('🔴 Bot Désactivé')
      .setColor('#E74C3C')
      .setDescription(
        '**Le bot a été désactivé sur ce serveur.**\n\n' +
        'Cela peut être dû à :\n' +
        '• Une désactivation manuelle par un administrateur\n' +
        '• Un problème de paiement\n\n' +
        '**Pour réactiver le bot**, contactez l\'équipe Loomix Labs sur notre serveur Discord.'
      );
  } else if (reason === 'trial_expired') {
    embed
      .setTitle('⏰ Période d\'Essai Terminée')
      .setColor('#F39C12')
      .setDescription(
        '**Votre période d\'essai de 14 jours est terminée.**\n\n' +
        'Vous avez apprécié le bot ? Passez en **version Premium** pour continuer à utiliser toutes les fonctionnalités !\n\n' +
        '**Avantages Premium:**\n' +
        '• ✅ Accès illimité au bot\n' +
        '• ✅ Support prioritaire\n' +
        '• ✅ Nouvelles fonctionnalités en avant-première\n\n' +
        '**Pour passer en Premium**, rejoignez notre serveur Discord et contactez un administrateur.'
      );
  }

  return embed;
}

/**
 * Vérifie le statut de subscription d'un serveur (middleware)
 * À utiliser dans les commandes pour bloquer les serveurs désactivés
 * @param {Interaction} interaction - L'interaction Discord
 * @returns {boolean} true si le serveur est actif, false sinon
 */
async function checkSubscriptionStatus(interaction) {
  const guildId = interaction.guildId;

  // Vérifier si le serveur est enregistré et actif
  const isActive = await GuildConfig.isActive(guildId);

  if (!isActive) {
    // Auto-enregistrer si pas encore fait (nouveau serveur)
    const guild = interaction.guild;
    const config = await GuildConfig.getConfig(guildId);

    if (!config) {
      // Nouveau serveur - l'enregistrer automatiquement + démarrer essai
      await GuildConfig.registerGuild(guildId, guild.name, guild.ownerId);
      await GuildConfig.startTrial(guildId, 14, null);
      console.log(`✅ Nouveau serveur auto-enregistré avec essai: ${guild.name} (${guildId})`);
      return true;
    }

    // Serveur désactivé
    const embed = createSubscriptionEmbed('disabled', config);
    const row = createLoomixSupportButton();

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64
    });
    return false;
  }

  // Vérifier si la période d'essai est expirée
  if (await GuildConfig.isTrialExpired(guildId)) {
    const embed = createSubscriptionEmbed('trial_expired');
    const row = createLoomixSupportButton();

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64
    });
    return false;
  }

  // Mettre à jour la dernière activité
  await GuildConfig.updateActivity(guildId);

  return true;
}

module.exports = {
  checkExpiredTrials,
  notifyExpiringTrials,
  checkSubscriptionStatus
};
