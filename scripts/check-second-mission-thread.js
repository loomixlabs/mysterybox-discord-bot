require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const SECOND_THREAD_ID = '1438873923877077062';

async function checkSecondMissionThread() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    console.log(`📍 Récupération du thread ${SECOND_THREAD_ID}...`);
    const thread = await client.channels.fetch(SECOND_THREAD_ID);

    if (!thread) {
      console.error('❌ Thread introuvable');
      process.exit(1);
    }

    console.log(`🧵 Thread: ${thread.name}`);
    console.log(`   Archivé: ${thread.archived ? 'Oui' : 'Non'}`);
    console.log(`   Créé: ${thread.createdAt}\n`);

    console.log('━'.repeat(80));
    console.log('📨 MESSAGES DU THREAD:\n');

    const messages = await thread.messages.fetch({ limit: 100 });
    const sortedMessages = Array.from(messages.values()).reverse();

    sortedMessages.forEach((msg, index) => {
      console.log(`[${index + 1}] ${msg.author.tag} - ${msg.createdAt.toLocaleString()}`);

      if (msg.content) {
        console.log(`    ${msg.content}`);
      }

      if (msg.embeds.length > 0) {
        msg.embeds.forEach(embed => {
          if (embed.title) console.log(`    📋 ${embed.title}`);
          if (embed.description) {
            console.log(`       ${embed.description}`);
          }
          if (embed.fields.length > 0) {
            embed.fields.forEach(field => {
              console.log(`       ${field.name}: ${field.value}`);
            });
          }
        });
      }

      if (msg.components.length > 0) {
        console.log(`    🔘 Boutons:`);
        msg.components.forEach((row, i) => {
          row.components.forEach(comp => {
            if (comp.label) {
              console.log(`       - ${comp.label} (${comp.customId})`);
            }
          });
        });
      }

      console.log('');
    });

    console.log('━'.repeat(80));
    console.log(`\n✅ Total: ${sortedMessages.length} messages`);

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkSecondMissionThread();
