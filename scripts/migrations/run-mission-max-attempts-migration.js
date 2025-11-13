const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔍 MIGRATION: Ajouter max_attempts à missions\n');
    console.log('='.repeat(80));

    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'add-mission-max-attempts-column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Contenu de la migration:');
    console.log(migrationSQL);
    console.log('='.repeat(80));

    // Exécuter la migration
    console.log('\n⚙️  Exécution de la migration...\n');
    await db.query(migrationSQL);

    console.log('✅ Migration exécutée avec succès !\n');

    // Vérifier que la colonne existe
    console.log('🔍 Vérification de la colonne max_attempts...\n');
    const columnCheck = await db.queryOne(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'missions' AND column_name = 'max_attempts'
    `);

    if (columnCheck) {
      console.log('✅ Colonne max_attempts trouvée:');
      console.table(columnCheck);
    } else {
      console.log('❌ Colonne max_attempts non trouvée !');
    }

    // Afficher quelques missions pour vérifier
    console.log('\n📋 Missions existantes (aperçu):');
    const missions = await db.queryAll(`
      SELECT id, name, type, timeout, max_attempts
      FROM missions
      WHERE guild_id = $1
      LIMIT 5
    `, [process.env.GUILD_ID]);

    console.table(missions);

    console.log('\n✅ Migration terminée avec succès !');
    console.log('💡 La colonne max_attempts est maintenant disponible (NULL = essais illimités)');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
