require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
  try {
    const missionIds = [243, 244];

    console.log('🔍 Vérification des keywords pour missions 243 et 244\n');
    console.log('='.repeat(80));

    for (const missionId of missionIds) {
      console.log(`\n📌 Mission ${missionId}`);

      const mp = await db.queryOne(
        `SELECT mp.*, p.username, p.discord_id, m.name as mission_name, m.type
         FROM mission_progress mp
         JOIN players p ON mp.player_id = p.id
         JOIN missions m ON mp.mission_id = m.id
         WHERE mp.id = $1`,
        [missionId]
      );

      if (mp) {
        console.log('Mission progress:');
        console.table({
          id: mp.id,
          player: mp.username,
          discord_id: mp.discord_id,
          mission_name: mp.mission_name,
          mission_id: mp.mission_id,
          mission_type: mp.type,
          status: mp.status,
          thread_id: mp.thread_id
        });

        // Récupérer les keywords
        const keywords = await db.queryAll(
          `SELECT * FROM mission_keywords WHERE mission_id = $1`,
          [mp.mission_id]
        );

        if (keywords.length > 0) {
          console.log('\nKeywords:');
          console.table(keywords.map(k => ({
            id: k.id,
            keyword: k.keyword
          })));
        } else {
          console.log('\n   ❌ Aucun keyword trouvé');
        }

        // Tester la requête getActiveKeywordMissions
        console.log('\n🔍 Test getActiveKeywordMissions:');
        if (keywords.length > 0 && mp.channel_id) {
          const testResults = await db.getActiveKeywordMissions(
            '297309737135898624',  // Test server
            mp.channel_id,
            keywords[0].keyword
          );

          if (testResults && testResults.length > 0) {
            console.log(`   ✅ Mission trouvée avec keyword "${keywords[0].keyword}" dans channel ${mp.channel_id}`);
            console.table(testResults.map(r => ({
              id: r.id,
              status: r.status,
              player_id: r.player_id,
              thread_id: r.thread_id
            })));
          } else {
            console.log(`   ❌ Aucune mission trouvée avec keyword "${keywords[0].keyword}" dans channel ${mp.channel_id}`);
            console.log(`   ⚠️  Cela signifie que le message n'a PAS été envoyé dans le bon canal!`);
          }
        }
      } else {
        console.log('   ❌ Mission progress non trouvée');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
