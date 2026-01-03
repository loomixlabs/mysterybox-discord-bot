require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const STUCK_THREAD_ID = '1438784899120234639';
const GUILD_ID = '1248028543389143070';

async function checkStuckThread() {
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

    // Vérifier en DB
    console.log('📊 Vérification en base de données...\n');

    const progress = await db.query(
      `SELECT mp.*, m.name as mission_name, m.type, m.validation_type, m.validation_data,
              p.username, p.discord_id
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       JOIN players p ON mp.player_id = p.id
       WHERE mp.guild_id = $1 AND mp.thread_id = $2`,
      [GUILD_ID, STUCK_THREAD_ID]
    );

    if (progress.length === 0) {
      console.log('❌ Mission non trouvée en DB');
      process.exit(1);
    }

    const mission = progress[0];
    console.log(`🎯 Mission: ${mission.mission_name}`);
    console.log(`   Joueur: ${mission.username} (${mission.discord_id})`);
    console.log(`   Type: ${mission.type}`);
    console.log(`   Statut: ${mission.status}`);
    console.log(`   Créée: ${mission.created_at}`);
    console.log(`   Complétée: ${mission.completed_at || 'JAMAIS'}`);
    console.log(`   Validation: ${mission.validation_type}`);

    if (mission.validation_data) {
      const validationData = JSON.parse(mission.validation_data);
      console.log(`   Mot à deviner: "${validationData.keyword}" (${validationData.difficulty})`);
      console.log(`   Durée: ${validationData.duration} minutes`);
      console.log(`   Canal: ${validationData.target_channel_id}`);
    }
    console.log('');

    // Vérifier le thread Discord
    console.log('━'.repeat(80));
    console.log('📍 Vérification du thread Discord...\n');

    const thread = await client.channels.fetch(STUCK_THREAD_ID);

    if (!thread) {
      console.log('❌ Thread Discord introuvable');
    } else {
      console.log(`🧵 Thread: ${thread.name}`);
      console.log(`   Archivé: ${thread.archived ? 'Oui' : 'Non'}`);
      console.log(`   Locked: ${thread.locked ? 'Oui' : 'Non'}`);
      console.log(`   Créé: ${thread.createdAt}`);
      console.log('');

      // Lire les messages du thread
      console.log('━'.repeat(80));
      console.log('📨 MESSAGES DU THREAD:\n');

      const messages = await thread.messages.fetch({ limit: 50 });
      const sortedMessages = Array.from(messages.values()).reverse();

      sortedMessages.forEach((msg, index) => {
        console.log(`[${index + 1}] ${msg.author.tag} - ${msg.createdAt.toLocaleString()}`);
        if (msg.content) {
          console.log(`    ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`);
        }
        if (msg.embeds.length > 0) {
          msg.embeds.forEach(embed => {
            if (embed.title) console.log(`    📋 ${embed.title}`);
            if (embed.description) console.log(`       ${embed.description.substring(0, 100)}...`);
          });
        }
      });

      console.log(`\n✅ Total: ${sortedMessages.length} messages`);
    }

    console.log('\n' + '━'.repeat(80));
    console.log('⏰ Vérification du timeout...\n');

    const createdAt = new Date(mission.created_at);
    const now = new Date();
    const elapsed = Math.floor((now - createdAt) / 1000 / 60); // minutes

    if (mission.validation_data) {
      const validationData = JSON.parse(mission.validation_data);
      const duration = validationData.duration || 60;

      console.log(`   Durée mission: ${duration} minutes`);
      console.log(`   Temps écoulé: ${elapsed} minutes`);
      console.log(`   Dépassement: ${elapsed > duration ? `OUI (+${elapsed - duration} min)` : 'Non'}`);

      if (elapsed > duration) {
        console.log('\n   ⚠️  MISSION EXPIRÉE ! Devrait être marquée comme failed.');
      }
    }

    await db.close();
    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkStuckThread();
