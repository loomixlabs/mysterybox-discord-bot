require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

async function runMigration() {
  try {
    console.log('🔄 Exécution de la migration: add-auto-delete-celebration\n');
    console.log('='.repeat(80));

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-auto-delete-celebration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL à exécuter:');
    console.log(sql);
    console.log('='.repeat(80));
    console.log('\n🔄 Exécution...\n');

    // Exécuter la migration
    await db.query(sql);

    console.log('✅ Migration exécutée avec succès!\n');

    // Vérifier que la colonne existe
    const verify = await db.queryOne(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      AND column_name = 'auto_delete_celebration_message'
    `);

    if (verify) {
      console.log('✅ Colonne vérifiée:');
      console.table({
        column_name: verify.column_name,
        data_type: verify.data_type,
        default_value: verify.column_default
      });
    } else {
      console.error('❌ Colonne non trouvée après migration');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
