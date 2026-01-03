require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
  try {
    const threadId = '1440423667594039327';

    console.log(`🔍 Vérification mission_progress pour thread ${threadId}\n`);

    const mp = await db.queryOne(
      `SELECT mp.*, p.username, p.discord_id, m.name as mission_name
       FROM mission_progress mp
       JOIN players p ON mp.player_id = p.id
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.thread_id = $1`,
      [threadId]
    );

    if (mp) {
      console.log('✅ Mission progress trouvée:');
      console.table({
        id: mp.id,
        player: mp.username,
        mission: mp.mission_name,
        status: mp.status,
        thread_id: mp.thread_id,
        created_at: new Date(mp.created_at).toLocaleString('fr-FR'),
        updated_at: mp.updated_at ? new Date(mp.updated_at).toLocaleString('fr-FR') : '-'
      });
    } else {
      console.log('❌ Aucun mission_progress trouvé pour ce thread');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
