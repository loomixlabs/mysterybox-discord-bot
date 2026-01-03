/**
 * Script pour restaurer les tables Theme Builder depuis le backup JSON
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

const THEME_BUILDER_BACKUP = path.join(__dirname, '..', 'backups', 'theme_builder_backup.json');

const THEME_BUILDER_TABLES = [
  'banned_builder_users',
  'theme_builder_config',
  'theme_builder_logs',
  'theme_builder_sessions',
  'theme_builder_user_quotas',
  'themes_library'
];

async function createTableIfNotExists(tableName, columns) {
  const tableExists = await db.queryOne(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    )
  `, [tableName]);

  if (tableExists && tableExists.exists) {
    return true;
  }

  // Créer la table
  const columnDefs = columns.map(c => {
    let def = `"${c.column_name}" ${c.data_type}`;
    if (c.column_default && c.column_default.includes('nextval')) {
      def = `"${c.column_name}" SERIAL`;
    }
    return def;
  }).join(', ');

  try {
    await db.query(`CREATE TABLE IF NOT EXISTS public."${tableName}" (${columnDefs})`);
    console.log(`   ➕ Table ${tableName} créée`);
    return true;
  } catch (err) {
    console.log(`   ⚠️  Erreur création ${tableName}: ${err.message}`);
    return false;
  }
}

async function main() {
  try {
    console.log('🎨 RESTAURATION TABLES THEME BUILDER\n');
    console.log('='.repeat(80));

    if (!fs.existsSync(THEME_BUILDER_BACKUP)) {
      console.error('❌ Fichier backup non trouvé:', THEME_BUILDER_BACKUP);
      process.exit(1);
    }

    const backup = JSON.parse(fs.readFileSync(THEME_BUILDER_BACKUP, 'utf-8'));
    console.log(`📅 Backup du: ${backup.timestamp}\n`);

    for (const tableName of THEME_BUILDER_TABLES) {
      console.log(`📋 Restauration de ${tableName}...`);

      const tableData = backup.tables[tableName];

      if (!tableData || !tableData.exists) {
        console.log(`   ⚠️  Pas de données dans le backup`);
        continue;
      }

      if (tableData.rowCount === 0) {
        console.log(`   ℹ️  Table vide (0 lignes)`);
        continue;
      }

      // Créer la table si elle n'existe pas
      await createTableIfNotExists(tableName, tableData.columns);

      // Vider la table
      try {
        await db.query(`DELETE FROM "${tableName}"`);
      } catch (err) {
        // Table n'existe peut-être pas encore
      }

      // Insérer les données
      const columns = tableData.columns.map(c => c.column_name);
      let inserted = 0;
      let errors = 0;

      for (const row of tableData.rows) {
        const values = columns.map(col => {
          const val = row[col];
          // Convertir les valeurs null/undefined
          if (val === null || val === undefined || val === 'null') {
            return null;
          }
          return val;
        });

        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const quotedColumns = columns.map(c => `"${c}"`).join(', ');

        try {
          await db.query(
            `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders})`,
            values
          );
          inserted++;
        } catch (err) {
          errors++;
          if (!err.message.includes('duplicate key')) {
            // console.log(`   ⚠️  Erreur: ${err.message}`);
          }
        }
      }

      console.log(`   ✅ ${inserted}/${tableData.rowCount} lignes restaurées`);
      if (errors > 0) {
        console.log(`   ⚠️  ${errors} erreurs (possibles doublons)`);
      }
    }

    // Vérification
    console.log('\n📊 VÉRIFICATION:\n');

    for (const tableName of THEME_BUILDER_TABLES) {
      try {
        const result = await db.queryOne(`SELECT COUNT(*) as count FROM "${tableName}"`);
        console.log(`   ✅ ${tableName}: ${result.count} lignes`);
      } catch (err) {
        console.log(`   ❌ ${tableName}: ${err.message}`);
      }
    }

    console.log('\n✅ Restauration Theme Builder terminée!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
