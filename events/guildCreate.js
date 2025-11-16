const db = require('../utils/database-pg');

/**
 * Event: guildCreate
 * Déclenché quand le bot est invité sur un nouveau serveur
 *
 * Actions:
 * 1. Installer les 11 super bonus fixes
 * 2. Logger l'événement
 * 3. (Futur) Créer thème par défaut, config guild, etc.
 */

module.exports = {
  name: 'guildCreate',
  once: false,

  async execute(guild) {
    console.log(`\n🆕 BOT INVITÉ SUR NOUVEAU SERVEUR`);
    console.log('='.repeat(80));
    console.log(`   Nom: ${guild.name}`);
    console.log(`   ID: ${guild.id}`);
    console.log(`   Membres: ${guild.memberCount}`);
    console.log(`   Propriétaire: ${guild.ownerId}`);
    console.log('='.repeat(80));

    try {
      // 1. Installer les super bonus
      console.log('\n🎁 Installation des super bonus...');
      const result = await db.installSuperBonusesForGuild(guild.id);

      if (result.installed === 11) {
        console.log(`✅ Tous les super bonus installés avec succès (${result.installed}/11)`);
      } else if (result.skipped === 11) {
        console.log(`⏭️  Tous les super bonus étaient déjà installés (${result.skipped}/11)`);
      } else {
        console.log(`⚠️  Installation partielle: ${result.installed} installés, ${result.skipped} déjà existants`);
      }

      // 2. TODO: Autres initialisations futures
      // - Créer thème par défaut si souhaité
      // - Créer configuration guild par défaut
      // - Envoyer message de bienvenue au propriétaire
      // - Logger dans audit_logs

      console.log(`\n✅ Initialisation terminée pour ${guild.name}`);
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error(`\n❌ ERREUR lors de l'initialisation du serveur ${guild.name}:`, error);
      console.error(error.stack);

      // Ne pas faire crash le bot, juste logger l'erreur
      // L'admin pourra toujours installer manuellement via un script
    }
  }
};
