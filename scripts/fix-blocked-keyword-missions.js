const db = require('../utils/database-pg');

async function fixBlockedKeywordMissions() {
  try {
    console.log('🔧 RÉPARATION MISSIONS "MOT À DEVINER" BLOQUÉES\n');
    console.log('='.repeat(80));

    const guildId = '1248028543389143070';

    // ÉTAPE 1: Fixer la mission spécifique (ID 654)
    console.log('\n📍 ÉTAPE 1: RÉPARATION MISSION ID 654\n');

    const mission654 = await db.queryOne(`
      SELECT
        mp.*,
        m.name as mission_name,
        p.username,
        p.discord_id
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.id = 654
    `);

    if (!mission654) {
      console.log('⚠️  Mission 654 introuvable');
    } else {
      console.log('Mission trouvée:');
      console.log(`  ID: ${mission654.id}`);
      console.log(`  Player: ${mission654.username} (${mission654.discord_id})`);
      console.log(`  Thread: ${mission654.thread_id}`);
      console.log(`  Status: ${mission654.status}`);
      console.log(`  target_channel_id: ${mission654.target_channel_id || 'NULL ❌'}`);
      console.log(`  target_keyword: ${mission654.target_keyword || 'NULL ❌'}`);

      // Essayer de récupérer les infos depuis le thread Discord
      console.log('\n🔍 Tentative de récupération des données depuis le message embed...');

      // Pour l'instant, on utilise les valeurs identifiées dans l'analyse
      const targetChannelId = '1264703299584786484';
      const targetKeyword = 'diamant';

      console.log(`\n✅ Réparation avec:`);
      console.log(`  target_channel_id: ${targetChannelId}`);
      console.log(`  target_keyword: ${targetKeyword}`);

      await db.query(`
        UPDATE mission_progress
        SET
          target_channel_id = $1,
          target_keyword = $2
        WHERE id = 654
      `, [targetChannelId, targetKeyword]);

      console.log('✅ Mission 654 réparée !');
    }

    // ÉTAPE 2: Trouver TOUTES les missions affectées
    console.log('\n\n📍 ÉTAPE 2: RECHERCHE MISSIONS AFFECTÉES\n');

    const affectedMissions = await db.queryAll(`
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
        AND m.type = 'keyword-message'
        AND (mp.target_channel_id IS NULL OR mp.target_keyword IS NULL)
      ORDER BY mp.created_at DESC
    `, [guildId]);

    console.log(`\n🔍 Résultats: ${affectedMissions.length} mission(s) affectée(s)\n`);

    if (affectedMissions.length > 0) {
      console.table(affectedMissions.map(m => ({
        id: m.id,
        player: m.username,
        status: m.status,
        thread_id: m.thread_id,
        target_channel_id: m.target_channel_id || 'NULL ❌',
        target_keyword: m.target_keyword || 'NULL ❌',
        created_at: new Date(m.created_at).toLocaleString()
      })));

      console.log('\n⚠️  IMPORTANT: Ces missions doivent être réparées manuellement');
      console.log('    Pour chaque mission, il faut:');
      console.log('    1. Récupérer le message embed du thread');
      console.log('    2. Extraire target_channel_id et target_keyword');
      console.log('    3. Mettre à jour la mission_progress');
    } else {
      console.log('✅ Aucune autre mission affectée trouvée');
    }

    // ÉTAPE 3: Analyser le code de création
    console.log('\n\n📍 ÉTAPE 3: ANALYSE CODE CRÉATION MISSIONS\n');

    console.log('🔍 Fichiers à vérifier:');
    console.log('  1. handlers/missionHandler.js - handleMissionStart()');
    console.log('  2. handlers/missionHandler.js - Création du thread mission');
    console.log('  3. utils/database-pg.js - createMissionProgress()');

    console.log('\n🔍 Points de contrôle:');
    console.log('  ✓ Vérifier que target_channel_id est bien passé lors de la création');
    console.log('  ✓ Vérifier que target_keyword est bien passé lors de la création');
    console.log('  ✓ Vérifier qu\'il n\'y a pas de condition qui les met à NULL');

    // STATISTIQUES FINALES
    console.log('\n\n📊 STATISTIQUES FINALES\n');

    const totalKeywordMissions = await db.queryOne(`
      SELECT COUNT(*) as total
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1
        AND m.type = 'keyword-message'
    `, [guildId]);

    const blockedMissions = await db.queryOne(`
      SELECT COUNT(*) as total
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1
        AND m.type = 'keyword-message'
        AND (mp.target_channel_id IS NULL OR mp.target_keyword IS NULL)
    `, [guildId]);

    console.log(`Total missions "Mot à Deviner": ${totalKeywordMissions.total}`);
    console.log(`Missions bloquées (NULL): ${blockedMissions.total}`);
    console.log(`Taux de succès: ${(((totalKeywordMissions.total - blockedMissions.total) / totalKeywordMissions.total) * 100).toFixed(2)}%`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analyse terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixBlockedKeywordMissions();
