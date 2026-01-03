const db = require('../utils/database-pg');

async function fixMission668() {
  try {
    console.log('🔧 RÉPARATION MISSION ID 668 (amelie.vl)\n');
    console.log('='.repeat(80));

    // Vérifier l'état actuel
    console.log('\n📊 ÉTAT ACTUEL:\n');
    const before = await db.queryOne(`
      SELECT
        mp.*,
        m.name as mission_name,
        p.username
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.id = 668
    `);

    if (!before) {
      console.log('❌ Mission 668 introuvable');
      process.exit(1);
    }

    console.log('Mission trouvée:');
    console.log(`  ID: ${before.id}`);
    console.log(`  Player: ${before.username}`);
    console.log(`  Thread: ${before.thread_id}`);
    console.log(`  Status: ${before.status}`);
    console.log(`  target_channel_id: ${before.target_channel_id || 'NULL ❌'}`);
    console.log(`  target_keyword: ${before.target_keyword || 'NULL ❌'}`);

    // Appliquer la correction
    console.log('\n\n🔧 APPLICATION DE LA CORRECTION:\n');
    const targetChannelId = '1264703299584786484';
    const targetKeyword = 'marâtre';

    console.log(`  target_channel_id: '${targetChannelId}'`);
    console.log(`  target_keyword: '${targetKeyword}'`);

    await db.query(`
      UPDATE mission_progress
      SET
        target_channel_id = $1,
        target_keyword = $2
      WHERE id = 668
    `, [targetChannelId, targetKeyword]);

    console.log('\n✅ Mise à jour effectuée !');

    // Vérifier le résultat
    console.log('\n\n📊 ÉTAT APRÈS CORRECTION:\n');
    const after = await db.queryOne(`
      SELECT
        mp.*,
        m.name as mission_name,
        p.username
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.id = 668
    `);

    console.log('Mission mise à jour:');
    console.log(`  ID: ${after.id}`);
    console.log(`  Player: ${after.username}`);
    console.log(`  Thread: ${after.thread_id}`);
    console.log(`  Status: ${after.status}`);
    console.log(`  target_channel_id: ${after.target_channel_id || 'NULL ❌'} ${after.target_channel_id ? '✅' : '❌'}`);
    console.log(`  target_keyword: ${after.target_keyword || 'NULL ❌'} ${after.target_keyword ? '✅' : '❌'}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Réparation terminée\n');
    console.log('🎯 Le bot peut maintenant détecter quand le mot "marâtre" est dit dans le canal');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixMission668();
