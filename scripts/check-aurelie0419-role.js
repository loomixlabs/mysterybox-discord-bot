require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = '1248028543389143070';
const DISCORD_ID = '1188059381233897534'; // aurelie0419
const ROLE_ID = '1437539197987852388';

async function checkRole() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    console.log('🔍 VÉRIFICATION DU RÔLE POUR aurelie0419\n');
    console.log('='.repeat(80));

    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`✅ Guild: ${guild.name}\n`);

    const member = await guild.members.fetch(DISCORD_ID);
    console.log(`✅ Membre trouvé: ${member.user.tag}`);
    console.log(`   Display name: ${member.displayName}`);
    console.log(`   User ID: ${member.id}\n`);

    const role = guild.roles.cache.get(ROLE_ID);
    if (role) {
      console.log(`✅ Rôle trouvé: ${role.name}`);
      console.log(`   Role ID: ${role.id}`);
      console.log(`   Couleur: ${role.hexColor}\n`);
    } else {
      console.log(`❌ Rôle ${ROLE_ID} introuvable dans le serveur\n`);
    }

    const hasRole = member.roles.cache.has(ROLE_ID);

    console.log('='.repeat(80));
    if (hasRole) {
      console.log('✅ Le membre POSSÈDE le rôle !');
      console.log('   → Le problème d\'attribution est résolu');
    } else {
      console.log('❌ Le membre NE POSSÈDE PAS le rôle !');
      console.log('   → Le code d\'attribution n\'a pas fonctionné');
      console.log('\n🔧 ATTRIBUTION DU RÔLE EN COURS...');

      await member.roles.add(role);
      console.log('✅ Rôle attribué avec succès !');

      // Vérifier
      await member.fetch(true); // Force refresh
      const nowHasRole = member.roles.cache.has(ROLE_ID);
      console.log(`\n✅ Vérification: ${nowHasRole ? 'Rôle correctement attribué' : 'Échec d\'attribution'}`);
    }

    console.log('\n📊 Rôles actuels du membre:');
    member.roles.cache.forEach(r => {
      if (r.id !== guild.id) { // Ignorer @everyone
        console.log(`  - ${r.name} (${r.id})`);
      }
    });

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

checkRole();
