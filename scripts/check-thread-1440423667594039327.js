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

    const threadId = '1440423667594039327';
    const guildId = '297309737135898624'; // Test server

    console.log(`🔍 Vérification du thread ${threadId}...\n`);

    const guild = await client.guilds.fetch(guildId);
    console.log(`✅ Guild trouvé: ${guild.name}\n`);

    // Méthode 1: guild.channels.fetch (celle utilisée dans le code)
    console.log('📌 Méthode 1: guild.channels.fetch()');
    try {
      const thread1 = await guild.channels.fetch(threadId);
      if (thread1) {
        console.log(`✅ Thread trouvé: "${thread1.name}"`);
        console.log(`   Archivé: ${thread1.archived}`);
        console.log(`   Parent: ${thread1.parent?.name || 'N/A'}`);
      } else {
        console.log('❌ Thread est null');
      }
    } catch (error) {
      console.error(`❌ Erreur: ${error.message}`);
      console.error(`   Code: ${error.code}`);
    }

    // Méthode 2: client.channels.fetch (l'ancienne méthode)
    console.log('\n📌 Méthode 2: client.channels.fetch()');
    try {
      const thread2 = await client.channels.fetch(threadId);
      if (thread2) {
        console.log(`✅ Thread trouvé: "${thread2.name}"`);
        console.log(`   Archivé: ${thread2.archived}`);
        console.log(`   Parent: ${thread2.parent?.name || 'N/A'}`);
      } else {
        console.log('❌ Thread est null');
      }
    } catch (error) {
      console.error(`❌ Erreur: ${error.message}`);
      console.error(`   Code: ${error.code}`);
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
