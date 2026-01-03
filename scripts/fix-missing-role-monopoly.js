/**
 * Script pour attribuer le rôle manquant suite au bug de cache Discord
 * Attribue le rôle "Magnat de l'Immobilier" à xmicordix sur le serveur test
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const GUILD_ID = '297309737135898624';
const USER_DISCORD_ID = '297307186307006464'; // xmicordix
const ROLE_ID = '1441571101187510504'; // 🎩 Magnat de l'Immobilier

async function fixMissingRole() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });

  try {
    await client.login(process.env.BOT_TOKEN);
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

    // Récupérer le serveur
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`📍 Serveur: ${guild.name} (${guild.id})`);

    // Récupérer le rôle
    const role = await guild.roles.fetch(ROLE_ID);
    if (!role) {
      console.error(`❌ Rôle ${ROLE_ID} introuvable!`);
      process.exit(1);
    }
    console.log(`🎭 Rôle trouvé: ${role.name} (${role.id})`);

    // Récupérer le membre
    const member = await guild.members.fetch(USER_DISCORD_ID);
    if (!member) {
      console.error(`❌ Membre ${USER_DISCORD_ID} introuvable!`);
      process.exit(1);
    }
    console.log(`👤 Membre trouvé: ${member.user.tag} (${member.id})`);

    // Vérifier si le membre a déjà le rôle
    if (member.roles.cache.has(ROLE_ID)) {
      console.log(`✅ ${member.user.tag} a déjà le rôle "${role.name}"`);
    } else {
      // Attribuer le rôle
      await member.roles.add(role);
      console.log(`✅ Rôle "${role.name}" attribué à ${member.user.tag}!`);
    }

    client.destroy();
    console.log('\n🎉 Script terminé avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    client.destroy();
    process.exit(1);
  }
}

fixMissingRole();
