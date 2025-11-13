const db = require('./utils/database-pg');
require('dotenv').config();

async function syncCounts() {
  try {
    console.log('🔄 Synchronisation des compteurs collected_count...\n');

    // Récupérer tous les player_progress
    const allProgress = await db.queryAll(`
      SELECT pp.*, t.name as theme_name
      FROM player_progress pp
      JOIN themes t ON pp.theme_id = t.id
    `);

    console.log(`📊 Trouvé ${allProgress.length} entrées player_progress à vérifier\n`);

    let fixed = 0;
    let alreadyOk = 0;

    for (const progress of allProgress) {
      // Compter les collectibles réels (lost_at IS NULL)
      const actualCount = await db.queryOne(`
        SELECT COUNT(DISTINCT c.collectible_id) as count
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.player_id = $1
          AND c.guild_id = $2
          AND col.theme_id = $3
          AND c.lost_at IS NULL
      `, [progress.player_id, progress.guild_id, progress.theme_id]);

      const realCount = parseInt(actualCount.count);

      if (realCount !== progress.collected_count) {
        console.log(`🔧 Correction pour player_id=${progress.player_id}, theme="${progress.theme_name}"`);
        console.log(`   Ancien: ${progress.collected_count} → Nouveau: ${realCount}`);

        // Mettre à jour le compteur
        await db.query(`
          UPDATE player_progress
          SET collected_count = $1
          WHERE player_id = $2
            AND guild_id = $3
            AND theme_id = $4
        `, [realCount, progress.player_id, progress.guild_id, progress.theme_id]);

        fixed++;
      } else {
        alreadyOk++;
      }
    }

    console.log(`\n✅ Synchronisation terminée !`);
    console.log(`   - ${fixed} compteur(s) corrigé(s)`);
    console.log(`   - ${alreadyOk} compteur(s) déjà corrects`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

syncCounts();
