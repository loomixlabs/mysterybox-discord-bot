const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('\n🔧 MIGRATION: Ajout des templates d\'annonces pour les 4 types de pièges\n');
  console.log('='.repeat(80));

  try {
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'add-trap-announcement-templates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📄 Exécution de la migration...');
    await db.query(migrationSQL);

    console.log('\n✅ Migration exécutée avec succès !');

    // Vérifier que les colonnes ont été ajoutées
    console.log('\n🔍 Vérification des nouvelles colonnes dans announcement_settings...');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
        AND column_name IN ('trap_cooldown', 'trap_lose_collectible', 'trap_public_shame', 'trap_malus_points')
      ORDER BY column_name
    `);

    if (columns.length === 4) {
      console.log('\n✅ Les 4 colonnes ont été ajoutées:');
      console.table(columns);
    } else {
      console.log('\n⚠️  Problème: seulement', columns.length, 'colonne(s) trouvée(s)');
      console.table(columns);
    }

    // Afficher les templates créés
    console.log('\n📊 Templates d\'annonces pour les pièges:');
    const templates = await db.queryAll(`
      SELECT type, title, color, LEFT(description, 60) as description_preview
      FROM announcement_templates
      WHERE type LIKE 'trap_%'
      ORDER BY type
    `);

    if (templates.length > 0) {
      console.table(templates);
    } else {
      console.log('⚠️  Aucun template de piège trouvé');
    }

    console.log('\n✅ Migration terminée avec succès !');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
