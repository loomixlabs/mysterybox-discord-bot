const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔧 Exécution de la migration mission_progress...\n');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, 'database', 'migrations', 'add-mission-progress-tracking-columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Exécuter la migration
    await db.query(sql);
    console.log('✅ Migration exécutée avec succès\n');

    // Vérifier que les colonnes existent
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'mission_progress'
        AND column_name IN ('target_channel_id', 'target_keyword', 'mission_type', 'expires_at')
      ORDER BY column_name
    `);

    if (columns.length === 4) {
      console.log('✅ Les 4 colonnes ont été créées avec succès:\n');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'NULL'})`);
      });
    } else {
      console.error(`❌ Seulement ${columns.length}/4 colonnes créées`);
      columns.forEach(col => {
        console.log(`  - ${col.column_name}`);
      });
    }

    // Afficher la structure complète de la table mission_progress
    const allColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'mission_progress'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Structure complète de mission_progress:\n');
    allColumns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(NULL)' : '(NOT NULL)';
      console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}`);
    });

    // Vérifier les index créés
    const indexes = await db.queryAll(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'mission_progress'
        AND indexname LIKE 'idx_mission_progress_%'
    `);

    if (indexes.length > 0) {
      console.log('\n📊 Index créés:\n');
      indexes.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });
    }

    console.log('\n✅ Migration terminée avec succès!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
