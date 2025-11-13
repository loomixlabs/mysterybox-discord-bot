const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔧 Exécution de la migration mission_keywords...\n');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, 'database', 'migrations', 'add-mission-keywords-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Exécuter la migration
    await db.query(sql);
    console.log('✅ Migration exécutée avec succès\n');

    // Vérifier que la table existe
    const tableCheck = await db.queryOne(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'mission_keywords'
    `);

    if (tableCheck) {
      console.log('✅ Table mission_keywords créée avec succès');

      // Afficher la structure de la table
      const columns = await db.queryAll(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'mission_keywords'
        ORDER BY ordinal_position
      `);

      console.log('\n📋 Structure de la table mission_keywords:\n');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
      });
    } else {
      console.error('❌ La table mission_keywords n\'a pas été créée');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
