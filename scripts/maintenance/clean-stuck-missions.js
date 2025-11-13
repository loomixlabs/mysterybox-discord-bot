const db = require('./utils/database-pg');
require('dotenv').config();

async function cleanStuckMissions() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '692649463805640724'; // floerin

    console.log('🧹 Nettoyage des missions bloquées\n');

    // 1. Récupérer le joueur
    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    if (!player) {
      console.log('❌ Joueur introuvable');
      process.exit(1);
    }

    console.log(`Joueur: ${player.username} (ID: ${player.id})\n`);

    // 2. Vérifier les missions en cours
    const activeMissions = await db.queryAll(`
      SELECT mp.id, mp.created_at, m.name as mission_name, m.type
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1 AND mp.player_id = $2 AND mp.status = 'in_progress'
      ORDER BY mp.created_at DESC
    `, [guildId, player.id]);

    console.log(`📊 Missions en cours: ${activeMissions.length}\n`);

    if (activeMissions.length === 0) {
      console.log('✅ Aucune mission à nettoyer !');
      console.log('Le joueur peut maintenant ouvrir une mystery box pour obtenir une nouvelle mission.\n');
      process.exit(0);
    }

    // Afficher les missions
    activeMissions.forEach((m, i) => {
      console.log(`${i + 1}. ${m.mission_name} (${m.type})`);
      console.log(`   - ID: ${m.id}`);
      console.log(`   - Créée: ${m.created_at}`);
    });

    console.log('\n❓ Options:');
    console.log('   1. Marquer comme "completed" (mission réussie)');
    console.log('   2. Marquer comme "failed" (mission échouée)');
    console.log('   3. Ne rien faire (garder en cours)\n');

    // Pour automatiser, on va marquer comme "failed" car elles étaient bloquées
    console.log('🔧 Action: Marquer toutes les missions bloquées comme "failed"\n');

    for (const mission of activeMissions) {
      await db.query(`
        UPDATE mission_progress
        SET status = 'failed', updated_at = NOW()
        WHERE id = $1
      `, [mission.id]);

      console.log(`   ✅ Mission "${mission.mission_name}" marquée comme échouée`);
    }

    console.log('\n✅ Nettoyage terminé !');
    console.log(`\n💡 Le joueur peut maintenant:`);
    console.log('   - Ouvrir une mystery box pour obtenir une nouvelle mission');
    console.log('   - Tester le système de validation corrigé');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

cleanStuckMissions();
