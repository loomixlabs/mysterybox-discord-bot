const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function analyzeThread() {
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    const guildId = '1248028543389143070';
    const threadId = '1441438159253799046';

    console.log('🔍 ANALYSE THREAD MISSION MOT À DEVINER (amelie.vl)\n');
    console.log('='.repeat(80));
    console.log(`\n📍 Thread ID: ${threadId}`);
    console.log(`📍 Guild ID: ${guildId}\n`);

    // 1. Récupérer le thread Discord
    const guild = await client.guilds.fetch(guildId);
    const thread = await guild.channels.fetch(threadId);

    if (!thread) {
      console.error('❌ Thread introuvable sur Discord');
      process.exit(1);
    }

    console.log(`✅ Thread Discord trouvé: ${thread.name}`);
    console.log(`   Archived: ${thread.archived}`);
    console.log(`   Locked: ${thread.locked}`);

    // 2. Récupérer les messages du thread (chercher l'embed)
    console.log('\n\n📨 MESSAGES DU THREAD:\n');
    const messages = await thread.messages.fetch({ limit: 50 });
    console.log(`   Total messages: ${messages.size}\n`);

    let targetChannelId = null;
    let targetKeyword = null;

    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    sortedMessages.forEach((msg, index) => {
      console.log(`\n[Message ${index + 1}] ${msg.author.tag} (${msg.author.id})`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Date: ${msg.createdAt.toLocaleString()}`);

      if (msg.content) {
        console.log(`   Contenu: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`);

        // Extraire depuis le contenu aussi (pas juste embeds)
        const channelMatch = msg.content.match(/<#(\d+)>/);
        if (channelMatch) {
          targetChannelId = channelMatch[1];
          console.log(`\n   ✅ Canal détecté dans contenu: ${targetChannelId}`);
        }

        const keywordMatch = msg.content.match(/le mot \*\*"([^"]+)"\*\*/);
        if (keywordMatch) {
          targetKeyword = keywordMatch[1];
          console.log(`   ✅ Mot-clé détecté dans contenu: ${targetKeyword}`);
        }
      }

      if (msg.embeds.length > 0) {
        console.log(`   Embeds: ${msg.embeds.length}`);
        msg.embeds.forEach((embed, i) => {
          console.log(`\n   [Embed ${i + 1}]`);
          console.log(`     Titre: ${embed.title || 'N/A'}`);
          console.log(`     Description: ${embed.description?.substring(0, 300) || 'N/A'}`);

          // Extraire target_channel_id (format: <#1234567890>)
          const channelMatch = embed.description?.match(/<#(\d+)>/);
          if (channelMatch) {
            targetChannelId = channelMatch[1];
            console.log(`\n     ✅ Canal détecté: ${targetChannelId}`);
          }

          // Extraire target_keyword (format: "mot")
          const keywordMatch = embed.description?.match(/dire le mot "([^"]+)"/);
          if (keywordMatch) {
            targetKeyword = keywordMatch[1];
            console.log(`     ✅ Mot-clé détecté: ${targetKeyword}`);
          }
        });
      }

      if (msg.components.length > 0) {
        console.log(`   Components: ${msg.components.length} ActionRows`);
      }
    });

    // 3. Vérifier mission_progress
    console.log('\n\n📊 MISSION PROGRESS DANS LA DB:\n');
    const progress = await db.queryOne(`
      SELECT
        mp.*,
        m.name as mission_name,
        p.username
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.thread_id = $1
    `, [threadId]);

    if (progress) {
      console.log('Mission trouvée:');
      console.log(`  ID: ${progress.id}`);
      console.log(`  Player: ${progress.username}`);
      console.log(`  Status: ${progress.status}`);
      console.log(`  target_channel_id DB: ${progress.target_channel_id || 'NULL ❌'}`);
      console.log(`  target_keyword DB: ${progress.target_keyword || 'NULL ❌'}`);
    }

    // 4. Proposition de réparation
    if (targetChannelId && targetKeyword) {
      console.log('\n\n✅ VALEURS POUR RÉPARATION:\n');
      console.log(`  target_channel_id: '${targetChannelId}'`);
      console.log(`  target_keyword: '${targetKeyword}'`);
      console.log('\nCommande SQL:');
      console.log(`  UPDATE mission_progress`);
      console.log(`  SET target_channel_id = '${targetChannelId}',`);
      console.log(`      target_keyword = '${targetKeyword}'`);
      console.log(`  WHERE id = ${progress.id};`);
    } else {
      console.log('\n❌ Impossible d\'extraire les valeurs depuis l\'embed');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analyse terminée\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyzeThread();
