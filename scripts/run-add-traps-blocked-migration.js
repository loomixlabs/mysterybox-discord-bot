const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🛡️ MIGRATION: Ajout tracking pièges bloqués\n');
    console.log('='.repeat(80));

    // Lire le fichier SQL de migration
    const migrationPath = path.join(__dirname, '../database/migrations/add-traps-blocked-tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 SQL de migration:');
    console.log(migrationSQL);
    console.log('\n' + '='.repeat(80));

    // Exécuter la migration
    console.log('\n🔄 Exécution de la migration...');
    await db.query(migrationSQL);

    console.log('✅ Migration exécutée avec succès!\n');

    // Vérifier que la colonne existe maintenant
    console.log('🔍 Vérification de la colonne ajoutée:');
    const check = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'players' AND column_name = 'traps_blocked'
    `);

    if (check.length > 0) {
      console.table(check);
      console.log('✅ Colonne traps_blocked créée avec succès!');
    } else {
      console.log('❌ ERREUR: Colonne traps_blocked non trouvée');
    }

    // Statistiques sur les joueurs
    console.log('\n📊 Statistiques actuelles:');
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_players,
        COUNT(CASE WHEN traps_blocked > 0 THEN 1 END) as players_with_blocks,
        MAX(traps_blocked) as max_blocked
      FROM players
    `);
    console.table(stats);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Migration terminée!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
