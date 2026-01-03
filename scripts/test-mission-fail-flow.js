require('dotenv').config();
const db = require('../utils/database-pg');

async function testMissionFailFlow() {
  try {
    console.log('🔍 TEST - Flow complet échec mission mot-clé\n');
    console.log('='.repeat(80));

    const guildId = '297309737135898624';  // Test server

    // Récupérer une mission mot-clé
    const mission = await db.queryOne(
      `SELECT * FROM missions
       WHERE guild_id = $1 AND type = 'keyword-message'
       LIMIT 1`,
      [guildId]
    );

    if (!mission) {
      console.error('❌ Aucune mission keyword-message trouvée');
      return process.exit(1);
    }

    console.log('✅ Mission trouvée:');
    console.table({
      id: mission.id,
      name: mission.name,
      type: mission.type
    });

    // Récupérer une mission_progress active pour cette mission
    const progress = await db.queryOne(
      `SELECT mp.*, p.username, p.discord_id
       FROM mission_progress mp
       JOIN players p ON mp.player_id = p.id
       WHERE mp.guild_id = $1 AND mp.mission_id = $2 AND mp.status = 'in_progress'
       ORDER BY mp.created_at DESC
       LIMIT 1`,
      [guildId, mission.id]
    );

    if (!progress) {
      console.log('\n⚠️  Aucune mission_progress active pour cette mission');
      console.log('   Créons une mission de test...');

      // Créer une mission de test
      const player = await db.queryOne(
        'SELECT * FROM players WHERE guild_id = $1 LIMIT 1',
        [guildId]
      );

      if (!player) {
        console.error('❌ Aucun joueur trouvé');
        return process.exit(1);
      }

      console.log(`   Joueur: ${player.username} (ID: ${player.id})`);

      // Créer un mission_progress de test
      const testProgress = await db.createMissionProgress(
        guildId,
        player.id,
        mission.id,
        'TEST_THREAD_ID'
      );

      console.log('\n✅ Mission progress de test créée:');
      console.table(testProgress);

      // Nettoyer
      await db.query('DELETE FROM mission_progress WHERE id = $1', [testProgress.id]);
      console.log('✅ Nettoyage terminé\n');
    } else {
      console.log('\n✅ Mission progress active trouvée:');
      console.table({
        id: progress.id,
        username: progress.username,
        discord_id: progress.discord_id,
        thread_id: progress.thread_id,
        status: progress.status,
        created_at: new Date(progress.created_at).toLocaleString('fr-FR')
      });

      // Vérifier si thread_id existe
      if (!progress.thread_id) {
        console.warn('\n⚠️  PROBLÈME: mission_progress.thread_id est NULL');
        console.warn('   findMissionThread retournera null ligne 336-338');
        console.warn('   Le message ne sera PAS envoyé dans le thread');
        console.warn('   Le thread ne sera PAS fermé');
      } else {
        console.log(`\n✅ thread_id présent: ${progress.thread_id}`);
        console.log('   findMissionThread devrait réussir à trouver le thread');
      }
    }

    process.exit(0);

  } catch (error) {
    console.error('\n🔴 Erreur:', error);
    process.exit(1);
  }
}

testMissionFailFlow();
