require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function checkThread() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    const threadId = '1440420226868056187';
    const guildId = '297309737135898624'; // Test server

    console.log(`🔍 Vérification du thread ${threadId}...\n`);

    const guild = await client.guilds.fetch(guildId);
    console.log(`✅ Guild trouvé: ${guild.name}\n`);

    // Méthode 1: guild.client.channels.fetch (celle utilisée dans le code)
    console.log('📌 Méthode 1: guild.client.channels.fetch()');
    try {
      const thread1 = await guild.client.channels.fetch(threadId);
      if (thread1) {
        console.log(`✅ Thread trouvé: "${thread1.name}"`);
        console.log(`   Archivé: ${thread1.archived}`);
        console.log(`   Parent: ${thread1.parent?.name || 'N/A'}`);
        console.log(`   Type: ${thread1.type}`);
        console.log(`   Auto archive duration: ${thread1.autoArchiveDuration} minutes`);
      } else {
        console.log('❌ Thread est null');
      }
    } catch (error) {
      console.error(`❌ Erreur: ${error.message}`);
      console.error(`   Code: ${error.code}`);

      if (error.code === 10003) {
        console.log('\n🔍 ANALYSE:');
        console.log('   Code 10003 = "Unknown Channel"');
        console.log('   Le thread a été SUPPRIMÉ ou n\'existe plus sur Discord');
        console.log('   Causes possibles:');
        console.log('   - Thread archivé automatiquement après 24h d\'inactivité');
        console.log('   - Thread supprimé manuellement');
        console.log('   - Thread créé dans un autre serveur');
      }
    }

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

checkThread();
