const db = require('./utils/database-pg');

async function diagnosticCollectibles() {
  console.log('🔍 DIAGNOSTIC COLLECTIBLES - Incohérences\n');
  console.log('='.repeat(80));

  const guildId = process.env.GUILD_ID || '297309737135898624';

  try {
    // 1. Récupérer tous les thèmes
    console.log('\n1️⃣ THÈMES ET required_items:\n');
    const themes = await db.queryAll(`
      SELECT id, name, required_items, is_active
      FROM themes
      WHERE guild_id = $1
      ORDER BY id
    `, [guildId]);
    console.table(themes);

    // 2. Pour chaque thème, compter les collectibles réels
    console.log('\n2️⃣ COMPTAGE RÉEL DES COLLECTIBLES PAR THÈME:\n');

    for (const theme of themes) {
      const realCount = await db.queryOne(`
        SELECT COUNT(*) as count
        FROM collectibles
        WHERE guild_id = $1 AND theme_id = $2
      `, [guildId, theme.id]);

      console.log(`\n📦 Thème: ${theme.name} (ID: ${theme.id})`);
      console.log(`   required_items (DB): ${theme.required_items}`);
      console.log(`   Collectibles réels : ${realCount.count}`);

      if (theme.required_items !== parseInt(realCount.count)) {
        console.log(`   ⚠️  INCOHÉRENCE DÉTECTÉE!`);
        console.log(`   ❌ Différence: ${theme.required_items - realCount.count}`);
      } else {
        console.log(`   ✅ Cohérent`);
      }

      // Lister les collectibles du thème
      const collectibles = await db.queryAll(`
        SELECT collectible_id, name, rarity
        FROM collectibles
        WHERE guild_id = $1 AND theme_id = $2
        ORDER BY rarity, name
      `, [guildId, theme.id]);

      if (collectibles.length > 0) {
        console.log(`\n   📋 Liste des collectibles:`);
        collectibles.forEach((c, i) => {
          console.log(`      ${i + 1}. ${c.name} (${c.rarity})`);
        });
      } else {
        console.log(`\n   ⚠️  Aucun collectible défini!`);
      }
    }

    // 3. Vérifier la progression des joueurs
    console.log('\n\n3️⃣ PROGRESSION DES JOUEURS:\n');
    const progress = await db.queryAll(`
      SELECT
        p.username,
        pp.theme_id,
        t.name as theme_name,
        pp.collected_count,
        t.required_items,
        pp.is_completed
      FROM player_progress pp
      JOIN players p ON pp.player_id = p.id
      JOIN themes t ON pp.theme_id = t.id
      WHERE pp.guild_id = $1
      ORDER BY pp.theme_id, pp.collected_count DESC
    `, [guildId]);
    console.table(progress);

    // 4. Vérifier les collections réelles des joueurs
    console.log('\n4️⃣ COLLECTIONS RÉELLES DES JOUEURS:\n');
    const collections = await db.queryAll(`
      SELECT
        p.username,
        c.theme_id,
        COUNT(*) as real_collected_count
      FROM collections col
      JOIN players p ON col.player_id = p.id
      JOIN collectibles c ON col.collectible_id = c.id
      WHERE col.guild_id = $1
      GROUP BY p.username, c.theme_id
      ORDER BY c.theme_id, real_collected_count DESC
    `, [guildId]);
    console.table(collections);

    // 5. Comparaison player_progress vs collections réelles
    console.log('\n5️⃣ COMPARAISON player_progress VS collections réelles:\n');
    const comparison = await db.queryAll(`
      SELECT
        p.username,
        pp.theme_id,
        t.name as theme_name,
        pp.collected_count as progress_count,
        COUNT(col.id) as real_count,
        (pp.collected_count - COUNT(col.id)) as difference
      FROM player_progress pp
      JOIN players p ON pp.player_id = p.id
      JOIN themes t ON pp.theme_id = t.id
      LEFT JOIN collections col ON col.player_id = pp.player_id
        AND col.guild_id = pp.guild_id
        AND EXISTS (
          SELECT 1 FROM collectibles c
          WHERE c.id = col.collectible_id AND c.theme_id = pp.theme_id
        )
      WHERE pp.guild_id = $1
      GROUP BY p.username, pp.theme_id, t.name, pp.collected_count
      ORDER BY pp.theme_id, difference DESC
    `, [guildId]);
    console.table(comparison);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnostic terminé\n');

    // Résumé des incohérences
    console.log('📊 RÉSUMÉ DES INCOHÉRENCES:\n');

    const themeInconsistencies = themes.filter(t => {
      const realCount = collectibles.filter(c => c.theme_id === t.id).length;
      return t.required_items !== realCount;
    });

    if (themeInconsistencies.length > 0) {
      console.log('⚠️  Thèmes avec required_items incorrect:');
      themeInconsistencies.forEach(t => {
        console.log(`   - ${t.name}: required_items=${t.required_items} mais ${realCount} collectibles réels`);
      });
    }

    const progressInconsistencies = comparison.filter(c => c.difference !== 0);
    if (progressInconsistencies.length > 0) {
      console.log('\n⚠️  Joueurs avec collected_count incorrect:');
      progressInconsistencies.forEach(c => {
        console.log(`   - ${c.username} (${c.theme_name}): progress_count=${c.progress_count} mais ${c.real_count} collectibles réels (diff: ${c.difference})`);
      });
    }

    if (themeInconsistencies.length === 0 && progressInconsistencies.length === 0) {
      console.log('✅ Aucune incohérence détectée!');
    }

    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

diagnosticCollectibles();
