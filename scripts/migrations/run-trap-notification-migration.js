const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('\n🔧 MIGRATION: Ajout des champs de personnalisation d\'embed\n');
  console.log('='.repeat(80));

  try {
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'add-trap-notification-embed-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📄 Exécution de la migration...');
    await db.query(migrationSQL);

    console.log('\n✅ Migration exécutée avec succès !');

    // Vérifier que les colonnes ont été ajoutées
    console.log('\n🔍 Vérification des nouvelles colonnes...');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'traps' AND column_name IN ('notif_title', 'notif_description', 'notif_color', 'notif_footer')
      ORDER BY column_name
    `);

    if (columns.length === 4) {
      console.log('\n✅ Les 4 colonnes ont été ajoutées:');
      console.table(columns);
    } else {
      console.log('\n⚠️  Problème: seulement', columns.length, 'colonne(s) trouvée(s)');
      console.table(columns);
    }

    // Afficher l'état actuel des pièges
    console.log('\n📊 État actuel des notifications de pièges:');
    const traps = await db.queryAll(`
      SELECT trap_id, name, type, notif_title, LEFT(notif_description, 40) as notif_desc_short, notif_color
      FROM traps
      ORDER BY type, trap_id
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
