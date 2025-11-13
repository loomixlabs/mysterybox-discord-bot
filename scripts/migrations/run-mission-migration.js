const db = require('./utils/database-pg');

async function runMigration() {
  try {
    console.log('🔄 Exécution de la migration des colonnes missions...\n');

    // Ajouter les colonnes si elles n'existent pas
    await db.query(`
      ALTER TABLE announcement_settings
      ADD COLUMN IF NOT EXISTS mission_started BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mission_completed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mission_failed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mission_approved BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mission_rejected BOOLEAN DEFAULT FALSE;
    `);

    console.log('✅ Colonnes ajoutées avec succès!\n');

    // Vérifier les colonnes
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name='announcement_settings'
      AND column_name LIKE '%mission%'
      ORDER BY column_name;
    `);

    console.log('📋 COLONNES MISSIONS:');
    console.table(columns);
    console.log(`\n✅ ${columns.length} colonne(s) mission trouvée(s)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

runMigration();
