/**
 * Script pour sauvegarder les tables Theme Builder en JSON
 * Plus fiable que pg_dump via cmd sur Windows
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

const THEME_BUILDER_TABLES = [
  'banned_builder_users',
  'theme_builder_config',
  'theme_builder_logs',
  'theme_builder_sessions',
  'theme_builder_user_quotas',
  'themes_library'
];

async function main() {
  try {
    console.log('💾 BACKUP TABLES THEME BUILDER\n');
    console.log('='.repeat(80));

    const backup = {
      timestamp: new Date().toISOString(),
      tables: {}
    };

    for (const tableName of THEME_BUILDER_TABLES) {
      console.log(`\n📋 Export de ${tableName}...`);

      // Vérifier si la table existe
      const tableExists = await db.queryOne(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [tableName]);

      if (!tableExists || !tableExists.exists) {
        console.log(`   ⚠️  Table ${tableName} n'existe pas localement`);
        backup.tables[tableName] = { exists: false, rows: [] };
        continue;
      }

      // Récupérer la structure (colonnes)
      const columns = await db.queryAll(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      // Récupérer les données
      const rows = await db.queryAll(`SELECT * FROM ${tableName}`);

      backup.tables[tableName] = {
        exists: true,
        columns: columns,
        rowCount: rows.length,
        rows: rows
      };

      console.log(`   ✅ ${rows.length} lignes exportées`);
    }

    // Sauvegarder en JSON
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, 'theme_builder_backup.json');
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Backup sauvegardé: ${backupFile}`);

    // Résumé
    console.log('\n📊 RÉSUMÉ:');
    for (const tableName of THEME_BUILDER_TABLES) {
      const tableData = backup.tables[tableName];
      if (tableData.exists) {
        console.log(`   ✅ ${tableName}: ${tableData.rowCount} lignes`);
      } else {
        console.log(`   ⚠️  ${tableName}: n'existe pas`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
