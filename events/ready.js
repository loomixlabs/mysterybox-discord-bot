const { ActivityType } = require('discord.js');
const superBonusHandler = require('../handlers/superBonusHandler');
const missionHandler = require('../handlers/missionHandler');
const subscriptionHandler = require('../handlers/subscriptionHandler');
const threadManager = require('../utils/threadManager');
const db = require('../utils/database-pg');
const imageGenerator = require('../utils/imageGenerator');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Bot prêt ! Connecté en tant que ${client.user.tag}`);

    // Configurer le client Discord pour l'imageGenerator (rafraîchissement URLs expirées)
    imageGenerator.setDiscordClient(client);
    console.log(`🎮 Serveurs: ${client.guilds.cache.size}`);
    console.log(`👥 Utilisateurs: ${client.users.cache.size}`);

    // Charger et définir le statut depuis la base de données
    // Utiliser GUILD_ID depuis .env pour garantir la persistance du statut
    try {
      const primaryGuildId = process.env.GUILD_ID;
      const primaryGuild = primaryGuildId ? client.guilds.cache.get(primaryGuildId) : client.guilds.cache.first();

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

    // 🔐 Nettoyage des permissions temporaires orphelines (missions terminées avant cleanup)
    missionHandler.cleanupOrphanedPermissions(client);

    // 🔐 Nettoyage périodique des permissions orphelines (toutes les 10 minutes)
    setInterval(() => {
      missionHandler.cleanupOrphanedPermissions(client);
    }, 600000); // 10 minutes en millisecondes

    // Récupération des missions bloquées (boutons inactifs après restart)
    missionHandler.recoverStaleMissions(client);

    // Vérification des missions expirées (toutes les 10 secondes)
    setInterval(() => {
      missionHandler.checkExpiredMissions(client);
    }, 10000); // 10 secondes en millisecondes

    // Vérification immédiate au démarrage
    missionHandler.checkExpiredMissions(client);

    // === NETTOYAGE DES THREADS ET MISSIONS ===
    // Nettoyage des missions abandonnées (toutes les 5 minutes)
    // Missions créées mais jamais lancées (bouton non cliqué)
    setInterval(() => {
      threadManager.cleanupAbandonedMissions(client, 30); // 30 minutes max
    }, 300000); // 5 minutes en millisecondes

    // Nettoyage immédiat au démarrage (missions abandonnées)
    threadManager.cleanupAbandonedMissions(client, 30);

    // Nettoyage des threads orphelins (toutes les 15 minutes)
    // Threads de missions terminées/échouées non archivés
    setInterval(() => {
      threadManager.cleanupOrphanedThreads(client);
    }, 900000); // 15 minutes en millisecondes

    // Nettoyage immédiat au démarrage (threads orphelins)
    setTimeout(() => {
      threadManager.cleanupOrphanedThreads(client);
    }, 5000); // Attendre 5s que le bot soit bien initialisé

    console.log('🧵 Système de gestion des threads initialisé');

    // === GESTION DES SUBSCRIPTIONS ===
    // Vérification des essais expirés (toutes les heures)
    setInterval(() => {
      subscriptionHandler.checkExpiredTrials(client);
    }, 3600000); // 1 heure en millisecondes

    // Vérification immédiate au démarrage
    subscriptionHandler.checkExpiredTrials(client);

    // Notifications des essais qui expirent bientôt (tous les jours à minuit = 24h)
    setInterval(() => {
      subscriptionHandler.notifyExpiringTrials(client, 3);
    }, 86400000); // 24 heures en millisecondes

    // Notification immédiate au démarrage
    subscriptionHandler.notifyExpiringTrials(client, 3);

    console.log('📊 Système de subscriptions initialisé');
  }
};
