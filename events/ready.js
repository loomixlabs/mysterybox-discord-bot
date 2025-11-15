const { ActivityType } = require('discord.js');
const superBonusHandler = require('../handlers/superBonusHandler');
const missionHandler = require('../handlers/missionHandler');
const db = require('../utils/database-pg');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Bot prêt ! Connecté en tant que ${client.user.tag}`);
    console.log(`🎮 Serveurs: ${client.guilds.cache.size}`);
    console.log(`👥 Utilisateurs: ${client.users.cache.size}`);

    // Charger et définir le statut depuis la base de données
    try {
      const primaryGuild = client.guilds.cache.first();

      if (primaryGuild) {
        const branding = await db.getGuildBranding(primaryGuild.id);

        if (branding?.bot_status && branding.bot_status.text) {
          // Utiliser le statut personnalisé depuis la base de données
          const activityTypeMap = {
            'Playing': ActivityType.Playing,
            'Watching': ActivityType.Watching,
            'Listening': ActivityType.Listening,
            'Competing': ActivityType.Competing,
            'Custom': ActivityType.Custom
          };

          const activityType = activityTypeMap[branding.bot_status.type] || ActivityType.Custom;

          client.user.setPresence({
            activities: [{
              name: branding.bot_status.text,
              type: activityType
            }],
            status: 'online'
          });

          console.log(`📊 Statut personnalisé chargé: ${branding.bot_status.type} - ${branding.bot_status.text}`);
        } else {
          // Utiliser le statut par défaut
          client.user.setPresence({
            activities: [{
              name: '🎁 Giveaways en cours',
              type: ActivityType.Watching
            }],
            status: 'online'
          });

          console.log('📊 Statut par défaut appliqué');
        }
      } else {
        // Pas de guild trouvé, utiliser le statut par défaut
        client.user.setPresence({
          activities: [{
            name: '🎁 Giveaways en cours',
            type: ActivityType.Watching
          }],
          status: 'online'
        });
      }
    } catch (error) {
      console.error('⚠️ Erreur lors du chargement du statut:', error.message);
      // En cas d'erreur, utiliser le statut par défaut
      client.user.setPresence({
        activities: [{
          name: '🎁 Giveaways en cours',
          type: ActivityType.Watching
        }],
        status: 'online'
      });
    }

    // Afficher les commandes chargées
    console.log(`\n📋 Commandes disponibles (${client.commands.size}):`);
    client.commands.forEach(cmd => {
      console.log(`   - /${cmd.data.name}`);
    });

    console.log('\n🚀 Le bot est opérationnel !\n');

    // Nettoyage automatique des super bonus expirés (toutes les heures)
    setInterval(() => {
      superBonusHandler.cleanupExpiredBonuses();
    }, 3600000); // 1 heure en millisecondes

    // Nettoyage immédiat au démarrage
    superBonusHandler.cleanupExpiredBonuses();

    // Récupération des missions bloquées (boutons inactifs après restart)
    missionHandler.recoverStaleMissions(client);

    // Vérification des missions expirées (toutes les 10 secondes)
    setInterval(() => {
      missionHandler.checkExpiredMissions(client);
    }, 10000); // 10 secondes en millisecondes

    // Vérification immédiate au démarrage
    missionHandler.checkExpiredMissions(client);
  }
};
