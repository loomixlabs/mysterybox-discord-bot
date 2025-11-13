const { ActivityType } = require('discord.js');
const superBonusHandler = require('../handlers/superBonusHandler');
const missionHandler = require('../handlers/missionHandler');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Bot prêt ! Connecté en tant que ${client.user.tag}`);
    console.log(`🎮 Serveurs: ${client.guilds.cache.size}`);
    console.log(`👥 Utilisateurs: ${client.users.cache.size}`);

    // Définir le statut
    client.user.setPresence({
      activities: [{
        name: '🎁 Giveaways en cours',
        type: ActivityType.Watching
      }],
      status: 'online'
    });

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
