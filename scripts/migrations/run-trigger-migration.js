const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runTriggerMigration() {
  const pool = new Pool({
    user: process.env.DB_USER || 'botuser',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'botdb',
    password: process.env.DB_PASSWORD || 'Discord2025IA@Bot',
    port: process.env.DB_PORT || 5432,
  });

  console.log('🔧 MIGRATION: Trigger auto-update collected_count\n');
  console.log('='.repeat(80));

  try {
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, 'database', 'migrations', 'create-auto-update-collected-count-trigger.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('\n⚙️  Exécution de la migration...\n');

    // Exécuter la migration
    const result = await pool.query(sql);

    console.log('\n✅ Migration exécutée avec succès!\n');

    // Vérifier les triggers créés
    console.log('📋 Triggers créés:');
    const triggers = await pool.query(`
      SELECT
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'collections'
        AND trigger_name LIKE 'trg_collections%'
      ORDER BY trigger_name
    `);
    console.table(triggers.rows);

    console.log('\n✅ RÉSULTAT:');
    console.log('   - Triggers créés et actifs');
    console.log('   - collected_count sera maintenant auto-synchronisé');
    console.log('   - Fonctionne sur INSERT et DELETE de collections\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await pool.end();
    process.exit(1);
  }
}

runTriggerMigration();
