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
    const threadId = '1441352468733886589';

    console.log('🔍 ANALYSE THREAD MISSION MOT À DEVINER\n');
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
    console.log(`   Type: ${thread.type}`);
    console.log(`   Parent: ${thread.parentId}`);
    console.log(`   Archived: ${thread.archived}`);
    console.log(`   Locked: ${thread.locked}`);

    // 2. Récupérer les messages du thread
    console.log('\n\n📨 MESSAGES DU THREAD:\n');
    const messages = await thread.messages.fetch({ limit: 100 });
    console.log(`   Total messages: ${messages.size}\n`);

    messages.reverse().forEach((msg, index) => {
      console.log(`\n[Message ${index + 1}] ${msg.author.tag} (${msg.author.id})`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Date: ${msg.createdAt.toLocaleString()}`);
      console.log(`   Contenu: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`);
      if (msg.embeds.length > 0) {
        console.log(`   Embeds: ${msg.embeds.length}`);
        msg.embeds.forEach((embed, i) => {
          console.log(`     [Embed ${i + 1}] Titre: ${embed.title || 'N/A'}`);
          console.log(`     Description: ${embed.description?.substring(0, 100) || 'N/A'}`);
        });
      }
      if (msg.components.length > 0) {
        console.log(`   Components: ${msg.components.length} ActionRows`);
        msg.components.forEach((row, i) => {
          console.log(`     [Row ${i + 1}] Components: ${row.components.length}`);
          row.components.forEach(comp => {
            if (comp.customId) {
              console.log(`       - ${comp.type}: ${comp.customId} (${comp.label || 'N/A'})`);
            }
          });
        });
      }
    });

    // 3. Chercher la mission progress associée
    console.log('\n\n📊 MISSION PROGRESS DANS LA DB:\n');
    const progress = await db.queryAll(`
      SELECT
        mp.*,
        m.name as mission_name,
        m.type as mission_type,
        p.username,
        p.discord_id
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.thread_id = $1
    `, [threadId]);

    if (progress.length === 0) {
      console.log('⚠️  Aucune mission_progress trouvée avec ce thread_id !');

      // Chercher par guild et statut
      console.log('\n🔍 Recherche de missions "in_progress" dans ce serveur...\n');
      const allProgress = await db.queryAll(`
        SELECT
          mp.*,
          m.name as mission_name,
          m.type as mission_type,
          p.username,
          p.discord_id
        FROM mission_progress mp
        JOIN missions m ON mp.mission_id = m.id
        JOIN players p ON mp.player_id = p.id
        WHERE mp.guild_id = $1
          AND mp.status = 'in_progress'
        ORDER BY mp.created_at DESC
        LIMIT 10
      `, [guildId]);

      console.table(allProgress);
    } else {
      console.table(progress);

      // Vérifier les mots-clés de la mission
      const missionId = progress[0].mission_id;
      console.log(`\n\n🔑 MOTS-CLÉS DE LA MISSION (ID: ${missionId}):\n`);
      const keywords = await db.queryAll(`
        SELECT * FROM mission_keywords
        WHERE mission_id = $1
        ORDER BY id
      `, [missionId]);

      if (keywords.length > 0) {
        console.table(keywords);
      } else {
        console.log('⚠️  Aucun mot-clé trouvé pour cette mission !');
      }

      // Vérifier les logs d'activité
      console.log(`\n\n📜 ACTIVITY LOGS POUR CE THREAD:\n`);
      const logs = await db.queryAll(`
        SELECT *
        FROM activity_logs
        WHERE guild_id = $1
          AND action_type LIKE '%mission%'
          AND (metadata->>'thread_id' = $2 OR metadata->>'mission_progress_id' = $3)
        ORDER BY timestamp DESC
        LIMIT 20
      `, [guildId, threadId, progress[0]?.id?.toString() || '0']);

      if (logs.length > 0) {
        console.table(logs.map(log => ({
          timestamp: new Date(log.timestamp).toLocaleString(),
          action_type: log.action_type,
          user_id: log.user_id,
          metadata: JSON.stringify(log.metadata).substring(0, 100)
        })));
      } else {
        console.log('⚠️  Aucun log trouvé');
      }
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
