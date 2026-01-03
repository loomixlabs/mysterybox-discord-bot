require('dotenv').config();
const db = require('../utils/database-pg');

async function checkAmelieMissionHistory() {
  try {
    console.log('🔍 HISTORIQUE - Missions d\'amelie.vl\n');
    console.log('='.repeat(80));

    const guildId = '1248028543389143070';
    const discordId = '1439668164253192262';  // amelie.vl

    // Récupérer le player_id
    const player = await db.queryOne(
      'SELECT * FROM players WHERE discord_id = $1 AND guild_id = $2',
      [discordId, guildId]
    );

    if (!player) {
      console.error('❌ Joueur amelie.vl introuvable');
      return process.exit(1);
    }

    console.log(`✅ Joueur trouvé: ${player.username} (ID: ${player.id})\n`);

    // Récupérer TOUTES les missions de ce joueur (pas seulement in_progress)
    console.log('📋 TOUTES LES MISSIONS (tous statuts):');
    const allMissions = await db.queryAll(
      `SELECT mp.*, m.name as mission_name, m.type
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.guild_id = $1 AND mp.player_id = $2
       ORDER BY mp.created_at DESC`,
      [guildId, player.id]
    );

    console.table(allMissions.map(m => ({
      id: m.id,
      mission: `${m.mission_name} (${m.type})`,
      thread_id: m.thread_id,
      status: m.status,
      created_at: new Date(m.created_at).toLocaleString('fr-FR'),
      completed_at: m.completed_at ? new Date(m.completed_at).toLocaleString('fr-FR') : '-'
    })));

    // Focus sur la mission 13 (Quiz)
    console.log('\n📌 FOCUS - Mission 13 (Quiz):');
    const mission13Progress = await db.queryAll(
      `SELECT * FROM mission_progress
       WHERE guild_id = $1 AND player_id = $2 AND mission_id = 13
       ORDER BY created_at DESC`,
      [guildId, player.id]
    );

    if (mission13Progress.length > 0) {
      console.table(mission13Progress.map(m => ({
        id: m.id,
        thread_id: m.thread_id,
        status: m.status,
        created_at: new Date(m.created_at).toLocaleString('fr-FR'),
        completed_at: m.completed_at ? new Date(m.completed_at).toLocaleString('fr-FR') : '-'
      })));
    } else {
      console.log('❌ Aucune tentative de mission 13 trouvée');
    }

    // Vérifier spécifiquement le thread 1440405288850296909
    console.log('\n🎯 THREAD SPÉCIFIQUE - 1440405288850296909:');
    const specificThread = await db.queryOne(
      `SELECT mp.*, m.name as mission_name, m.type
       FROM mission_progress mp
       LEFT JOIN missions m ON mp.mission_id = m.id
       WHERE mp.thread_id = $1`,
      ['1440405288850296909']
    );

    if (specificThread) {
      console.log('✅ Mission trouvée pour ce thread:');
      console.table(specificThread);
    } else {
      console.log('❌ AUCUNE mission_progress trouvée pour ce thread_id');
      console.log('   ⚠️  C\'EST LE PROBLÈME: Le thread existe, mais mission_progress n\'a jamais été créé!');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkAmelieMissionHistory();
