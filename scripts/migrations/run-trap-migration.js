const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('\n🔧 EXÉCUTION DE LA MIGRATION DES PIÈGES\n');
  console.log('='.repeat(80));

  try {
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'add-trap-default-and-active-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📄 Contenu de la migration:');
    console.log(migrationSQL);

    // Exécuter la migration
    console.log('\n⚙️  Exécution de la migration...');
    await db.query(migrationSQL);

    console.log('\n✅ Migration exécutée avec succès !');

    // Vérifier que les colonnes ont été ajoutées
    console.log('\n🔍 Vérification des nouvelles colonnes...');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'traps' AND column_name IN ('is_default', 'is_active')
      ORDER BY column_name
    `);

    if (columns.length === 2) {
      console.log('\n✅ Les deux colonnes ont été ajoutées:');
      console.table(columns);
    } else {
      console.log('\n⚠️  Problème: seulement', columns.length, 'colonne(s) trouvée(s)');
      console.table(columns);
    }

    // Vérifier les index
    console.log('\n🔍 Vérification des index...');
    const indexes = await db.queryAll(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'traps' AND indexname IN ('idx_traps_active', 'idx_traps_default')
      ORDER BY indexname
    `);

    if (indexes.length > 0) {
      console.log('\n✅ Index créés:');
      console.table(indexes);
    } else {
      console.log('\n⚠️  Aucun index trouvé');
    }

    // Afficher l'état actuel des pièges
    console.log('\n📊 État actuel des pièges:');
    const traps = await db.queryAll(`
      SELECT trap_id, name, type, is_default, is_active
      FROM traps
      ORDER BY trap_id
    `);

    if (traps.length > 0) {
      console.table(traps);
    } else {
      console.log('⚠️  Aucun piège dans la base');
    }

    console.log('\n✅ Migration terminée avec succès !');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
