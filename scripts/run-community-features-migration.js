/**
 * Script pour exécuter la migration des fonctionnalités communautaires
 * Tables: themes_library (nouvelles colonnes), theme_reviews, theme_views
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Migration: Fonctionnalités communautaires themes_library\n');
  console.log('='.repeat(80));

  try {
    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'add-community-features-themes-library.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Diviser en statements individuels (ignorer les commentaires et lignes vides)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 ${statements.length} statements SQL à exécuter\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Afficher un résumé du statement
      const firstLine = stmt.split('\n').find(l => !l.startsWith('--') && l.trim())?.trim() || '';
      const preview = firstLine.substring(0, 60) + (firstLine.length > 60 ? '...' : '');

      try {
        await db.query(stmt);
        console.log(`✅ [${i + 1}/${statements.length}] ${preview}`);
        successCount++;
      } catch (error) {
        // Ignorer les erreurs "already exists"
        if (error.message.includes('already exists') ||
            error.message.includes('existe déjà') ||
            error.message.includes('duplicate')) {
          console.log(`⏭️  [${i + 1}/${statements.length}] Déjà existant: ${preview}`);
          successCount++;
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] Erreur: ${error.message}`);
          console.error(`   Statement: ${preview}`);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📊 Résultat: ${successCount} succès, ${errorCount} erreurs\n`);

    // Vérification post-migration
    console.log('🔍 Vérification des nouvelles colonnes...\n');

    const newColumns = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'themes_library'
      AND column_name IN ('share_slug', 'short_code', 'fork_count', 'view_count',
                          'rating_count', 'weekly_downloads', 'embed_color',
                          'tags', 'category', 'difficulty', 'icon')
      ORDER BY column_name
    `);

    if (newColumns.length > 0) {
      console.log('✅ Nouvelles colonnes dans themes_library:');
      console.table(newColumns);
    } else {
      console.log('⚠️ Aucune nouvelle colonne trouvée!');
    }

    // Vérifier les nouvelles tables
    const newTables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('theme_reviews', 'theme_views')
      AND table_schema = 'public'
    `);

    if (newTables.length > 0) {
      console.log('\n✅ Nouvelles tables créées:');
      console.table(newTables);
    }

    console.log('\n✅ Migration terminée avec succès!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

runMigration();
