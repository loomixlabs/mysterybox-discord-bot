require('dotenv').config();
const db = require('../utils/database-pg');

async function testMissionProgressCreation() {
  try {
    console.log('🔍 TEST - Création de mission_progress avec les mêmes paramètres\n');
    console.log('='.repeat(80));

    const guildId = '1248028543389143070';  // Monopoly Friends
    const playerId = 760;  // amelie.vl
    const missionId = 13;  // Quiz
    const threadId = '1440405288850296909_TEST';  // Thread ID de test (ajout _TEST pour éviter conflit)

    console.log('\n📋 Paramètres du test:');
    console.log(`   Guild ID: ${guildId}`);
    console.log(`   Player ID: ${playerId}`);
    console.log(`   Mission ID: ${missionId}`);
    console.log(`   Thread ID: ${threadId}`);

    console.log('\n🔍 Vérification de l\'existence des données...');

    // Vérifier que le joueur existe
    const player = await db.queryOne(
      'SELECT * FROM players WHERE id = $1 AND guild_id = $2',
      [playerId, guildId]
    );

    if (!player) {
      console.error('❌ PROBLÈME: Joueur ID 760 introuvable dans la BD!');
      return process.exit(1);
    }
    console.log(`✅ Joueur trouvé: ${player.username} (discord_id: ${player.discord_id})`);

    // Vérifier que la mission existe
    const mission = await db.queryOne(
      'SELECT * FROM missions WHERE id = $1 AND guild_id = $2',
      [missionId, guildId]
    );

    if (!mission) {
      console.error('❌ PROBLÈME: Mission ID 13 introuvable dans la BD!');
      return process.exit(1);
    }
    console.log(`✅ Mission trouvée: ${mission.name} (type: ${mission.type})`);

    // Vérifier s'il existe déjà un mission_progress pour ce joueur et cette mission
    const existingProgress = await db.queryOne(
      `SELECT * FROM mission_progress
       WHERE guild_id = $1 AND player_id = $2 AND mission_id = $3 AND status = 'in_progress'`,
      [guildId, playerId, missionId]
    );

    if (existingProgress) {
      console.warn(`⚠️  Mission progress déjà en cours: ID ${existingProgress.id} (thread_id: ${existingProgress.thread_id})`);
      console.warn('   Cela pourrait expliquer le problème si c\'était le cas lors de la création originale.');
    }

    // Tenter de créer le mission_progress
    console.log('\n🔄 Tentative de création du mission_progress...');

    const result = await db.createMissionProgress(guildId, playerId, missionId, threadId);

    if (result) {
      console.log('✅ Mission progress créé avec succès!');
      console.table(result);

      // Nettoyer (supprimer le test)
      console.log('\n🧹 Nettoyage du test...');
      await db.query(
        'DELETE FROM mission_progress WHERE id = $1',
        [result.id]
      );
      console.log('✅ Nettoyage terminé');
    } else {
      console.error('❌ createMissionProgress a retourné null ou undefined!');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n🔴 ERREUR DÉTECTÉE:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

testMissionProgressCreation();
