const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔍 MIGRATION: Créer la table guild_admin_roles\n');
    console.log('='.repeat(80));

    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'create-guild-admin-roles-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Contenu de la migration:');
    console.log(migrationSQL);
    console.log('='.repeat(80));

    // Exécuter la migration
    console.log('\n⚙️  Exécution de la migration...\n');
    await db.query(migrationSQL);

    console.log('✅ Migration exécutée avec succès !\n');

    // Vérifier que la table existe
    console.log('🔍 Vérification de la table guild_admin_roles...\n');
    const tableCheck = await db.queryOne(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_name = 'guild_admin_roles'
    `);

    if (tableCheck) {
      console.log('✅ Table guild_admin_roles trouvée:');
      console.table(tableCheck);
    } else {
      console.log('❌ Table guild_admin_roles non trouvée !');
    }

    // Afficher les colonnes
    console.log('\n📋 Colonnes de la table:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'guild_admin_roles'
      ORDER BY ordinal_position
    `);

    console.table(columns);

    console.log('\n✅ Migration terminée avec succès !');
    console.log('💡 La table guild_admin_roles est prête pour stocker les rôles admin par serveur');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
