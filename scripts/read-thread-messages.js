require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const THREAD_ID = '1438784619234463794';

async function readThreadMessages() {
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

    console.log(`📍 Récupération du thread ${THREAD_ID}...`);
    const thread = await client.channels.fetch(THREAD_ID);

    if (!thread) {
      console.error('❌ Thread introuvable');
      process.exit(1);
    }

    console.log(`🧵 Thread: ${thread.name}`);
    console.log(`   Parent: ${thread.parent?.name || 'N/A'}`);
    console.log(`   Archivé: ${thread.archived ? 'Oui' : 'Non'}`);
    console.log(`   Créé: ${thread.createdAt}\n`);

    console.log('━'.repeat(80));
    console.log('📨 MESSAGES DU THREAD:\n');

    // Récupérer tous les messages du thread
    const messages = await thread.messages.fetch({ limit: 100 });

    // Trier par ordre chronologique (du plus ancien au plus récent)
    const sortedMessages = Array.from(messages.values()).reverse();

    sortedMessages.forEach((msg, index) => {
      console.log(`\n[${index + 1}] ${msg.author.tag} (${msg.author.bot ? 'BOT' : 'USER'}) - ${msg.createdAt.toLocaleString()}`);
      console.log(`    ID: ${msg.id}`);

      if (msg.content) {
        console.log(`    Contenu: ${msg.content}`);
      }

      if (msg.embeds.length > 0) {
        console.log(`    📋 Embeds (${msg.embeds.length}):`);
        msg.embeds.forEach((embed, i) => {
          console.log(`       [${i + 1}] Titre: ${embed.title || 'N/A'}`);
          console.log(`           Description: ${embed.description?.substring(0, 200) || 'N/A'}${embed.description?.length > 200 ? '...' : ''}`);
          if (embed.fields.length > 0) {
            console.log(`           Champs:`);
            embed.fields.forEach(field => {
              console.log(`             - ${field.name}: ${field.value}`);
            });
          }
        });
      }

      if (msg.components.length > 0) {
        console.log(`    🔘 Components (${msg.components.length}):`);
        msg.components.forEach((row, i) => {
          console.log(`       Row ${i + 1}:`);
          row.components.forEach(comp => {
            if (comp.customId) {
              console.log(`         - ${comp.style === 1 ? '🔵' : comp.style === 2 ? '⚪' : comp.style === 3 ? '🟢' : comp.style === 4 ? '🔴' : '⚫'} ${comp.label || comp.customId} (${comp.customId})`);
            }
          });
        });
      }

      if (msg.attachments.size > 0) {
        console.log(`    📎 Attachments (${msg.attachments.size}):`);
        msg.attachments.forEach(att => {
          console.log(`       - ${att.name} (${att.url})`);
        });
      }

      if (msg.reactions.cache.size > 0) {
        console.log(`    ❤️ Reactions:`);
        msg.reactions.cache.forEach(reaction => {
          console.log(`       ${reaction.emoji} x${reaction.count}`);
        });
      }
    });

    console.log('\n' + '━'.repeat(80));
    console.log(`\n✅ Total: ${sortedMessages.length} messages`);

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

readThreadMessages();
