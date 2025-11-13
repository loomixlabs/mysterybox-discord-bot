const db = require('./utils/database-pg');

async function fixCollectedCount() {
  console.log('🔧 CORRECTION DES COMPTEURS collected_count\n');
  console.log('='.repeat(80));

  const guildId = process.env.GUILD_ID || '297309737135898624';

  try {
    // 1. Récupérer tous les joueurs avec progression
    console.log('\n1️⃣ Récupération des progressions à corriger:\n');
    const progressions = await db.queryAll(`
      SELECT pp.id, pp.guild_id, pp.player_id, pp.theme_id, pp.collected_count, p.username
      FROM player_progress pp
      JOIN players p ON pp.player_id = p.id
      WHERE pp.guild_id = $1
    `, [guildId]);

    console.log(`📋 ${progressions.length} progression(s) trouvée(s)`);

    // 2. Pour chaque progression, calculer le vrai compteur
    console.log('\n2️⃣ Calcul des vrais compteurs:\n');

    for (const progress of progressions) {
      // Compter les collectibles DISTINCTS du joueur pour ce thème
      const realCount = await db.queryOne(`
        SELECT COUNT(DISTINCT col.collectible_id) as count
        FROM collections col
        JOIN collectibles c ON col.collectible_id = c.id
        WHERE col.guild_id = $1
          AND col.player_id = $2
          AND c.theme_id = $3
      `, [progress.guild_id, progress.player_id, progress.theme_id]);

      const oldCount = progress.collected_count;
      const newCount = parseInt(realCount.count);

      console.log(`👤 ${progress.username}:`);
      console.log(`   Ancien: ${oldCount}`);
      console.log(`   Nouveau: ${newCount}`);

      if (oldCount !== newCount) {
        console.log(`   ⚠️  Correction nécessaire (diff: ${oldCount - newCount})`);

        // Mettre à jour le compteur
        await db.query(`
          UPDATE player_progress
          SET collected_count = $1
          WHERE id = $2
        `, [newCount, progress.id]);

        console.log(`   ✅ Corrigé !`);
      } else {
        console.log(`   ✅ Déjà correct`);
      }
    }

    // 3. Vérification finale
    console.log('\n3️⃣ Vérification finale:\n');
    const verification = await db.queryAll(`
      SELECT
        p.username,
        pp.collected_count as progress_count,
        COUNT(DISTINCT col.collectible_id) as real_count
      FROM player_progress pp
      JOIN players p ON pp.player_id = p.id
      LEFT JOIN collections col ON col.player_id = pp.player_id AND col.guild_id = pp.guild_id
      LEFT JOIN collectibles c ON col.collectible_id = c.id AND c.theme_id = pp.theme_id
      WHERE pp.guild_id = $1
      GROUP BY p.username, pp.collected_count
    `, [guildId]);

    console.table(verification);

    const stillIncorrect = verification.filter(v => v.progress_count !== parseInt(v.real_count));

    if (stillIncorrect.length === 0) {
      console.log('\n✅ Tous les compteurs sont maintenant corrects !');
    } else {
      console.log('\n⚠️  Il reste des incohérences:');
      console.table(stillIncorrect);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Correction terminée\n');

    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

fixCollectedCount();
