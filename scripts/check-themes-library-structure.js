/**
 * Script pour vérifier la structure de themes_library
 */
const db = require('../utils/database-pg');

async function checkStructure() {
  try {
    console.log('🔍 Structure de la table themes_library:\n');

    const result = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'themes_library'
      ORDER BY ordinal_position
    `);

    console.table(result);

    if (result.length === 0) {
      console.log('⚠️ La table themes_library n\'existe pas!');
    } else {
      console.log(`\n✅ ${result.length} colonnes trouvées`);
    }

    // Check sample data
    const sample = await db.queryAll(`
      SELECT theme_id, name, visibility, download_count, fork_count, is_featured, created_at
      FROM themes_library
      LIMIT 5
    `);

    if (sample.length > 0) {
      console.log('\n📊 Échantillon de données:');
      console.table(sample);
    } else {
      console.log('\n📊 Aucun thème dans la bibliothèque');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkStructure();
