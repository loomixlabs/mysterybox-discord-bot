const db = require('./utils/database-pg');

async function checkSchema() {
  console.log('🔍 SCHÉMA DE LA TABLE super_admin_logs\n');
  console.log('='.repeat(80));

  try {
    const schema = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'super_admin_logs'
      ORDER BY ordinal_position
    `);

    console.log('📋 Colonnes:\n');
    console.table(schema);

    // Exemple
    const sample = await db.queryOne(`SELECT * FROM super_admin_logs LIMIT 1`);
    if (sample) {
      console.log('\n📝 Exemple:\n');
      console.table(sample);
    } else {
      console.log('\n⚠️  Aucun log super-admin dans la table');
    }

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkSchema();
