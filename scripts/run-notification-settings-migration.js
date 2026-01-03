/**
 * Script pour exécuter la migration des paramètres de notification mission
 */

const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔄 Exécution de la migration: add-mission-notification-settings.sql\n');
  console.log('='.repeat(60));

  try {
    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-mission-notification-settings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Exécuter chaque commande SQL séparément
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    for (const command of commands) {
      if (command.length > 0) {
        try {
          await db.query(command);
          console.log(`✅ ${command.substring(0, 60)}...`);
        } catch (err) {
          // Ignorer si la colonne existe déjà
          if (err.code === '42701') {
            console.log(`⏭️  Colonne existe déjà - ignoré`);
          } else {
            console.error(`❌ Erreur: ${err.message}`);
          }
        }
      }
    }

    // Vérifier que les colonnes ont été ajoutées
    console.log('\n📋 Vérification des colonnes ajoutées:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'guild_config'
      AND column_name LIKE 'notify_%'
      ORDER BY column_name
    `);

    if (columns.length > 0) {
      console.table(columns);
      console.log(`\n✅ Migration terminée avec succès! ${columns.length} colonnes créées.`);
    } else {
      console.log('\n⚠️  Aucune colonne notify_* trouvée - vérifiez la migration');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
