/**
 * Analyse la structure réelle des missions dans themes_library
 * Pour comprendre pourquoi le compteur affiche 0
 */

const db = require('../utils/database-pg');

async function analyzeMissionsStructure() {
  try {
    console.log('='.repeat(80));
    console.log('🔍 ANALYSE STRUCTURE DES MISSIONS DANS themes_library');
    console.log('='.repeat(80));

    // 1. Récupérer tous les thèmes avec leurs missions (sans jsonb_array_length sur objets)
    const themes = await db.queryAll(`
      SELECT
        theme_id,
        name,
        jsonb_typeof(theme_data->'missions') as missions_type,
        theme_data->'missions' as missions_raw
      FROM themes_library
      LIMIT 10
    `);

    console.log(`\n📦 ${themes.length} thèmes analysés:\n`);

    for (const theme of themes) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`🎨 ${theme.name} (${theme.theme_id})`);
      console.log(`   Type de missions: ${theme.missions_type || 'null/absent'}`);

      if (theme.missions_raw) {
        const missions = theme.missions_raw;

        if (Array.isArray(missions)) {
          console.log(`   ✅ C'est un tableau avec ${missions.length} missions`);
        } else if (typeof missions === 'object') {
          console.log(`   ⚠️  C'est un OBJET, pas un tableau!`);
          console.log(`   Clés: ${Object.keys(missions).join(', ')}`);

          // Compter les missions dans l'ancien format
          const quizCount = missions.quiz?.length || 0;
          const keywordCount = missions.keyword?.length || 0;
          console.log(`   → quiz: ${quizCount}, keyword: ${keywordCount}`);
          console.log(`   → Total réel: ${quizCount + keywordCount}`);
        }
      } else {
        console.log(`   ❌ Pas de missions`);
      }
    }

    // 2. Statistiques globales
    console.log('\n' + '='.repeat(80));
    console.log('📊 STATISTIQUES GLOBALES');
    console.log('='.repeat(80));

    const stats = await db.queryAll(`
      SELECT
        jsonb_typeof(theme_data->'missions') as missions_type,
        COUNT(*) as count
      FROM themes_library
      GROUP BY jsonb_typeof(theme_data->'missions')
    `);

    console.table(stats);

    // 3. Proposer la solution
    console.log('\n' + '='.repeat(80));
    console.log('💡 SOLUTION PROPOSÉE');
    console.log('='.repeat(80));

    console.log(`
Pour gérer les deux formats (tableau et objet), utiliser cette requête:

CASE
  WHEN jsonb_typeof(theme_data->'missions') = 'array'
    THEN jsonb_array_length(theme_data->'missions')
  WHEN jsonb_typeof(theme_data->'missions') = 'object'
    THEN COALESCE(jsonb_array_length(theme_data->'missions'->'quiz'), 0) +
         COALESCE(jsonb_array_length(theme_data->'missions'->'keyword'), 0)
  ELSE 0
END as missions_count
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyzeMissionsStructure();
