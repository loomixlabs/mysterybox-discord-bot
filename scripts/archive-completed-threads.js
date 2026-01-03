require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const THREAD_IDS = [
  '1438657149353066627',
  '1438649867831607316',
  '1438657495894851726'
];

const GUILD_ID = '1248028543389143070';

async function archiveCompletedThreads() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`📍 Serveur: ${guild.name}\n`);

    for (const threadId of THREAD_IDS) {
      console.log('━'.repeat(60));
      console.log(`🧵 Traitement du thread ${threadId}...`);

      try {
        // Vérifier la mission en DB
        const progress = await db.query(
          `SELECT mp.*, m.name as mission_name, p.username
           FROM mission_progress mp
           JOIN missions m ON mp.mission_id = m.id
           JOIN players p ON mp.player_id = p.id
           WHERE mp.guild_id = $1 AND mp.thread_id = $2`,
          [GUILD_ID, threadId]
        );

        if (progress.length === 0) {
          console.log('⚠️  Mission non trouvée en DB, skip');
          continue;
        }

        const mission = progress[0];
        console.log(`   Mission: ${mission.mission_name}`);
        console.log(`   Joueur: ${mission.username}`);
        console.log(`   Statut: ${mission.status}`);

        // Récupérer le thread Discord
        const thread = await client.channels.fetch(threadId);

        if (!thread) {
          console.log('   ❌ Thread Discord introuvable');
          continue;
        }

        console.log(`   Thread: ${thread.name}`);

        // Vérifier si déjà archivé
        if (thread.archived) {
          console.log('   ✅ Thread déjà archivé');
          continue;
        }

        // Archiver le thread
        console.log('   📦 Archivage du thread...');
        await thread.setArchived(true, `Mission ${mission.status} - Nettoyage automatique`);
        console.log('   ✅ Thread archivé avec succès');

        // Envoyer un message de clôture dans le thread avant archivage
        // (note: le thread est déjà archivé, donc on ne peut plus poster)

      } catch (error) {
        console.error(`   ❌ Erreur pour le thread ${threadId}:`, error.message);
      }

      console.log('');
    }

    console.log('━'.repeat(60));
    console.log('\n✅ Traitement terminé !');

    await db.close();
    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

archiveCompletedThreads();
