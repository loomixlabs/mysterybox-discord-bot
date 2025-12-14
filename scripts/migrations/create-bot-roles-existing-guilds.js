require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../../utils/database-pg');
const BotRoleManager = require('../../utils/botRoleManager');

/**
 * Script pour créer les rôles bot sur les serveurs existants
 * À exécuter une seule fois après la migration add-bot-role-field.js
 */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function createBotRolesForExistingGuilds() {
  console.log('🤖 Création des rôles bot pour les serveurs existants\n');
  console.log('━'.repeat(100));

  try {
    // Connexion du bot
    await client.login(process.env.DISCORD_TOKEN);
    console.log(`✅ Bot connecté: ${client.user.tag}\n`);

    // Récupérer tous les serveurs
    const guilds = client.guilds.cache;
    console.log(`📊 ${guilds.size} serveur(s) trouvé(s)\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const [guildId, guild] of guilds) {
      try {
        console.log(`\n🔄 Traitement de: ${guild.name} (${guildId})`);

        // Récupérer la config du serveur
        const branding = await db.getGuildBranding(guildId);

        // Vérifier si un rôle existe déjà
        if (branding.bot_role_id) {
          const existingRole = guild.roles.cache.get(branding.bot_role_id);
          if (existingRole) {
            console.log(`   ⏭️  Rôle déjà existant: ${existingRole.name}`);
            skipped++;
            continue;
          }
        }

        // Créer le rôle bot
        const botRole = await BotRoleManager.createOrGetBotRole(
          guild,
          branding.bot_display_name,
          branding.primary_color
        );

        console.log(`   ✅ Rôle créé: ${botRole.name} (${botRole.hexColor})`);
        created++;

      } catch (error) {
        console.error(`   ❌ Erreur: ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 RÉSUMÉ:\n');
    console.log(`   ✅ Rôles créés: ${created}`);
    console.log(`   ⏭️  Rôles déjà existants: ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log('\n✅ MIGRATION TERMINÉE\n');

  } catch (error) {
    console.error('\n❌ ERREUR GLOBALE:', error);
    throw error;
  } finally {
    await db.close();
    await client.destroy();
  }
}

createBotRolesForExistingGuilds();
