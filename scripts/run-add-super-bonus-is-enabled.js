require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

async function runMigration() {
  try {
    console.log('🔄 Exécution de la migration: add-super-bonus-is-enabled\n');
    console.log('='.repeat(80));

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-super-bonus-is-enabled.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL à exécuter:');
    console.log(sql);
    console.log('='.repeat(80));
    console.log('\n🔄 Exécution...\n');

    // Exécuter la migration
    await db.query(sql);

    console.log('✅ Migration exécutée avec succès!\n');

    // Vérifier que la colonne existe
    const verify = await db.queryOne(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      AND column_name = 'is_enabled'
    `);

    if (verify) {
      console.log('✅ Colonne vérifiée:');
      console.table({
        column_name: verify.column_name,
        data_type: verify.data_type,
        default_value: verify.column_default,
        nullable: verify.is_nullable
      });
    } else {
      console.error('❌ Colonne non trouvée après migration');
    }

    // Vérifier l'index
    const indexVerify = await db.queryOne(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'super_bonuses'
      AND indexname = 'idx_super_bonuses_is_enabled'
    `);

    if (indexVerify) {
      console.log('\n✅ Index créé:');
      console.table({
        index_name: indexVerify.indexname,
        definition: indexVerify.indexdef
      });
    }

    // Compter les bonus actuels
    const count = await db.queryOne(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE is_enabled = TRUE) as enabled,
             COUNT(*) FILTER (WHERE is_enabled = FALSE) as disabled
      FROM super_bonuses
    `);

    console.log('\n📊 État des super bonuses:');
    console.table({
      total: count.total,
      enabled: count.enabled,
      disabled: count.disabled
    });

    console.log('\n✅ Migration terminée avec succès!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
