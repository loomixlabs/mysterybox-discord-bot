const db = require('./utils/database-pg');

async function verify() {
  try {
    console.log('🔍 VÉRIFICATION TIMEOUTS MISSIONS\n');
    console.log('='.repeat(80));

    // Récupérer toutes les missions en cours
    const missions = await db.queryAll(`
      SELECT
        mp.id,
        mp.status,
        mp.expires_at,
        mp.created_at,
        mp.thread_id,
        m.name as mission_name,
        m.timeout as mission_timeout,
        p.username,
        p.discord_id,
        EXTRACT(EPOCH FROM (NOW() - mp.created_at)) as elapsed_seconds,
        EXTRACT(EPOCH FROM (mp.expires_at - NOW())) as remaining_seconds
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.guild_id = $1
      ORDER BY mp.created_at DESC
      LIMIT 10
    `, [process.env.GUILD_ID]);

    console.log(`\n📋 Missions trouvées : ${missions.length}\n`);

    if (missions.length === 0) {
      console.log('⚠️  Aucune mission trouvée');
      process.exit(0);
    }

    missions.forEach((mission, index) => {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`Mission #${index + 1}: ${mission.mission_name}`);
      console.log(`  ID: ${mission.id}`);
      console.log(`  Joueur: ${mission.username} (${mission.discord_id})`);
      console.log(`  Status: ${mission.status}`);
      console.log(`  Thread ID: ${mission.thread_id || 'N/A'}`);
      console.log(`  Timeout configuré: ${mission.mission_timeout} secondes`);
      console.log(`  Créée le: ${mission.created_at}`);
      console.log(`  Expire le: ${mission.expires_at || 'N/A'}`);

      if (mission.expires_at) {
        console.log(`  Temps écoulé: ${Math.round(mission.elapsed_seconds)} secondes`);
        console.log(`  Temps restant: ${Math.round(mission.remaining_seconds)} secondes`);

        if (mission.remaining_seconds < 0) {
          console.log(`  ⚠️  MISSION EXPIRÉE depuis ${Math.abs(Math.round(mission.remaining_seconds))} secondes`);
        } else {
          console.log(`  ✅ Mission encore valide`);
        }
      } else {
        console.log(`  ⚠️  PAS D'EXPIRATION DÉFINIE`);
      }
    });

    console.log(`\n${'='.repeat(80)}`);

    // Vérifier les missions qui devraient être expirées
    const expiredMissions = await db.queryAll(`
      SELECT mp.*, m.name as mission_name, p.username
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.status = 'in_progress'
        AND mp.expires_at IS NOT NULL
        AND mp.expires_at < NOW()
        AND mp.guild_id = $1
    `, [process.env.GUILD_ID]);

    console.log(`\n🔥 Missions expirées détectées: ${expiredMissions.length}`);

    if (expiredMissions.length > 0) {
      console.log('\n⚠️  Ces missions devraient être marquées comme échouées:');
      expiredMissions.forEach(m => {
        console.log(`  - ${m.mission_name} (ID: ${m.id}, Joueur: ${m.username})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verify();
