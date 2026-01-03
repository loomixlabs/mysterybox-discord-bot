require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

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

    console.log('✅ Bot connecté');

    const threadId = '1440405288850296909';
    const guildId = '1248028543389143070'; // Monopoly Friends

    // Vérifier en DB
    console.log('\n=== VÉRIFICATION DB ===');
    const missionProgress = await db.queryOne(`
      SELECT mp.*, m.name as mission_name, m.type, p.username
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.thread_id = $1
    `, [threadId]);

    if (missionProgress) {
      console.log('✅ Mission trouvée en DB:');
      console.table(missionProgress);
    } else {
      console.log('❌ AUCUNE mission trouvée en DB pour ce thread_id');
    }

    // Vérifier sur Discord
    console.log('\n=== VÉRIFICATION DISCORD ===');
    const guild = await client.guilds.fetch(guildId);

    try {
      const thread = await guild.channels.fetch(threadId);

      if (thread) {
        console.log('✅ Thread trouvé sur Discord:');
        console.log(`   Nom: ${thread.name}`);
        console.log(`   Type: ${thread.type}`);
        console.log(`   Parent: ${thread.parent?.name || 'N/A'}`);
        console.log(`   Créé: ${thread.createdAt}`);
        console.log(`   Archivé: ${thread.archived}`);

        // Lire les messages du thread
        console.log('\n=== MESSAGES DU THREAD ===');
        const messages = await thread.messages.fetch({ limit: 10 });

        messages.forEach((msg, index) => {
          console.log(`\nMessage ${index + 1}:`);
          console.log(`   Auteur: ${msg.author.tag}`);
          console.log(`   Contenu: ${msg.content.substring(0, 100)}...`);

          if (msg.embeds.length > 0) {
            console.log(`   Embeds: ${msg.embeds.length}`);
            msg.embeds.forEach((embed, i) => {
              console.log(`     Embed ${i + 1} - Titre: ${embed.title || 'N/A'}`);
              console.log(`     Embed ${i + 1} - Description: ${(embed.description || '').substring(0, 100)}...`);
            });
          }

          if (msg.components.length > 0) {
            console.log(`   Components: ${msg.components.length} rows`);
          }
        });
      }
    } catch (error) {
      console.log('❌ Thread introuvable sur Discord:', error.message);
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
