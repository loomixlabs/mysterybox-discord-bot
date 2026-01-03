require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
  try {
    const threadIds = [
      '1440419771123368048',  // Trouvé ✅
      '1440420056927572072',  // Unknown Channel
      '1440420213047824405',  // Unknown Channel
      '1440423667594039327',  // Test du user
      '1440424953794007151'   // Dernier test du user
    ];

    console.log('🔍 Vérification des threads dans la base de données\n');
    console.log('='.repeat(80));

    for (const threadId of threadIds) {
      console.log(`\n📌 Thread: ${threadId}`);

      const mp = await db.queryOne(
        `SELECT mp.*, p.username, p.discord_id, m.name as mission_name, m.type
         FROM mission_progress mp
         JOIN players p ON mp.player_id = p.id
         JOIN missions m ON mp.mission_id = m.id
         WHERE mp.thread_id = $1`,
        [threadId]
      );

      if (mp) {
        console.table({
          id: mp.id,
          player: mp.username,
          mission: mp.mission_name,
          type: mp.type,
          status: mp.status,
          created_at: new Date(mp.created_at).toLocaleString('fr-FR'),
          updated_at: mp.updated_at ? new Date(mp.updated_at).toLocaleString('fr-FR') : '-'
        });
      } else {
        console.log('   ❌ Aucun mission_progress trouvé');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
