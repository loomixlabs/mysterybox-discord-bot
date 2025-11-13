const db = require('./utils/database-pg');
require('dotenv').config();

async function checkMissionsCompleted() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '692649463805640724'; // floerin

    console.log('📊 Historique des missions\n');

    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    console.log(`Joueur: ${player.username}\n`);

    // Toutes les missions
    const allMissions = await db.queryAll(`
      SELECT mp.status, mp.created_at, mp.completed_at, mp.updated_at,
             m.name as mission_name, m.type
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1 AND mp.player_id = $2
      ORDER BY mp.created_at DESC
      LIMIT 20
    `, [guildId, player.id]);

    console.log(`📊 Total missions (historique): ${allMissions.length}\n`);

    if (allMissions.length === 0) {
      console.log('⚠️ Aucune mission trouvée');
      process.exit(0);
    }

    console.log('HISTORIQUE DES MISSIONS:');
    console.log('═'.repeat(80));

    const statusEmoji = {
      'completed': '✅',
      'failed': '❌',
      'in_progress': '🔄',
      'submitted': '📤'
    };

    allMissions.forEach((m, i) => {
      const emoji = statusEmoji[m.status] || '❓';
      console.log(`\n${i + 1}. ${emoji} ${m.mission_name} (${m.type}) - ${m.status.toUpperCase()}`);
      console.log(`   Créée: ${new Date(m.created_at).toLocaleString('fr-FR')}`);
      if (m.completed_at) {
        console.log(`   Complétée: ${new Date(m.completed_at).toLocaleString('fr-FR')}`);
      }
      console.log(`   Dernière MAJ: ${new Date(m.updated_at).toLocaleString('fr-FR')}`);
    });

    console.log('\n' + '═'.repeat(80));

    // Résumé
    const completed = allMissions.filter(m => m.status === 'completed').length;
    const failed = allMissions.filter(m => m.status === 'failed').length;
    const inProgress = allMissions.filter(m => m.status === 'in_progress').length;

    console.log('\n📊 RÉSUMÉ:');
    console.log(`   ✅ Complétées: ${completed}`);
    console.log(`   ❌ Échouées: ${failed}`);
    console.log(`   🔄 En cours: ${inProgress}`);
    console.log(`   📦 Total: ${allMissions.length}`);

    console.log('\n💡 ANALYSE:');
    if (completed === 0) {
      console.log('   ⚠️ AUCUNE mission complétée !');
      console.log('   → Le bug a empêché toutes les validations');
      console.log(`   → Le joueur devrait avoir ${completed} collectibles de missions`);
      console.log('   → Actuellement il a 0 collectible de source "mission"');
    } else {
      console.log(`   ✅ ${completed} mission(s) complétée(s)`);
      console.log(`   → Le joueur devrait avoir ${completed} collectibles de missions`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkMissionsCompleted();
