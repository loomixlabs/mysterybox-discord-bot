require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

async function runMigration() {
  try {
    console.log('🔄 APPLICATION DE LA MIGRATION: add-unique-active-bonus-constraint.sql\n');
    console.log('='.repeat(80));

    // Lire le fichier SQL
    const migrationPath = path.join(__dirname, '../database/migrations/add-unique-active-bonus-constraint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Contenu de la migration:\n');
    console.log(migrationSQL);
    console.log('\n' + '='.repeat(80));

    // Exécuter la migration
    console.log('\n🚀 Exécution de la migration...\n');
    await db.query(migrationSQL);

    console.log('✅ Migration appliquée avec succès!\n');

    // Vérifier que la contrainte a été créée
    console.log('🔍 Vérification de la contrainte créée:\n');
    const constraints = await db.queryAll(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'player_active_bonuses'
        AND indexname = 'unique_active_bonus_per_player'
    `);

    if (constraints.length > 0) {
      console.log('✅ Contrainte trouvée:\n');
      console.table(constraints);
    } else {
      console.error('❌ Contrainte non trouvée!');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RÉSUMÉ:');
    console.log('✅ Contrainte UNIQUE partielle ajoutée sur player_active_bonuses');
    console.log('✅ Protection: Un joueur ne peut plus avoir le même bonus actif 2 fois');
    console.log('✅ Historique: Les bonus inactifs multiples restent autorisés');
    console.log('\n💡 Test: Essaye de créer un doublon actif pour vérifier la protection\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
