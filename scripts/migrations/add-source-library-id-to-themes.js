/**
 * Migration: Ajouter source_library_id à la table themes
 *
 * Cette colonne permet de tracker quel thème de themes_library (Theme Builder)
 * a été déployé vers la table themes (Bot).
 *
 * Cela corrige le problème de suppression où les theme_id ne correspondent pas
 * (themes_library utilise des IDs custom, themes utilise des slugs historiques)
 */

const db = require('../../utils/database-pg');

async function migrate() {
  console.log('🔄 Migration: Ajout de source_library_id à la table themes...\n');

  try {
    // Vérifier si la colonne existe déjà
    const columnExists = await db.queryOne(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'themes' AND column_name = 'source_library_id'
    `);

    if (columnExists) {
      console.log('✅ La colonne source_library_id existe déjà');
      return { success: true, message: 'Colonne déjà existante' };
    }

    // Ajouter la colonne
    await db.query(`
      ALTER TABLE themes
      ADD COLUMN source_library_id VARCHAR(255) DEFAULT NULL
    `);
    console.log('✅ Colonne source_library_id ajoutée');

    // Créer un index pour les recherches rapides
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_themes_source_library_id
      ON themes(source_library_id)
      WHERE source_library_id IS NOT NULL
    `);
    console.log('✅ Index idx_themes_source_library_id créé');

    // Vérification
    const verification = await db.queryOne(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'themes' AND column_name = 'source_library_id'
    `);

    console.log('\n📊 Vérification:');
    console.log(`   Colonne: ${verification.column_name}`);
    console.log(`   Type: ${verification.data_type}`);
    console.log(`   Nullable: ${verification.is_nullable}`);

    console.log('\n✅ Migration terminée avec succès!');
    return { success: true };

  } catch (error) {
    console.error('❌ Erreur de migration:', error.message);
    return { success: false, error: error.message };
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  migrate().then(result => {
    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log('🎉 Migration réussie');
    } else {
      console.log('❌ Migration échouée:', result.error);
    }
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { migrate };
