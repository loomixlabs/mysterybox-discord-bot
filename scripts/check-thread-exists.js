require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function checkThreadExists() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    const threadId = '1440420226868056187'; // Thread de xmicordix

    console.log(`🔍 Vérification du thread ${threadId}...\n`);

    try {
      const thread = await client.channels.fetch(threadId);

      if (thread) {
        console.log('✅ Thread trouvé:');
        console.log(`   Nom: ${thread.name}`);
        console.log(`   Type: ${thread.type}`);
        console.log(`   Parent: ${thread.parent?.name || 'N/A'}`);
        console.log(`   Créé: ${thread.createdAt}`);
        console.log(`   Archivé: ${thread.archived}`);
        console.log(`   Locked: ${thread.locked || false}`);

        // Lire les derniers messages
        console.log('\n📝 Derniers messages du thread:');
        const messages = await thread.messages.fetch({ limit: 5 });

        if (messages.size === 0) {
          console.log('   Aucun message');
        } else {
          messages.forEach((msg, i) => {
            console.log(`\n   Message ${i + 1}:`);
            console.log(`   Auteur: ${msg.author.tag}`);
            console.log(`   Contenu: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
            if (msg.embeds.length > 0) {
              console.log(`   Embed: ${msg.embeds[0].title || 'N/A'}`);
            }
          });
        }
      }
    } catch (error) {
      console.error(`❌ Thread introuvable: ${error.message}`);
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

checkThreadExists();
