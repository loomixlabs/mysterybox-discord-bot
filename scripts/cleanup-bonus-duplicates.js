require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624'; // Serveur de test

async function cleanup() {
  try {
    console.log('🧹 NETTOYAGE DES DOUBLONS DANS player_active_bonuses\n');
    console.log('='.repeat(80));

    // 1. Trouver tous les doublons
    const duplicates = await db.queryAll(`
      SELECT
        pab.user_id,
        pab.bonus_id,
        sb.name as bonus_name,
        sb.icon,
        p.username,
        COUNT(*) as count,
        array_agg(pab.id ORDER BY pab.id) as pab_ids
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      WHERE pab.guild_id = $1
      GROUP BY pab.user_id, pab.bonus_id, sb.name, sb.icon, p.username
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `, [GUILD_ID]);

    if (duplicates.length === 0) {
      console.log('✅ Aucun doublon trouvé\n');
      process.exit(0);
      return;
    }

    console.log(`\n❌ ${duplicates.length} doublon(s) trouvé(s):\n`);

    let totalDeleted = 0;
    let totalKept = 0;

    for (const dup of duplicates) {
      console.log(`\n👤 ${dup.username || dup.user_id} - ${dup.icon} ${dup.bonus_name}`);
      console.log(`   Entrées: ${dup.count} (IDs: ${dup.pab_ids.join(', ')})`);

      // Garder le premier (ID le plus bas), supprimer les autres
      const toKeep = dup.pab_ids[0];
      const toDelete = dup.pab_ids.slice(1);

      console.log(`   ✅ Conserver: ID ${toKeep}`);
      console.log(`   ❌ Supprimer: ${toDelete.join(', ')}`);

      // Supprimer les doublons
      for (const id of toDelete) {
        const result = await db.queryOne(`
          DELETE FROM player_active_bonuses
          WHERE id = $1 AND guild_id = $2
          RETURNING id
        `, [id, GUILD_ID]);

        if (result) {
          console.log(`      → ID ${id} supprimé`);
          totalDeleted++;
        }
      }

      totalKept++;
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RÉSUMÉ:');
    console.log(`   ✅ ${totalKept} bonus conservés`);
    console.log(`   ❌ ${totalDeleted} doublons supprimés`);
    console.log('\n✅ Nettoyage terminé\n');

    // Vérification finale
    console.log('🔍 VÉRIFICATION FINALE:\n');
    const remainingDuplicates = await db.queryAll(`
      SELECT
        user_id,
        bonus_id,
        COUNT(*) as count
      FROM player_active_bonuses
      WHERE guild_id = $1
      GROUP BY user_id, bonus_id
      HAVING COUNT(*) > 1
    `, [GUILD_ID]);

    if (remainingDuplicates.length === 0) {
      console.log('✅ Plus aucun doublon détecté\n');
    } else {
      console.error('❌ Il reste encore des doublons!\n');
      console.table(remainingDuplicates);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

cleanup();
