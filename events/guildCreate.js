const db = require('../utils/database-pg');
const GuildConfig = require('../utils/guildConfig');
const { LOOMIX_BRANDING } = require('../utils/footerHelper');

/**
 * Event: guildCreate
 * Déclenché quand le bot est invité sur un nouveau serveur
 *
 * Actions:
 * 1. Enregistrer le serveur dans guild_config
 * 2. Démarrer la période d'essai de 14 jours
 * 3. Installer les 11 super bonus fixes
 * 4. Envoyer un message de bienvenue au propriétaire
 */

// Configuration de la période d'essai
const TRIAL_DAYS = 14;

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
      // 1. Enregistrer le serveur et démarrer l'essai
      console.log('\n📋 Enregistrement du serveur...');
      await GuildConfig.registerGuild(guild.id, guild.name, guild.ownerId);
      console.log(`✅ Serveur enregistré dans guild_config`);

      // 2. Démarrer la période d'essai de 14 jours
      console.log(`\n🆓 Démarrage de la période d'essai (${TRIAL_DAYS} jours)...`);
      await GuildConfig.startTrial(guild.id, TRIAL_DAYS, null); // null = illimité
      console.log(`✅ Période d'essai de ${TRIAL_DAYS} jours activée`);

      // 3. Installer les super bonus
      console.log('\n🎁 Installation des super bonus...');
      const result = await db.installSuperBonusesForGuild(guild.id);

      if (result.installed === 11) {
        console.log(`✅ Tous les super bonus installés avec succès (${result.installed}/11)`);
      } else if (result.skipped === 11) {
        console.log(`⏭️  Tous les super bonus étaient déjà installés (${result.skipped}/11)`);
      } else {
        console.log(`⚠️  Installation partielle: ${result.installed} installés, ${result.skipped} déjà existants`);
      }

      // 4. Envoyer un message de bienvenue au propriétaire
      console.log('\n📨 Envoi du message de bienvenue au propriétaire...');
      try {
        const owner = await guild.client.users.fetch(guild.ownerId);
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + TRIAL_DAYS);

        await owner.send({
          content: `🎉 **Merci d'avoir ajouté le bot sur ${guild.name} !**\n\n` +
            `Votre période d'essai de **${TRIAL_DAYS} jours** a commencé.\n` +
            `📅 Date d'expiration: <t:${Math.floor(expirationDate.getTime() / 1000)}:F>\n\n` +
            `**Prochaines étapes:**\n` +
            `1. Utilisez \`/setup\` pour configurer le bot\n` +
            `2. Créez votre premier thème de collection\n` +
            `3. Lancez des mystery boxes !\n\n` +
            `**Besoin d'aide ou passer en Premium ?**\n` +
            `👉 Rejoignez notre serveur Discord: ${LOOMIX_BRANDING.discordInvite}\n\n` +
            `Bonne découverte ! 🚀`
        });
        console.log(`✅ Message de bienvenue envoyé à ${owner.tag}`);
      } catch (dmError) {
        console.log(`⚠️ Impossible d'envoyer le DM au propriétaire (DMs fermés)`);
      }

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
